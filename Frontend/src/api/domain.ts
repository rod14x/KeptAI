import type { Brand, Customer, DemoState, Evidence, Order, Scope } from "./schemas";

// Reglas de cálculo de la demo. En producción estas cifras vienen del servidor Spring;
// el navegador solo las muestra (roadmap: "frontend consume cálculos servidor").

export type MatchKind = "coincide" | "parcial" | "duplicado" | "huerfano" | "monto_no_cuadra" | "excede" | "incompleto";

export const DAY_MS = 86_400_000;

export function inScope(brand: Brand, scope: Scope) {
  return scope === "consolidado" || brand === scope;
}

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

export function orderMargin(order: Order) {
  return order.saleCents - orderCost(order);
}

export function parseDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  return toIsoDate(new Date(parseDate(iso).getTime() + days * DAY_MS));
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((parseDate(toIso).getTime() - parseDate(fromIso).getTime()) / DAY_MS);
}

/** Días que faltan para el vencimiento desde la fecha de corte (negativo = vencido). */
export function daysToDue(state: DemoState, order: Order) {
  return daysBetween(state.cutDate, order.dueDate);
}

export function lastPayment(state: DemoState, orderId: string) {
  const apps = state.applications.filter((a) => a.orderId === orderId).sort((a, b) => b.at.localeCompare(a.at));
  return apps[0] ?? null;
}

export type OrderFinance = "cobrado" | "en_disputa" | "vencido" | "vence_hoy" | "por_vencer" | "al_dia";

export function orderFinance(state: DemoState, order: Order): OrderFinance {
  const bal = orderBalance(state, order);
  if (bal <= 0) return "cobrado";
  if (order.dispute) return "en_disputa";
  const d = daysToDue(state, order);
  if (d < 0) return "vencido";
  if (d === 0) return "vence_hoy";
  if (d <= 3) return "por_vencer";
  return "al_dia";
}

/** Días de atraso con que se cerró un pedido (negativo = pagó antes). Null si sigue abierto. */
export function daysLate(state: DemoState, order: Order) {
  if (orderBalance(state, order) > 0) return null;
  const last = lastPayment(state, order.id);
  return last ? daysBetween(order.dueDate, last.at) : null;
}

/** Cadencia de alertas internas (propuesta del rediseño: -3, 0, +3 y escalamiento). */
export function alertSchedule(state: DemoState, order: Order) {
  const bal = orderBalance(state, order);
  const closedOn = bal <= 0 ? (lastPayment(state, order.id)?.at.slice(0, 10) ?? null) : null;
  return state.settings.alertOffsets.map((offset) => {
    const date = addDays(order.dueDate, offset);
    const label = offset < 0 ? `Aviso preventivo` : offset === 0 ? "Vence hoy" : offset >= 7 ? "Escalamiento a administración" : "Mora temprana";
    let status: "enviada" | "programada" | "cancelada" | "pausada";
    if (closedOn && closedOn <= date) status = "cancelada";
    else if (order.dispute && date >= order.dispute.since) status = "pausada";
    else status = date <= state.cutDate ? "enviada" : "programada";
    return { offset, date, label, status };
  });
}

/* ---------- Crédito por cliente ---------- */

export type CreditStatus = "al_dia" | "por_vencer" | "en_mora" | "en_disputa" | "sobre_linea";

export function customerOrders(state: DemoState, customerId: string) {
  return state.orders.filter((o) => o.customerId === customerId).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
}

