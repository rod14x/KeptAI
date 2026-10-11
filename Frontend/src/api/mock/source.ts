import { actions, getState, nowIso } from "./store";
import type { DemoState } from "./state";
import type { AuditEvent, Brand, Customer, Evidence, Order, Person, Scope } from "../model";
import { inScope } from "../model";
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
  isConfirmed,
  lastPayment,
  matchFor,
  missingFields,
  orderBalance,
  orderCost,
  orderFinance,
  orderMargin,
  perceivedMargin,
  weekWindows,
} from "./domain";
import { toIsoDate } from "../../lib/dates";
import { formatDate, formatDateShort, formatMoney } from "../../lib/format";
import type { Preferences } from "../../lib/preferences";
import type {
  ActivityItem,
  AssistantNote,
  CobranzaDTO,
  CreditDecisionRow,
  CreditSnapshot,
  CustomerDetailDTO,
  CustomerRow,
  CustomerView,
  DashboardDTO,
  DataSource,
  EvidenceDetailDTO,
  OrderBoardDTO,
  OrderCard,
  OrderColumnId,
  OrderDetailDTO,
  OrderRow,
  PaymentCard,
  ProfileDTO,
  ResultRow,
  ResultsDTO,
  StatementDTO,
  TallerDTO,
  TallerOrder,
  TimelineItem,
  WeekPoint,
} from "../dto";
import { MESSAGE_LABEL } from "../dto";

// MOCK: fuente de datos local que simula a Spring con la semilla de demostración.
// Mismas firmas que contract/source.ts. Eliminar al integrar (ver Frontend/docs/integracion-api.md).

const LATENCY_MS = 120;

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
const costKnown = (o: Order) => o.costComplete && orderCost(o) > 0;
const view = (c: Customer): CustomerView => ({ ...c });

function snapshot(s: DemoState, c: Customer): CreditSnapshot {
  const { nextDue: _next, ...snap } = creditSnapshot(s, c);
  return snap;
}

/* ---------- Dashboard ---------- */

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
      inflows: due.map((o) => `${o.ref} ${formatMoney(orderBalance(s, o), { short: true })}`),
    };
  });
}

const MATCH_TEXT: Record<string, string> = {
  sin_orden: "sin orden",
  no_cuadra: "el monto no cuadra",
  incompleto: "faltan datos",
};

