import type { Brand, CollectionAlert, Evidence, MatchKind, Order, OrderFinance, OrderState, Role, Scope } from "../model";
import { inScope } from "../model";
import { bump, getVersion } from "../events";
import { addDays, daysBetween, todayIso } from "../../lib/dates";
import { formatDate, formatMoney } from "../../lib/format";
import { all, endpoints } from "./endpoints";
import { HttpError } from "./http";
import type * as S from "./schemas";
import type {
  ActionResult,
  ActivityItem,
  AlertRow,
  AssistantNote,
  CreditDecisionRow,
  CreditSnapshot,
  CustomerRow,
  CustomerView,
  DataSource,
  OrderCard,
  OrderColumnId,
  OrderRow,
  PaymentCard,
  ReceivableRow,
  ResultRow,
  TallerOrder,
  TimelineItem,
  WeekPoint,
} from "../dto";

// Fuente "api": adapta los DTO del contrato (Backend/docs/openapi.yaml) a los DTO de pantalla.
// Lo que el contrato todavía no expone se devuelve como null o se marca en `capabilities`;
// los comandos sin endpoint responden code "no_disponible". Ver Frontend/docs/integracion-api.md.

/* ---------- Utilidades ---------- */

const cents = (m: { amount_cents: number } | null | undefined) => (m ? m.amount_cents : null);
const zero = (m: { amount_cents: number } | null | undefined) => m?.amount_cents ?? 0;

/** La marca llega como texto libre (orden.marca); se reconoce por nombre. */
export function toBrand(s: string | null | undefined): Brand | null {
  const v = (s ?? "").toLowerCase();
  if (v.includes("unicrack")) return "unicrack";
  if (v.includes("corpotex")) return "corpotex";
  return null;
}
const fits = (b: Brand | null, scope: Scope) => scope === "consolidado" || b === null || inScope(b, scope);

/** 403 (rol sin acceso) o 404 se degradan a un valor por defecto en lugar de romper la pantalla. */
async function soft<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof HttpError && (e.status === 403 || e.status === 404)) return fallback;
    throw e;
  }
}

/** Memo corto por versión del bus: varias pantallas comparten la misma carga de listas. */
const memo = new Map<string, { version: number; at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.version === getVersion() && Date.now() - hit.at < 20_000) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { version: getVersion(), at: Date.now(), value });
  value.catch(() => memo.delete(key));
  return value;
}

const loadOrders = () => cached("orders", () => all.orders());
const loadReceivables = () => cached("receivables", () => soft(all.receivables(), [] as S.ReceivableT[]));
const loadPayments = () => cached("payments", () => soft(all.payments(), [] as S.PaymentT[]));
const loadAlerts = () => cached("alerts", () => soft(all.alerts(), [] as S.CollectionAlertT[]));
const loadOrderDrafts = () =>
  cached("drafts", () => soft(all.drafts({ status: "pending_review" }), [] as S.ExtractionDraftT[]).then((d) => d.filter((x) => x.draft_type === "order")));
const loadMe = () => cached("me", () => endpoints.getMyContext());

const DRAFT = "draft-";

/* ---------- Mapeos de estado ---------- */

const ORDER_STATE: Record<S.OrderT["status"], OrderState> = {
  draft: "pendiente_aprobacion",
  pending_approval: "pendiente_aprobacion",
  held: "retenida",
  released: "en_produccion",
  in_production: "en_produccion",
  dispatched: "despachada",
  closed: "despachada",
  cancelled: "rechazada",
};

const MATCH: Record<S.PaymentT["reconciliation_status"], MatchKind> = {
  pending: "pendiente",
  applied: "total",
  partial: "parcial",
  duplicate: "duplicado",
  orphan: "sin_orden",
  amount_mismatch: "no_cuadra",
};

const PHASE: Record<S.PaymentT["phase"], Evidence["status"]> = { received: "recibido", bank_verified: "verificado_banco", applied: "aplicado" };

const CHANNEL: Record<S.PaymentT["channel"], string> = {
  yape: "Yape",
  plin: "Plin",
  bank_transfer: "Transferencia",
  deposit: "Depósito",
  cash: "Efectivo",
  other: "Otro",
};

const RULE: Record<S.CollectionAlertT["rule"], string> = {
  early_arrears: "Mora temprana (+3 días)",
  payment_in_review: "Pago en revisión",
  advance_pending: "Anticipo pendiente",
};

const ALERT_STATE: Record<S.CollectionAlertT["status"], CollectionAlert["estado"]> = { open: "abierta", resolved: "resuelta", cancelled: "cancelada" };

function finance(o: S.OrderT, r: S.ReceivableT | undefined, today: string): OrderFinance {
  const status = r?.status ?? o.receivable_status;
  if (status === "paid") return "cobrado";
  const due = r?.due_date ?? o.due_date;
  if (!due) return "sin_vencimiento";
  if (r?.due_bucket === "overdue" || status === "overdue") return "vencido";
  const d = daysBetween(today, due);
  if (d < 0) return "vencido";
  if (d === 0) return "vence_hoy";
  return d <= 3 ? "por_vencer" : "al_dia";
}

function balanceOf(o: S.OrderT, r: S.ReceivableT | undefined) {
  if (r) return r.balance.amount_cents;
  return o.receivable_status === "paid" ? 0 : zero(o.sale);
}

/** Lo que debe cobrarse antes de producir: el anticipo, o el total si la orden es al contado (gate V5). */
function requiredBeforeProduction(o: S.OrderT) {
  return o.payment_condition === "cash" ? zero(o.sale) : o.advance_required.amount_cents;
}

function errorResult(e: unknown): ActionResult {
  if (e instanceof HttpError) {
    if (e.status === 403) return { ok: false, message: "Tu rol no tiene permiso para esta acción." };
    return { ok: false, message: `${e.message}${e.requestId ? ` (ref. ${e.requestId})` : ""}` };
  }
  return { ok: false, message: e instanceof Error ? e.message : "Error inesperado" };
}

const unavailable = (what: string): Promise<ActionResult> =>
  Promise.resolve({ ok: false, code: "no_disponible", message: `${what} todavía no tiene endpoint en el contrato de la API.` });

/** Ejecuta un comando, invalida las lecturas y traduce errores HTTP a ActionResult. */
async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const r = await fn();
    if (r.ok) {
      memo.clear();
      bump();
    }
    return r;
  } catch (e) {
    return errorResult(e);
  }
}

/* ---------- Construcción de vistas ---------- */

type Ctx = { orders: S.OrderT[]; receivables: S.ReceivableT[]; byOrder: Map<string, S.ReceivableT>; today: string };

async function context(): Promise<Ctx> {
  const [orders, receivables] = await Promise.all([loadOrders(), loadReceivables()]);
  return { orders, receivables, byOrder: new Map(receivables.map((r) => [r.order_id, r])), today: todayIso() };
}

function overdueCustomers(ctx: Ctx) {
  const set = new Set<string>();
  for (const r of ctx.receivables) if (r.due_bucket === "overdue" && r.balance.amount_cents > 0) set.add(r.customer.id);
  return set;
}

