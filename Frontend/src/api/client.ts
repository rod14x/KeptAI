import { getState, nowIso } from "./store";
import type { AuditEvent, Brand, CollectionAlert, Customer, DemoState, Evidence, EvidenceStatus, Order, OrderState, OutgoingMessage, Role, Scope, Settings } from "./schemas";
import {
  anticipoRequired,
  appliedCents,
  cashNow,
  creditSnapshot,
  customerOrders,
  daysLate,
  daysToDue,
  dueDateOf,
  duplicateOf,
  gatekeeperPasses,
  inScope,
  isConfirmed,
  lastPayment,
  matchFor,
  missingFields,
  orderBalance,
  orderCost,
  orderFinance,
  orderMargin,
  perceivedMargin,
  toIsoDate,
  weekWindows,
  IN_REVIEW,
  type CreditStatus,
  type MatchKind,
  type OrderFinance,
} from "./domain";
import { formatDate, formatDateShort, formatMoney } from "../lib/format";
import type { Preferences } from "../lib/preferences";

// Cliente de datos. Hoy lee el store de demostración con una latencia simulada;
// al integrar Spring, cada función pasa a ser un fetch a VITE_API_BASE_URL con el mismo DTO.

const LATENCY_MS = 240;

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
/** Órdenes sin costo registrado no entran a los totales de margen (no se inventa un costo). */
export const hasCost = (o: Order) => orderCost(o) > 0;

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
  factorCobro: number;
  expectedCents: number;
  openOrders: number;
  overdueCents: number;
  pipelineCents: number;
  pipelineCount: number;
  cashCents: number;
  openingCents: number;
  collectedCents: number;
  openingSource: string;
  marginCents: number;
  perceivedCents: number;
  orderCount: number;
  weeks: WeekPoint[];
  assistant: AssistantNote[];
  activity: ActivityItem[];
};

