import { getState, nowIso } from "./store";
import type { Application, AuditEvent, Brand, CreditRequest, Customer, DemoState, Evidence, EvidenceStatus, Order, Role, Scope, Settings } from "./schemas";
import {
  alertSchedule,
  cashNow,
  creditSnapshot,
  customerOrders,
  daysLate,
  daysToDue,
  duplicateOf,
  inScope,
  lastPayment,
  matchFor,
  missingFields,
  orderBalance,
  orderCost,
  orderFinance,
  orderMargin,
  toIsoDate,
  weekWindows,
  type CreditStatus,
  type MatchKind,
  type OrderFinance,
} from "./domain";
import { formatDate, formatDateShort, formatMoney } from "../lib/format";
import type { Preferences } from "../lib/preferences";

// Cliente de datos. Hoy lee el store de demostración con una latencia simulada;
// al integrar Spring, cada función pasa a ser un fetch a VITE_API_BASE_URL con el mismo DTO.

const LATENCY_MS = 260;

function respond<T>(build: (s: DemoState) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // ?demo_error=1 fuerza el estado de error para revisarlo en la UI.
      if (new URLSearchParams(window.location.search).has("demo_error")) {
        reject(new Error("No se pudo conectar con el servidor de KeptAI."));
        return;
      }
      try {
        resolve(build(getState()));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Error inesperado"));
      }
    }, LATENCY_MS);
  });
}

const customerOf = (s: DemoState, order: Order | undefined) => s.customers.find((c) => c.id === order?.customerId);
const customerName = (s: DemoState, order: Order | undefined) => customerOf(s, order)?.name ?? "Sin cliente";
const personName = (s: DemoState, id: string | undefined) => s.people.find((p) => p.id === id)?.name ?? null;
const orderOf = (s: DemoState, ev: Evidence) => s.orders.find((o) => o.id === ev.orderId);

/* ---------- Dashboard ---------- */

export type AssistantNote = { id: string; tone: "bad" | "warn" | "info" | "violet"; title: string; detail: string; href: string; date: string | null };
export type ActivityItem = {
  id: string;
  at: string;
  who: string;
  actor: string;
  text: string;
  reference: string;
  amountCents: number | null;
  status: "completado" | "pendiente" | "fallido" | "entregado";
  href: string | null;
};
export type WeekPoint = { label: string; range: string; inCents: number; outCents: number; balanceCents: number; outflows: string[]; inflows: string[] };

export type DashboardDTO = {
  cutDate: string;
  factorMora: number;
  expectedCents: number;
  openOrders: number;
  overdueCents: number;
  disputedCents: number;
  cashCents: number;
  openingCents: number;
  collectedCents: number;
  openingSource: string;
  marginCents: number;
  orderCount: number;
  weeks: WeekPoint[];
  assistant: AssistantNote[];
  activity: ActivityItem[];
};

export function buildWeeks(s: DemoState, scope: Scope): WeekPoint[] {
  const windows = weekWindows(s.cutDate);
  // Pedidos en disputa no se proyectan como cobro: dependen de una negociación.
  const orders = s.orders.filter((o) => inScope(o.brand, scope) && !o.dispute && orderBalance(s, o) > 0);
  let running = cashNow(s, scope).total;
  return windows.map((w) => {
    const fromIso = toIsoDate(w.from);
    const toIso = toIsoDate(w.to);
    // Cobros esperados por vencimiento; lo vencido cae en la primera semana.
    const due = orders.filter((o) => (w.index === 0 ? o.dueDate <= toIso : o.dueDate >= fromIso && o.dueDate <= toIso));
    const inCents = Math.round(due.reduce((sum, o) => sum + orderBalance(s, o), 0) * (1 - s.settings.factorMora));
    const outs = s.outflows.filter((o) => o.week === w.index && inScope(o.brand, scope));
    const outCents = outs.reduce((sum, o) => sum + o.amountCents, 0);
    running += inCents - outCents;
    return {
      label: `Sem ${w.index + 1}`,
      range: `${formatDateShort(w.from)} al ${formatDateShort(w.to)}`,
      inCents,
      outCents,
      balanceCents: running,
      outflows: outs.map((o) => `${o.label} ${formatMoney(o.amountCents, { short: true })}`),
      inflows: due.map((o) => `${o.id} ${formatMoney(orderBalance(s, o), { short: true })}`),
    };
  });
}