function card(o: S.OrderT, ctx: Ctx, moroso: Set<string>): OrderCard {
  const r = ctx.byOrder.get(o.id);
  const due = r?.due_date ?? o.due_date;
  return {
    id: o.id,
    ref: o.display_code,
    customerId: o.customer?.id ?? null,
    customer: o.customer?.name ?? "Sin cliente",
    brand: toBrand(o.brand),
    description: o.product_line ?? "Sin descripción",
    saleCents: cents(o.sale),
    balanceCents: balanceOf(o, r),
    estado: ORDER_STATE[o.status],
    finance: finance(o, r, ctx.today),
    issuedOn: o.created_at.slice(0, 10),
    entregaSolicitada: o.requested_delivery_date,
    dueDate: due,
    daysToDue: due ? daysBetween(ctx.today, due) : null,
    seller: null,
    origen: o.source === "whatsapp" ? "whatsapp" : o.source === "manual" ? "manual" : "historico",
    faltantes: 0,
    clienteEnMora: o.customer ? moroso.has(o.customer.id) : false,
    anticipoPendienteCents: o.status === "held" ? requiredBeforeProduction(o) : 0,
    demo: o.data_origin === "demo_fixture",
  };
}

function row(o: S.OrderT, ctx: Ctx, moroso: Set<string>): OrderRow {
  const r = ctx.byOrder.get(o.id);
  return {
    ...card(o, ctx, moroso),
    line: o.product_line,
    despachoOn: o.dispatch_date,
    paidCents: r ? r.applied_amount.amount_cents : 0,
    lastPaymentAt: null,
    daysLate: r && r.days_overdue > 0 ? r.days_overdue : null,
  };
}

function draftLabel(d: S.ExtractionDraftT) {
  const f = d.order_fields;
  const missing = f ? Object.entries(f).filter(([, v]) => v.status !== "present").map(([k]) => FIELD_LABEL[k] ?? k) : [];
  return { f, missing };
}

const FIELD_LABEL: Record<string, string> = {
  customer_name: "Cliente",
  brand: "Marca",
  product_description: "Producto",
  quantity: "Cantidad",
  sale_amount: "Monto",
};

function draftCard(d: S.ExtractionDraftT, today: string): OrderCard {
  const { f, missing } = draftLabel(d);
  return {
    id: `${DRAFT}${d.id}`,
    ref: `Borrador ${d.id.slice(0, 8)}`,
    customerId: null,
    customer: f?.customer_name.value ?? "Cliente por identificar",
    brand: toBrand(f?.brand.value),
    description: f?.product_description.value ?? "Pedido recibido por WhatsApp",
    saleCents: f?.sale_amount.value?.amount_cents ?? null,
    balanceCents: f?.sale_amount.value?.amount_cents ?? 0,
    estado: "pendiente_aprobacion",
    finance: "sin_vencimiento",
    issuedOn: d.created_at.slice(0, 10) || today,
    entregaSolicitada: null,
    dueDate: null,
    daysToDue: null,
    seller: null,
    origen: "whatsapp",
    faltantes: missing.length,
    clienteEnMora: false,
    anticipoPendienteCents: 0,
    demo: false,
  };
}

function columnOf(c: OrderCard): OrderColumnId | null {
  if (c.estado === "rechazada") return null;
  if (c.estado === "pendiente_aprobacion") return "por_confirmar";
  if (c.estado === "retenida") return "retenida";
  if (c.estado === "en_produccion") return "en_produccion";
  return c.balanceCents > 0 ? "por_cobrar" : "cobrada";
}

const ORDER_COLUMNS: Array<{ id: OrderColumnId; title: string }> = [
  { id: "por_confirmar", title: "Por confirmar" },
  { id: "retenida", title: "Retenida" },
  { id: "en_produccion", title: "En producción" },
  { id: "por_cobrar", title: "Por cobrar" },
  { id: "cobrada", title: "Cobrada" },
];

/** Orden del modelo de vista a partir del contrato. Ítems y costos no existen en el DTO Order. */
function viewOrder(o: S.OrderT, credit: S.CreditAuthorizationT | null): Order {
  const tipo = o.payment_condition === "cash" ? "contado" : o.payment_condition === "advance" ? "anticipo" : "credito";
  return {
    id: o.id,
    ref: o.display_code,
    customerId: o.customer?.id ?? "",
    // El contrato no garantiza marca; la vista usa card.brand (nullable). Este valor no se muestra.
    brand: toBrand(o.brand) ?? "corpotex",
    line: o.product_line ?? "",
    description: o.product_line ?? "",
    items: [],
    modality: o.production_mode === "own" ? "propia" : "tercerizada",
    saleCents: zero(o.sale),
    costs: { materiales: 0, manoObra: 0, terceros: 0, indirectos: 0 },
    costOrigin: "teorico",
    costComplete: false,
    internalChargeCents: null,
    sellerId: "",
    estado: ORDER_STATE[o.status],
    condicionPago: o.payment_condition ? { tipo, plazoDias: o.credit_term_days ?? 0, anticipoPct: credit?.advance_pct_bps != null ? credit.advance_pct_bps / 100 : null } : null,
    credito:
      credit && (credit.status === "approved" || credit.status === "rejected")
        ? {
            decision: credit.status === "approved" ? "aprobado" : "rechazado",
            by: "Vendedor",
            at: credit.decided_at ?? o.created_at,
            avisoMoraMostrado: credit.arrears_notice_shown,
            saldoReferenciaCents: zero(credit.overdue_balance_reference),
            nota: credit.reason,
          }
        : null,
    hoja: null,
    issuedOn: o.created_at.slice(0, 10),
    fechaEntregaSolicitada: o.requested_delivery_date,
    inicioProduccion: o.production_start_date,
    despacho: o.dispatch_date ? { fecha: o.dispatch_date, acta: "Registrado", by: "Taller" } : null,
    dataOrigin: o.data_origin,
  };
}

function hojaFromDraft(d: S.ExtractionDraftT): Order["hoja"] {
  const { f, missing } = draftLabel(d);
  const show = (v: unknown) => (v == null ? null : typeof v === "object" && "amount_cents" in (v as object) ? formatMoney((v as { amount_cents: number }).amount_cents) : String(v));
  return {
    version: d.revision,
    origen: "whatsapp",
    campos: f ? Object.entries(f).map(([k, v]) => ({ campo: FIELD_LABEL[k] ?? k, valor: show(v.value), estado: v.status })) : [],
    faltantes: missing,
    confianza: d.model_reported_confidence_permille != null ? d.model_reported_confidence_permille / 1000 : null,
    estado: d.status === "confirmed" ? "confirmada" : "borrador",
    revisadoPor: d.reviewed_by_user_id ? "Revisado" : null,
    revisadoAt: d.status === "confirmed" ? d.updated_at : null,
  };
}

