import type { Customer, Evidence, Order, OutgoingMessage, Scope, CreditStatus, MatchKind, OrderFinance } from "../model";
import { inScope } from "../model";
import type { DemoState } from "./state";
import { formatMoney } from "../../lib/format";
import { addDays, daysBetween, parseDate, weekWindows } from "../../lib/dates";

// MOCK: motor de reglas que corre en el navegador solo para la demo.
// En producción estas cifras las calcula Spring (v_saldo_obligacion, v_margen_orden, caja); eliminar al integrar.

export { inScope, addDays, daysBetween, parseDate, weekWindows };


/* ---------- Órdenes ---------- */

export function appliedCents(state: DemoState, orderId: string) {
  return state.applications.filter((a) => a.orderId === orderId).reduce((s, a) => s + a.amountCents, 0);
}

export function orderBalance(state: DemoState, order: Order) {
  return order.saleCents - appliedCents(state, order.id);
}

export function orderCost(order: Order) {
  const c = order.costs;
  return c.materiales + c.manoObra + c.terceros + c.indirectos;
}

/** Margen teórico/facturado: venta menos costo. */
export function orderMargin(order: Order) {
  return order.saleCents - orderCost(order);
}

/** margen_real_cobrado de v_margen_orden: aplicado − costos reales cerrados. Null si el costeo no está completo. */
export function perceivedMargin(state: DemoState, order: Order): number | null {
  if (!order.costComplete) return null;
  return appliedCents(state, order.id) - orderCost(order);
}

/** Una orden confirmada genera obligación; un borrador o una orden rechazada todavía no. */
export function isConfirmed(order: Order) {
  return order.estado !== "pendiente_aprobacion" && order.estado !== "rechazada";
}

/** Vencimiento = fecha del acta de despacho + plazo. El reloj no corre desde el pedido. */
export function dueDateOf(order: Order) {
  if (!order.despacho) return null;
  return addDays(order.despacho.fecha, order.condicionPago?.plazoDias ?? 0);
}

export function daysToDue(state: DemoState, order: Order) {
  const due = dueDateOf(order);
  return due ? daysBetween(state.cutDate, due) : null;
}

/** Monto que debe estar verificado antes de producir (contado = todo; anticipo = %; crédito = 0). */
export function anticipoRequired(order: Order) {
  const c = order.condicionPago;
  if (!c) return 0;
  if (c.tipo === "contado") return order.saleCents;
  if (c.tipo === "anticipo") return Math.round((order.saleCents * (c.anticipoPct ?? 0)) / 100);
  return 0;
}

/** Gatekeeper: crédito aprobado o anticipo verificado. Ninguna orden entra a producción sin esto. */
export function gatekeeperPasses(state: DemoState, order: Order) {
  if (!order.condicionPago) return false;
  if (order.condicionPago.tipo === "credito") return order.credito?.decision === "aprobado";
  return appliedCents(state, order.id) >= anticipoRequired(order);
}

export function lastPayment(state: DemoState, orderId: string) {
  const apps = state.applications.filter((a) => a.orderId === orderId).sort((a, b) => b.at.localeCompare(a.at));
  return apps[0] ?? null;
}

export function orderFinance(state: DemoState, order: Order): OrderFinance {
  if (orderBalance(state, order) <= 0) return "cobrado";
  const d = daysToDue(state, order);
  if (d === null) return "sin_vencimiento";
  if (d < 0) return "vencido";
  if (d === 0) return "vence_hoy";
  if (d <= 3) return "por_vencer";
  return "al_dia";
}

/** Días de atraso con que se cerró una orden (negativo = pagó antes). Null si sigue abierta. */
export function daysLate(state: DemoState, order: Order) {
  const due = dueDateOf(order);
  if (!due || orderBalance(state, order) > 0) return null;
  const last = lastPayment(state, order.id);
  return last ? daysBetween(due, last.at) : null;
}

/* ---------- Clientes y crédito ---------- */

export function customerOrders(state: DemoState, customerId: string) {
  return state.orders.filter((o) => o.customerId === customerId).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
}