export function buildWeeks(s: DemoState, scope: Scope): WeekPoint[] {
  const windows = weekWindows(s.cutDate);
  // Solo lo despachado tiene vencimiento; lo que está en producción aún no se proyecta.
  const orders = s.orders.filter((o) => inScope(o.brand, scope) && dueDateOf(o) && orderBalance(s, o) > 0);
  let running = cashNow(s, scope).total;
  return windows.map((w) => {
    const fromIso = toIsoDate(w.from);
    const toIso = toIsoDate(w.to);
    const due = orders.filter((o) => {
      const d = dueDateOf(o)!;
      return w.index === 0 ? d <= toIso : d >= fromIso && d <= toIso;
    });
    const inCents = Math.round(due.reduce((sum, o) => sum + orderBalance(s, o), 0) * s.settings.factorCobro);
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
  const orders = s.orders.filter((o) => inScope(o.brand, scope));
  const live = s.evidences.filter((e) => inScope(e.brand, scope) && e.status !== "descartado" && e.status !== "aplicado");

  if (notify.credito) {
    for (const o of orders.filter((x) => x.estado === "pendiente_aprobacion")) {
      const c = customerOf(s, o)!;
      const snap = creditSnapshot(s, c);
      notes.push({
        id: `pend-${o.id}`,
        tone: snap.status === "en_mora" ? "warn" : "violet",
        title: role === "vendedor" ? `${o.id} espera tu confirmación` : `${o.id} espera confirmación del vendedor`,
        detail: `${c.name}, ${formatMoney(o.saleCents)}. ${snap.status === "en_mora" ? "Cliente en mora: el vendedor verá el aviso antes de dar crédito." : "Historial al día."}`,
        href: `/pedidos/${o.id}`,
        date: o.issuedOn,
      });
    }
    for (const o of orders.filter((x) => x.estado === "retenida")) {
      const pending = Math.max(anticipoRequired(o) - appliedCents(s, o.id), 0);
      notes.push({
        id: `ret-${o.id}`,
        tone: "info",
        title: `${o.id} retenida: falta anticipo de ${formatMoney(pending)}`,
        detail: "No entra a producción hasta que Administración verifique y aplique el anticipo.",
        href: `/pedidos/${o.id}`,
        date: o.issuedOn,
      });
    }
  }

  if (notify.duplicados && role !== "vendedor") {
    const dups = live.filter((e) => matchFor(s, e) === "duplicado");
    if (dups.length) {
      notes.push({
        id: "dup",
        tone: "bad",
        title: dups.length === 1 ? `${dups[0].id} parece un comprobante duplicado` : `${dups.length} comprobantes duplicados por revisar`,
        detail: `Mismo código, monto y fecha que ${duplicateOf(s, dups[0])?.id}. No reduce el saldo.`,
        href: `/conciliacion/${dups[0].id}`,
        date: dups[0].receivedAt,
      });
    }
  }

  if (notify.vencimientos) {
    for (const o of orders) {
      const fin = orderFinance(s, o);
      const c = customerOf(s, o)!;
      const due = dueDateOf(o);
      if (fin === "vencido" && due) {
        notes.push({
          id: `due-${o.id}`,
          tone: "bad",
          title: `${c.name} excedió su fecha de pago`,
          detail: `${o.id} venció el ${formatDate(due)} (hace ${-(daysToDue(s, o) ?? 0)} días) con saldo ${formatMoney(orderBalance(s, o))}.`,
          href: `/clientes/${c.id}`,
          date: due,
        });
      } else if ((fin === "vence_hoy" || fin === "por_vencer") && due) {
        notes.push({
          id: `due-${o.id}`,
          tone: "warn",
          title: fin === "vence_hoy" ? `${o.id} vence hoy` : `${o.id} vence el ${formatDate(due)}`,
          detail: `${c.name}: saldo ${formatMoney(orderBalance(s, o))}. Recordatorio por WhatsApp programado.`,
          href: `/clientes/${c.id}`,
          date: due,
        });
      }
    }
  }

  if (notify.sinPedido && role !== "vendedor") {
    const review = live.filter((e) => ["sin_orden", "no_cuadra", "incompleto"].includes(matchFor(s, e)));
    if (review.length) {
      notes.push({
        id: "review",
        tone: "warn",
        title: `${review.length} ${review.length === 1 ? "comprobante en revisión" : "comprobantes en revisión"}`,
        detail: review.map((e) => `${e.id}: ${MATCH_TEXT[matchFor(s, e)]}`).join(". ") + ".",
        href: `/conciliacion/${review[0].id}`,
        date: review[0].receivedAt,
      });
    }
    const errors = s.messages.filter((m) => m.estado === "error" && inScope(s.customers.find((c) => c.id === m.customerId)!.brand, scope));
    if (errors.length) {
      notes.push({
        id: "msg-error",
        tone: "bad",
        title: `${errors.length} ${errors.length === 1 ? "mensaje de WhatsApp falló" : "mensajes de WhatsApp fallaron"}`,
        detail: errors[0].error ?? "Revisa y reintenta desde Cobranza.",
        href: "/cobranza?vista=mensajes",
        date: errors[0].programadoPara,
      });
    }
  }
  return notes;
}

const MATCH_TEXT: Record<MatchKind, string> = {
  total: "cubre el saldo",
  parcial: "pago parcial",
  duplicado: "duplicado",
  sin_orden: "sin orden",
  no_cuadra: "el monto no cuadra",
  excede: "excede el saldo",
  incompleto: "faltan datos",
};

function activityOf(s: DemoState, a: AuditEvent): ActivityItem {
  const ev = a.evidenceId ? s.evidences.find((e) => e.id === a.evidenceId) : undefined;
  const order = s.orders.find((o) => o.id === a.orderId);
  const customer = a.customerId ? s.customers.find((c) => c.id === a.customerId) : customerOf(s, order);
  const who = customer?.name ?? ev?.fields.payer ?? (a.kind === "configuracion" ? "Configuración" : "Remitente sin identificar");
  const ok: AuditEvent["kind"][] = ["aplicado", "credito_aprobado", "verificado", "orden_confirmada", "alerta_resuelta"];
  const bad: AuditEvent["kind"][] = ["duplicado", "descartado", "credito_rechazado", "enlace_revocado"];
  const neutral: AuditEvent["kind"][] = ["despacho", "produccion", "configuracion", "enlace_creado", "corregido", "mensaje"];
  return {
    id: a.id,
    at: a.at,
    who,
    actor: a.by,
    text: a.text,
    reference: [a.evidenceId, a.orderId].filter(Boolean).join(" · "),
    amountCents: a.amountCents,
    status: ok.includes(a.kind) ? "completado" : bad.includes(a.kind) ? "fallido" : neutral.includes(a.kind) ? "entregado" : "pendiente",
    href: a.evidenceId ? `/conciliacion/${a.evidenceId}` : a.orderId ? `/pedidos/${a.orderId}` : customer ? `/clientes/${customer.id}` : null,
  };
}

export function getDashboard(scope: Scope, role: Role, notify: Preferences["notify"]) {
  return respond<DashboardDTO>((s) => {
    const orders = s.orders.filter((o) => inScope(o.brand, scope));
    const confirmed = orders.filter(isConfirmed);
    const dispatchedOpen = confirmed.filter((o) => dueDateOf(o) && orderBalance(s, o) > 0);
    const pipeline = confirmed.filter((o) => !o.despacho);
    const cash = cashNow(s, scope);
    const withCost = confirmed.filter(hasCost);
    return {
      cutDate: s.cutDate,
      factorCobro: s.settings.factorCobro,
      expectedCents: dispatchedOpen.reduce((sum, o) => sum + orderBalance(s, o), 0),
      openOrders: dispatchedOpen.length,
      overdueCents: dispatchedOpen.filter((o) => orderFinance(s, o) === "vencido").reduce((sum, o) => sum + orderBalance(s, o), 0),
      pipelineCents: pipeline.reduce((sum, o) => sum + orderBalance(s, o), 0),
      pipelineCount: pipeline.length,
      cashCents: cash.total,
      openingCents: cash.opening,
      collectedCents: cash.collected,
      openingSource: s.openings[0]?.source ?? "",
      marginCents: withCost.reduce((sum, o) => sum + orderMargin(o), 0),
      perceivedCents: withCost.reduce((sum, o) => sum + perceivedMargin(s, o), 0),
      orderCount: withCost.length,
      weeks: buildWeeks(s, scope),
      assistant: buildAssistant(s, scope, role, notify),
      activity: s.audit
        .filter((a) => (a.brand ? inScope(a.brand, scope) : scope === "consolidado") && !["corregido", "configuracion"].includes(a.kind))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 6)
        .map((a) => activityOf(s, a)),
    };
  });
}

/* ---------- Órdenes ---------- */

export type OrderColumnId = "por_confirmar" | "retenida" | "en_produccion" | "por_cobrar" | "cobrada";

export type OrderCard = {
  id: string;
  customerId: string;
  customer: string;
  brand: Brand;
  description: string;
  saleCents: number;
  balanceCents: number;
  estado: OrderState;
  finance: OrderFinance;
  issuedOn: string;
  entregaSolicitada: string | null;
  dueDate: string | null;
  daysToDue: number | null;
  seller: string | null;
  origen: "whatsapp" | "manual" | "historico";
  faltantes: number;
  clienteEnMora: boolean;
  anticipoPendienteCents: number;
};

function orderCard(s: DemoState, o: Order): OrderCard {
  const c = customerOf(s, o)!;
  return {
    id: o.id,
    customerId: o.customerId,
    customer: c.name,
    brand: o.brand,
    description: o.description,
    saleCents: o.saleCents,
    balanceCents: orderBalance(s, o),
    estado: o.estado,
    finance: orderFinance(s, o),
    issuedOn: o.issuedOn,
    entregaSolicitada: o.fechaEntregaSolicitada,
    dueDate: dueDateOf(o),
    daysToDue: daysToDue(s, o),
    seller: personName(s, o.sellerId),
    origen: o.hoja?.origen ?? "historico",
    faltantes: o.hoja?.estado === "borrador" ? o.hoja.faltantes.length : 0,
    clienteEnMora: creditSnapshot(s, c).status === "en_mora",
    anticipoPendienteCents: Math.max(anticipoRequired(o) - appliedCents(s, o.id), 0),
  };
}

export function columnOf(s: DemoState, o: Order): OrderColumnId | null {
  if (o.estado === "rechazada") return null;
  if (o.estado === "pendiente_aprobacion") return "por_confirmar";
  if (o.estado === "retenida") return "retenida";
  if (o.estado === "en_produccion") return "en_produccion";
  return orderBalance(s, o) > 0 ? "por_cobrar" : "cobrada";
}

export type OrderBoardDTO = { columns: Array<{ id: OrderColumnId; title: string; cards: OrderCard[] }>; rejected: number };

const ORDER_COLUMNS: Array<{ id: OrderColumnId; title: string }> = [
  { id: "por_confirmar", title: "Por confirmar" },
  { id: "retenida", title: "Retenida" },
  { id: "en_produccion", title: "En producción" },
  { id: "por_cobrar", title: "Por cobrar" },
  { id: "cobrada", title: "Cobrada" },
];

export function getOrderBoard(scope: Scope) {
  return respond<OrderBoardDTO>((s) => {
    const orders = s.orders.filter((o) => inScope(o.brand, scope));
    return {
      columns: ORDER_COLUMNS.map((c) => {
        let cards = orders.filter((o) => columnOf(s, o) === c.id).map((o) => orderCard(s, o));
        // Lo urgente primero: vencidos y por vencer arriba; lo cobrado, lo más reciente.
        cards = cards.sort((a, b) =>
          c.id === "por_cobrar" ? (a.dueDate ?? "").localeCompare(b.dueDate ?? "") : b.issuedOn.localeCompare(a.issuedOn),
        );
        return { ...c, cards: c.id === "cobrada" ? cards.slice(0, 6) : cards };
      }),
      rejected: orders.filter((o) => o.estado === "rechazada").length,
    };
  });
}

export type OrderRow = OrderCard & {
  line: string;
  despachoOn: string | null;
  paidCents: number;
  lastPaymentAt: string | null;
  daysLate: number | null;
};

export function getOrders(scope: Scope) {
  return respond<OrderRow[]>((s) =>
    s.orders
      .filter((o) => inScope(o.brand, scope))
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))
      .map((o) => ({
        ...orderCard(s, o),
        line: o.line,
        despachoOn: o.despacho?.fecha ?? null,
        paidCents: appliedCents(s, o.id),
        lastPaymentAt: lastPayment(s, o.id)?.at ?? null,
        daysLate: daysLate(s, o),
      })),
  );
}