function buildAssistant(s: DemoState, scope: Scope, role: Role, notify: Preferences["notify"]): AssistantNote[] {
  const notes: AssistantNote[] = [];
  const live = s.evidences.filter((e) => inScope(e.brand, scope) && e.status !== "descartado" && e.status !== "pago_aplicado");

  if (notify.credito && (role === "gerencia" || role === "vendedor")) {
    const pending = s.creditRequests.filter((r) => r.status === "pendiente" && inScope(s.customers.find((c) => c.id === r.customerId)!.brand, scope));
    for (const r of pending) {
      const c = s.customers.find((x) => x.id === r.customerId)!;
      notes.push({
        id: `cr-${r.id}`,
        tone: "violet",
        title: role === "gerencia" ? `${r.id}: ${c.name} pide crédito por ${formatMoney(r.amountCents)}` : `${r.id} espera decisión de gerencia`,
        detail: `${creditSnapshot(s, c).suggestion ?? "Cliente sin observaciones de crédito."} Solicitada por ${r.requestedBy}.`,
        href: `/clientes/${c.id}`,
        date: r.requestedAt,
      });
    }
  }

  if (notify.duplicados) {
    const dups = live.filter((e) => matchFor(s, e) === "duplicado");
    if (dups.length) {
      notes.push({
        id: "dup",
        tone: "bad",
        title: dups.length === 1 ? `${dups[0].id} parece un comprobante duplicado` : `${dups.length} comprobantes duplicados por revisar`,
        detail: `Misma operación que ${duplicateOf(s, dups[0])?.id}. No reduce el saldo hasta que lo revises.`,
        href: `/conciliacion/${dups[0].id}`,
        date: dups[0].receivedAt,
      });
    }
  }

  if (notify.vencimientos) {
    for (const o of s.orders.filter((o) => inScope(o.brand, scope))) {
      const bal = orderBalance(s, o);
      const fin = orderFinance(s, o);
      const d = daysToDue(s, o);
      const c = customerOf(s, o)!;
      if (fin === "vencido") {
        notes.push({
          id: `due-${o.id}`,
          tone: "bad",
          title: `${c.name} excedió su fecha de pago`,
          detail: `${o.id} venció el ${formatDate(o.dueDate)} (hace ${-d} días) con saldo ${formatMoney(bal)}.${d <= -7 ? " Escalamiento a administración (propuesta)." : ""}`,
          href: `/clientes/${c.id}`,
          date: o.dueDate,
        });
      } else if (fin === "vence_hoy" || fin === "por_vencer") {
        notes.push({
          id: `due-${o.id}`,
          tone: "warn",
          title: d === 0 ? `${o.id} vence hoy` : `${o.id} vence el ${formatDate(o.dueDate)}`,
          detail: `${c.name}: saldo ${formatMoney(bal)}. Aviso preventivo enviado dentro de la app.`,
          href: `/clientes/${c.id}`,
          date: o.dueDate,
        });
      }
    }
  }

  if (notify.sinPedido) {
    const orphan = live.filter((e) => matchFor(s, e) === "huerfano");
    if (orphan.length) {
      notes.push({
        id: "orphan",
        tone: "warn",
        title: `${orphan[0].id}: pago de ${formatMoney(orphan[0].fields.amountCents ?? 0)} sin pedido`,
        detail: "Asígnalo a un pedido o descártalo.",
        href: `/conciliacion/${orphan[0].id}`,
        date: orphan[0].receivedAt,
      });
    }
    for (const e of live.filter((e) => matchFor(s, e) === "monto_no_cuadra")) {
      notes.push({
        id: `mm-${e.id}`,
        tone: "warn",
        title: `${e.id}: el monto no cuadra`,
        detail: `El chat anuncia ${formatMoney(e.declaredAmountCents ?? 0)} y el comprobante dice ${formatMoney(e.fields.amountCents ?? 0)}.`,
        href: `/conciliacion/${e.id}`,
        date: e.receivedAt,
      });
    }
    const drafts = live.filter((e) => e.status === "borrador" && missingFields(e).length);
    if (drafts.length) {
      notes.push({
        id: "drafts",
        tone: "info",
        title: `${drafts.length} ${drafts.length === 1 ? "borrador necesita" : "borradores necesitan"} datos`,
        detail: drafts.map((d) => `${d.id}: falta ${missingFields(d).join(" y ")}`).join(". ") + ".",
        href: `/conciliacion/${drafts[0].id}`,
        date: drafts[0].receivedAt,
      });
    }
  }
  return notes;
}