export function creditSnapshot(state: DemoState, customer: Customer) {
  const orders = customerOrders(state, customer.id);
  const confirmed = orders.filter(isConfirmed);
  const open = confirmed.filter((o) => orderBalance(state, o) > 0);
  const usedCents = open.reduce((s, o) => s + orderBalance(state, o), 0);
  const overdue = open.filter((o) => orderFinance(state, o) === "vencido");
  const overdueCents = overdue.reduce((s, o) => s + orderBalance(state, o), 0);
  const soon = open.filter((o) => ["por_vencer", "vence_hoy"].includes(orderFinance(state, o)));
  const closed = confirmed.map((o) => daysLate(state, o)).filter((d): d is number => d !== null);
  const paidOnTime = closed.filter((d) => d <= 0).length;
  const avgDaysLate = closed.length ? Math.round(closed.reduce((s, d) => s + d, 0) / closed.length) : null;
  const maxOverdueDays = overdue.length ? Math.max(...overdue.map((o) => -(daysToDue(state, o) ?? 0))) : 0;
  const payments = state.applications.filter((a) => orders.some((o) => o.id === a.orderId)).sort((a, b) => b.at.localeCompare(a.at));

  let status: CreditStatus = "al_dia";
  if (overdueCents > 0) status = "en_mora";
  else if (usedCents > customer.creditLimitCents) status = "sobre_linea";
  else if (soon.length) status = "por_vencer";

  // D-005: la mora no bloquea. El sistema avisa y el vendedor decide.
  const aviso =
    status === "en_mora"
      ? `Este cliente está en mora: ${formatMoney(overdueCents)} vencido, hasta ${maxOverdueDays} días de atraso. ¿Quieres volver a darle crédito?`
      : status === "sobre_linea"
        ? `El saldo abierto supera la línea de referencia de ${formatMoney(customer.creditLimitCents)}.`
        : null;

  const withDue = open.filter((o) => dueDateOf(o)).sort((a, b) => (dueDateOf(a) ?? "").localeCompare(dueDateOf(b) ?? ""));

  return {
    usedCents,
    availableCents: Math.max(customer.creditLimitCents - usedCents, 0),
    overdueCents,
    maxOverdueDays,
    avgDaysLate,
    paidOnTime,
    closedCount: closed.length,
    status,
    aviso,
    totalSoldCents: confirmed.reduce((s, o) => s + o.saleCents, 0),
    totalPaidCents: payments.reduce((s, a) => s + a.amountCents, 0),
    orderCount: confirmed.length,
    lastPaymentAt: payments[0]?.at ?? null,
    lastOrderOn: orders[0]?.issuedOn ?? null,
    nextDue: withDue[0] ?? null,
  };
}

/* ---------- Conciliación ---------- */

/** Duplicado = mismo código de operación + monto + fecha de pago (README de n8n). */
export function duplicateOf(state: DemoState, ev: Evidence): Evidence | null {
  const f = ev.fields;
  if (!f.operationRef || f.amountCents == null) return null;
  const day = f.paidAt?.slice(0, 10) ?? null;
  const earlier = state.evidences
    .filter(
      (o) =>
        o.id !== ev.id &&
        o.status !== "descartado" &&
        o.fields.operationRef === f.operationRef &&
        o.fields.amountCents === f.amountCents &&
        (o.fields.paidAt?.slice(0, 10) ?? null) === day &&
        o.receivedAt < ev.receivedAt,
    )
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return earlier[0] ?? null;
}

export function matchFor(state: DemoState, ev: Evidence): MatchKind {
  if (ev.status === "aplicado") return "total";
  if (duplicateOf(state, ev)) return "duplicado";
  if (ev.fields.amountCents == null || !ev.fields.operationRef) return "incompleto";
  if (!ev.orderId) return "sin_orden";
  if (ev.declaredAmountCents != null && ev.declaredAmountCents !== ev.fields.amountCents && !ev.mismatchAccepted) return "no_cuadra";
  const order = state.orders.find((o) => o.id === ev.orderId);
  if (!order) return "sin_orden";
  const balance = orderBalance(state, order);
  if (ev.fields.amountCents > balance) return "excede";
  if (ev.fields.amountCents === balance) return "total";
  return "parcial";
}

export function missingFields(ev: Evidence) {
  const missing: string[] = [];
  if (ev.fields.amountCents == null) missing.push("monto");
  if (!ev.fields.operationRef) missing.push("N.° de operación");
  return missing;
}

/* ---------- Mensajes de cobranza (los programa Spring, los envía n8n WF3) ---------- */

const CADENCE: Record<number, OutgoingMessage["tipo"]> = { [-3]: "cobranza_preventiva", 0: "cobranza_vencimiento", 3: "mora_temprana" };

/** Programa los recordatorios −3/0/+3 de una orden despachada (envio_notificacion, sin texto). */
export function scheduleCollection(order: Order, customer: Customer, idPrefix: string): OutgoingMessage[] {
  const due = dueDateOf(order);
  if (!due) return [];
  return [-3, 0, 3].map((offset) => ({
    id: `${idPrefix}-${order.id}-${offset}`,
    customerId: customer.id,
    orderId: order.id,
    tipo: CADENCE[offset],
    estado: "pendiente",
    programadoPara: `${addDays(due, offset)}T09:00:00`,
    intentos: 0,
    enviadoAt: null,
    error: null,
  }));
}

/* ---------- Caja ---------- */

/** Caja = apertura + pagos aplicados desde la fecha de apertura de cada marca. */
export function cashNow(state: DemoState, scope: Scope) {
  const openings = state.openings.filter((o) => inScope(o.brand, scope));
  const opening = openings.reduce((s, o) => s + o.amountCents, 0);
  const collected = state.applications
    .filter((a) => {
      const order = state.orders.find((o) => o.id === a.orderId);
      const op = order && openings.find((o) => o.brand === order.brand);
      return order && op && a.at.slice(0, 10) >= op.date;
    })
    .reduce((s, a) => s + a.amountCents, 0);
  return { opening, collected, total: opening + collected };
}
