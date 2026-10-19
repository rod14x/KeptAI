import type { Brand, CollectionAlert, Customer, Evidence, MatchKind, Order, OrderFinance, OrderState, OutgoingMessage, Role, Scope } from "../model";
import { inScope } from "../model";
import { bump, getVersion } from "../events";
import { addDays, daysBetween, todayIso } from "../../lib/dates";
import { formatDate, formatMoney } from "../../lib/format";
import { all, endpoints } from "./endpoints";
import { HttpError } from "./http";
import type * as S from "./schemas";
import { MESSAGE_LABEL } from "../dto";
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
  MessageRow,
  OrderCard,
  OrderColumnId,
  OrderRow,
  PaymentCard,
  ReceivableRow,
  ResultRow,
  ResultsDTO,
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

/* ---------- Lecturas por rol ---------- */

// Roles que pueden leer cada recurso (AccessPolicy de Spring). Spring decide; aquí solo se evita pedir lo que el rol
// no puede ver, para no generar un 403 en cada carga. Si /me falla, se intenta igual y el 403 se degrada.
type ApiRole = S.UserContextT["role"];
// D-014: la cartera del vendedor sigue sin definir (PanelContext responde 403 a VENDEDOR), así que no se le pide nada.
const READS = {
  orders: ["ADMIN", "GERENTE", "JEFE_TALLER"],
  payments: ["ADMIN", "GERENTE"],
  reconciliation: ["ADMIN"],
  receivables: ["ADMIN", "GERENTE"],
  alerts: ["ADMIN"],
  credit: ["ADMIN", "GERENTE"],
  notifications: ["ADMIN", "GERENTE"],
  drafts: ["ADMIN"],
  results: ["GERENTE"],
  audit: ["ADMIN", "GERENTE"],
} satisfies Record<string, ApiRole[]>;
type Read = keyof typeof READS;

/** Revisión de borradores (D-013): implementada en Spring para ADMIN. */
const DRAFTS_IN_SPRING = true;

const loadMe = () => cached("me", () => endpoints.getMyContext());

async function canRead(what: Read) {
  const me = await soft(loadMe(), null);
  return me === null || (READS[what] as readonly ApiRole[]).includes(me.role);
}
async function readIf<T>(what: Read, load: () => Promise<T>, fallback: T): Promise<T> {
  return (await canRead(what)) ? soft(load(), fallback) : fallback;
}

const loadOrders = () => cached("orders", () => readIf("orders", () => all.orders(), [] as S.OrderT[]));
const loadReceivables = () => cached("receivables", () => readIf("receivables", () => all.receivables(), [] as S.ReceivableT[]));
const loadPayments = () => cached("payments", () => readIf("payments", () => all.payments(), [] as S.PaymentT[]));
const loadAlerts = () => cached("alerts", () => readIf("alerts", () => all.alerts(), [] as S.CollectionAlertT[]));
const loadNotifications = () => cached("notifications", () => readIf("notifications", () => all.notifications(), [] as S.NotificationT[]));
const loadOrderMargins = () => cached("margins:order", () => readIf("results", () => all.margins({ group_by: "order" }), [] as S.MarginRowT[]));
const loadOrderDrafts = () =>
  DRAFTS_IN_SPRING
    ? cached("drafts", () => readIf("drafts", () => all.drafts({ status: "pending_review" }), [] as S.ExtractionDraftT[]).then((d) => d.filter((x) => x.draft_type === "order")))
    : Promise.resolve([] as S.ExtractionDraftT[]);

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