function snapshotFor(customerId: string | null, ctx: Ctx): CreditSnapshot {
  const rs = ctx.receivables.filter((r) => r.customer.id === customerId);
  const open = rs.filter((r) => r.balance.amount_cents > 0);
  const overdue = open.filter((r) => r.due_bucket === "overdue");
  const overdueCents = overdue.reduce((s, r) => s + r.balance.amount_cents, 0);
  const soon = open.filter((r) => r.due_date && daysBetween(ctx.today, r.due_date) <= 3);
  const maxOverdueDays = overdue.reduce((m, r) => Math.max(m, r.days_overdue), 0);
  const orders = ctx.orders.filter((o) => o.customer?.id === customerId);
  return {
    usedCents: open.reduce((s, r) => s + r.balance.amount_cents, 0),
    availableCents: null,
    overdueCents,
    maxOverdueDays,
    avgDaysLate: null,
    paidOnTime: rs.filter((r) => r.status === "paid").length,
    closedCount: rs.filter((r) => r.status === "paid").length,
    status: overdueCents > 0 ? "en_mora" : soon.length ? "por_vencer" : "al_dia",
    aviso: overdueCents > 0 ? `Este cliente está en mora: ${formatMoney(overdueCents)} vencido, hasta ${maxOverdueDays} días de atraso. ¿Quieres volver a darle crédito?` : null,
    totalSoldCents: orders.reduce((s, o) => s + zero(o.sale), 0),
    totalPaidCents: rs.reduce((s, r) => s + r.applied_amount.amount_cents, 0),
    orderCount: orders.length,
    lastPaymentAt: null,
    lastOrderOn: orders.map((o) => o.created_at.slice(0, 10)).sort().pop() ?? null,
  };
}

function customerView(id: string, ctx: Ctx): CustomerView | null {
  const o = ctx.orders.find((x) => x.customer?.id === id);
  const r = ctx.receivables.find((x) => x.customer.id === id);
  const name = o?.customer?.name ?? r?.customer.name;
  if (!name) return null;
  const firstOrder = ctx.orders.filter((x) => x.customer?.id === id).map((x) => x.created_at.slice(0, 10)).sort()[0] ?? null;
  return { id, name, brand: toBrand(o?.brand), tipo: null, rucDni: null, sellerId: null, contactoWhatsapp: null, since: firstOrder, creditLimitCents: null };
}

function paymentToEvidence(p: S.PaymentT): Evidence {
  return {
    id: p.id,
    ref: p.display_code ?? `PAGO-${p.id.slice(0, 8)}`,
    // Los pagos no tienen marca en el contrato; la vista no la muestra en modo api.
    brand: "corpotex",
    kind: "voucher",
    origen: p.data_origin === "manual_entry" ? "manual" : "whatsapp",
    receivedAt: p.created_at,
    orderId: null,
    fields: {
      amountCents: p.received_amount.amount_cents,
      operationRef: p.operation_reference,
      payer: p.payer_name,
      // pago.fecha_pago es una fecha de negocio: se muestra sin hora (no se inventa una).
      paidAt: p.paid_at ? formatDate(p.paid_at.slice(0, 10)) : null,
      channel: CHANNEL[p.channel],
    },
    declaredAmountCents: null,
    legible: true,
    status: PHASE[p.phase],
    mismatchAccepted: false,
    verifiedBy: p.verification ? (p.verification.method === "simulated_demo" ? "Verificación de demo" : "Administración") : null,
    verifiedAt: p.verification?.verified_at ?? null,
    appliedAt: p.phase === "applied" ? p.created_at : null,
    discardReason: null,
    corrections: [],
    evidenceIds: p.evidence_ids,
    dataOrigin: p.data_origin,
  };
}

function paymentCard(p: S.PaymentT): PaymentCard {
  const ev = paymentToEvidence(p);
  return {
    id: p.id,
    ref: ev.ref,
    kind: "voucher",
    origen: ev.origen,
    channel: ev.fields.channel,
    orderId: null,
    orderRef: null,
    customer: p.payer_name ?? "Remitente sin identificar",
    amountCents: p.received_amount.amount_cents,
    seller: null,
    match: MATCH[p.reconciliation_status],
    status: ev.status,
    receivedAt: p.created_at,
  };
}

function alertRow(a: S.CollectionAlertT, ctx: Ctx): AlertRow {
  const r = ctx.receivables.find((x) => x.id === a.receivable_id);
  return {
    id: a.id,
    orderId: r?.order_id ?? "",
    regla: RULE[a.rule],
    responsable: "Administración",
    estado: ALERT_STATE[a.status],
    creadaAt: a.created_at,
    resolucion: a.resolution === "payment_applied" ? "Pago aplicado" : a.resolution === "manual" ? "Resuelta manualmente" : null,
    resueltaBy: null,
    resueltaAt: a.closed_at,
    orderRef: r?.order_code ?? (a.payment_id ? "Pago en revisión" : "—"),
    customer: r?.customer.name ?? "—",
    customerId: r?.customer.id ?? null,
    balanceCents: r ? r.balance.amount_cents : null,
    dueDate: r?.due_date ?? null,
  };
}

function receivableRow(r: S.ReceivableT, today: string): ReceivableRow {
  const due = r.due_date!;
  const d = daysBetween(today, due);
  return {
    id: r.order_id,
    orderRef: r.order_code,
    customerId: r.customer.id,
    customer: r.customer.name,
    seller: null,
    dueDate: due,
    daysToDue: d,
    balanceCents: r.balance.amount_cents,
    finance: r.status === "paid" ? "cobrado" : d < 0 ? "vencido" : d === 0 ? "vence_hoy" : d <= 3 ? "por_vencer" : "al_dia",
  };
}

function activity(e: S.AuditEventT, meId: string | null): ActivityItem {
  const actor = e.actor === "user" ? (e.actor_user_id === meId ? "Tú" : "Usuario") : e.actor === "n8n" ? "n8n" : e.actor === "scheduler" ? "Programador" : "Sistema";
  // evento_auditoria.entidad es el nombre de la tabla (pago, orden, aplicacion_pago, despacho…): solo pago y orden
  // apuntan a una pantalla con ese id.
  const href = e.entity_type === "pago" || e.entity_type === "payment" ? `/conciliacion/${e.entity_id}` : e.entity_type === "orden" || e.entity_type === "order" ? `/pedidos/${e.entity_id}` : null;
  return {
    id: e.id,
    at: e.occurred_at,
    who: e.entity_type,
    actor,
    text: e.operation.replace(/_/g, " ").toLowerCase(),
    reference: e.changes.map((c) => `${c.field}: ${c.new_value ?? "-"}`).join(" · "),
    amountCents: null,
    status: "completado",
    href,
  };
}

/** Pago aplicado por el usuario desde la vista: orden elegida para la conciliación (assignOrder). */
const chosenReceivable = new Map<string, string>();

/* ---------- Fuente ---------- */