export type OrderDetailDTO = {
  cutDate: string;
  order: Order;
  customer: Customer;
  seller: string | null;
  card: OrderCard;
  credit: ReturnType<typeof creditSnapshot>;
  paidCents: number;
  anticipoRequeridoCents: number;
  gatekeeper: boolean;
  costCents: number;
  marginCents: number;
  perceivedCents: number;
  payments: Array<{ id: string; at: string; amountCents: number; channel: string; by: string; evidenceId: string | null }>;
  pendingEvidence: Array<{ id: string; amountCents: number | null; status: EvidenceStatus; match: MatchKind; receivedAt: string }>;
  messages: OutgoingMessage[];
  alerts: CollectionAlert[];
  plazoDefecto: number;
};

export function getOrder(id: string) {
  return respond<OrderDetailDTO | null>((s) => {
    const o = s.orders.find((x) => x.id === id);
    if (!o) return null;
    const c = customerOf(s, o)!;
    return {
      cutDate: s.cutDate,
      order: o,
      customer: c,
      seller: personName(s, o.sellerId),
      card: orderCard(s, o),
      // El aviso de crédito no cuenta esta misma orden como deuda.
      credit: creditSnapshot(s, c),
      paidCents: appliedCents(s, o.id),
      anticipoRequeridoCents: anticipoRequired(o),
      gatekeeper: gatekeeperPasses(s, o),
      costCents: orderCost(o),
      marginCents: orderMargin(o),
      perceivedCents: perceivedMargin(s, o),
      payments: s.applications
        .filter((a) => a.orderId === o.id)
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((a) => ({ id: a.id, at: a.at, amountCents: a.amountCents, channel: a.channel, by: a.by, evidenceId: a.evidenceId })),
      pendingEvidence: s.evidences
        .filter((e) => e.orderId === o.id && (e.status === "recibido" || e.status === "verificado_banco"))
        .map((e) => ({ id: e.id, amountCents: e.fields.amountCents, status: e.status, match: matchFor(s, e), receivedAt: e.receivedAt })),
      messages: s.messages.filter((m) => m.orderId === o.id).sort((a, b) => a.programadoPara.localeCompare(b.programadoPara)),
      alerts: s.alerts.filter((a) => a.orderId === o.id),
      plazoDefecto: s.settings.plazoDefecto,
    };
  });
}