function activityOf(s: DemoState, a: AuditEvent): ActivityItem {
  const ev = a.evidenceId ? s.evidences.find((e) => e.id === a.evidenceId) : undefined;
  const order = s.orders.find((o) => o.id === a.orderId);
  const customer = a.customerId ? s.customers.find((c) => c.id === a.customerId) : customerOf(s, order);
  const who = customer?.name ?? ev?.fields.payer ?? (a.kind === "configuracion" ? "Configuración" : "Remitente sin identificar");
  const status: ActivityItem["status"] =
    a.kind === "aplicado" || a.kind === "credito_aprobado" || a.kind === "validado" || a.kind === "verificado"
      ? "completado"
      : a.kind === "duplicado" || a.kind === "descartado" || a.kind === "credito_rechazado" || a.kind === "enlace_revocado"
        ? "fallido"
        : a.kind === "entregado" || a.kind === "configuracion" || a.kind === "enlace_creado" || a.kind === "corregido"
          ? "entregado"
          : "pendiente";
  return {
    id: a.id,
    at: a.at,
    who,
    actor: a.by,
    text: a.text,
    reference: [a.evidenceId, a.orderId].filter(Boolean).join(" · "),
    amountCents: a.amountCents,
    status,
    href: a.evidenceId ? `/conciliacion/${a.evidenceId}` : customer ? `/clientes/${customer.id}` : null,
  };
}

export function getDashboard(scope: Scope, role: Role, notify: Preferences["notify"]) {
  return respond<DashboardDTO>((s) => {
    const orders = s.orders.filter((o) => inScope(o.brand, scope));
    const open = orders.filter((o) => orderBalance(s, o) > 0);
    const cash = cashNow(s, scope);
    return {
      cutDate: s.cutDate,
      factorMora: s.settings.factorMora,
      expectedCents: open.filter((o) => !o.dispute).reduce((sum, o) => sum + orderBalance(s, o), 0),
      openOrders: open.length,
      overdueCents: open.filter((o) => orderFinance(s, o) === "vencido").reduce((sum, o) => sum + orderBalance(s, o), 0),
      disputedCents: open.filter((o) => o.dispute).reduce((sum, o) => sum + orderBalance(s, o), 0),
      cashCents: cash.total,
      openingCents: cash.opening,
      collectedCents: cash.collected,
      openingSource: s.openings[0]?.source ?? "",
      marginCents: orders.reduce((sum, o) => sum + orderMargin(o), 0),
      orderCount: orders.length,
      weeks: buildWeeks(s, scope),
      assistant: buildAssistant(s, scope, role, notify),
      activity: s.audit
        .filter((a) => (a.brand ? inScope(a.brand, scope) : scope === "consolidado") && !["corregido", "validado", "verificado", "configuracion"].includes(a.kind))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 6)
        .map((a) => activityOf(s, a)),
    };
  });
}

/* ---------- Tablero de cobro ---------- */

export type BoardColumnId = Exclude<EvidenceStatus, "descartado">;
export type BoardCard = {
  id: string;
  kind: Evidence["kind"];
  channel: string | null;
  orderId: string | null;
  customer: string;
  dueDate: string | null;
  daysToDue: number | null;
  amountCents: number | null;
  seller: string | null;
  priority: "urgente" | "normal";
  match: MatchKind;
  validated: boolean;
  status: EvidenceStatus;
  receivedAt: string;
};
export type BoardDTO = { columns: Array<{ id: BoardColumnId; title: string; cards: BoardCard[] }>; closed: number };