export function creditSnapshot(state: DemoState, customer: Customer) {
  const orders = customerOrders(state, customer.id);
  const open = orders.filter((o) => orderBalance(state, o) > 0);
  const usedCents = open.reduce((s, o) => s + orderBalance(state, o), 0);
  const overdue = open.filter((o) => !o.dispute && daysToDue(state, o) < 0);
  const overdueCents = overdue.reduce((s, o) => s + orderBalance(state, o), 0);
  const disputed = open.filter((o) => o.dispute);
  const soon = open.filter((o) => !o.dispute && daysToDue(state, o) >= 0 && daysToDue(state, o) <= 3);
  const closed = orders.map((o) => daysLate(state, o)).filter((d): d is number => d !== null);
  const avgDaysLate = closed.length ? Math.round(closed.reduce((s, d) => s + d, 0) / closed.length) : null;
  const maxOverdueDays = overdue.length ? Math.max(...overdue.map((o) => -daysToDue(state, o))) : 0;
  const payments = state.applications
    .filter((a) => orders.some((o) => o.id === a.orderId))
    .sort((a, b) => b.at.localeCompare(a.at));

  let status: CreditStatus = "al_dia";
  if (overdueCents > 0) status = "en_mora";
  else if (disputed.length) status = "en_disputa";
  else if (usedCents > customer.creditLimitCents) status = "sobre_linea";
  else if (soon.length) status = "por_vencer";

  // Regla del rediseño USR-REDISENO-001, macroproceso 1. Es una propuesta, no política aprobada.
  const suggestion =
    status === "en_mora"
      ? "Sugerencia (propuesta): no abrir nuevo crédito; pedir pago contra entrega o anticipo hasta regularizar."
      : status === "en_disputa"
        ? "Sugerencia (propuesta): resolver la disputa antes de ampliar crédito."
        : status === "sobre_linea"
          ? "Sugerencia (propuesta): el saldo supera la línea; pedir anticipo para nuevos pedidos."
          : null;

  return {
    usedCents,
    availableCents: Math.max(customer.creditLimitCents - usedCents, 0),
    overdueCents,
    disputedCents: disputed.reduce((s, o) => s + orderBalance(state, o), 0),
    maxOverdueDays,
    avgDaysLate,
    status,
    suggestion,
    totalSoldCents: orders.reduce((s, o) => s + o.saleCents, 0),
    totalPaidCents: payments.reduce((s, a) => s + a.amountCents, 0),
    orderCount: orders.length,
    lastPaymentAt: payments[0]?.at ?? null,
    lastOrderOn: orders[0]?.issuedOn ?? null,
    nextDue: open.filter((o) => !o.dispute).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
  };
}

/* ---------- Conciliación ---------- */

/** Primer comprobante vivo con la misma referencia de operación, si es otro. */
export function duplicateOf(state: DemoState, ev: Evidence): Evidence | null {
  if (!ev.fields.operationRef) return null;
  const earlier = state.evidences
    .filter(
      (o) =>
        o.id !== ev.id &&
        o.status !== "descartado" &&
        o.fields.operationRef === ev.fields.operationRef &&
        o.fields.channel === ev.fields.channel &&
        o.receivedAt < ev.receivedAt,
    )
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return earlier[0] ?? null;
}

export function matchFor(state: DemoState, ev: Evidence): MatchKind {
  if (ev.status === "pago_aplicado") return "coincide";
  if (duplicateOf(state, ev)) return "duplicado";
  if (ev.fields.amountCents == null || !ev.fields.operationRef) return "incompleto";
  if (!ev.orderId) return "huerfano";
  if (ev.declaredAmountCents != null && ev.declaredAmountCents !== ev.fields.amountCents && !ev.mismatchAccepted) {
    return "monto_no_cuadra";
  }
  const order = state.orders.find((o) => o.id === ev.orderId);
  if (!order) return "huerfano";
  const balance = orderBalance(state, order);
  if (ev.fields.amountCents > balance) return "excede";
  if (ev.fields.amountCents === balance) return "coincide";
  return "parcial";
}

export function missingFields(ev: Evidence) {
  const missing: string[] = [];
  if (ev.fields.amountCents == null) missing.push("monto");
  if (!ev.fields.operationRef) missing.push("N.° de operación");
  return missing;
}

/* ---------- Caja ---------- */

/** Las 4 semanas proyectadas desde la fecha de corte. */
export function weekWindows(cutDate: string) {
  const start = parseDate(cutDate);
  return [0, 1, 2, 3].map((i) => {
    const from = new Date(start.getTime() + i * 7 * DAY_MS);
    const to = new Date(from.getTime() + 6 * DAY_MS);
    return { index: i, from, to };
  });
}

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