/* ---------- Taller ---------- */

export type TallerOrder = {
  id: string;
  customer: string;
  brand: Brand;
  description: string;
  items: Order["items"];
  modality: Order["modality"];
  issuedOn: string;
  inicioProduccion: string | null;
  entregaSolicitada: string | null;
  plazoDias: number | null;
  despacho: Order["despacho"];
  anticipoPendienteCents: number;
};

export function getTaller(scope: Scope) {
  return respond((s) => {
    const map = (o: Order): TallerOrder => ({
      id: o.id,
      customer: customerName(s, o),
      brand: o.brand,
      description: o.description,
      items: o.items,
      modality: o.modality,
      issuedOn: o.issuedOn,
      inicioProduccion: o.inicioProduccion,
      entregaSolicitada: o.fechaEntregaSolicitada,
      plazoDias: o.condicionPago?.plazoDias ?? null,
      despacho: o.despacho,
      anticipoPendienteCents: Math.max(anticipoRequired(o) - appliedCents(s, o.id), 0),
    });
    const orders = s.orders.filter((o) => inScope(o.brand, scope));
    return {
      cutDate: s.cutDate,
      enProduccion: orders.filter((o) => o.estado === "en_produccion").sort((a, b) => (a.fechaEntregaSolicitada ?? "").localeCompare(b.fechaEntregaSolicitada ?? "")).map(map),
      retenidas: orders.filter((o) => o.estado === "retenida").map(map),
      despachadas: orders
        .filter((o) => o.despacho)
        .sort((a, b) => b.despacho!.fecha.localeCompare(a.despacho!.fecha))
        .slice(0, 5)
        .map(map),
    };
  });
}

/* ---------- Conciliación ---------- */

export type PaymentCard = {
  id: string;
  kind: Evidence["kind"];
  origen: Evidence["origen"];
  channel: string | null;
  orderId: string | null;
  customer: string;
  amountCents: number | null;
  seller: string | null;
  match: MatchKind;
  status: EvidenceStatus;
  receivedAt: string;
};

function toPaymentCard(s: DemoState, ev: Evidence): PaymentCard {
  const order = orderOf(s, ev);
  return {
    id: ev.id,
    kind: ev.kind,
    origen: ev.origen,
    channel: ev.fields.channel,
    orderId: ev.orderId,
    customer: order ? customerName(s, order) : (ev.fields.payer ?? "Remitente sin identificar"),
    amountCents: ev.fields.amountCents,
    seller: personName(s, order?.sellerId ?? (ev.brand === "corpotex" ? "u-rosa" : "u-luis")),
    match: matchFor(s, ev),
    status: ev.status,
    receivedAt: ev.receivedAt,
  };
}

export type QueueFilter = "recibidos" | "verificados" | "aplicados" | "revision";

export function queueGroup(c: PaymentCard): QueueFilter | null {
  if (c.status === "descartado") return null;
  if (c.status === "aplicado") return "aplicados";
  if (c.status === "verificado_banco") return "verificados";
  return IN_REVIEW.includes(c.match) ? "revision" : "recibidos";
}