const COLUMNS: Array<{ id: BoardColumnId; title: string }> = [
  { id: "borrador", title: "Borrador (IA)" },
  { id: "comprobante_pendiente", title: "Comprobante pendiente" },
  { id: "pago_verificado", title: "Pago verificado" },
  { id: "pago_aplicado", title: "Pago aplicado" },
];

function toCard(s: DemoState, ev: Evidence): BoardCard {
  const order = orderOf(s, ev);
  const match = matchFor(s, ev);
  const d = order ? daysToDue(s, order) : null;
  const urgent =
    ev.status !== "pago_aplicado" && (match === "duplicado" || match === "huerfano" || match === "monto_no_cuadra" || (d !== null && d < 0));
  return {
    id: ev.id,
    kind: ev.kind,
    channel: ev.fields.channel,
    orderId: ev.orderId,
    customer: order ? customerName(s, order) : (ev.fields.payer ?? "Remitente sin identificar"),
    dueDate: order?.dueDate ?? null,
    daysToDue: d,
    amountCents: ev.fields.amountCents,
    seller: personName(s, order?.sellerId ?? (ev.brand === "corpotex" ? "u-rosa" : "u-luis")),
    priority: urgent ? "urgente" : "normal",
    match,
    validated: Boolean(ev.validatedBy),
    status: ev.status,
    receivedAt: ev.receivedAt,
  };
}

export function getBoard(scope: Scope) {
  return respond<BoardDTO>((s) => {
    const evs = s.evidences.filter((e) => inScope(e.brand, scope));
    return {
      columns: COLUMNS.map((c) => ({
        ...c,
        cards: evs
          .filter((e) => e.status === c.id)
          .map((e) => toCard(s, e))
          .sort((a, b) => (a.priority === b.priority ? b.receivedAt.localeCompare(a.receivedAt) : a.priority === "urgente" ? -1 : 1)),
      })),
      closed: evs.filter((e) => e.status === "descartado").length,
    };
  });
}

/* ---------- Lista de pedidos ---------- */

export type OrderRow = {
  id: string;
  customerId: string;
  customer: string;
  brand: Brand;
  line: string;
  description: string;
  seller: string | null;
  issuedOn: string;
  deliveredOn: string;
  dueDate: string;
  saleCents: number;
  paidCents: number;
  balanceCents: number;
  finance: OrderFinance;
  daysToDue: number;
  lastPaymentAt: string | null;
  daysLate: number | null;
  dispute: Order["dispute"];
};

function orderRow(s: DemoState, o: Order): OrderRow {
  const bal = orderBalance(s, o);
  return {
    id: o.id,
    customerId: o.customerId,
    customer: customerName(s, o),
    brand: o.brand,
    line: o.line,
    description: o.description,
    seller: personName(s, o.sellerId),
    issuedOn: o.issuedOn,
    deliveredOn: o.deliveredOn,
    dueDate: o.dueDate,
    saleCents: o.saleCents,
    paidCents: o.saleCents - bal,
    balanceCents: bal,
    finance: orderFinance(s, o),
    daysToDue: daysToDue(s, o),
    lastPaymentAt: lastPayment(s, o.id)?.at ?? null,
    daysLate: daysLate(s, o),
    dispute: o.dispute,
  };
}

export function getOrders(scope: Scope) {
  return respond<OrderRow[]>((s) =>
    s.orders
      .filter((o) => inScope(o.brand, scope))
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))
      .map((o) => orderRow(s, o)),
  );
}

/* ---------- Conciliación ---------- */

export type EvidenceDetailDTO = {
  evidence: Evidence;
  appliedBy: string | null;
  match: MatchKind;
  duplicateOfId: string | null;
  order: (Order & { customer: string; balanceCents: number; daysToDue: number; seller: string | null }) | null;
  missing: string[];
  openOrders: Array<{ id: string; label: string }>;
};