/** Clasificación del motor para un pago todavía sin conciliar (GET /payments/{id}/reconciliation). */
const CLASS_MATCH: Record<S.ReconciliationResultT["classification"], MatchKind> = {
  matches: "total",
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

const CUSTOMER_TIPO: Record<NonNullable<S.CustomerRefT["type"]>, Customer["tipo"]> = { school: "colegio", company: "empresa", person: "persona" };

const MESSAGE_TIPO: Record<S.NotificationT["type"], OutgoingMessage["tipo"]> = {
  collection_preventive: "cobranza_preventiva",
  collection_due: "cobranza_vencimiento",
  early_arrears: "mora_temprana",
  account_statement: "estado_cuenta",
  payment_confirmation: "confirmacion_pago",
  repurchase: "recompra",
  seller_summary: "resumen_vendedor",
};

const MESSAGE_ESTADO: Record<S.NotificationT["status"], OutgoingMessage["estado"]> = { pending: "pendiente", sent: "enviado", error: "error", cancelled: "cancelado" };

const COMPONENT: Record<string, string> = { raw_materials: "materiales", labor: "mano de obra", outsourced: "terceros", overhead: "indirectos", logistics: "logística" };

/** Operaciones de evento_auditoria (motores de Andrés y comandos del panel) en lenguaje de la vista. */
const OPERATION: Record<string, { text: string; status: ActivityItem["status"] }> = {
  CREDITO_APROBADO: { text: "Crédito aprobado", status: "completado" },
  CREDITO_RECHAZADO: { text: "Crédito rechazado", status: "fallido" },
  ORDEN_CONFIRMADA_CONTADO: { text: "Orden confirmada al contado", status: "completado" },
  PAGO_VERIFICADO: { text: "Pago verificado en banco", status: "completado" },
  PAGO_APLICADO: { text: "Pago descontado de la deuda", status: "completado" },
  PAGO_DUPLICADO: { text: "Pago marcado como duplicado", status: "fallido" },
  PAGO_EN_REVISION: { text: "Pago en revisión", status: "pendiente" },
  APLICACION_ANULADA: { text: "Aplicación de pago anulada", status: "fallido" },
  DESPACHO_REGISTRADO: { text: "Despacho registrado", status: "entregado" },
  ALERTA_RESUELTA: { text: "Alerta de cobranza resuelta", status: "completado" },
  COBRANZA_EVALUADA: { text: "Cobranza evaluada", status: "entregado" },
  COSTO_REGISTRADO: { text: "Costo registrado", status: "entregado" },
  COSTO_ASIGNADO: { text: "Costo asignado a ítems", status: "entregado" },
  COSTOS_REPARTIDOS: { text: "Costos repartidos", status: "entregado" },
  COSTEO_CERRADO: { text: "Costeo cerrado", status: "entregado" },
  CARGO_INTERNO_REGISTRADO: { text: "Cargo interno registrado", status: "entregado" },
  CARGO_INTERNO_ANULADO: { text: "Cargo interno anulado", status: "fallido" },
};

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

/** Descripción del pedido desde sus ítems (orden_item); sin ítems, la línea. */
function describe(o: S.OrderT) {
  const items = o.items ?? [];
  if (!items.length) return o.product_line ?? "Sin descripción";
  return items.length === 1 ? items[0].description : `${items[0].description} y ${items.length - 1} más`;
}

/** Último pago aplicado (vigente) entre las obligaciones dadas. */
function lastApplied(rs: S.ReceivableT[]) {
  return rs.flatMap((r) => r.applications ?? []).map((a) => a.applied_at).sort().pop() ?? null;
}

/** Una orden confirmada genera obligación; un borrador, una pendiente o una rechazada todavía no. */
const confirmed = (o: S.OrderT) => !["draft", "pending_approval", "cancelled"].includes(o.status);

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

type Ctx = {
  orders: S.OrderT[];
  receivables: S.ReceivableT[];
  orderById: Map<string, S.OrderT>;
  byOrder: Map<string, S.ReceivableT>;
  today: string;
};

async function context(): Promise<Ctx> {
  const [orders, receivables] = await Promise.all([loadOrders(), loadReceivables()]);
  return {
    orders,
    receivables,
    orderById: new Map(orders.map((o) => [o.id, o])),
    byOrder: new Map(receivables.map((r) => [r.order_id, r])),
    today: todayIso(),
  };
}

function overdueCustomers(ctx: Ctx) {
  const set = new Set<string>();
  for (const r of ctx.receivables) if (r.due_bucket === "overdue" && r.balance.amount_cents > 0) set.add(r.customer.id);
  return set;
}

/** Órdenes del cliente, la más reciente primero. */
function ordersOf(customerId: string | null, ctx: Ctx) {
  return ctx.orders.filter((o) => o.customer?.id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Ficha del cliente tal como la trae su orden más reciente (o su cuenta por cobrar). */
function customerRef(customerId: string | null, ctx: Ctx): S.CustomerRefT | null {
  return ordersOf(customerId, ctx)[0]?.customer ?? ctx.receivables.find((r) => r.customer.id === customerId)?.customer ?? null;
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
    description: describe(o),
    saleCents: cents(o.sale),
    balanceCents: balanceOf(o, r),
    estado: ORDER_STATE[o.status],
    finance: finance(o, r, ctx.today),
    issuedOn: o.created_at.slice(0, 10),
    entregaSolicitada: o.requested_delivery_date,
    dueDate: due,
    daysToDue: due ? daysBetween(ctx.today, due) : null,
    seller: o.seller?.name ?? null,
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
    lastPaymentAt: r ? lastApplied([r]) : null,
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

const items = (o: S.OrderT): Order["items"] =>
  (o.items ?? []).map((i) => ({ descripcion: i.description, cantidad: i.quantity, detalle: i.detail ?? "", precioUnitCents: i.unit_price.amount_cents }));

const dispatchOf = (o: S.OrderT): Order["despacho"] => (o.dispatch_date ? { fecha: o.dispatch_date, acta: "Acta registrada", by: o.dispatched_by?.name ?? "Taller" } : null);

/** Orden del modelo de vista a partir del contrato. El desglose de costos no existe en el DTO Order. */
function viewOrder(o: S.OrderT, credit: S.CreditAuthorizationT | null, margin: S.MarginRowT | null = null): Order {
  const tipo = o.payment_condition === "cash" ? "contado" : o.payment_condition === "advance" ? "anticipo" : "credito";
  return {
    id: o.id,
    ref: o.display_code,
    customerId: o.customer?.id ?? "",
    // El contrato no garantiza marca; la vista usa card.brand (nullable). Este valor no se muestra.
    brand: toBrand(o.brand) ?? "corpotex",
    line: o.product_line ?? "",
    description: describe(o),
    items: items(o),
    modality: o.production_mode === "own" ? "propia" : "tercerizada",
    saleCents: zero(o.sale),
    costs: { materiales: 0, manoObra: 0, terceros: 0, indirectos: 0 },
    // El motor solo da margen con costos reales cerrados (v_margen_orden).
    costOrigin: "real",
    costComplete: margin?.cost_status === "complete",
    internalChargeCents: null,
    sellerId: o.seller?.id ?? "",
    estado: ORDER_STATE[o.status],
    condicionPago: o.payment_condition ? { tipo, plazoDias: o.credit_term_days ?? 0, anticipoPct: credit?.advance_pct_bps != null ? credit.advance_pct_bps / 100 : null } : null,
    credito:
      credit && (credit.status === "approved" || credit.status === "rejected")
        ? {
            decision: credit.status === "approved" ? "aprobado" : "rechazado",
            by: credit.responsible_name ?? o.seller?.name ?? "Vendedor",
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
    despacho: dispatchOf(o),
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
  const usedCents = open.reduce((s, r) => s + r.balance.amount_cents, 0);
  const soon = open.filter((r) => r.due_date && daysBetween(ctx.today, r.due_date) <= 3);
  const maxOverdueDays = overdue.reduce((m, r) => Math.max(m, r.days_overdue), 0);
  const limit = cents(customerRef(customerId, ctx)?.credit_limit);
  // Días entre el vencimiento y el último pago de cada obligación pagada (negativo = pagó antes).
  const closed = rs
    .filter((r) => r.status === "paid" && r.due_date)
    .map((r) => {
      const last = lastApplied([r]);
      return last ? daysBetween(r.due_date!, last) : null;
    })
    .filter((d): d is number => d !== null);
  const orders = ordersOf(customerId, ctx).filter(confirmed);

  let status: CreditSnapshot["status"] = "al_dia";
  if (overdueCents > 0) status = "en_mora";
  else if (limit != null && usedCents > limit) status = "sobre_linea";
  else if (soon.length) status = "por_vencer";

  return {
    usedCents,
    availableCents: limit != null ? Math.max(limit - usedCents, 0) : null,
    overdueCents,
    maxOverdueDays,
    avgDaysLate: closed.length ? Math.round(closed.reduce((s, d) => s + d, 0) / closed.length) : null,
    paidOnTime: closed.filter((d) => d <= 0).length,
    closedCount: closed.length,
    status,
    // D-005: la mora avisa, no bloquea. El vendedor decide y queda registrado.
    aviso:
      status === "en_mora"
        ? `Este cliente está en mora: ${formatMoney(overdueCents)} vencido, hasta ${maxOverdueDays} días de atraso. ¿Quieres volver a darle crédito?`
        : status === "sobre_linea" && limit != null
          ? `El saldo abierto supera la línea de referencia de ${formatMoney(limit)}.`
          : null,
    totalSoldCents: orders.reduce((s, o) => s + zero(o.sale), 0),
    totalPaidCents: rs.reduce((s, r) => s + r.applied_amount.amount_cents, 0),
    orderCount: orders.length,
    lastPaymentAt: lastApplied(rs),
    lastOrderOn: ordersOf(customerId, ctx)[0]?.created_at.slice(0, 10) ?? null,
  };
}

function customerView(id: string, ctx: Ctx): CustomerView | null {
  const ref = customerRef(id, ctx);
  if (!ref) return null;
  const own = ordersOf(id, ctx);
  return {
    id,
    name: ref.name,
    brand: toBrand(own[0]?.brand),
    tipo: ref.type ? CUSTOMER_TIPO[ref.type] : null,
    rucDni: ref.tax_id ?? null,
    // Vendedor de su pedido más reciente: la API no expone la asignación del canal de WhatsApp.
    sellerId: own[0]?.seller?.id ?? null,
    contactoWhatsapp: null,
    since: own.map((x) => x.created_at.slice(0, 10)).sort()[0] ?? null,
    creditLimitCents: cents(ref.credit_limit),
  };
}

const sellerOf = (customerId: string, ctx: Ctx) => ordersOf(customerId, ctx).find((o) => o.seller)?.seller?.name ?? null;

const emptyCustomer = (name: string, brand: Brand | null): CustomerView => ({ id: "", name, brand, tipo: null, rucDni: null, sellerId: null, contactoWhatsapp: null, since: null, creditLimitCents: null });

function paymentToEvidence(p: S.PaymentT): Evidence {
  const applied = [...(p.applications ?? [])].sort((a, b) => b.applied_at.localeCompare(a.applied_at));
  return {
    id: p.id,
    ref: p.display_code ?? `PAGO-${p.id.slice(0, 8)}`,
    // Los pagos no tienen marca en el contrato; la vista no la muestra en modo api.
    brand: "corpotex",
    kind: "voucher",
    origen: p.data_origin === "manual_entry" ? "manual" : "whatsapp",
    receivedAt: p.created_at,
    orderId: applied[0]?.order_id ?? null,
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
    verifiedBy: p.verification ? (p.verification.verified_by_name ?? (p.verification.method === "simulated_demo" ? "Verificación de demo" : "Administración")) : null,
    verifiedAt: p.verification?.verified_at ?? null,
    appliedAt: applied[0]?.applied_at ?? (p.phase === "applied" ? p.created_at : null),
    discardReason: null,
    corrections: [],
    evidenceIds: p.evidence_ids,
    dataOrigin: p.data_origin,
  };
}

function paymentCard(p: S.PaymentT, ctx: Ctx): PaymentCard {
  const ev = paymentToEvidence(p);
  const app = p.applications?.[0];
  return {
    id: p.id,
    ref: ev.ref,
    kind: "voucher",
    origen: ev.origen,
    channel: ev.fields.channel,
    orderId: app?.order_id ?? null,
    orderRef: app?.order_code ?? null,
    customer: p.payer_name ?? "Remitente sin identificar",
    amountCents: p.received_amount.amount_cents,
    seller: app ? (ctx.orderById.get(app.order_id)?.seller?.name ?? null) : null,
    match: MATCH[p.reconciliation_status],
    status: ev.status,
    receivedAt: p.created_at,
  };
}

function alertRow(a: S.CollectionAlertT, ctx: Ctx, payments: S.PaymentT[] = []): AlertRow {
  const r = ctx.receivables.find((x) => x.id === a.receivable_id);
  const p = a.payment_id ? payments.find((x) => x.id === a.payment_id) : undefined;
  return {
    id: a.id,
    orderId: r?.order_id ?? "",
    regla: RULE[a.rule],
    responsable: a.responsible_name ?? "Administración",
    estado: ALERT_STATE[a.status],
    creadaAt: a.created_at,
    resolucion: a.resolution_note ?? (a.resolution === "payment_applied" ? "Pago aplicado" : a.resolution === "manual" ? "Resuelta manualmente" : null),
    resueltaBy: null,
    resueltaAt: a.closed_at,
    orderRef: r?.order_code ?? (a.payment_id ? (p?.display_code ? `${p.display_code} en revisión` : "Pago en revisión") : "—"),
    customer: r?.customer.name ?? p?.payer_name ?? (a.payment_id ? "Remitente sin identificar" : "—"),
    customerId: r?.customer.id ?? null,
    balanceCents: r ? r.balance.amount_cents : null,
    dueDate: r?.due_date ?? null,
  };
}

function receivableRow(r: S.ReceivableT, ctx: Ctx): ReceivableRow {
  const due = r.due_date!;
  const d = daysBetween(ctx.today, due);
  return {
    id: r.order_id,
    orderRef: r.order_code,
    customerId: r.customer.id,
    customer: r.customer.name,
    seller: ctx.orderById.get(r.order_id)?.seller?.name ?? null,
    dueDate: due,
    daysToDue: d,
    balanceCents: r.balance.amount_cents,
    finance: r.status === "paid" ? "cobrado" : d < 0 ? "vencido" : d === 0 ? "vence_hoy" : d <= 3 ? "por_vencer" : "al_dia",
  };
}

function message(n: S.NotificationT): OutgoingMessage {
  return {
    id: n.id,
    customerId: n.customer?.id ?? "",
    orderId: n.order_id,
    tipo: MESSAGE_TIPO[n.type],
    estado: MESSAGE_ESTADO[n.status],
    programadoPara: n.scheduled_for,
    intentos: n.attempts,
    enviadoAt: n.sent_at,
    error: n.last_error,
  };
}

function messageRow(n: S.NotificationT): MessageRow {
  // El número de destino no sale de la API: solo se muestra el canal.
  return { ...message(n), customer: n.customer?.name ?? "Contacto interno", contacto: "WhatsApp", orderRef: n.order_code };
}

/** Pedido, pago y monto detrás de un evento de auditoría, para mostrarlo con nombres en vez de ids. */
type Lookup = { ctx: Ctx; payments: S.PaymentT[] };

function auditAmount(e: S.AuditEventT) {
  const v = e.changes.find((c) => c.field === "monto")?.new_value;
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function activity(e: S.AuditEventT, meId: string | null, look: Lookup): ActivityItem {
  const change = (f: string) => e.changes.find((c) => c.field === f)?.new_value ?? null;
  const pago =
    e.entity_type === "pago" ? look.payments.find((p) => p.id === e.entity_id) : e.entity_type === "aplicacion_pago" ? look.payments.find((p) => p.id === change("pago_id") || p.applications?.some((a) => a.application_id === e.entity_id)) : undefined;
  const orderId =
    e.entity_type === "orden"
      ? e.entity_id
      : e.entity_type === "despacho"
        ? change("orden_id")
        : e.entity_type === "aplicacion_pago"
          ? (pago?.applications?.find((a) => a.application_id === e.entity_id)?.order_id ?? look.ctx.receivables.find((r) => r.id === change("obligacion_id"))?.order_id ?? null)
          : null;
  const order = orderId ? look.ctx.orderById.get(orderId) : undefined;
  const op = OPERATION[e.operation];
  const actor = e.actor === "user" ? (e.actor_user_id === meId ? "Tú" : (e.actor_name ?? "Usuario")) : (e.actor_name ?? (e.actor === "n8n" ? "n8n" : e.actor === "scheduler" ? "Programador" : "Sistema"));
  return {
    id: e.id,
    at: e.occurred_at,
    who: order?.customer?.name ?? pago?.payer_name ?? (pago ? "Remitente sin identificar" : e.entity_type === "alerta_cobranza" ? "Cobranza" : "KeptAI"),
    actor,
    text: op?.text ?? e.operation.replace(/_/g, " ").toLowerCase(),
    reference: [pago?.display_code, order?.display_code].filter(Boolean).join(" · "),
    amountCents: auditAmount(e),
    status: op?.status ?? "pendiente",
    href: pago ? `/conciliacion/${pago.id}` : order ? `/pedidos/${order.id}` : null,
  };
}

/** Margen de los pedidos confirmados con costeo cerrado (filas del motor por pedido); el resto no suma. */
function closedMargins(rows: S.MarginRowT[], ctx: Ctx, scope: Scope) {
  return rows.filter((m) => {
    const o = m.group_id ? ctx.orderById.get(m.group_id) : undefined;
    return o && confirmed(o) && fits(toBrand(o.brand), scope) && m.cost_status === "complete";
  });
}

/** Pago aplicado por el usuario desde la vista: orden elegida para la conciliación (assignOrder). */
const chosenReceivable = new Map<string, string>();

/* ---------- Fuente ---------- */

export const apiSource: DataSource = {
  capabilities: {
    messagesLog: true,
    resolveAlerts: true,
    retryMessages: false,
    editPaymentFields: false,
    markDuplicate: true,
    applyBySameVerifier: false,
    discardPayment: false,
    manualOrderCapture: true,
    voucherNeedsFile: true,
    settings: false,
    orderItems: true,
    customerDirectory: true,
    resetDemo: false,
    demoAccounts: false,
  },

  async getDashboard(scope, role, notify) {
    const isManager = role === "gerencia";
    const [ctx, alerts, payments, drafts, summary, forecast, margins, audit, me, notifications] = await Promise.all([
      context(),
      loadAlerts(),
      loadPayments(),
      loadOrderDrafts(),
      isManager ? readIf("results", () => endpoints.getResultsSummary(), null) : Promise.resolve(null),
      isManager ? readIf("results", () => endpoints.getCashForecast(), null) : Promise.resolve(null),
      isManager ? loadOrderMargins() : Promise.resolve([] as S.MarginRowT[]),
      readIf("audit", () => endpoints.listAuditEvents({ limit: 6 }), null),
      soft(loadMe(), null),
      role !== "vendedor" ? loadNotifications() : Promise.resolve([] as S.NotificationT[]),
    ]);
    const orders = ctx.orders.filter((o) => fits(toBrand(o.brand), scope));
    const ids = new Set(orders.map((o) => o.id));
    const recs = ctx.receivables.filter((r) => ids.has(r.order_id) && r.balance.amount_cents > 0);
    const due = recs.filter((r) => r.due_date);
    const pipeline = recs.filter((r) => !r.due_date);
    const opening = forecast?.opening_cash ? forecast.opening_cash.amount.amount_cents : null;
    // Caja actual según MotorCaja: el cierre de la primera semana menos su neto (apertura + cobros desde la apertura).
    const w0 = forecast?.weeks[0];
    const cashNow = w0?.closing_balance ? w0.closing_balance.amount_cents - w0.net.amount_cents : null;
    const collected = cashNow != null && opening != null ? cashNow - opening : recs.reduce((s, r) => s + r.applied_amount.amount_cents, 0);
    const counted = closedMargins(margins, ctx, scope);

    let running = cashNow ?? opening ?? 0;
    const weeks: WeekPoint[] | null = forecast
      ? forecast.weeks.map((w, i) => {
          running += w.net.amount_cents;
          return {
            label: `Sem ${i + 1}`,
            range: `${formatDate(w.week_start)} al ${formatDate(w.week_end)}`,
            inCents: w.expected_inflows.amount_cents,
            outCents: w.outflows.amount_cents,
            // Sin apertura el motor no da cierre: se muestra el acumulado de los netos.
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
        const mine = role === "vendedor" && (!o.seller || o.seller.id === me?.user_id);
        assistant.push({
          id: `pend-${o.id}`,
          tone: "violet",
          title: mine ? `${o.display_code} espera tu confirmación` : `${o.display_code} espera confirmación de ${o.seller?.name ?? "su vendedor"}`,
          detail: `${o.customer?.name ?? "Sin cliente"}, ${formatMoney(zero(o.sale))}.`,
          href: `/pedidos/${o.id}`,
          date: o.created_at.slice(0, 10),
        });
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
      if (review.length)
        assistant.push({
          id: "review",
          tone: "warn",
          title: `${review.length} ${review.length === 1 ? "pago en revisión" : "pagos en revisión"}`,
          detail: review.map((p) => `${p.display_code ?? "Pago"}: ${p.reconciliation_status === "duplicate" ? "duplicado" : p.reconciliation_status === "orphan" ? "sin cliente identificado" : "monto que no cuadra"}`).join(". ") + ".",
          href: `/conciliacion/${review[0].id}`,
          date: review[0].created_at,
        });
      const open = alerts.filter((a) => a.status === "open");
      if (open.length) assistant.push({ id: "alerts", tone: "bad", title: `${open.length} ${open.length === 1 ? "alerta de cobranza abierta" : "alertas de cobranza abiertas"}`, detail: "Revisa la mora temprana en Cobranza.", href: "/cobranza?vista=alertas", date: open[0].created_at });
      const errors = notifications.filter((n) => n.status === "error" && fits(toBrand(n.order_id ? ctx.orderById.get(n.order_id)?.brand : null), scope));
      if (errors.length)
        assistant.push({
          id: "msg-error",
          tone: "bad",
          title: `${errors.length} ${errors.length === 1 ? "mensaje de WhatsApp falló" : "mensajes de WhatsApp fallaron"}`,
          detail: errors[0].last_error ?? "El programador lo reintentará; revisa la bitácora en Cobranza.",
          href: "/cobranza?vista=mensajes",
          date: errors[0].scheduled_for,
        });
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
      cashCents: cashNow,
      openingCents: opening,
      collectedCents: collected,
      openingSource: forecast?.opening_cash ? `Saldo inicial al ${formatDate(forecast.opening_cash.as_of)} (${forecast.opening_cash.source === "demo_fixture" ? "demo" : "manual"})` : "",
      marginCents: isManager && counted.length ? counted.reduce((s, m) => s + zero(m.margin), 0) : null,
      perceivedCents: isManager && counted.length && counted.every((m) => m.perceived_margin) ? counted.reduce((s, m) => s + zero(m.perceived_margin), 0) : null,
      orderCount: counted.length,
      weeks,
      assistant,
      activity: audit ? audit.items.map((e) => activity(e, me?.user_id ?? null, { ctx, payments })) : null,
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
      const d = DRAFTS_IN_SPRING ? await soft(endpoints.getDraft(id.slice(DRAFT.length)), null) : null;
      if (!d) return null;
      const c = draftCard(d, ctx.today);
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
        customer: emptyCustomer(c.customer, c.brand),
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

    const o = ctx.orderById.get(id) ?? (await soft(endpoints.getOrder(id), null));
    if (!o) return null;
    const [credit, alerts, notifications, margins] = await Promise.all([
      readIf("credit", () => endpoints.getCreditDecision(o.id), null),
      loadAlerts(),
      loadNotifications(),
      loadOrderMargins(),
    ]);
    const r = ctx.byOrder.get(o.id);
    const c = card(o, ctx, moroso);
    const m = margins.find((x) => x.group_id === o.id && x.cost_status === "complete") ?? null;
    return {
      cutDate: ctx.today,
      order: viewOrder(o, credit, m),
      customer: (o.customer && customerView(o.customer.id, ctx)) ?? emptyCustomer(c.customer, c.brand),
      seller: o.seller?.name ?? null,
      card: c,
      credit: snapshotFor(o.customer?.id ?? null, ctx),
      paidCents: r ? r.applied_amount.amount_cents : 0,
      anticipoRequeridoCents: requiredBeforeProduction(o),
      gatekeeper: !["draft", "pending_approval", "held", "cancelled"].includes(o.status),
      costCents: cents(m?.total_cost),
      marginCents: cents(m?.margin),
      perceivedCents: cents(m?.perceived_margin),
      payments: [...(r?.applications ?? [])]
        .sort((a, b) => b.applied_at.localeCompare(a.applied_at))
        .map((a) => ({ id: a.application_id, at: a.applied_at, amountCents: a.amount.amount_cents, channel: CHANNEL[a.channel], by: a.applied_by?.name ?? "Administración", evidenceId: a.payment_code })),
      pendingEvidence: [],
      messages: notifications.filter((n) => n.order_id === o.id).map(message).sort((a, b) => a.programadoPara.localeCompare(b.programadoPara)),
      alerts: alerts.filter((a) => a.receivable_id && a.receivable_id === r?.id).map((a) => alertRow(a, ctx)),
      plazoDefecto: o.credit_term_days ?? 30,
    };
  },

  async getTaller(scope) {
    const [ctx, me] = await Promise.all([context(), soft(loadMe(), null)]);
    const map = (o: S.OrderT): TallerOrder => ({
      id: o.id,
      ref: o.display_code,
      customer: o.customer?.name ?? null,
      brand: toBrand(o.brand),
      description: describe(o),
      items: items(o),
      modality: o.production_mode === "own" ? "propia" : "tercerizada",
      issuedOn: o.created_at.slice(0, 10),
      inicioProduccion: o.production_start_date,
      entregaSolicitada: o.requested_delivery_date,
      plazoDias: o.credit_term_days,
      despacho: dispatchOf(o),
      anticipoPendienteCents: o.status === "held" ? requiredBeforeProduction(o) : 0,
    });
    const orders = ctx.orders.filter((o) => fits(toBrand(o.brand), scope));
    return {
      cutDate: ctx.today,
      enProduccion: orders
        .filter((o) => o.status === "released" || o.status === "in_production")
        .sort((a, b) => (a.requested_delivery_date ?? "").localeCompare(b.requested_delivery_date ?? ""))
        .map(map),
      // V7: el jefe de taller solo lee órdenes liberadas; las retenidas no le llegan.
      retenidas: me?.role === "JEFE_TALLER" ? null : orders.filter((o) => o.status === "held").map(map),
      despachadas: orders
        .filter((o) => o.dispatch_date)
        .sort((a, b) => (b.dispatch_date ?? "").localeCompare(a.dispatch_date ?? ""))
        .slice(0, 5)
        .map(map),
    };
  },

  async getQueue() {
    const [payments, ctx] = await Promise.all([loadPayments(), context()]);
    return payments.map((p) => paymentCard(p, ctx)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },

  async getEvidence(id) {
    const p = await soft(endpoints.getPayment(id), null);
    if (!p) return null;
    const [rec, link, payments, ctx, me] = await Promise.all([
      // La clasificación y los candidatos solo cambian mientras el pago no está aplicado.
      p.phase !== "applied" ? readIf("reconciliation", () => endpoints.getReconciliationCandidates(id), null) : Promise.resolve(null),
      p.evidence_ids[0] ? soft(endpoints.getEvidenceDownloadLink(p.evidence_ids[0]), null) : Promise.resolve(null),
      loadPayments(),
      context(),
      soft(loadMe(), null),
    ]);
    const ev = paymentToEvidence(p);
    const candidates = (rec?.candidates ?? []).filter((c) => c.balance.amount_cents > 0);
    const chosen = candidates.find((c) => c.receivable_id === chosenReceivable.get(id));
    // Con varios candidatos, Administración elige el pedido; con uno solo, es ese.
    const candidate = chosen ?? (candidates.length === 1 ? candidates[0] : null);
    const applied = p.applications?.[0];
    const orderId = applied?.order_id ?? candidate?.order_id ?? null;
    const o = orderId ? ctx.orderById.get(orderId) : undefined;
    const r = orderId ? ctx.byOrder.get(orderId) : undefined;
    const due = r?.due_date ?? o?.due_date ?? null;
    ev.orderId = orderId;

    const amount = p.received_amount.amount_cents;
    let match: MatchKind = MATCH[p.reconciliation_status];
    if (p.reconciliation_status === "pending" && rec) {
      // Si se eligió otro pedido que el sugerido, el cuadre se mide contra su saldo.
      match = chosen && chosen.receivable_id !== rec.candidates[0]?.receivable_id
        ? amount === chosen.balance.amount_cents ? "total" : amount < chosen.balance.amount_cents ? "parcial" : "no_cuadra"
        : CLASS_MATCH[rec.classification];
    }
    const original = p.duplicate_of_payment_id
      ? payments.find((x) => x.id === p.duplicate_of_payment_id)
      : match === "duplicado"
        ? payments.find((x) => x.id !== p.id && x.operation_reference === p.operation_reference && x.received_amount.amount_cents === amount && x.created_at < p.created_at)
        : undefined;
    const missing = [p.operation_reference ? null : "Número de operación", p.payer_name ? null : "Remitente", p.paid_at ? null : "Fecha de pago"].filter((x): x is string => x !== null);
    return {
      evidence: ev,
      brand: o ? toBrand(o.brand) : null,
      imageUrl: link?.url ?? null,
      appliedBy: applied ? (applied.applied_by?.name ?? "Administración") : null,
      match,
      duplicateOfId: p.duplicate_of_payment_id ?? original?.id ?? null,
      duplicateOfRef: original?.display_code ?? null,
      duplicateMarked: p.reconciliation_status === "duplicate",
      verifiedByMe: !!me && p.verification?.verified_by_user_id === me.user_id,
      order: orderId
        ? {
            id: orderId,
            ref: applied?.order_code ?? candidate?.order_code ?? o?.display_code ?? "",
            customer: o?.customer?.name ?? candidate?.customer_name ?? "—",
            line: o?.product_line ?? null,
            saleCents: cents(o?.sale),
            balanceCents: r?.balance.amount_cents ?? candidate?.balance.amount_cents ?? 0,
            daysToDue: due ? daysBetween(ctx.today, due) : null,
            dueDate: due,
            seller: o?.seller?.name ?? null,
          }
        : null,
      missing,
      openOrders: candidates.map((c) => ({ id: c.receivable_id, label: `${c.order_code} · ${c.customer_name} · saldo ${formatMoney(c.balance.amount_cents)}` })),
    };
  },

  async getCobranza(scope) {
    const [ctx, alerts, notifications, payments] = await Promise.all([context(), loadAlerts(), loadNotifications(), loadPayments()]);
    const brandOf = (orderId: string | null) => (orderId ? toBrand(ctx.orderById.get(orderId)?.brand) : null);
    return {
      cutDate: ctx.today,
      receivables: ctx.receivables
        .filter((r) => r.due_date && r.balance.amount_cents > 0 && fits(brandOf(r.order_id), scope))
        .map((r) => receivableRow(r, ctx))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      alerts: alerts
        .map((a) => alertRow(a, ctx, payments))
        .filter((a) => !a.orderId || fits(brandOf(a.orderId), scope))
        .sort((a, b) => (a.estado === b.estado ? b.creadaAt.localeCompare(a.creadaAt) : a.estado === "abierta" ? -1 : 1)),
      messages: notifications
        .filter((n) => fits(brandOf(n.order_id), scope))
        .map(messageRow)
        .sort((a, b) => b.programadoPara.localeCompare(a.programadoPara)),
    };
  },

  async getCustomers(scope) {
    const ctx = await context();
    const remote = await soft(endpoints.listCustomers(), null);
    const ids = new Set<string>();
    if (remote?.items) {
      for (const item of remote.items) ids.add(item.id);
    }
    for (const o of ctx.orders) if (o.customer) ids.add(o.customer.id);
    for (const r of ctx.receivables) ids.add(r.customer.id);
    const rows: CustomerRow[] = [];
    for (const id of ids) {
      const v = customerView(id, ctx);
      const remoteItem = remote?.items.find((item) => item.id === id);
      const name = v?.name ?? remoteItem?.razon_social ?? "Cliente";
      const brand = v?.brand ?? null;
      if (!fits(brand, scope)) continue;
      const snap = snapshotFor(id, ctx);
      const next = ctx.receivables
        .filter((r) => r.customer.id === id && r.due_date && r.balance.amount_cents > 0)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
      rows.push({
        id,
        name,
        brand,
        tipo: v?.tipo ?? (remoteItem?.tipo_persona === "COLEGIO" ? "colegio" : remoteItem?.tipo_persona === "EMPRESA" ? "empresa" : "persona"),
        seller: sellerOf(id, ctx),
        since: v?.since ?? remoteItem?.creado_en ?? null,
        creditLimitCents: v?.creditLimitCents ?? remoteItem?.limite_credito?.amount_cents ?? null,
        usedCents: snap.usedCents,
        overdueCents: snap.overdueCents,
        maxOverdueDays: snap.maxOverdueDays,
        status: snap.status,
        avgDaysLate: snap.avgDaysLate,
        lastPaymentAt: snap.lastPaymentAt,
        nextDue: next ? { id: next.order_id, ref: next.order_code, date: next.due_date!, overdue: next.due_date! < ctx.today } : null,
        pendingOrders: ctx.orders.filter((o) => o.customer?.id === id && (o.status === "pending_approval" || o.status === "draft")).length,
        rucDni: v?.rucDni ?? remoteItem?.ruc_dni ?? null,
        telefonoPrincipal: remoteItem?.telefono_principal ?? null,
        canalOrigen: remoteItem?.canal_origen ?? null,
      });
    }
    return rows.sort((a, b) => b.overdueCents - a.overdueCents || b.usedCents - a.usedCents);
  },

  async getCustomer(id) {
    const ctx = await context();
    const view = customerView(id, ctx);
    if (!view) return null;
    const moroso = overdueCustomers(ctx);
    const orders = ordersOf(id, ctx);
    const [credits, notifications] = await Promise.all([
      Promise.all(orders.map((o) => (confirmed(o) ? readIf("credit", () => endpoints.getCreditDecision(o.id), null) : Promise.resolve(null)))),
      loadNotifications(),
    ]);
    const payments = ctx.receivables
      .filter((r) => r.customer.id === id)
      .flatMap((r) => (r.applications ?? []).map((a) => ({ a, orderRef: r.order_code })))
      .sort((x, y) => y.a.applied_at.localeCompare(x.a.applied_at))
      .map(({ a, orderRef }) => ({
        id: a.application_id,
        at: a.applied_at,
        orderRef,
        amountCents: a.amount.amount_cents,
        channel: CHANNEL[a.channel],
        by: a.applied_by?.name ?? null,
        evidence: a.payment_code,
      }));
    const decisions: CreditDecisionRow[] = [];
    orders.forEach((o, i) => {
      const c = credits[i];
      if (!c || (c.status !== "approved" && c.status !== "rejected")) return;
      decisions.push({
        orderId: o.id,
        orderRef: o.display_code,
        decision: c.status === "approved" ? "aprobado" : "rechazado",
        by: c.responsible_name ?? o.seller?.name ?? "Vendedor",
        at: c.decided_at ?? o.created_at,
        avisoMoraMostrado: c.arrears_notice_shown,
        tipo: o.payment_condition === "cash" ? "Contado" : o.payment_condition === "advance" ? "Anticipo" : "Crédito",
        plazoDias: c.credit_term_days ?? 0,
        nota: c.reason,
        saleCents: cents(o.sale),
      });
    });
    const messages = notifications
      .filter((n) => n.customer?.id === id)
      .map(message)
      .sort((a, b) => b.programadoPara.localeCompare(a.programadoPara));

    const timeline: TimelineItem[] = [];
    for (const o of orders) {
      timeline.push({ id: `${o.id}-p`, at: o.created_at, kind: "pedido", title: `Pedido ${o.display_code}`, detail: describe(o), amountCents: cents(o.sale), tone: "neutral", future: false, dateOnly: false });
      if (o.dispatch_date) timeline.push({ id: `${o.id}-d`, at: `${o.dispatch_date}T12:00:00`, kind: "despacho", title: `Despacho de ${o.display_code}`, detail: `${o.dispatched_by ? `Registrado por ${o.dispatched_by.name}. ` : ""}Inicia el plazo de ${o.credit_term_days ?? 0} días.`, amountCents: null, tone: "info", future: false, dateOnly: true });
      const r = ctx.byOrder.get(o.id);
      if (r?.due_date && r.balance.amount_cents > 0) {
        const d = daysBetween(ctx.today, r.due_date);
        timeline.push({ id: `${o.id}-v`, at: `${r.due_date}T23:59:00`, kind: "vencimiento", title: d < 0 ? `${o.display_code} vencido` : `Vence ${o.display_code}`, detail: `Saldo ${formatMoney(r.balance.amount_cents)}`, amountCents: r.balance.amount_cents, tone: d < 0 ? "bad" : d <= 3 ? "warn" : "neutral", future: r.due_date > ctx.today, dateOnly: true });
      }
    }
    for (const p of payments)
      timeline.push({ id: p.id, at: p.at, kind: "pago", title: `Pago aplicado a ${p.orderRef}`, detail: [p.channel, p.evidence, p.by && `por ${p.by}`].filter(Boolean).join(" · "), amountCents: p.amountCents, tone: "ok", future: false, dateOnly: false });
    for (const d of decisions)
      timeline.push({ id: `${d.orderId}-c`, at: d.at, kind: "credito", title: `${d.orderRef}: ${d.decision === "aprobado" ? `${d.tipo.toLowerCase()} aprobado` : "crédito rechazado"}`, detail: [d.by, d.avisoMoraMostrado && "vio el aviso de mora", d.nota].filter(Boolean).join(" · "), amountCents: null, tone: d.decision === "aprobado" ? (d.avisoMoraMostrado ? "warn" : "violet") : "bad", future: false, dateOnly: false });
    for (const m of messages.filter((x) => x.estado === "enviado" || x.estado === "error"))
      timeline.push({
        id: m.id,
        at: m.enviadoAt ?? m.programadoPara,
        kind: "mensaje",
        title: `WhatsApp: ${MESSAGE_LABEL[m.tipo]}`,
        detail: m.estado === "error" ? `Error: ${m.error ?? "sin detalle"}` : `Enviado al contacto de prueba${m.orderId ? ` · ${ctx.orderById.get(m.orderId)?.display_code ?? ""}` : ""}`,
        amountCents: null,
        tone: m.estado === "error" ? "bad" : "info",
        future: false,
        dateOnly: false,
      });
    timeline.sort((a, b) => b.at.localeCompare(a.at));

    return {
      cutDate: ctx.today,
      customer: view,
      seller: sellerOf(id, ctx),
      snapshot: snapshotFor(id, ctx),
      orders: orders.map((o) => row(o, ctx, moroso)),
      payments,
      decisions,
      messages,
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
      const full = ctx.orderById.get(o.order_id);
      const late = o.due_date != null && o.due_date < today && o.balance.amount_cents > 0;
      if (late) overdue += o.balance.amount_cents;
      return {
        id: o.order_id,
        ref: o.order_code,
        description: full ? describe(full) : null,
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
    const [ctx, byOrder, center, summary] = await Promise.all([
      context(),
      loadOrderMargins(),
      readIf("results", () => endpoints.getProductionCenterResults(), null),
      readIf("results", () => endpoints.getResultsSummary(), null),
    ]);
    const rows: ResultRow[] = [];
    for (const m of byOrder) {
      const o = m.group_id ? ctx.orderById.get(m.group_id) : undefined;
      // Como en la demo: solo pedidos confirmados (los pendientes o rechazados aún no tienen resultado).
      if (o && !confirmed(o)) continue;
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
        description: o ? describe(o) : m.group_key,
        modality: m.production_mode === "own" ? "propia" : m.production_mode === "outsourced" ? "tercerizada" : null,
        costOrigin: m.cost_status === "complete" ? "real" : null,
        issuedOn: o?.created_at.slice(0, 10) ?? summary?.as_of ?? ctx.today,
        saleCents: m.revenue.amount_cents,
        costCents: cents(m.total_cost),
        costs: null,
        costComplete: m.cost_status === "complete",
        missingCosts: m.missing_cost_components.map((c) => COMPONENT[c] ?? c),
        marginCents: cents(m.margin),
        perceivedCents: cents(m.perceived_margin),
        collectedCents: r ? r.applied_amount.amount_cents : null,
        balanceCents: r ? r.balance.amount_cents : null,
        dueDate: r?.due_date ?? null,
      });
    }
    rows.sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));

    // Marca y línea: suma de los pedidos con costeo cerrado (el motor deja la agrupación incompleta mientras haya
    // pedidos en curso, y esos no tienen margen todavía).
    const counted = rows.filter((r) => r.costComplete);
    const brands: Brand[] = scope === "consolidado" ? ["corpotex", "unicrack"] : [scope];
    const sum = (list: ResultRow[], f: (r: ResultRow) => number | null) => list.reduce((s, r) => s + (f(r) ?? 0), 0);
    const items = center?.items ?? [];
    const total = (f: (i: (typeof items)[number]) => number | null) => (items.some((i) => f(i) == null) ? null : items.reduce((s, i) => s + (f(i) ?? 0), 0));
    const byBrand: ResultsDTO["byBrand"] = brands.map((b) => {
      const bo = counted.filter((r) => r.brand === b);
      return {
        brand: b,
        saleCents: sum(bo, (r) => r.saleCents),
        marginCents: sum(bo, (r) => r.marginCents),
        perceivedCents: bo.every((r) => r.perceivedCents != null) ? sum(bo, (r) => r.perceivedCents) : null,
        collectedCents: sum(bo, (r) => r.collectedCents),
        orders: bo.length,
        withoutCost: rows.filter((r) => r.brand === b && !r.costComplete).length,
      };
    });
    const lines = [...new Set(counted.map((r) => r.line ?? "Sin línea"))];
    return {
      cutDate: summary?.as_of ?? ctx.today,
      demo: summary?.data_origin === "demo_fixture" || ctx.orders.some((o) => o.data_origin === "demo_fixture"),
      rows,
      byBrand,
      byLine: lines.map((line) => {
        const lo = counted.filter((r) => (r.line ?? "Sin línea") === line);
        return { line, saleCents: sum(lo, (r) => r.saleCents), marginCents: sum(lo, (r) => r.marginCents), orders: lo.length };
      }),
      workshop: items.length
        ? {
            orderIds: items.map((i) => i.order_code),
            costCents: total((i) => cents(i.workshop_cost)),
            internalChargeCents: items.reduce((s, i) => s + i.internal_charge.amount_cents, 0),
            workshopResultCents: total((i) => cents(i.workshop_result)),
            commercialResultCents: items.reduce((s, i) => s + i.commercial_result.amount_cents, 0),
            consolidatedMarginCents: total((i) => cents(i.consolidated_margin)),
          }
        : null,
    };
  },

  ordersCsv: () => endpoints.exportOrdersCsv(),

  async getProfile(person) {
    const [me, audit, ctx, payments] = await Promise.all([soft(loadMe(), null), readIf("audit", () => endpoints.listAuditEvents({ limit: 100 }), null), context(), loadPayments()]);
    const mine = audit ? audit.items.filter((e) => e.actor === "user" && e.actor_user_id === me?.user_id) : null;
    const count = (re: RegExp) => mine?.filter((e) => re.test(e.operation)).length ?? 0;
    const counts: Record<Role, Array<{ label: string; value: number }>> = {
      vendedor: [
        { label: "Créditos decididos", value: count(/CREDITO|CONTADO/i) },
        { label: "Borradores confirmados", value: count(/DRAFT|BORRADOR/i) },
      ],
      administracion: [
        { label: "Pagos verificados", value: count(/VERIFICADO/i) },
        { label: "Pagos aplicados", value: count(/APLICADO/i) },
        { label: "Despachos registrados", value: count(/DESPACHO/i) },
      ],
      gerencia: [{ label: "Eventos revisados", value: audit?.items.length ?? 0 }],
      jefe_taller: [{ label: "Despachos registrados", value: count(/DESPACHO/i) }],
      diseno: [{ label: "Artes aprobados", value: count(/ARTE|DISENO/i) }, { label: "Fichas revisadas", value: count(/FICHA/i) }],
    };
    return { activity: mine ? mine.slice(0, 30).map((e) => activity(e, me?.user_id ?? null, { ctx, payments })) : null, counts: counts[person.role], settings: null, ownOrders: [] };
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
      .filter((o) => ok(toBrand(o.brand)) && (o.display_code.toLowerCase().includes(term) || (o.customer?.name ?? "").toLowerCase().includes(term) || describe(o).toLowerCase().includes(term)))
      .map((o) => ({ id: o.id, label: `${o.display_code} · ${o.customer?.name ?? "Sin cliente"}`, detail: `${describe(o)}${o.sale ? ` · ${formatMoney(o.sale.amount_cents)}` : ""}`, href: `/pedidos/${o.id}`, brand: toBrand(o.brand) }));
    const pays = payments
      .filter((p) => (p.display_code ?? "").toLowerCase().includes(term) || (p.payer_name ?? "").toLowerCase().includes(term) || (p.operation_reference ?? "").includes(term))
      .map((p) => ({ id: p.id, label: `${p.display_code ?? "Pago"} · ${p.payer_name ?? "Sin remitente"}`, detail: `${CHANNEL[p.channel]} ${formatMoney(p.received_amount.amount_cents)}`, href: `/conciliacion/${p.id}`, brand: null }));
    return [...customers, ...orders, ...pays].slice(0, 7);
  },

  async getCaptureOptions(brand) {
    const ctx = await context();
    const open = ctx.receivables.filter((r) => r.balance.amount_cents > 0 && fits(toBrand(ctx.orderById.get(r.order_id)?.brand), brand));
    const customers = new Map<string, string>();
    for (const o of ctx.orders) if (o.customer && fits(toBrand(o.brand), brand)) customers.set(o.customer.id, o.customer.name);
    return {
      orders: open.map((r) => ({ id: r.order_id, label: `${r.order_code} · ${r.customer.name} · saldo ${formatMoney(r.balance.amount_cents)}` })),
      customers: [...customers].map(([id, name]) => ({ id, name })),
    };
  },

  commands: {
    editField: () => unavailable("Corregir un pago ya creado"),
    discard: () => unavailable("Descartar un pago"),
    retryMessage: () => unavailable("Reintentar un mensaje"),
    captureOrder: (input) =>
      run(async () => {
        const order = await endpoints.createOrder({
          customer_id: input.customerId,
          description: input.description,
          quantity: input.cantidad,
          total_amount: { amount_cents: input.totalCents, currency: "PEN" },
          requested_delivery_date: input.entrega || null,
        });
        return { ok: true, message: `Pedido ${order.display_code} registrado exitosamente.`, id: order.id };
      }),

    createCustomer: (input) =>
      run(async () => {
        const res = await endpoints.createCustomer({
          tipo_persona: input.tipoPersona,
          razon_social: input.razonSocial,
          ruc_dni: input.rucDni,
          telefono_principal: input.telefonoPrincipal,
          canal_origen: input.canalOrigen,
          limite_credito: input.limiteCreditoCents ? { amount_cents: input.limiteCreditoCents, currency: "PEN" } : undefined,
        });
        return { ok: true, message: `Cliente ${res.razon_social} creado exitosamente.`, id: res.id, customer: res };
      }),

    createContact: (customerId, input) =>
      run(async () => {
        await endpoints.createContact(customerId, {
          nombre: input.nombre,
          telefono: input.telefono,
          whatsapp_jid: input.whatsappJid,
          email: input.email,
          es_principal: input.esPrincipal,
        });
        return { ok: true, message: `Contacto ${input.nombre} registrado exitosamente.` };
      }),
    updateSettings: () => unavailable("Cambiar los supuestos"),
    setInternalCharge: () => unavailable("Cambiar el precio de transferencia"),
    reset: () => unavailable("Restablecer la demo"),

    markDuplicate: (id) =>
      run(async () => {
        const p = await endpoints.markPaymentDuplicate(id);
        return { ok: true, message: `${p.display_code ?? "Pago"} marcado como duplicado. Queda en revisión y no reduce el saldo.` };
      }),

    resolveAlert: (alertId, resolucion) =>
      run(async () => {
        const note = resolucion.trim();
        if (note.length < 5) return { ok: false, message: "Describe qué se acordó con el cliente." };
        await endpoints.resolveCollectionAlert(alertId, { note });
        return { ok: true, message: "Alerta resuelta. La nota queda en el historial." };
      }),

    /** Elegir la cuenta por cobrar donde se aplicará el pago (se usa en applyPayment). */
    assignOrder: (id, receivableId) =>
      run(async () => {
        chosenReceivable.set(id, receivableId);
        return { ok: true, message: "Pedido elegido. El pago se descontará de su saldo." };
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
        const open = rec.candidates.filter((x) => x.balance.amount_cents > 0);
        const c = open.find((x) => x.receivable_id === chosenReceivable.get(id)) ?? (open.length === 1 ? open[0] : null);
        if (!c) return { ok: false, message: open.length ? "Elige el pedido al que corresponde el pago." : "No hay una cuenta por cobrar candidata para este pago." };
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
          customerId = ctx.orderById.get(orderId)?.customer?.id ?? null;
        }
        // D-005: la mora avisa, no bloquea. Spring exige confirmar el aviso para cualquier decisión con saldo vencido.
        const snap = snapshotFor(customerId, ctx);
        if (snap.status === "en_mora" && !opts.moraAcknowledged) return { ok: false, code: "aviso_mora", message: snap.aviso ?? "Cliente en mora." };

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
        const message =
          terms.tipo === "credito"
            ? `Orden confirmada con crédito a ${terms.plazoDias} días: pasa a producción.`
            : terms.tipo === "anticipo"
              ? `Orden confirmada con anticipo del ${terms.anticipoPct}%: queda retenida hasta que llegue.`
              : "Orden confirmada al contado: queda retenida hasta que llegue el pago completo.";
        return { ok: true, message, id };
      }),

    rejectOrder: (orderId, nota) =>
      run(async () => {
        if (orderId.startsWith(DRAFT)) {
          await endpoints.discardDraft(orderId.slice(DRAFT.length), nota);
          return { ok: true, message: "Borrador descartado." };
        }
        if (nota.trim().length < 5) return { ok: false, message: "Registra el motivo." };
        await endpoints.submitCreditDecision(orderId, { decision: "rejected", arrears_notice_acknowledged: true, reason: nota.trim() });
        return { ok: true, message: "Orden rechazada." };
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