export function getQueue(scope: Scope) {
  return respond((s) =>
    s.evidences
      .filter((e) => inScope(e.brand, scope))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .map((e) => toPaymentCard(s, e)),
  );
}

export type EvidenceDetailDTO = {
  evidence: Evidence;
  appliedBy: string | null;
  match: MatchKind;
  duplicateOfId: string | null;
  order: (Order & { customer: string; balanceCents: number; daysToDue: number | null; dueDate: string | null; seller: string | null }) | null;
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
        ? { ...order, customer: customerName(s, order), balanceCents: orderBalance(s, order), daysToDue: daysToDue(s, order), dueDate: dueDateOf(order), seller: personName(s, order.sellerId) }
        : null,
      missing: missingFields(ev),
      openOrders: s.orders
        .filter((o) => o.brand === ev.brand && isConfirmed(o) && orderBalance(s, o) > 0)
        .map((o) => ({ id: o.id, label: `${o.id} · ${customerName(s, o)} · saldo ${formatMoney(orderBalance(s, o))}` })),
    };
  });
}

/* ---------- Cobranza ---------- */

export type ReceivableRow = { id: string; customerId: string; customer: string; seller: string | null; dueDate: string; daysToDue: number; balanceCents: number; finance: OrderFinance };
export type AlertRow = CollectionAlert & { customer: string; customerId: string; balanceCents: number; dueDate: string | null };
export type MessageRow = OutgoingMessage & { customer: string; contacto: string };