export function getEvidence(id: string) {
  return respond<EvidenceDetailDTO | null>((s) => {
    const ev = s.evidences.find((e) => e.id === id);
    if (!ev) return null;
    const order = orderOf(s, ev);
    return {
      evidence: ev,
      appliedBy: s.applications.find((a) => a.evidenceId === ev.id)?.by ?? null,
      match: matchFor(s, ev),
      duplicateOfId: duplicateOf(s, ev)?.id ?? null,
      order: order
        ? { ...order, customer: customerName(s, order), balanceCents: orderBalance(s, order), daysToDue: daysToDue(s, order), seller: personName(s, order.sellerId) }
        : null,
      missing: missingFields(ev),
      openOrders: s.orders
        .filter((o) => o.brand === ev.brand && orderBalance(s, o) > 0)
        .map((o) => ({ id: o.id, label: `${o.id} · ${customerName(s, o)} · saldo ${formatMoney(orderBalance(s, o))}` })),
    };
  });
}

export function getQueue(scope: Scope) {
  const rank: Record<EvidenceStatus, number> = { comprobante_pendiente: 0, borrador: 1, pago_verificado: 2, pago_aplicado: 3, descartado: 4 };
  return respond((s) =>
    s.evidences
      .filter((e) => inScope(e.brand, scope))
      .sort((a, b) => rank[a.status] - rank[b.status] || b.receivedAt.localeCompare(a.receivedAt))
      .map((e) => toCard(s, e)),
  );
}

/* ---------- Clientes ---------- */

export type CustomerRow = {
  id: string;
  name: string;
  brand: Brand;
  kind: Customer["kind"];
  seller: string | null;
  since: string;
  termDays: number;
  creditLimitCents: number;
  usedCents: number;
  overdueCents: number;
  maxOverdueDays: number;
  status: CreditStatus;
  avgDaysLate: number | null;
  lastPaymentAt: string | null;
  nextDue: { id: string; date: string; overdue: boolean } | null;
  pendingRequest: string | null;
};

export function getCustomers(scope: Scope) {
  return respond<CustomerRow[]>((s) =>
    s.customers
      .filter((c) => inScope(c.brand, scope))
      .map((c) => {
        const snap = creditSnapshot(s, c);
        return {
          id: c.id,
          name: c.name,
          brand: c.brand,
          kind: c.kind,
          seller: personName(s, c.sellerId),
          since: c.since,
          termDays: c.termDays,
          creditLimitCents: c.creditLimitCents,
          usedCents: snap.usedCents,
          overdueCents: snap.overdueCents,
          maxOverdueDays: snap.maxOverdueDays,
          status: snap.status,
          avgDaysLate: snap.avgDaysLate,
          lastPaymentAt: snap.lastPaymentAt,
          nextDue: snap.nextDue ? { id: snap.nextDue.id, date: snap.nextDue.dueDate, overdue: snap.nextDue.dueDate < s.cutDate } : null,
          pendingRequest: s.creditRequests.find((r) => r.customerId === c.id && r.status === "pendiente")?.id ?? null,
        };
      })
      .sort((a, b) => b.overdueCents - a.overdueCents || b.usedCents - a.usedCents),
  );
}

export type TimelineItem = {
  id: string;
  at: string;
  kind: "pedido" | "entrega" | "vencimiento" | "pago" | "credito" | "disputa" | "enlace" | "alerta";
  title: string;
  detail: string;
  amountCents: number | null;
  tone: "ok" | "warn" | "bad" | "violet" | "neutral" | "info";
  future: boolean;
};

export type CustomerDetailDTO = {
  cutDate: string;
  customer: Customer;
  seller: string | null;
  snapshot: ReturnType<typeof creditSnapshot>;
  orders: Array<OrderRow & { alerts: ReturnType<typeof alertSchedule> }>;
  payments: Array<Application & { evidence: string | null }>;
  requests: CreditRequest[];
  links: Array<{ token: string; createdBy: string; createdAt: string; expiresAt: string; revokedAt: string | null; state: "activo" | "vencido" | "revocado" }>;
  timeline: TimelineItem[];
  termOptions: number[];
};