function buildAssistant(s: DemoState, scope: Scope, role: Person["role"], notify: Preferences["notify"]): AssistantNote[] {
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
        title: role === "vendedor" ? `${o.ref} espera tu confirmación` : `${o.ref} espera confirmación del vendedor`,
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
        title: `${o.ref} retenida: falta anticipo de ${formatMoney(pending)}`,
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
        title: dups.length === 1 ? `${dups[0].ref} parece un comprobante duplicado` : `${dups.length} comprobantes duplicados por revisar`,
        detail: `Mismo código, monto y fecha que ${duplicateOf(s, dups[0])?.ref}. No reduce el saldo.`,
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
          detail: `${o.ref} venció el ${formatDate(due)} (hace ${-(daysToDue(s, o) ?? 0)} días) con saldo ${formatMoney(orderBalance(s, o))}.`,
          href: `/clientes/${c.id}`,
          date: due,
        });
      } else if ((fin === "vence_hoy" || fin === "por_vencer") && due) {
        notes.push({
          id: `due-${o.id}`,
          tone: "warn",
          title: fin === "vence_hoy" ? `${o.ref} vence hoy` : `${o.ref} vence el ${formatDate(due)}`,
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
        detail: review.map((e) => `${e.ref}: ${MATCH_TEXT[matchFor(s, e)]}`).join(". ") + ".",
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

function activityOf(s: DemoState, a: AuditEvent): ActivityItem {
  const ev = a.evidenceId ? s.evidences.find((e) => e.id === a.evidenceId) : undefined;
  const order = s.orders.find((o) => o.id === a.orderId);
  const customer = a.customerId ? s.customers.find((c) => c.id === a.customerId) : customerOf(s, order);
  const who = customer?.name ?? ev?.fields.payer ?? (a.kind === "configuracion" ? "Configuración" : "Remitente sin identificar");
  const ok: AuditEvent["kind"][] = ["aplicado", "credito_aprobado", "verificado", "orden_confirmada", "alerta_resuelta"];
  const bad: AuditEvent["kind"][] = ["duplicado", "descartado", "credito_rechazado"];
  const neutral: AuditEvent["kind"][] = ["despacho", "produccion", "configuracion", "corregido", "mensaje"];
  return {
    id: a.id,
    at: a.at,
    who,
    actor: a.by,
    text: a.text,
    reference: [ev?.ref, order?.ref].filter(Boolean).join(" · "),
    amountCents: a.amountCents,
    status: ok.includes(a.kind) ? "completado" : bad.includes(a.kind) ? "fallido" : neutral.includes(a.kind) ? "entregado" : "pendiente",
    href: a.evidenceId ? `/conciliacion/${a.evidenceId}` : a.orderId ? `/pedidos/${a.orderId}` : customer ? `/clientes/${customer.id}` : null,
  };
}

/* ---------- Órdenes ---------- */

function orderCard(s: DemoState, o: Order): OrderCard {
  const c = customerOf(s, o)!;
  return {
    id: o.id,
    ref: o.ref,
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
    demo: o.dataOrigin === "demo_fixture",
  };
}

function orderRow(s: DemoState, o: Order): OrderRow {
  return {
    ...orderCard(s, o),
    line: o.line,
    despachoOn: o.despacho?.fecha ?? null,
    paidCents: appliedCents(s, o.id),
    lastPaymentAt: lastPayment(s, o.id)?.at ?? null,
    daysLate: daysLate(s, o),
  };
}

export function columnOf(s: DemoState, o: Order): OrderColumnId | null {
  if (o.estado === "rechazada") return null;
  if (o.estado === "pendiente_aprobacion") return "por_confirmar";
  if (o.estado === "retenida") return "retenida";
  if (o.estado === "en_produccion") return "en_produccion";
  return orderBalance(s, o) > 0 ? "por_cobrar" : "cobrada";
}

const ORDER_COLUMNS: Array<{ id: OrderColumnId; title: string }> = [
  { id: "por_confirmar", title: "Por confirmar" },
  { id: "retenida", title: "Retenida" },
  { id: "en_produccion", title: "En producción" },
  { id: "por_cobrar", title: "Por cobrar" },
  { id: "cobrada", title: "Cobrada" },
];

/* ---------- Conciliación ---------- */

function toPaymentCard(s: DemoState, ev: Evidence): PaymentCard {
  const order = orderOf(s, ev);
  return {
    id: ev.id,
    ref: ev.ref,
    kind: ev.kind,
    origen: ev.origen,
    channel: ev.fields.channel,
    orderId: ev.orderId,
    orderRef: order?.ref ?? null,
    customer: order ? customerName(s, order) : (ev.fields.payer ?? "Remitente sin identificar"),
    amountCents: ev.fields.amountCents,
    seller: personName(s, order?.sellerId ?? (ev.brand === "corpotex" ? "u-rosa" : "u-luis")),
    match: matchFor(s, ev),
    status: ev.status,
    receivedAt: ev.receivedAt,
  };
}

/* ---------- Fuente ---------- */

const TIPO_PAGO: Record<string, string> = { credito: "Crédito", anticipo: "Anticipo", contado: "Contado" };

type Result = ReturnType<typeof actions.reset>;
const wrap =
  <A extends unknown[]>(fn: (...a: A) => Result) =>
  (...a: A) =>
    Promise.resolve(fn(...a));

export const mockSource: DataSource = {
  capabilities: {
    messagesLog: true,
    resolveAlerts: true,
    retryMessages: true,
    editPaymentFields: true,
    markDuplicate: true,
    discardPayment: true,
    manualOrderCapture: true,
    voucherNeedsFile: false,
    settings: true,
    orderItems: true,
    customerDirectory: true,
    resetDemo: true,
    demoAccounts: true,
  },

  getDashboard: (scope, role, notify) =>
    respond<DashboardDTO>((s) => {
      const orders = s.orders.filter((o) => inScope(o.brand, scope));
      const confirmed = orders.filter(isConfirmed);
      const dispatchedOpen = confirmed.filter((o) => dueDateOf(o) && orderBalance(s, o) > 0);
      const pipeline = confirmed.filter((o) => !o.despacho);
      const cash = cashNow(s, scope);
      const withCost = confirmed.filter(costKnown);
      const canResults = role === "gerencia";
      return {
        cutDate: s.cutDate,
        demo: true,
        factorCobro: s.settings.factorCobro,
        expectedCents: dispatchedOpen.reduce((sum, o) => sum + orderBalance(s, o), 0),
        openOrders: dispatchedOpen.length,
        overdueCents: dispatchedOpen.filter((o) => orderFinance(s, o) === "vencido").reduce((sum, o) => sum + orderBalance(s, o), 0),
        pipelineCents: pipeline.reduce((sum, o) => sum + orderBalance(s, o), 0),
        pipelineCount: pipeline.length,
        // Caja y resultados: GET /results/* es solo de gerencia en el contrato.
        cashCents: canResults ? cash.total : null,
        openingCents: canResults ? cash.opening : null,
        collectedCents: cash.collected,
        openingSource: s.openings[0]?.source ?? "",
        marginCents: canResults ? withCost.reduce((sum, o) => sum + orderMargin(o), 0) : null,
        perceivedCents: canResults ? withCost.reduce((sum, o) => sum + (perceivedMargin(s, o) ?? 0), 0) : null,
        orderCount: withCost.length,
        weeks: canResults ? buildWeeks(s, scope) : null,
        assistant: buildAssistant(s, scope, role, notify),
        activity:
          role === "administracion" || role === "gerencia"
            ? s.audit
                .filter((a) => (a.brand ? inScope(a.brand, scope) : scope === "consolidado") && !["corregido", "configuracion"].includes(a.kind))
                .sort((a, b) => b.at.localeCompare(a.at))
                .slice(0, 6)
                .map((a) => activityOf(s, a))
            : null,
      };
    }),

  getOrderBoard: (scope) =>
    respond<OrderBoardDTO>((s) => {
      const orders = s.orders.filter((o) => inScope(o.brand, scope));
      return {
        columns: ORDER_COLUMNS.map((c) => {
          let cards = orders.filter((o) => columnOf(s, o) === c.id).map((o) => orderCard(s, o));
          cards = cards.sort((a, b) => (c.id === "por_cobrar" ? (a.dueDate ?? "").localeCompare(b.dueDate ?? "") : b.issuedOn.localeCompare(a.issuedOn)));
          return { ...c, cards: c.id === "cobrada" ? cards.slice(0, 6) : cards };
        }),
        rejected: orders.filter((o) => o.estado === "rechazada").length,
      };
    }),

  getOrders: (scope) =>
    respond((s) =>
      s.orders
        .filter((o) => inScope(o.brand, scope))
        .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))
        .map((o) => orderRow(s, o)),
    ),

  getOrder: (id) =>
    respond<OrderDetailDTO | null>((s) => {
      const o = s.orders.find((x) => x.id === id);
      if (!o) return null;
      const c = customerOf(s, o)!;
      return {
        cutDate: s.cutDate,
        order: o,
        customer: view(c),
        seller: personName(s, o.sellerId),
        card: orderCard(s, o),
        credit: snapshot(s, c),
        paidCents: appliedCents(s, o.id),
        anticipoRequeridoCents: anticipoRequired(o),
        gatekeeper: gatekeeperPasses(s, o),
        costCents: costKnown(o) ? orderCost(o) : null,
        marginCents: costKnown(o) ? orderMargin(o) : null,
        perceivedCents: costKnown(o) ? perceivedMargin(s, o) : null,
        payments: s.applications
          .filter((a) => a.orderId === o.id)
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((a) => ({ id: a.id, at: a.at, amountCents: a.amountCents, channel: a.channel, by: a.by, evidenceId: a.evidenceId })),
        pendingEvidence: s.evidences
          .filter((e) => e.orderId === o.id && (e.status === "recibido" || e.status === "verificado_banco"))
          .map((e) => ({ id: e.id, ref: e.ref, amountCents: e.fields.amountCents, status: e.status, match: matchFor(s, e), receivedAt: e.receivedAt })),
        messages: s.messages.filter((m) => m.orderId === o.id).sort((a, b) => a.programadoPara.localeCompare(b.programadoPara)),
        alerts: s.alerts.filter((a) => a.orderId === o.id),
        plazoDefecto: s.settings.plazoDefecto,
      };
    }),

  getTaller: (scope) =>
    respond<TallerDTO>((s) => {
      const map = (o: Order): TallerOrder => ({
        id: o.id,
        ref: o.ref,
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
        enProduccion: orders
          .filter((o) => o.estado === "en_produccion")
          .sort((a, b) => (a.fechaEntregaSolicitada ?? "").localeCompare(b.fechaEntregaSolicitada ?? ""))
          .map(map),
        retenidas: orders.filter((o) => o.estado === "retenida").map(map),
        despachadas: orders
          .filter((o) => o.despacho)
          .sort((a, b) => b.despacho!.fecha.localeCompare(a.despacho!.fecha))
          .slice(0, 5)
          .map(map),
      };
    }),

  getQueue: (scope) =>
    respond((s) =>
      s.evidences
        .filter((e) => inScope(e.brand, scope))
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .map((e) => toPaymentCard(s, e)),
    ),

  getEvidence: (id) =>
    respond<EvidenceDetailDTO | null>((s) => {
      const ev = s.evidences.find((e) => e.id === id);
      if (!ev) return null;
      const order = orderOf(s, ev);
      return {
        evidence: ev,
        brand: ev.brand,
        imageUrl: null,
        appliedBy: s.applications.find((a) => a.evidenceId === ev.id)?.by ?? null,
        match: matchFor(s, ev),
        duplicateOfId: duplicateOf(s, ev)?.id ?? null,
        duplicateOfRef: duplicateOf(s, ev)?.ref ?? null,
        // En la demo, marcar un duplicado lo cierra (descartado); uno detectado sigue recibido.
        duplicateMarked: false,
        order: order
          ? {
              id: order.id,
              ref: order.ref,
              customer: customerName(s, order),
              line: order.line,
              saleCents: order.saleCents,
              balanceCents: orderBalance(s, order),
              daysToDue: daysToDue(s, order),
              dueDate: dueDateOf(order),
              seller: personName(s, order.sellerId),
            }
          : null,
        missing: missingFields(ev),
        openOrders: s.orders
          .filter((o) => o.brand === ev.brand && isConfirmed(o) && orderBalance(s, o) > 0)
          .map((o) => ({ id: o.id, label: `${o.ref} · ${customerName(s, o)} · saldo ${formatMoney(orderBalance(s, o))}` })),
      };
    }),

  getCobranza: (scope) =>
    respond<CobranzaDTO>((s) => {
      const orders = s.orders.filter((o) => inScope(o.brand, scope) && dueDateOf(o) && orderBalance(s, o) > 0);
      const inScopeCustomer = (id: string) => inScope(s.customers.find((c) => c.id === id)!.brand, scope);
      return {
        cutDate: s.cutDate,
        receivables: orders
          .map((o) => ({
            id: o.id,
            orderRef: o.ref,
            customerId: o.customerId,
            customer: customerName(s, o),
            seller: personName(s, o.sellerId),
            dueDate: dueDateOf(o)!,
            daysToDue: daysToDue(s, o)!,
            balanceCents: orderBalance(s, o),
            finance: orderFinance(s, o),
          }))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        alerts: s.alerts
          .filter((a) => {
            const o = s.orders.find((x) => x.id === a.orderId);
            return o && inScope(o.brand, scope);
          })
          .map((a) => {
            const o = s.orders.find((x) => x.id === a.orderId)!;
            return { ...a, orderRef: o.ref, customer: customerName(s, o), customerId: o.customerId, balanceCents: orderBalance(s, o), dueDate: dueDateOf(o) };
          })
          .sort((a, b) => (a.estado === b.estado ? b.creadaAt.localeCompare(a.creadaAt) : a.estado === "abierta" ? -1 : 1)),
        messages: s.messages
          .filter((m) => inScopeCustomer(m.customerId))
          .map((m) => {
            const c = s.customers.find((x) => x.id === m.customerId)!;
            return { ...m, customer: c.name, contacto: c.contactoWhatsapp, orderRef: s.orders.find((o) => o.id === m.orderId)?.ref ?? null };
          })
          .sort((a, b) => b.programadoPara.localeCompare(a.programadoPara)),
      };
    }),

  getCustomers: (scope) =>
    respond<CustomerRow[]>((s) =>
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
            nextDue: snap.nextDue && due ? { id: snap.nextDue.id, ref: snap.nextDue.ref, date: due, overdue: due < s.cutDate } : null,
            pendingOrders: s.orders.filter((o) => o.customerId === c.id && o.estado === "pendiente_aprobacion").length,
          };
        })
        .sort((a, b) => b.overdueCents - a.overdueCents || b.usedCents - a.usedCents),
    ),

  getCustomer: (id) =>
    respond<CustomerDetailDTO | null>((s) => {
      const c = s.customers.find((x) => x.id === id);
      if (!c) return null;
      const orders = customerOrders(s, c.id);
      const refOf = (orderId: string) => s.orders.find((o) => o.id === orderId)?.ref ?? orderId;
      const payments = s.applications
        .filter((a) => orders.some((o) => o.id === a.orderId))
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((a) => ({ id: a.id, at: a.at, orderRef: refOf(a.orderId), amountCents: a.amountCents, channel: a.channel, by: a.by, evidence: a.evidenceId }));
      const decisions: CreditDecisionRow[] = orders
        .filter((o) => o.credito)
        .map((o) => ({
          orderId: o.id,
          orderRef: o.ref,
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

      const timeline: TimelineItem[] = [];
      for (const o of orders) {
        timeline.push({ id: `${o.id}-p`, at: `${o.issuedOn}T09:00:00`, kind: "pedido", title: `Pedido ${o.ref}`, detail: o.description, amountCents: o.saleCents, tone: "neutral", future: false, dateOnly: true });
        if (o.despacho) {
          timeline.push({
            id: `${o.id}-d`,
            at: `${o.despacho.fecha}T12:00:00`,
            kind: "despacho",
            title: `Despacho de ${o.ref}`,
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
            title: d < 0 ? `${o.ref} vencido` : `Vence ${o.ref}`,
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
          title: `Pago aplicado a ${a.orderRef}`,
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
          title: `${d.orderRef}: ${d.decision === "aprobado" ? `${d.tipo.toLowerCase()} aprobado` : "crédito rechazado"}`,
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
          detail: m.estado === "error" ? `Error: ${m.error}` : `Enviado al contacto de prueba${m.orderId ? ` · ${refOf(m.orderId)}` : ""}`,
          amountCents: null,
          tone: m.estado === "error" ? "bad" : "info",
          future: false,
          dateOnly: false,
        });
      }
      timeline.sort((a, b) => b.at.localeCompare(a.at));

      return { cutDate: s.cutDate, customer: view(c), seller: personName(s, c.sellerId), snapshot: snapshot(s, c), orders: orders.map((o) => orderRow(s, o)), payments, decisions, messages, timeline };
    }),

  getStatement: (customerId) =>
    respond<StatementDTO | null>((s) => {
      const c = s.customers.find((x) => x.id === customerId);
      if (!c) return null;
      const orders = customerOrders(s, c.id).filter(isConfirmed);
      const snap = creditSnapshot(s, c);
      return {
        customerId: c.id,
        customer: c.name,
        generatedAt: nowIso(),
        balanceCents: snap.usedCents,
        overdueCents: snap.overdueCents,
        nextDue: snap.nextDue ? { ref: snap.nextDue.ref, date: dueDateOf(snap.nextDue)!, amountCents: orderBalance(s, snap.nextDue) } : null,
        orders: orders.map((o) => {
          const bal = orderBalance(s, o);
          const fin = orderFinance(s, o);
          return {
            id: o.id,
            ref: o.ref,
            description: o.description,
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
          .map((a) => ({ id: a.id, at: a.at, orderRef: s.orders.find((o) => o.id === a.orderId)?.ref ?? "", paymentRef: a.evidenceId, amountCents: a.amountCents })),
        demo: true,
      };
    }),

  getResults: (scope) =>
    respond<ResultsDTO>((s) => {
      const orders = s.orders.filter((o) => inScope(o.brand, scope) && isConfirmed(o)).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
      const counted = orders.filter(costKnown);
      const rows: ResultRow[] = orders.map((o) => ({
        id: o.id,
        ref: o.ref,
        customer: customerName(s, o),
        customerId: o.customerId,
        brand: o.brand,
        line: o.line,
        description: o.description,
        modality: o.modality,
        costOrigin: o.costOrigin,
        issuedOn: o.issuedOn,
        saleCents: o.saleCents,
        costCents: orderCost(o) > 0 ? orderCost(o) : null,
        costs: o.costs,
        costComplete: costKnown(o),
        missingCosts: costKnown(o) ? [] : ["costos reales cerrados"],
        marginCents: costKnown(o) ? orderMargin(o) : null,
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
        demo: true,
        rows,
        byBrand: brands.map((b) => {
          const bo = counted.filter((o) => o.brand === b);
          return {
            brand: b,
            saleCents: bo.reduce((x, o) => x + o.saleCents, 0),
            marginCents: bo.reduce((x, o) => x + orderMargin(o), 0),
            perceivedCents: bo.reduce((x, o) => x + (perceivedMargin(s, o) ?? 0), 0),
            collectedCents: bo.reduce((x, o) => x + appliedCents(s, o.id), 0),
            orders: bo.length,
            withoutCost: orders.filter((o) => o.brand === b && !costKnown(o)).length,
          };
        }),
        byLine: lines.map((line) => {
          const lo = counted.filter((o) => o.line === line);
          return { line, saleCents: lo.reduce((x, o) => x + o.saleCents, 0), marginCents: lo.reduce((x, o) => x + orderMargin(o), 0), orders: lo.length };
        }),
        workshop: own.length
          ? { orderIds: own.map((o) => o.ref), costCents: cost, internalChargeCents: charge, workshopResultCents: charge - cost, commercialResultCents: sale - charge, consolidatedMarginCents: sale - cost }
          : null,
      };
    }),

  ordersCsv: (scope) =>
    respond((s) => {
      const header = ["orden", "marca", "cliente", "linea", "modalidad", "moneda", "fecha_pedido", "fecha_despacho", "vencimiento", "venta", "costo", "margen", "cobrado", "saldo", "estado", "fecha_corte"];
      const rows = s.orders
        .filter((o) => inScope(o.brand, scope) && isConfirmed(o))
        .map((o) => {
          const bal = orderBalance(s, o);
          const n = (c: number) => (c / 100).toFixed(2);
          return [o.ref, o.brand, customerName(s, o), o.line, o.modality, "PEN", o.issuedOn, o.despacho?.fecha ?? "", dueDateOf(o) ?? "", n(o.saleCents), costKnown(o) ? n(orderCost(o)) : "", costKnown(o) ? n(orderMargin(o)) : "", n(o.saleCents - bal), n(bal), o.estado, s.cutDate];
        });
      const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    }),

  getProfile: (person) =>
    respond<ProfileDTO>((s) => {
      const mine = s.audit.filter((a) => a.by === person.name).sort((a, b) => b.at.localeCompare(a.at));
      const count = (kinds: AuditEvent["kind"][]) => mine.filter((a) => kinds.includes(a.kind)).length;
      const counts = {
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
          { label: "Despachos registrados", value: count(["despacho"]) },
        ],
        gerencia: [{ label: "Cambios de supuestos", value: count(["configuracion"]) }],
        jefe_taller: [{ label: "Despachos registrados", value: count(["despacho"]) }],
      }[person.role];
      return {
        activity: mine.slice(0, 30).map((a) => activityOf(s, a)),
        counts,
        settings: s.settings,
        ownOrders: s.orders
          .filter((o) => o.modality === "propia" && isConfirmed(o))
          .map((o) => ({ id: o.id, ref: o.ref, customer: customerName(s, o), costCents: orderCost(o), internalChargeCents: o.internalChargeCents ?? 0, saleCents: o.saleCents })),
      };
    }),

  search: (q, brand) =>
    respond((s) => {
      const term = q.trim().toLowerCase();
      if (!term) return [];
      const ok = (b: Brand) => !brand || b === brand;
      const customer = (id: string) => s.customers.find((c) => c.id === id)?.name ?? "";
      const customers = s.customers
        .filter((c) => ok(c.brand) && c.name.toLowerCase().includes(term))
        .map((c) => ({ id: c.id, label: c.name, detail: `Cliente ${c.brand === "corpotex" ? "Corpotex" : "Unicrack"}`, href: `/clientes/${c.id}`, brand: c.brand }));
      const orders = s.orders
        .filter((o) => ok(o.brand) && (o.ref.toLowerCase().includes(term) || customer(o.customerId).toLowerCase().includes(term)))
        .map((o) => ({ id: o.id, label: `${o.ref} · ${customer(o.customerId)}`, detail: `Orden ${formatMoney(o.saleCents)}`, href: `/pedidos/${o.id}`, brand: o.brand }));
      const evs = s.evidences
        .filter((e) => ok(e.brand) && (e.ref.toLowerCase().includes(term) || (e.fields.payer ?? "").toLowerCase().includes(term) || (e.fields.operationRef ?? "").includes(term)))
        .map((e) => ({
          id: e.id,
          label: `${e.ref} · ${e.fields.payer ?? "Sin remitente"}`,
          detail: `${e.fields.channel ?? "Comprobante"} ${e.fields.amountCents != null ? formatMoney(e.fields.amountCents) : ""}`,
          href: `/conciliacion/${e.id}`,
          brand: e.brand,
        }));
      return [...customers, ...orders, ...evs].slice(0, 7);
    }),

  getCaptureOptions: (brand) =>
    respond((s) => ({
      orders: s.orders
        .filter((o) => o.brand === brand && isConfirmed(o) && orderBalance(s, o) > 0)
        .map((o) => ({ id: o.id, label: `${o.ref} · ${customerName(s, o)} · saldo ${formatMoney(orderBalance(s, o))}` })),
      customers: s.customers.filter((c) => c.brand === brand).map((c) => ({ id: c.id, name: c.name })),
    })),

  commands: {
    editField: wrap(actions.editField),
    assignOrder: wrap(actions.assignOrder),
    verifyFunds: wrap(actions.verifyFunds),
    applyPayment: wrap(actions.applyPayment),
    markDuplicate: wrap(actions.markDuplicate),
    discard: wrap(actions.discard),
    confirmOrder: wrap(actions.confirmOrder),
    rejectOrder: wrap(actions.rejectOrder),
    registerDispatch: wrap(actions.registerDispatch),
    resolveAlert: wrap(actions.resolveAlert),
    retryMessage: wrap(actions.retryMessage),
    captureVoucher: wrap(actions.captureVoucher),
    captureOrder: wrap(actions.captureOrder),
    updateSettings: wrap(actions.updateSettings),
    setInternalCharge: wrap(actions.setInternalCharge),
    reset: wrap(actions.reset),
  },
};