export function getCobranza(scope: Scope) {
  return respond((s) => {
    const orders = s.orders.filter((o) => inScope(o.brand, scope) && dueDateOf(o) && orderBalance(s, o) > 0);
    const receivables: ReceivableRow[] = orders
      .map((o) => ({
        id: o.id,
        customerId: o.customerId,
        customer: customerName(s, o),
        seller: personName(s, o.sellerId),
        dueDate: dueDateOf(o)!,
        daysToDue: daysToDue(s, o)!,
        balanceCents: orderBalance(s, o),
        finance: orderFinance(s, o),
      }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const inScopeCustomer = (id: string) => inScope(s.customers.find((c) => c.id === id)!.brand, scope);
    const alerts: AlertRow[] = s.alerts
      .filter((a) => {
        const o = s.orders.find((x) => x.id === a.orderId);
        return o && inScope(o.brand, scope);
      })
      .map((a) => {
        const o = s.orders.find((x) => x.id === a.orderId)!;
        return { ...a, customer: customerName(s, o), customerId: o.customerId, balanceCents: orderBalance(s, o), dueDate: dueDateOf(o) };
      })
      .sort((a, b) => (a.estado === b.estado ? b.creadaAt.localeCompare(a.creadaAt) : a.estado === "abierta" ? -1 : 1));
    const messages: MessageRow[] = s.messages
      .filter((m) => inScopeCustomer(m.customerId))
      .map((m) => {
        const c = s.customers.find((x) => x.id === m.customerId)!;
        return { ...m, customer: c.name, contacto: c.contactoWhatsapp };
      })
      .sort((a, b) => b.programadoPara.localeCompare(a.programadoPara));
    return { cutDate: s.cutDate, receivables, alerts, messages };
  });
}

/* ---------- Clientes ---------- */

export type CustomerRow = {
  id: string;
  name: string;
  brand: Brand;
  tipo: Customer["tipo"];
  seller: string | null;
  since: string;
  creditLimitCents: number;
  usedCents: number;
  overdueCents: number;
  maxOverdueDays: number;
  status: CreditStatus;
  avgDaysLate: number | null;
  lastPaymentAt: string | null;
  nextDue: { id: string; date: string; overdue: boolean } | null;
  pendingOrders: number;
};

export function getCustomers(scope: Scope) {
  return respond<CustomerRow[]>((s) =>
    s.customers
      .filter((c) => inScope(c.brand, scope))
      .map((c) => {
        const snap = creditSnapshot(s, c);
        const due = snap.nextDue ? dueDateOf(snap.nextDue) : null;
        return {
          id: c.id,
          name: c.name,
          brand: c.brand,
          tipo: c.tipo,
          seller: personName(s, c.sellerId),
          since: c.since,
          creditLimitCents: c.creditLimitCents,
          usedCents: snap.usedCents,
          overdueCents: snap.overdueCents,
          maxOverdueDays: snap.maxOverdueDays,
          status: snap.status,
          avgDaysLate: snap.avgDaysLate,
          lastPaymentAt: snap.lastPaymentAt,
          nextDue: snap.nextDue && due ? { id: snap.nextDue.id, date: due, overdue: due < s.cutDate } : null,
          pendingOrders: s.orders.filter((o) => o.customerId === c.id && o.estado === "pendiente_aprobacion").length,
        };
      })
      .sort((a, b) => b.overdueCents - a.overdueCents || b.usedCents - a.usedCents),
  );
}

export type TimelineItem = {
  id: string;
  at: string;
  kind: "pedido" | "despacho" | "vencimiento" | "pago" | "credito" | "mensaje" | "enlace";
  title: string;
  detail: string;
  amountCents: number | null;
  tone: "ok" | "warn" | "bad" | "violet" | "neutral" | "info";
  future: boolean;
  dateOnly: boolean;
};

export type CreditDecisionRow = { orderId: string; decision: "aprobado" | "rechazado"; by: string; at: string; avisoMoraMostrado: boolean; tipo: string; plazoDias: number; nota: string | null; saleCents: number };

export type CustomerDetailDTO = {
  cutDate: string;
  customer: Customer;
  seller: string | null;
  snapshot: ReturnType<typeof creditSnapshot>;
  orders: OrderRow[];
  payments: Array<{ id: string; at: string; orderId: string; amountCents: number; channel: string; by: string; evidence: string | null }>;
  decisions: CreditDecisionRow[];
  messages: OutgoingMessage[];
  links: Array<{ token: string; createdBy: string; createdAt: string; expiresAt: string; revokedAt: string | null; state: "activo" | "vencido" | "revocado" }>;
  timeline: TimelineItem[];
};

const TIPO_PAGO: Record<string, string> = { credito: "Crédito", anticipo: "Anticipo", contado: "Contado" };

export function getCustomer(id: string) {
  return respond<CustomerDetailDTO | null>((s) => {
    const c = s.customers.find((x) => x.id === id);
    if (!c) return null;
    const orders = customerOrders(s, c.id);
    const payments = s.applications
      .filter((a) => orders.some((o) => o.id === a.orderId))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => ({ id: a.id, at: a.at, orderId: a.orderId, amountCents: a.amountCents, channel: a.channel, by: a.by, evidence: a.evidenceId }));
    const decisions: CreditDecisionRow[] = orders
      .filter((o) => o.credito)
      .map((o) => ({
        orderId: o.id,
        decision: o.credito!.decision,
        by: o.credito!.by,
        at: o.credito!.at,
        avisoMoraMostrado: o.credito!.avisoMoraMostrado,
        tipo: TIPO_PAGO[o.condicionPago?.tipo ?? "credito"],
        plazoDias: o.condicionPago?.plazoDias ?? 0,
        nota: o.credito!.nota,
        saleCents: o.saleCents,
      }))
      .sort((a, b) => b.at.localeCompare(a.at));
    const messages = s.messages.filter((m) => m.customerId === c.id).sort((a, b) => b.programadoPara.localeCompare(a.programadoPara));
    const now = nowIso();

    const timeline: TimelineItem[] = [];
    for (const o of orders) {
      timeline.push({ id: `${o.id}-p`, at: `${o.issuedOn}T09:00:00`, kind: "pedido", title: `Pedido ${o.id}`, detail: o.description, amountCents: o.saleCents, tone: "neutral", future: false, dateOnly: true });
      if (o.despacho) {
        timeline.push({
          id: `${o.id}-d`,
          at: `${o.despacho.fecha}T12:00:00`,
          kind: "despacho",
          title: `Despacho de ${o.id}`,
          detail: `${o.despacho.acta}. Inicia el plazo de ${o.condicionPago?.plazoDias ?? 0} días.`,
          amountCents: null,
          tone: "info",
          future: false,
          dateOnly: true,
        });
      }
      const due = dueDateOf(o);
      const bal = orderBalance(s, o);
      if (due && bal > 0) {
        const d = daysToDue(s, o)!;
        timeline.push({
          id: `${o.id}-v`,
          at: `${due}T23:59:00`,
          kind: "vencimiento",
          title: d < 0 ? `${o.id} vencido` : `Vence ${o.id}`,
          detail: `Saldo ${formatMoney(bal)}`,
          amountCents: bal,
          tone: d < 0 ? "bad" : d <= 3 ? "warn" : "neutral",
          future: due > s.cutDate,
          dateOnly: true,
        });
      }
    }
    for (const a of payments) {
      timeline.push({
        id: a.id,
        at: a.at,
        kind: "pago",
        title: `Pago aplicado a ${a.orderId}`,
        detail: `${a.channel}${a.evidence ? ` · ${a.evidence}` : " · registro histórico"} · por ${a.by}`,
        amountCents: a.amountCents,
        tone: "ok",
        future: false,
        dateOnly: false,
      });
    }
    for (const d of decisions) {
      timeline.push({
        id: `${d.orderId}-c`,
        at: d.at,
        kind: "credito",
        title: `${d.orderId}: ${d.decision === "aprobado" ? `${d.tipo.toLowerCase()} aprobado` : "crédito rechazado"}`,
        detail: `${d.by}${d.avisoMoraMostrado ? " · vio el aviso de mora" : ""}${d.nota ? ` · ${d.nota}` : ""}`,
        amountCents: null,
        tone: d.decision === "aprobado" ? (d.avisoMoraMostrado ? "warn" : "violet") : "bad",
        future: false,
        dateOnly: false,
      });
    }
    for (const m of messages.filter((x) => x.estado === "enviado" || x.estado === "error")) {
      timeline.push({
        id: m.id,
        at: m.enviadoAt ?? m.programadoPara,
        kind: "mensaje",
        title: `WhatsApp: ${MESSAGE_LABEL[m.tipo]}`,
        detail: m.estado === "error" ? `Error: ${m.error}` : m.texto,
        amountCents: null,
        tone: m.estado === "error" ? "bad" : "info",
        future: false,
        dateOnly: false,
      });
    }
    for (const l of s.shareLinks.filter((x) => x.customerId === c.id)) {
      timeline.push({ id: `${l.token}-c`, at: l.createdAt, kind: "enlace", title: "Estado de cuenta compartido", detail: `Por ${l.createdBy}`, amountCents: null, tone: "info", future: false, dateOnly: false });
    }
    timeline.sort((a, b) => b.at.localeCompare(a.at));

    return {
      cutDate: s.cutDate,
      customer: c,
      seller: personName(s, c.sellerId),
      snapshot: creditSnapshot(s, c),
      orders: orders.map((o) => ({
        ...orderCard(s, o),
        line: o.line,
        despachoOn: o.despacho?.fecha ?? null,
        paidCents: appliedCents(s, o.id),
        lastPaymentAt: lastPayment(s, o.id)?.at ?? null,
        daysLate: daysLate(s, o),
      })),
      payments,
      decisions,
      messages,
      links: s.shareLinks
        .filter((l) => l.customerId === c.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => ({ ...l, state: l.revokedAt ? "revocado" : l.expiresAt < now ? "vencido" : "activo" })),
      timeline,
    };
  });
}

export const MESSAGE_LABEL: Record<OutgoingMessage["tipo"], string> = {
  cobranza_preventiva: "Aviso preventivo (−3 días)",
  cobranza_vencimiento: "Vence hoy",
  mora_temprana: "Mora temprana (+3 días)",
  estado_cuenta: "Estado de cuenta",
  confirmacion_pago: "Confirmación de pago",
  resumen_orden: "Resumen de la orden",
};

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
      orders: Array<{ id: string; description: string; issuedOn: string; despachoOn: string | null; dueDate: string | null; saleCents: number; paidCents: number; balanceCents: number; state: "Pagado" | "Vencido" | "Por pagar" | "En producción" }>;
      payments: Array<{ id: string; at: string; orderId: string; amountCents: number; channel: string }>;
    };