export function getCustomer(id: string) {
  return respond<CustomerDetailDTO | null>((s) => {
    const c = s.customers.find((x) => x.id === id);
    if (!c) return null;
    const orders = customerOrders(s, c.id);
    const payments = s.applications
      .filter((a) => orders.some((o) => o.id === a.orderId))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => ({ ...a, evidence: a.evidenceId }));
    const requests = s.creditRequests.filter((r) => r.customerId === c.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    const now = nowIso();

    const timeline: TimelineItem[] = [];
    for (const o of orders) {
      timeline.push({ id: `${o.id}-p`, at: `${o.issuedOn}T09:00:00`, kind: "pedido", title: `Pedido ${o.id}`, detail: o.description, amountCents: o.saleCents, tone: "neutral", future: false });
      timeline.push({ id: `${o.id}-e`, at: `${o.deliveredOn}T12:00:00`, kind: "entrega", title: `Entrega de ${o.id}`, detail: `Inicia el plazo de ${daysLateLabel(o)}`, amountCents: null, tone: "info", future: o.deliveredOn > s.cutDate });
      const bal = orderBalance(s, o);
      if (bal > 0) {
        const d = daysToDue(s, o);
        timeline.push({
          id: `${o.id}-v`,
          at: `${o.dueDate}T23:59:00`,
          kind: "vencimiento",
          title: d < 0 ? `${o.id} vencido` : `Vence ${o.id}`,
          detail: `Saldo ${formatMoney(bal)}`,
          amountCents: bal,
          tone: d < 0 ? "bad" : d <= 3 ? "warn" : "neutral",
          future: o.dueDate > s.cutDate,
        });
      }
      if (o.dispute) {
        timeline.push({ id: `${o.id}-d`, at: `${o.dispute.since}T10:00:00`, kind: "disputa", title: `Disputa en ${o.id}`, detail: o.dispute.note, amountCents: null, tone: "warn", future: false });
      }
    }
    for (const a of payments) {
      timeline.push({
        id: a.id,
        at: a.at,
        kind: "pago",
        title: `Pago aplicado a ${a.orderId}`,
        detail: `${a.channel}${a.evidenceId ? ` · ${a.evidenceId}` : " · registro histórico"} · por ${a.by}`,
        amountCents: a.amountCents,
        tone: "ok",
        future: false,
      });
    }
    for (const r of requests) {
      timeline.push({ id: `${r.id}-s`, at: r.requestedAt, kind: "credito", title: `${r.id}: solicitud de crédito`, detail: `${r.requestedBy} · ${r.termDays} días · ${r.reason}`, amountCents: r.amountCents, tone: "violet", future: false });
      if (r.decidedAt) {
        timeline.push({
          id: `${r.id}-d`,
          at: r.decidedAt,
          kind: "credito",
          title: `${r.id} ${r.status === "aprobada" ? "aprobada" : "rechazada"}`,
          detail: `${r.decidedBy}: ${r.decisionNote}`,
          amountCents: null,
          tone: r.status === "aprobada" ? "ok" : "bad",
          future: false,
        });
      }
    }
    for (const l of s.shareLinks.filter((l) => l.customerId === c.id)) {
      timeline.push({ id: `${l.token}-c`, at: l.createdAt, kind: "enlace", title: "Estado de cuenta compartido", detail: `Por ${l.createdBy}`, amountCents: null, tone: "info", future: false });
    }
    timeline.sort((a, b) => b.at.localeCompare(a.at));

    return {
      cutDate: s.cutDate,
      customer: c,
      seller: personName(s, c.sellerId),
      snapshot: creditSnapshot(s, c),
      orders: orders.map((o) => ({ ...orderRow(s, o), alerts: alertSchedule(s, o) })),
      payments,
      requests,
      links: s.shareLinks
        .filter((l) => l.customerId === c.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => ({ ...l, state: l.revokedAt ? "revocado" : l.expiresAt < now ? "vencido" : "activo" })),
      timeline,
      termOptions: s.settings.termOptions,
    };

    function daysLateLabel(o: Order) {
      return `${c!.termDays} días (vence ${formatDate(o.dueDate)})`;
    }
  });
}