export const apiSource: DataSource = {
  capabilities: {
    messagesLog: false,
    resolveAlerts: false,
    retryMessages: false,
    editPaymentFields: false,
    discardPayment: false,
    manualOrderCapture: false,
    voucherNeedsFile: true,
    settings: false,
    orderItems: false,
    customerDirectory: false,
    resetDemo: false,
    demoAccounts: false,
  },

  async getDashboard(scope, role, notify) {
    const isManager = role === "gerencia";
    const [ctx, alerts, payments, drafts, summary, forecast, audit, me] = await Promise.all([
      context(),
      loadAlerts(),
      role === "administracion" || role === "gerencia" ? loadPayments() : Promise.resolve([] as S.PaymentT[]),
      loadOrderDrafts(),
      isManager ? soft(endpoints.getResultsSummary(), null) : Promise.resolve(null),
      isManager ? soft(endpoints.getCashForecast(), null) : Promise.resolve(null),
      role === "administracion" || role === "gerencia" ? soft(endpoints.listAuditEvents({ limit: 6 }), null) : Promise.resolve(null),
      soft(loadMe(), null),
    ]);
    const orders = ctx.orders.filter((o) => fits(toBrand(o.brand), scope));
    const ids = new Set(orders.map((o) => o.id));
    const recs = ctx.receivables.filter((r) => ids.has(r.order_id) && r.balance.amount_cents > 0);
    const due = recs.filter((r) => r.due_date);
    const pipeline = recs.filter((r) => !r.due_date);
    const opening = forecast?.opening_cash ? forecast.opening_cash.amount.amount_cents : null;
    const collected = summary ? summary.applied_collections_total.amount_cents : recs.reduce((s, r) => s + r.applied_amount.amount_cents, 0);

    let running = opening ?? 0;
    const weeks: WeekPoint[] | null = forecast
      ? forecast.weeks.map((w, i) => {
          running += w.net.amount_cents;
          return {
            label: `Sem ${i + 1}`,
            range: `${formatDate(w.week_start)} al ${formatDate(w.week_end)}`,
            inCents: w.expected_inflows.amount_cents,
            outCents: w.outflows.amount_cents,
            balanceCents: w.closing_balance?.amount_cents ?? running,
            outflows: [],
            inflows: [],
          };
        })
      : null;

    const assistant: AssistantNote[] = [];
    if (notify.credito) {
      for (const d of drafts) {
        const c = draftCard(d, ctx.today);
        assistant.push({ id: `draft-${d.id}`, tone: "violet", title: `Borrador de pedido por revisar`, detail: `${c.customer}. ${c.faltantes ? `${c.faltantes} datos faltantes.` : "Listo para confirmar."}`, href: `/pedidos/${c.id}`, date: c.issuedOn });
      }
      for (const o of orders.filter((x) => x.status === "pending_approval")) {
        assistant.push({ id: `pend-${o.id}`, tone: "violet", title: role === "vendedor" ? `${o.display_code} espera tu confirmación` : `${o.display_code} espera confirmación del vendedor`, detail: `${o.customer?.name ?? "Sin cliente"}, ${formatMoney(zero(o.sale))}.`, href: `/pedidos/${o.id}`, date: o.created_at.slice(0, 10) });
      }
      for (const o of orders.filter((x) => x.status === "held")) {
        assistant.push({ id: `ret-${o.id}`, tone: "info", title: `${o.display_code} retenida: falta ${o.payment_condition === "cash" ? "el pago al contado" : "anticipo"} de ${formatMoney(requiredBeforeProduction(o))}`, detail: "No entra a producción hasta que Administración verifique y aplique el pago.", href: `/pedidos/${o.id}`, date: o.created_at.slice(0, 10) });
      }
    }
    if (notify.vencimientos) {
      for (const r of due) {
        const d = daysBetween(ctx.today, r.due_date!);
        if (d < 0) assistant.push({ id: `due-${r.id}`, tone: "bad", title: `${r.customer.name} excedió su fecha de pago`, detail: `${r.order_code} venció el ${formatDate(r.due_date!)} (hace ${-d} días) con saldo ${formatMoney(r.balance.amount_cents)}.`, href: `/clientes/${r.customer.id}`, date: r.due_date });
        else if (d <= 3) assistant.push({ id: `due-${r.id}`, tone: "warn", title: d === 0 ? `${r.order_code} vence hoy` : `${r.order_code} vence el ${formatDate(r.due_date!)}`, detail: `${r.customer.name}: saldo ${formatMoney(r.balance.amount_cents)}.`, href: `/clientes/${r.customer.id}`, date: r.due_date });
      }
    }
    if (notify.sinPedido && role !== "vendedor") {
      const review = payments.filter((p) => ["duplicate", "orphan", "amount_mismatch"].includes(p.reconciliation_status) && p.phase !== "applied");
      if (review.length) assistant.push({ id: "review", tone: "warn", title: `${review.length} ${review.length === 1 ? "pago en revisión" : "pagos en revisión"}`, detail: "Duplicados, sin orden o con monto que no cuadra.", href: `/conciliacion/${review[0].id}`, date: review[0].created_at });
      const open = alerts.filter((a) => a.status === "open");
      if (open.length) assistant.push({ id: "alerts", tone: "bad", title: `${open.length} ${open.length === 1 ? "alerta de cobranza abierta" : "alertas de cobranza abiertas"}`, detail: "Revisa la mora temprana en Cobranza.", href: "/cobranza", date: open[0].created_at });
    }

    return {
      cutDate: forecast?.as_of ?? summary?.as_of ?? ctx.today,
      demo: orders.some((o) => o.data_origin === "demo_fixture"),
      factorCobro: forecast ? 1 - forecast.assumptions.collection_risk_factor_bps / 10_000 : null,
      expectedCents: due.reduce((s, r) => s + r.balance.amount_cents, 0),
      openOrders: due.length,
      overdueCents: due.filter((r) => r.due_bucket === "overdue").reduce((s, r) => s + r.balance.amount_cents, 0),
      pipelineCents: pipeline.reduce((s, r) => s + r.balance.amount_cents, 0),
      pipelineCount: pipeline.length,
      cashCents: opening != null ? opening + collected : null,
      openingCents: opening,
      collectedCents: collected,
      openingSource: forecast?.opening_cash ? `Saldo inicial al ${formatDate(forecast.opening_cash.as_of)} (${forecast.opening_cash.source === "demo_fixture" ? "demo" : "manual"})` : "",
      marginCents: summary?.cost_status === "complete" ? cents(summary.margin_total) : null,
      perceivedCents: null,
      orderCount: orders.length,
      weeks,
      assistant,
      activity: audit ? audit.items.map((e) => activity(e, me?.user_id ?? null)) : null,
    };
  },

  async getOrderBoard(scope) {
    const [ctx, drafts] = await Promise.all([context(), loadOrderDrafts()]);
    const moroso = overdueCustomers(ctx);
    const cards = [
      ...drafts.map((d) => draftCard(d, ctx.today)),
      ...ctx.orders.map((o) => card(o, ctx, moroso)),
    ].filter((c) => fits(c.brand, scope));
    return {
      columns: ORDER_COLUMNS.map((col) => {
        const list = cards
          .filter((c) => columnOf(c) === col.id)
          .sort((a, b) => (col.id === "por_cobrar" ? (a.dueDate ?? "").localeCompare(b.dueDate ?? "") : b.issuedOn.localeCompare(a.issuedOn)));
        return { ...col, cards: col.id === "cobrada" ? list.slice(0, 6) : list };
      }),
      rejected: cards.filter((c) => c.estado === "rechazada").length,
    };
  },

  async getOrders(scope) {
    const ctx = await context();
    const moroso = overdueCustomers(ctx);
    return ctx.orders
      .map((o) => row(o, ctx, moroso))
      .filter((r) => fits(r.brand, scope))
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
  },

  async getOrder(id) {
    const ctx = await context();
    const moroso = overdueCustomers(ctx);

    if (id.startsWith(DRAFT)) {
      const d = await soft(endpoints.getDraft(id.slice(DRAFT.length)), null);
      if (!d) return null;
      const c = draftCard(d, ctx.today);
      const customer: CustomerView = { id: "", name: c.customer, brand: c.brand, tipo: null, rucDni: null, sellerId: null, contactoWhatsapp: null, since: null, creditLimitCents: null };
      const known = ctx.receivables.find((r) => r.customer.name.toLowerCase() === c.customer.toLowerCase());
      const order: Order = {
        ...viewOrder(
          { id: c.id, display_code: c.ref, customer: null, brand: c.brand, product_line: c.description, production_mode: "outsourced", sale: c.saleCents ? { amount_cents: c.saleCents, currency: "PEN" } : null, status: "draft", source: "whatsapp", payment_condition: null, credit_term_days: null, advance_required: { amount_cents: 0, currency: "PEN" }, requested_delivery_date: null, production_start_date: null, dispatch_date: null, receivable_status: null, due_date: null, source_evidence_id: d.evidence_id, data_origin: "reviewed_extraction", created_at: d.created_at },
          null,
        ),
        hoja: hojaFromDraft(d),
      };
      return {
        cutDate: ctx.today,
        order,
        customer,
        seller: null,
        card: { ...c, clienteEnMora: known ? moroso.has(known.customer.id) : false },
        credit: snapshotFor(known?.customer.id ?? null, ctx),
        paidCents: 0,
        anticipoRequeridoCents: 0,
        gatekeeper: false,
        costCents: null,
        marginCents: null,
        perceivedCents: null,
        payments: [],
        pendingEvidence: [],
        messages: null,
        alerts: [],
        plazoDefecto: 30,
      };
    }

    const o = ctx.orders.find((x) => x.id === id) ?? (await soft(endpoints.getOrder(id), null));
    if (!o) return null;
    const [credit, alerts] = await Promise.all([soft(endpoints.getCreditDecision(o.id), null), loadAlerts()]);
    const r = ctx.byOrder.get(o.id);
    const c = card(o, ctx, moroso);
    return {
      cutDate: ctx.today,
      order: viewOrder(o, credit),
      customer: (o.customer && customerView(o.customer.id, ctx)) ?? { id: "", name: c.customer, brand: c.brand, tipo: null, rucDni: null, sellerId: null, contactoWhatsapp: null, since: null, creditLimitCents: null },
      seller: null,
      card: c,
      credit: snapshotFor(o.customer?.id ?? null, ctx),
      paidCents: r ? r.applied_amount.amount_cents : 0,
      anticipoRequeridoCents: requiredBeforeProduction(o),
      gatekeeper: !["draft", "pending_approval", "held", "cancelled"].includes(o.status),
      costCents: null,
      marginCents: null,
      perceivedCents: null,
      payments:
        r && r.applied_amount.amount_cents > 0
          ? [{ id: `${r.id}-applied`, at: o.created_at, amountCents: r.applied_amount.amount_cents, channel: "Pagos aplicados", by: "Administración", evidenceId: null }]
          : [],
      pendingEvidence: [],
      messages: null,
      alerts: alerts.filter((a) => a.receivable_id && a.receivable_id === r?.id).map((a) => alertRow(a, ctx)),
      plazoDefecto: o.credit_term_days ?? 30,
    };
  },

  async getTaller(scope) {
    const ctx = await context();
    const map = (o: S.OrderT): TallerOrder => ({
      id: o.id,
      ref: o.display_code,
      customer: o.customer?.name ?? "Sin cliente",
      brand: toBrand(o.brand),
      description: o.product_line ?? "",
      items: [],
      modality: o.production_mode === "own" ? "propia" : "tercerizada",
      issuedOn: o.created_at.slice(0, 10),
      inicioProduccion: o.production_start_date,
      entregaSolicitada: o.requested_delivery_date,
      plazoDias: o.credit_term_days,
      despacho: o.dispatch_date ? { fecha: o.dispatch_date, acta: "Registrado", by: "Taller" } : null,
      anticipoPendienteCents: o.status === "held" ? requiredBeforeProduction(o) : 0,
    });
    const orders = ctx.orders.filter((o) => fits(toBrand(o.brand), scope));
    return {
      cutDate: ctx.today,
      enProduccion: orders
        .filter((o) => o.status === "released" || o.status === "in_production")
        .sort((a, b) => (a.requested_delivery_date ?? "").localeCompare(b.requested_delivery_date ?? ""))
        .map(map),
      retenidas: orders.filter((o) => o.status === "held").map(map),
      despachadas: orders
        .filter((o) => o.dispatch_date)
        .sort((a, b) => (b.dispatch_date ?? "").localeCompare(a.dispatch_date ?? ""))
        .slice(0, 5)
        .map(map),
    };
  },

  async getQueue() {
    const payments = await loadPayments();
    return payments.map(paymentCard).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },

  async getEvidence(id) {
    const p = await soft(endpoints.getPayment(id), null);
    if (!p) return null;
    const [rec, link] = await Promise.all([
      soft(endpoints.getReconciliationCandidates(id), null),
      p.evidence_ids[0] ? soft(endpoints.getEvidenceDownloadLink(p.evidence_ids[0]), null) : Promise.resolve(null),
    ]);
    const chosen = chosenReceivable.get(id);
    const top = rec?.candidates.find((c) => c.receivable_id === chosen) ?? rec?.candidates[0] ?? null;
    const ev = paymentToEvidence(p);
    ev.orderId = top?.order_id ?? null;
    const missing = [
      p.operation_reference ? null : "Número de operación",
      p.payer_name ? null : "Remitente",
      p.paid_at ? null : "Fecha de pago",
    ].filter((x): x is string => x !== null);
    return {
      evidence: ev,
      brand: null,
      imageUrl: link?.url ?? null,
      appliedBy: p.phase === "applied" ? "Administración" : null,
      match: MATCH[p.reconciliation_status],
      duplicateOfId: p.duplicate_of_payment_id,
      order: top
        ? { id: top.order_id, ref: top.order_code, customer: top.customer_name, line: null, saleCents: null, balanceCents: top.balance.amount_cents, daysToDue: null, dueDate: null, seller: null }
        : null,
      missing,
      openOrders: (rec?.candidates ?? []).filter((c) => c.balance.amount_cents > 0).map((c) => ({ id: c.receivable_id, label: `${c.order_code} · ${c.customer_name} · saldo ${formatMoney(c.balance.amount_cents)}` })),
    };
  },

  async getCobranza(scope) {
    const [ctx, alerts] = await Promise.all([context(), loadAlerts()]);
    const brandOf = new Map(ctx.orders.map((o) => [o.id, toBrand(o.brand)]));
    return {
      cutDate: ctx.today,
      receivables: ctx.receivables
        .filter((r) => r.due_date && r.balance.amount_cents > 0 && fits(brandOf.get(r.order_id) ?? null, scope))
        .map((r) => receivableRow(r, ctx.today))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      alerts: alerts
        .map((a) => alertRow(a, ctx))
        .sort((a, b) => (a.estado === b.estado ? b.creadaAt.localeCompare(a.creadaAt) : a.estado === "abierta" ? -1 : 1)),
      messages: null,
    };
  },

  async getCustomers(scope) {
    const ctx = await context();
    const ids = new Set<string>();
    for (const o of ctx.orders) if (o.customer) ids.add(o.customer.id);
    for (const r of ctx.receivables) ids.add(r.customer.id);
    const rows: CustomerRow[] = [];
    for (const id of ids) {
      const v = customerView(id, ctx);
      if (!v || !fits(v.brand, scope)) continue;
      const snap = snapshotFor(id, ctx);
      const next = ctx.receivables
        .filter((r) => r.customer.id === id && r.due_date && r.balance.amount_cents > 0)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
      rows.push({
        id,
        name: v.name,
        brand: v.brand,
        tipo: null,
        seller: null,
        since: v.since,
        creditLimitCents: null,
        usedCents: snap.usedCents,
        overdueCents: snap.overdueCents,
        maxOverdueDays: snap.maxOverdueDays,
        status: snap.status,
        avgDaysLate: null,
        lastPaymentAt: null,
        nextDue: next ? { id: next.order_id, ref: next.order_code, date: next.due_date!, overdue: next.due_date! < ctx.today } : null,
        pendingOrders: ctx.orders.filter((o) => o.customer?.id === id && (o.status === "pending_approval" || o.status === "draft")).length,
      });
    }
    return rows.sort((a, b) => b.overdueCents - a.overdueCents || b.usedCents - a.usedCents);
  },

  async getCustomer(id) {
    const ctx = await context();
    const view = customerView(id, ctx);
    if (!view) return null;
    const moroso = overdueCustomers(ctx);
    const orders = ctx.orders.filter((o) => o.customer?.id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const [statement, credits] = await Promise.all([
      soft(endpoints.getCustomerStatement(id), null),
      Promise.all(orders.map((o) => soft(endpoints.getCreditDecision(o.id), null))),
    ]);
    const payments = (statement?.applications ?? []).map((a, i) => ({
      id: `${a.payment_code ?? "pago"}-${i}`,
      at: a.applied_at,
      orderRef: a.order_code,
      amountCents: a.applied_amount.amount_cents,
      // El estado de cuenta trae el código del pago, no su id: se muestra sin enlace a Conciliación.
      channel: a.payment_code,
      by: null,
      evidence: null,
    }));
    const decisions: CreditDecisionRow[] = [];
    orders.forEach((o, i) => {
      const c = credits[i];
      if (!c || (c.status !== "approved" && c.status !== "rejected")) return;
      decisions.push({
        orderId: o.id,
        orderRef: o.display_code,
        decision: c.status === "approved" ? "aprobado" : "rechazado",
        by: "Vendedor",
        at: c.decided_at ?? o.created_at,
        avisoMoraMostrado: c.arrears_notice_shown,
        tipo: o.payment_condition === "cash" ? "Contado" : o.payment_condition === "advance" ? "Anticipo" : "Crédito",
        plazoDias: c.credit_term_days ?? 0,
        nota: c.reason,
        saleCents: cents(o.sale),
      });
    });

    const timeline: TimelineItem[] = [];
    for (const o of orders) {
      timeline.push({ id: `${o.id}-p`, at: o.created_at, kind: "pedido", title: `Pedido ${o.display_code}`, detail: o.product_line ?? "", amountCents: cents(o.sale), tone: "neutral", future: false, dateOnly: false });
      if (o.dispatch_date) timeline.push({ id: `${o.id}-d`, at: `${o.dispatch_date}T12:00:00`, kind: "despacho", title: `Despacho de ${o.display_code}`, detail: `Inicia el plazo de ${o.credit_term_days ?? 0} días.`, amountCents: null, tone: "info", future: false, dateOnly: true });
      const r = ctx.byOrder.get(o.id);
      if (r?.due_date && r.balance.amount_cents > 0) {
        const d = daysBetween(ctx.today, r.due_date);
        timeline.push({ id: `${o.id}-v`, at: `${r.due_date}T23:59:00`, kind: "vencimiento", title: d < 0 ? `${o.display_code} vencido` : `Vence ${o.display_code}`, detail: `Saldo ${formatMoney(r.balance.amount_cents)}`, amountCents: r.balance.amount_cents, tone: d < 0 ? "bad" : d <= 3 ? "warn" : "neutral", future: r.due_date > ctx.today, dateOnly: true });
      }
    }
    for (const p of payments) timeline.push({ id: p.id, at: p.at, kind: "pago", title: `Pago aplicado a ${p.orderRef}`, detail: p.evidence ?? "Pago", amountCents: p.amountCents, tone: "ok", future: false, dateOnly: false });
    for (const d of decisions)
      timeline.push({ id: `${d.orderId}-c`, at: d.at, kind: "credito", title: `${d.orderRef}: ${d.decision === "aprobado" ? `${d.tipo.toLowerCase()} aprobado` : "crédito rechazado"}`, detail: `${d.avisoMoraMostrado ? "Vio el aviso de mora" : "Sin aviso de mora"}${d.nota ? ` · ${d.nota}` : ""}`, amountCents: null, tone: d.decision === "aprobado" ? (d.avisoMoraMostrado ? "warn" : "violet") : "bad", future: false, dateOnly: false });
    timeline.sort((a, b) => b.at.localeCompare(a.at));

    return {
      cutDate: ctx.today,
      customer: view,
      seller: null,
      snapshot: snapshotFor(id, ctx),
      orders: orders.map((o) => row(o, ctx, moroso)),
      payments,
      decisions,
      messages: null,
      timeline,
    };
  },

  async getStatement(customerId) {
    const s = await soft(endpoints.getCustomerStatement(customerId), null);
    if (!s) return null;
    const ctx = await context();
    const today = ctx.today;
    let overdue = 0;
    const orders = s.orders.map((o) => {
      const full = ctx.orders.find((x) => x.id === o.order_id);
      const late = o.due_date != null && o.due_date < today && o.balance.amount_cents > 0;
      if (late) overdue += o.balance.amount_cents;
      return {
        id: o.order_id,
        ref: o.order_code,
        description: full?.product_line ?? null,
        despachoOn: full?.dispatch_date ?? null,
        dueDate: o.due_date,
        saleCents: o.sale.amount_cents,
        paidCents: o.applied_amount.amount_cents,
        balanceCents: o.balance.amount_cents,
        state: (o.balance.amount_cents === 0 ? "Pagado" : late ? "Vencido" : o.due_date ? "Por pagar" : "En producción") as "Pagado" | "Vencido" | "Por pagar" | "En producción",
      };
    });
    const next = s.orders.filter((o) => o.due_date && o.balance.amount_cents > 0).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0];
    return {
      customerId: s.customer.id,
      customer: s.customer.name,
      generatedAt: s.generated_at,
      balanceCents: s.total_balance.amount_cents,
      overdueCents: overdue,
      nextDue: next ? { ref: next.order_code, date: next.due_date!, amountCents: next.balance.amount_cents } : null,
      orders,
      payments: s.applications.map((a, i) => ({ id: `${a.payment_code ?? "pago"}-${i}`, at: a.applied_at, orderRef: a.order_code, paymentRef: a.payment_code, amountCents: a.applied_amount.amount_cents })),
      demo: s.data_origin === "demo_fixture",
    };
  },

  async getResults(scope) {
    const [ctx, byOrder, byBrand, byLine, center, summary] = await Promise.all([
      context(),
      endpoints.getMarginReport({ group_by: "order", limit: 200 }),
      endpoints.getMarginReport({ group_by: "brand" }),
      endpoints.getMarginReport({ group_by: "product_line" }),
      soft(endpoints.getProductionCenterResults(), null),
      soft(endpoints.getResultsSummary(), null),
    ]);
    const COMPONENT: Record<string, string> = { raw_materials: "materiales", labor: "mano de obra", outsourced: "terceros", overhead: "indirectos", logistics: "logística" };
    const rows: ResultRow[] = [];
    for (const m of byOrder.items) {
      const o = ctx.orders.find((x) => x.id === m.group_id);
      const brand = toBrand(o?.brand);
      if (!fits(brand, scope)) continue;
      const r = o ? ctx.byOrder.get(o.id) : undefined;
      rows.push({
        id: m.group_id ?? m.group_key,
        ref: o?.display_code ?? m.group_key,
        customer: o?.customer?.name ?? "—",
        customerId: o?.customer?.id ?? null,
        brand,
        line: o?.product_line ?? null,
        description: o?.product_line ?? m.group_key,
        modality: m.production_mode === "own" ? "propia" : m.production_mode === "outsourced" ? "tercerizada" : null,
        costOrigin: null,
        issuedOn: o?.created_at.slice(0, 10) ?? byOrder.as_of,
        saleCents: m.revenue.amount_cents,
        costCents: cents(m.total_cost),
        costs: null,
        costComplete: m.cost_status === "complete",
        missingCosts: m.missing_cost_components.map((c) => COMPONENT[c] ?? c),
        marginCents: cents(m.margin),
        perceivedCents: null,
        collectedCents: r ? r.applied_amount.amount_cents : null,
        balanceCents: r ? r.balance.amount_cents : null,
        dueDate: r?.due_date ?? null,
      });
    }
    const collectedByBrand = (b: Brand) =>
      ctx.receivables.filter((r) => toBrand(ctx.orders.find((o) => o.id === r.order_id)?.brand) === b).reduce((s, r) => s + r.applied_amount.amount_cents, 0);
    const items = center?.items ?? [];
    const sum = (f: (i: (typeof items)[number]) => number | null) => (items.some((i) => f(i) == null) ? null : items.reduce((s, i) => s + (f(i) ?? 0), 0));
    return {
      cutDate: summary?.as_of ?? byOrder.as_of,
      demo: byOrder.data_origin === "demo_fixture",
      rows,
      byBrand: byBrand.items
        .map((m) => ({ m, brand: toBrand(m.group_key) }))
        .filter((x): x is { m: S.MarginRowT; brand: Brand } => x.brand !== null && fits(x.brand, scope))
        .map(({ m, brand }) => ({ brand, saleCents: m.revenue.amount_cents, marginCents: cents(m.margin), perceivedCents: null, collectedCents: collectedByBrand(brand) })),
      byLine: byLine.items.map((m) => ({ line: m.group_key, saleCents: m.revenue.amount_cents, marginCents: cents(m.margin), orders: m.orders_count })),
      workshop: items.length
        ? {
            orderIds: items.map((i) => i.order_code),
            costCents: sum((i) => cents(i.workshop_cost)),
            internalChargeCents: items.reduce((s, i) => s + i.internal_charge.amount_cents, 0),
            workshopResultCents: sum((i) => cents(i.workshop_result)),
            commercialResultCents: items.reduce((s, i) => s + i.commercial_result.amount_cents, 0),
            consolidatedMarginCents: sum((i) => cents(i.consolidated_margin)),
          }
        : null,
    };
  },

  ordersCsv: () => endpoints.exportOrdersCsv(),

  async getProfile(person) {
    const [me, audit] = await Promise.all([soft(loadMe(), null), soft(endpoints.listAuditEvents({ limit: 100 }), null)]);
    const mine = audit ? audit.items.filter((e) => e.actor === "user" && e.actor_user_id === me?.user_id) : null;
    const count = (re: RegExp) => mine?.filter((e) => re.test(e.operation)).length ?? 0;
    const counts: Record<Role, Array<{ label: string; value: number }>> = {
      vendedor: [
        { label: "Créditos decididos", value: count(/CREDIT|CONTADO/i) },
        { label: "Borradores confirmados", value: count(/DRAFT|BORRADOR/i) },
      ],
      administracion: [
        { label: "Pagos verificados", value: count(/VERIF/i) },
        { label: "Pagos aplicados", value: count(/APPL|APLICADO/i) },
        { label: "Despachos registrados", value: count(/DISPATCH|DESPACHO/i) },
      ],
      gerencia: [{ label: "Eventos revisados", value: audit?.items.length ?? 0 }],
      jefe_taller: [{ label: "Despachos registrados", value: count(/DISPATCH|DESPACHO/i) }],
    };
    return { activity: mine ? mine.slice(0, 30).map((e) => activity(e, me?.user_id ?? null)) : null, counts: counts[person.role], settings: null, ownOrders: [] };
  },

  async search(q, brand) {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const [ctx, payments] = await Promise.all([context(), loadPayments()]);
    const ok = (b: Brand | null) => !brand || b === null || b === brand;
    const seen = new Set<string>();
    const customers = ctx.orders
      .filter((o) => o.customer && o.customer.name.toLowerCase().includes(term) && ok(toBrand(o.brand)) && !seen.has(o.customer.id) && seen.add(o.customer.id))
      .map((o) => ({ id: o.customer!.id, label: o.customer!.name, detail: "Cliente", href: `/clientes/${o.customer!.id}`, brand: toBrand(o.brand) }));
    const orders = ctx.orders
      .filter((o) => ok(toBrand(o.brand)) && (o.display_code.toLowerCase().includes(term) || (o.customer?.name ?? "").toLowerCase().includes(term)))
      .map((o) => ({ id: o.id, label: `${o.display_code} · ${o.customer?.name ?? "Sin cliente"}`, detail: `Orden ${o.sale ? formatMoney(o.sale.amount_cents) : ""}`, href: `/pedidos/${o.id}`, brand: toBrand(o.brand) }));
    const pays = payments
      .filter((p) => (p.display_code ?? "").toLowerCase().includes(term) || (p.payer_name ?? "").toLowerCase().includes(term) || (p.operation_reference ?? "").includes(term))
      .map((p) => ({ id: p.id, label: `${p.display_code ?? "Pago"} · ${p.payer_name ?? "Sin remitente"}`, detail: `${CHANNEL[p.channel]} ${formatMoney(p.received_amount.amount_cents)}`, href: `/conciliacion/${p.id}`, brand: null }));
    return [...customers, ...orders, ...pays].slice(0, 7);
  },

  async getCaptureOptions(brand) {
    const ctx = await context();
    const open = ctx.receivables.filter((r) => r.balance.amount_cents > 0 && fits(toBrand(ctx.orders.find((o) => o.id === r.order_id)?.brand), brand));
    const customers = new Map<string, string>();
    for (const o of ctx.orders) if (o.customer && fits(toBrand(o.brand), brand)) customers.set(o.customer.id, o.customer.name);
    return {
      orders: open.map((r) => ({ id: r.order_id, label: `${r.order_code} · ${r.customer.name} · saldo ${formatMoney(r.balance.amount_cents)}` })),
      customers: [...customers].map(([id, name]) => ({ id, name })),
    };
  },

  commands: {
    editField: () => unavailable("Corregir un pago ya creado"),
    markDuplicate: () => unavailable("Marcar duplicado a mano"),
    discard: () => unavailable("Descartar un pago"),
    resolveAlert: () => unavailable("Resolver una alerta"),
    retryMessage: () => unavailable("Reintentar un mensaje"),
    captureOrder: () => unavailable("El alta manual de pedidos"),
    updateSettings: () => unavailable("Cambiar los supuestos"),
    setInternalCharge: () => unavailable("Cambiar el precio de transferencia"),
    reset: () => unavailable("Restablecer la demo"),

    /** Elegir la cuenta por cobrar donde se aplicará el pago (se usa en applyPayment). */
    assignOrder: (id, receivableId) =>
      run(async () => {
        chosenReceivable.set(id, receivableId);
        return { ok: true, message: "Cuenta por cobrar elegida. Se usará al aplicar el pago." };
      }),

    verifyFunds: (id, _actor, acceptMismatch) =>
      run(async () => {
        const p = await endpoints.registerPaymentVerification(id, {
          method: "manual_confirmation",
          note: acceptMismatch ? "Administración confirmó en su banca; acepta la diferencia de monto." : "Administración confirmó en su banca.",
        });
        return { ok: true, message: `${p.display_code ?? "Pago"} verificado en banco.` };
      }),

    applyPayment: (id) =>
      run(async () => {
        const [p, rec] = await Promise.all([endpoints.getPayment(id), endpoints.getReconciliationCandidates(id)]);
        const chosen = chosenReceivable.get(id);
        const c = rec.candidates.find((x) => x.receivable_id === chosen) ?? rec.candidates.find((x) => x.balance.amount_cents > 0);
        if (!c) return { ok: false, message: "No hay una cuenta por cobrar candidata para este pago." };
        const available = zero(p.verified_amount ?? p.received_amount) - p.applied_amount.amount_cents;
        const amount = Math.min(available, c.balance.amount_cents);
        if (amount <= 0) return { ok: false, message: "El pago no tiene monto disponible para aplicar." };
        const res = await endpoints.applyPayment(id, { receivable_id: c.receivable_id, amount: { amount_cents: amount, currency: "PEN" } });
        chosenReceivable.delete(id);
        return { ok: true, message: `${formatMoney(res.application.applied_amount.amount_cents)} aplicado a ${c.order_code}. Saldo: ${formatMoney(res.receivable.balance.amount_cents)}.` };
      }),

    confirmOrder: (orderId, terms, _actor, opts) =>
      run(async () => {
        let id = orderId;
        let customerId: string | null = null;
        const ctx = await context();
        if (orderId.startsWith(DRAFT)) {
          const d = await endpoints.getDraft(orderId.slice(DRAFT.length));
          const name = d.order_fields?.customer_name.value?.toLowerCase();
          customerId = ctx.receivables.find((r) => r.customer.name.toLowerCase() === name)?.customer.id ?? null;
        } else {
          customerId = ctx.orders.find((o) => o.id === orderId)?.customer?.id ?? null;
        }
        // D-005: la mora avisa, no bloquea. Se pide confirmación explícita antes de dar crédito.
        const snap = snapshotFor(customerId, ctx);
        if (terms.tipo === "credito" && snap.status === "en_mora" && !opts.moraAcknowledged) return { ok: false, code: "aviso_mora", message: snap.aviso ?? "Cliente en mora." };

        if (orderId.startsWith(DRAFT)) {
          const d = await endpoints.getDraft(orderId.slice(DRAFT.length));
          const res = await endpoints.confirmDraft(d.id, d.revision);
          if (!res.order_id) return { ok: false, message: "El borrador se confirmó pero no devolvió una orden." };
          id = res.order_id;
        }
        await endpoints.submitCreditDecision(id, {
          decision: "approved",
          arrears_notice_acknowledged: opts.moraAcknowledged,
          ...(terms.tipo === "credito" ? { credit_term_days: terms.plazoDias } : {}),
          ...(terms.tipo === "anticipo" && terms.anticipoPct != null ? { advance_pct_bps: Math.round(terms.anticipoPct * 100), credit_term_days: terms.plazoDias } : {}),
          ...(opts.nota ? { reason: opts.nota } : {}),
        });
        return { ok: true, message: "Orden confirmada.", id };
      }),

    rejectOrder: (orderId, nota) =>
      run(async () => {
        if (orderId.startsWith(DRAFT)) {
          await endpoints.discardDraft(orderId.slice(DRAFT.length), nota);
          return { ok: true, message: "Borrador descartado." };
        }
        await endpoints.submitCreditDecision(orderId, { decision: "rejected", arrears_notice_acknowledged: true, reason: nota });
        return { ok: true, message: "Crédito rechazado." };
      }),

    registerDispatch: (orderId, fecha, acta) =>
      run(async () => {
        const o = await endpoints.registerDispatch(orderId, { dispatch_date: fecha, note: acta || null });
        const due = o.due_date ?? (o.credit_term_days ? addDays(fecha, o.credit_term_days) : null);
        return { ok: true, message: `Despacho registrado.${due ? ` Vence el ${formatDate(due)}.` : ""}` };
      }),

    captureVoucher: (input) =>
      run(async () => {
        if (!input.file) return { ok: false, message: "Adjunta la imagen del voucher: la API extrae los datos del archivo." };
        const ev = await endpoints.uploadEvidenceFile(input.file, input.operationRef || undefined);
        await endpoints.startExtraction(ev.id, "payment_voucher");
        return { ok: true, message: "Voucher subido. La extracción queda como borrador para revisar en Conciliación.", id: ev.id };
      }),
  },
};