export function getStatement(token: string) {
  return respond<StatementDTO>((s) => {
    const link = s.shareLinks.find((l) => l.token === token);
    if (!link) return { ok: false, reason: "no_existe" };
    if (link.revokedAt) return { ok: false, reason: "revocado" };
    if (link.expiresAt < nowIso()) return { ok: false, reason: "vencido" };
    const c = s.customers.find((x) => x.id === link.customerId)!;
    const orders = customerOrders(s, c.id).filter(isConfirmed);
    const snap = creditSnapshot(s, c);
    const nextDue = snap.nextDue ? { id: snap.nextDue.id, date: dueDateOf(snap.nextDue)!, amountCents: orderBalance(s, snap.nextDue) } : null;
    return {
      ok: true,
      customer: c.name,
      brand: c.brand,
      generatedAt: nowIso(),
      expiresAt: link.expiresAt,
      balanceCents: snap.usedCents,
      overdueCents: snap.overdueCents,
      nextDue,
      orders: orders.map((o) => {
        const bal = orderBalance(s, o);
        const fin = orderFinance(s, o);
        return {
          id: o.id,
          description: o.description,
          issuedOn: o.issuedOn,
          despachoOn: o.despacho?.fecha ?? null,
          dueDate: dueDateOf(o),
          saleCents: o.saleCents,
          paidCents: o.saleCents - bal,
          balanceCents: bal,
          state: fin === "cobrado" ? "Pagado" : fin === "vencido" ? "Vencido" : fin === "sin_vencimiento" ? "En producción" : "Por pagar",
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
  costOrigin: Order["costOrigin"];
  issuedOn: string;
  saleCents: number;
  costCents: number;
  costs: Order["costs"];
  hasCost: boolean;
  marginCents: number;
  perceivedCents: number;
  collectedCents: number;
  balanceCents: number;
  dueDate: string | null;
};
export type ResultsDTO = {
  cutDate: string;
  rows: ResultRow[];
  byBrand: Array<{ brand: Brand; saleCents: number; marginCents: number; perceivedCents: number; collectedCents: number }>;
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
    const orders = s.orders.filter((o) => inScope(o.brand, scope) && isConfirmed(o)).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
    const counted = orders.filter(hasCost);
    const rows: ResultRow[] = orders.map((o) => ({
      id: o.id,
      customer: customerName(s, o),
      customerId: o.customerId,
      brand: o.brand,
      line: o.line,
      description: o.description,
      modality: o.modality,
      costOrigin: o.costOrigin,
      issuedOn: o.issuedOn,
      saleCents: o.saleCents,
      costCents: orderCost(o),
      costs: o.costs,
      hasCost: hasCost(o),
      marginCents: orderMargin(o),
      perceivedCents: perceivedMargin(s, o),
      collectedCents: appliedCents(s, o.id),
      balanceCents: orderBalance(s, o),
      dueDate: dueDateOf(o),
    }));
    const brands: Brand[] = scope === "consolidado" ? ["corpotex", "unicrack"] : [scope];
    const own = counted.filter((o) => o.modality === "propia" && o.internalChargeCents != null);
    const charge = own.reduce((sum, o) => sum + (o.internalChargeCents ?? 0), 0);
    const cost = own.reduce((sum, o) => sum + orderCost(o), 0);
    const sale = own.reduce((sum, o) => sum + o.saleCents, 0);
    const lines = [...new Set(counted.map((o) => o.line))];
    return {
      cutDate: s.cutDate,
      rows,
      byBrand: brands.map((b) => {
        const bo = counted.filter((o) => o.brand === b);
        return {
          brand: b,
          saleCents: bo.reduce((x, o) => x + o.saleCents, 0),
          marginCents: bo.reduce((x, o) => x + orderMargin(o), 0),
          perceivedCents: bo.reduce((x, o) => x + perceivedMargin(s, o), 0),
          collectedCents: bo.reduce((x, o) => x + appliedCents(s, o.id), 0),
        };
      }),
      byLine: lines.map((line) => {
        const lo = counted.filter((o) => o.line === line);
        return { line, saleCents: lo.reduce((x, o) => x + o.saleCents, 0), marginCents: lo.reduce((x, o) => x + orderMargin(o), 0), orders: lo.length };
      }),
      workshop: own.length
        ? { orderIds: own.map((o) => o.id), costCents: cost, internalChargeCents: charge, workshopResultCents: charge - cost, commercialResultCents: sale - charge, consolidatedMarginCents: sale - cost }
        : null,
    };
  });
}

/** CSV para el sistema contable (Factura Ya, formato por verificar): IDs, marca, moneda, fechas y estado. */
export function ordersCsv(scope: Scope) {
  const s = getState();
  const header = ["orden", "marca", "cliente", "linea", "modalidad", "moneda", "fecha_pedido", "fecha_despacho", "vencimiento", "venta", "costo", "margen", "cobrado", "saldo", "estado", "fecha_corte"];
  const rows = s.orders
    .filter((o) => inScope(o.brand, scope) && isConfirmed(o))
    .map((o) => {
      const bal = orderBalance(s, o);
      const n = (c: number) => (c / 100).toFixed(2);
      return [o.id, o.brand, customerName(s, o), o.line, o.modality, "PEN", o.issuedOn, o.despacho?.fecha ?? "", dueDateOf(o) ?? "", n(o.saleCents), n(orderCost(o)), n(orderMargin(o)), n(o.saleCents - bal), n(bal), o.estado, s.cutDate];
    });
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

/* ---------- Perfil y configuración ---------- */

export type ProfileDTO = {
  activity: ActivityItem[];
  counts: Array<{ label: string; value: number }>;
  settings: Settings;
  ownOrders: Array<{ id: string; customer: string; costCents: number; internalChargeCents: number; saleCents: number }>;
};

export function getProfile(name: string, role: Role) {
  return respond<ProfileDTO>((s) => {
    const mine = s.audit.filter((a) => a.by === name).sort((a, b) => b.at.localeCompare(a.at));
    const count = (kinds: AuditEvent["kind"][]) => mine.filter((a) => kinds.includes(a.kind)).length;
    const counts: Record<Role, Array<{ label: string; value: number }>> = {
      vendedor: [
        { label: "Órdenes confirmadas", value: count(["orden_confirmada"]) },
        { label: "Créditos aprobados", value: count(["credito_aprobado"]) },
        { label: "Créditos rechazados", value: count(["credito_rechazado"]) },
        { label: "Cargas manuales", value: count(["orden_ingresada", "recibido"]) },
      ],
      administracion: [
        { label: "Pagos verificados", value: count(["verificado"]) },
        { label: "Pagos aplicados", value: count(["aplicado"]) },
        { label: "Correcciones", value: count(["corregido"]) },
        { label: "Alertas resueltas", value: count(["alerta_resuelta"]) },
      ],
      gerencia: [
        { label: "Cambios de supuestos", value: count(["configuracion"]) },
        { label: "Estados de cuenta compartidos", value: count(["enlace_creado"]) },
      ],
      jefe_taller: [{ label: "Despachos registrados", value: count(["despacho"]) }],
    };
    return {
      activity: mine.slice(0, 30).map((a) => activityOf(s, a)),
      counts: counts[role],
      settings: s.settings,
      ownOrders: s.orders
        .filter((o) => o.modality === "propia" && isConfirmed(o))
        .map((o) => ({ id: o.id, customer: customerName(s, o), costCents: orderCost(o), internalChargeCents: o.internalChargeCents ?? 0, saleCents: o.saleCents })),
    };
  });
}