/* ---------- Estado de cuenta compartido (vista del cliente) ---------- */

export type StatementDTO =
  | { ok: false; reason: "no_existe" | "revocado" | "vencido" }
  | {
      ok: true;
      customer: string;
      brand: Brand;
      generatedAt: string;
      expiresAt: string;
      balanceCents: number;
      overdueCents: number;
      nextDue: { id: string; date: string; amountCents: number } | null;
      orders: Array<{ id: string; description: string; issuedOn: string; deliveredOn: string; dueDate: string; saleCents: number; paidCents: number; balanceCents: number; state: "Pagado" | "Vencido" | "Por pagar" | "En revisión" }>;
      payments: Array<{ id: string; at: string; orderId: string; amountCents: number; channel: string }>;
    };

export function getStatement(token: string) {
  return respond<StatementDTO>((s) => {
    const link = s.shareLinks.find((l) => l.token === token);
    if (!link) return { ok: false, reason: "no_existe" };
    if (link.revokedAt) return { ok: false, reason: "revocado" };
    if (link.expiresAt < nowIso()) return { ok: false, reason: "vencido" };
    const c = s.customers.find((x) => x.id === link.customerId)!;
    const orders = customerOrders(s, c.id);
    const snap = creditSnapshot(s, c);
    return {
      ok: true,
      customer: c.name,
      brand: c.brand,
      generatedAt: nowIso(),
      expiresAt: link.expiresAt,
      balanceCents: snap.usedCents,
      overdueCents: snap.overdueCents,
      nextDue: snap.nextDue ? { id: snap.nextDue.id, date: snap.nextDue.dueDate, amountCents: orderBalance(s, snap.nextDue) } : null,
      orders: orders.map((o) => {
        const bal = orderBalance(s, o);
        const fin = orderFinance(s, o);
        return {
          id: o.id,
          description: o.description,
          issuedOn: o.issuedOn,
          deliveredOn: o.deliveredOn,
          dueDate: o.dueDate,
          saleCents: o.saleCents,
          paidCents: o.saleCents - bal,
          balanceCents: bal,
          state: fin === "cobrado" ? "Pagado" : fin === "en_disputa" ? "En revisión" : fin === "vencido" ? "Vencido" : "Por pagar",
        };
      }),
      payments: s.applications
        .filter((a) => orders.some((o) => o.id === a.orderId))
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((a) => ({ id: a.id, at: a.at, orderId: a.orderId, amountCents: a.amountCents, channel: a.channel })),
    };
  });
}

/* ---------- Resultado ---------- */

export type ResultRow = {
  id: string;
  customer: string;
  customerId: string;
  brand: Brand;
  line: string;
  description: string;
  modality: Order["modality"];
  issuedOn: string;
  saleCents: number;
  costCents: number;
  costs: Order["costs"];
  marginCents: number;
  collectedCents: number;
  balanceCents: number;
  dueDate: string;
};
export type ResultsDTO = {
  cutDate: string;
  rows: ResultRow[];
  byBrand: Array<{ brand: Brand; saleCents: number; marginCents: number; collectedCents: number }>;
  byLine: Array<{ line: string; saleCents: number; marginCents: number; orders: number }>;
  workshop: null | {
    orderIds: string[];
    costCents: number;
    internalChargeCents: number;
    workshopResultCents: number;
    commercialResultCents: number;
    consolidatedMarginCents: number;
  };
};

export function getResults(scope: Scope) {
  return respond<ResultsDTO>((s) => {
    const orders = s.orders.filter((o) => inScope(o.brand, scope)).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
    const rows: ResultRow[] = orders.map((o) => ({
      id: o.id,
      customer: customerName(s, o),
      customerId: o.customerId,
      brand: o.brand,
      line: o.line,
      description: o.description,
      modality: o.modality,
      issuedOn: o.issuedOn,
      saleCents: o.saleCents,
      costCents: orderCost(o),
      costs: o.costs,
      marginCents: orderMargin(o),
      collectedCents: o.saleCents - orderBalance(s, o),
      balanceCents: orderBalance(s, o),
      dueDate: o.dueDate,
    }));
    const brands: Brand[] = scope === "consolidado" ? ["corpotex", "unicrack"] : [scope];
    const own = orders.filter((o) => o.modality === "propia" && o.internalChargeCents != null);
    const charge = own.reduce((sum, o) => sum + (o.internalChargeCents ?? 0), 0);
    const cost = own.reduce((sum, o) => sum + orderCost(o), 0);
    const sale = own.reduce((sum, o) => sum + o.saleCents, 0);
    const lines = [...new Set(orders.map((o) => o.line))];
    return {
      cutDate: s.cutDate,
      rows,
      byBrand: brands.map((b) => {
        const bo = orders.filter((o) => o.brand === b);
        return {
          brand: b,
          saleCents: bo.reduce((x, o) => x + o.saleCents, 0),
          marginCents: bo.reduce((x, o) => x + orderMargin(o), 0),
          collectedCents: bo.reduce((x, o) => x + o.saleCents - orderBalance(s, o), 0),
        };
      }),
      byLine: lines.map((line) => {
        const lo = orders.filter((o) => o.line === line);
        return { line, saleCents: lo.reduce((x, o) => x + o.saleCents, 0), marginCents: lo.reduce((x, o) => x + orderMargin(o), 0), orders: lo.length };
      }),
      workshop: own.length
        ? {
            orderIds: own.map((o) => o.id),
            costCents: cost,
            internalChargeCents: charge,
            workshopResultCents: charge - cost,
            commercialResultCents: sale - charge,
            consolidatedMarginCents: sale - cost,
          }
        : null,
    };
  });
}

/** CSV para el sistema contable: IDs, marca, moneda, fechas y estado. */
export function ordersCsv(scope: Scope) {
  const s = getState();
  const header = ["pedido", "marca", "cliente", "linea", "modalidad", "moneda", "fecha_pedido", "fecha_entrega", "vencimiento", "venta", "costo", "margen", "cobrado", "saldo", "estado", "fecha_corte"];
  const rows = s.orders
    .filter((o) => inScope(o.brand, scope))
    .map((o) => {
      const bal = orderBalance(s, o);
      const n = (c: number) => (c / 100).toFixed(2);
      return [o.id, o.brand, customerName(s, o), o.line, o.modality, "PEN", o.issuedOn, o.deliveredOn, o.dueDate, n(o.saleCents), n(orderCost(o)), n(orderMargin(o)), n(o.saleCents - bal), n(bal), orderFinance(s, o), s.cutDate];
    });
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

/* ---------- Perfil y configuración ---------- */

export type ProfileDTO = {
  activity: ActivityItem[];
  counts: { validados: number; aplicados: number; corregidos: number; solicitudes: number; decisiones: number };
  settings: Settings;
  ownOrders: Array<{ id: string; customer: string; costCents: number; internalChargeCents: number; saleCents: number }>;
};

export function getProfile(name: string) {
  return respond<ProfileDTO>((s) => {
    const mine = s.audit.filter((a) => a.by === name).sort((a, b) => b.at.localeCompare(a.at));
    const count = (kinds: AuditEvent["kind"][]) => mine.filter((a) => kinds.includes(a.kind)).length;
    return {
      activity: mine.slice(0, 30).map((a) => activityOf(s, a)),
      counts: {
        validados: count(["validado"]),
        aplicados: count(["aplicado"]),
        corregidos: count(["corregido"]),
        solicitudes: count(["credito_solicitado"]),
        decisiones: count(["credito_aprobado", "credito_rechazado"]),
      },
      settings: s.settings,
      ownOrders: s.orders
        .filter((o) => o.modality === "propia")
        .map((o) => ({ id: o.id, customer: customerName(s, o), costCents: orderCost(o), internalChargeCents: o.internalChargeCents ?? 0, saleCents: o.saleCents })),
    };
  });
}
