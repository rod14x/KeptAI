import type {
  Brand,
  CollectionAlert,
  CreditStatus,
  Customer,
  Evidence,
  EvidenceStatus,
  FieldKey,
  MatchKind,
  Order,
  OrderFinance,
  OrderState,
  OutgoingMessage,
  Person,
  Role,
  Scope,
  Settings,
} from "./model";
import type { Preferences } from "../lib/preferences";
import { IN_REVIEW } from "./model";

// DTOs de pantalla: lo que consume cada vista. Ambas fuentes (mock y API) devuelven exactamente esto.
// Campos null = la fuente no lo provee (por ejemplo, la API no expone el desglose de costos ni el contacto de WhatsApp).

/* ---------- Capacidades de la fuente ---------- */

/** Qué puede hacer la fuente activa. La UI oculta o explica lo que no existe todavía en el contrato. */
export type Capabilities = {
  /** Bitácora de envio_notificacion (API: GET /notifications, solo metadatos). */
  messagesLog: boolean;
  /** Cerrar una alerta con nota (API: POST /collection-alerts/{id}/resolution). */
  resolveAlerts: boolean;
  /** Reintentar un envío fallido: lo hace el scheduler (WF3); la API no lo expone. */
  retryMessages: boolean;
  /** Corregir campos de un pago ya creado (en la API se corrige el borrador antes de confirmar). */
  editPaymentFields: boolean;
  /** Marcar un pago como duplicado de otro (API: POST /payments/{id}/duplicate). */
  markDuplicate: boolean;
  /** Descartar un pago: sin endpoint en el contrato. */
  discardPayment: boolean;
  /** Alta manual de pedidos: createTextEvidence está fuera del MVP. */
  manualOrderCapture: boolean;
  /** Carga de voucher con datos tipeados (mock) o con archivo (API: uploadEvidenceFile). */
  voucherNeedsFile: boolean;
  /** Supuestos de caja, plazo por defecto y precio de transferencia: sin endpoint. */
  settings: boolean;
  /** Ítems de la orden (API: Order.items desde orden_item). */
  orderItems: boolean;
  /** Directorio propio de clientes: la API no tiene GET /customers; los clientes se derivan de sus órdenes. */
  customerDirectory: boolean;
  resetDemo: boolean;
  /** Demo de login con cuentas de prueba. */
  demoAccounts: boolean;
};

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
  demo: boolean;
  factorCobro: number | null;
  expectedCents: number;
  openOrders: number;
  overdueCents: number;
  pipelineCents: number;
  pipelineCount: number;
  /** null = el rol no tiene acceso a caja (GET /results/cash-forecast es de gerencia). */
  cashCents: number | null;
  openingCents: number | null;
  collectedCents: number;
  openingSource: string;
  /** null = costeo incompleto o rol sin acceso a resultados. */
  marginCents: number | null;
  perceivedCents: number | null;
  orderCount: number;
  weeks: WeekPoint[] | null;
  assistant: AssistantNote[];
  /** null = rol sin acceso a auditoría. */
  activity: ActivityItem[] | null;
};

/* ---------- Órdenes ---------- */

export type OrderColumnId = "por_confirmar" | "retenida" | "en_produccion" | "por_cobrar" | "cobrada";

export type OrderCard = {
  id: string;
  ref: string;
  customerId: string | null;
  customer: string;
  brand: Brand | null;
  description: string;
  saleCents: number | null;
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
  demo: boolean;
};

export type OrderBoardDTO = { columns: Array<{ id: OrderColumnId; title: string; cards: OrderCard[] }>; rejected: number };

export type OrderRow = OrderCard & {
  line: string | null;
  despachoOn: string | null;
  paidCents: number;
  lastPaymentAt: string | null;
  daysLate: number | null;
};

export type CreditSnapshot = {
  usedCents: number;
  availableCents: number | null;
  overdueCents: number;
  maxOverdueDays: number;
  avgDaysLate: number | null;
  paidOnTime: number;
  closedCount: number;
  status: CreditStatus;
  aviso: string | null;
  totalSoldCents: number;
  totalPaidCents: number;
  orderCount: number;
  lastPaymentAt: string | null;
  lastOrderOn: string | null;
};

/** Cliente visto desde el panel. La API no tiene GET /customers: varios campos pueden faltar. */
export type CustomerView = {
  id: string;
  name: string;
  brand: Brand | null;
  tipo: Customer["tipo"] | null;
  rucDni: string | null;
  sellerId: string | null;
  contactoWhatsapp: string | null;
  since: string | null;
  creditLimitCents: number | null;
};

export type OrderDetailDTO = {
  cutDate: string;
  order: Order;
  customer: CustomerView;
  seller: string | null;
  card: OrderCard;
  credit: CreditSnapshot;
  paidCents: number;
  anticipoRequeridoCents: number;
  gatekeeper: boolean;
  /** null = costeo no disponible o incompleto. */
  costCents: number | null;
  marginCents: number | null;
  perceivedCents: number | null;
  payments: Array<{ id: string; at: string; amountCents: number; channel: string; by: string; evidenceId: string | null }>;
  pendingEvidence: Array<{ id: string; ref: string; amountCents: number | null; status: EvidenceStatus; match: MatchKind; receivedAt: string }>;
  messages: OutgoingMessage[] | null;
  alerts: CollectionAlert[];
  plazoDefecto: number;
};

export type TallerOrder = {
  id: string;
  ref: string;
  /** null = el rol no ve clientes (RLS V7: producción no lee `cliente`). */
  customer: string | null;
  brand: Brand | null;
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

/** `retenidas` null = el rol no las ve (RLS V7: producción recibe solo órdenes liberadas). */
export type TallerDTO = { cutDate: string; enProduccion: TallerOrder[]; retenidas: TallerOrder[] | null; despachadas: TallerOrder[] };

/* ---------- Conciliación ---------- */

export type PaymentCard = {
  id: string;
  ref: string;
  kind: Evidence["kind"];
  origen: Evidence["origen"];
  channel: string | null;
  orderId: string | null;
  orderRef: string | null;
  customer: string;
  amountCents: number | null;
  seller: string | null;
  match: MatchKind;
  status: EvidenceStatus;
  receivedAt: string;
};

export type QueueFilter = "recibidos" | "verificados" | "aplicados" | "revision";

export function queueGroup(c: PaymentCard): QueueFilter | null {
  if (c.status === "descartado") return null;
  if (c.status === "aplicado") return "aplicados";
  if (c.status === "verificado_banco") return "verificados";
  return IN_REVIEW.includes(c.match) ? "revision" : "recibidos";
}

export type EvidenceDetailDTO = {
  evidence: Evidence;
  /** Marca del pago: el contrato no la expone (null en modo api). */
  brand: Brand | null;
  /** URL firmada del voucher (getEvidenceDownloadLink); null en mock o sin imagen. */
  imageUrl: string | null;
  appliedBy: string | null;
  match: MatchKind;
  duplicateOfId: string | null;
  /** Código del pago original (V-00X), para mostrarlo en lugar del id. */
  duplicateOfRef: string | null;
  /** Ya quedó marcado como duplicado (en revisión, sin descontar); false si solo se detectó. */
  duplicateMarked: boolean;
  order: { id: string; ref: string; customer: string; line: string | null; saleCents: number | null; balanceCents: number; daysToDue: number | null; dueDate: string | null; seller: string | null } | null;
  missing: string[];
  /** Órdenes con saldo para vincular (mock) o candidatos de conciliación (API). */
  openOrders: Array<{ id: string; label: string }>;
};

/* ---------- Cobranza ---------- */

export type ReceivableRow = { id: string; orderRef: string; customerId: string; customer: string; seller: string | null; dueDate: string; daysToDue: number; balanceCents: number; finance: OrderFinance };
export type AlertRow = CollectionAlert & { orderRef: string; customer: string; customerId: string | null; balanceCents: number | null; dueDate: string | null };
export type MessageRow = OutgoingMessage & { customer: string; contacto: string; orderRef: string | null };
export type CobranzaDTO = { cutDate: string; receivables: ReceivableRow[]; alerts: AlertRow[]; messages: MessageRow[] | null };

/* ---------- Clientes ---------- */

export type CustomerRow = {
  id: string;
  name: string;
  brand: Brand | null;
  tipo: Customer["tipo"] | null;
  seller: string | null;
  since: string | null;
  creditLimitCents: number | null;
  usedCents: number;
  overdueCents: number;
  maxOverdueDays: number;
  status: CreditStatus;
  avgDaysLate: number | null;
  lastPaymentAt: string | null;
  nextDue: { id: string; ref: string; date: string; overdue: boolean } | null;
  pendingOrders: number;
};

export type TimelineItem = {
  id: string;
  at: string;
  kind: "pedido" | "despacho" | "vencimiento" | "pago" | "credito" | "mensaje";
  title: string;
  detail: string;
  amountCents: number | null;
  tone: "ok" | "warn" | "bad" | "violet" | "neutral" | "info";
  future: boolean;
  dateOnly: boolean;
};

export type CreditDecisionRow = {
  orderId: string;
  orderRef: string;
  decision: "aprobado" | "rechazado";
  by: string;
  at: string;
  avisoMoraMostrado: boolean;
  tipo: string;
  plazoDias: number;
  nota: string | null;
  saleCents: number | null;
};

export type CustomerDetailDTO = {
  cutDate: string;
  customer: CustomerView;
  seller: string | null;
  snapshot: CreditSnapshot;
  orders: OrderRow[];
  payments: Array<{ id: string; at: string; orderRef: string; amountCents: number; channel: string | null; by: string | null; evidence: string | null }>;
  decisions: CreditDecisionRow[];
  messages: OutgoingMessage[] | null;
  timeline: TimelineItem[];
};

/** Estado de cuenta autenticado (GET /customers/{id}/statement). No hay enlace público en V6. */
export type StatementDTO = {
  customerId: string;
  customer: string;
  generatedAt: string;
  balanceCents: number;
  overdueCents: number;
  nextDue: { ref: string; date: string; amountCents: number } | null;
  orders: Array<{ id: string; ref: string; description: string | null; despachoOn: string | null; dueDate: string | null; saleCents: number; paidCents: number; balanceCents: number; state: "Pagado" | "Vencido" | "Por pagar" | "En producción" }>;
  payments: Array<{ id: string; at: string; orderRef: string; paymentRef: string | null; amountCents: number }>;
  demo: boolean;
};

/* ---------- Resultado ---------- */

export type ResultRow = {
  id: string;
  ref: string;
  customer: string;
  customerId: string | null;
  brand: Brand | null;
  line: string | null;
  description: string;
  modality: Order["modality"] | null;
  costOrigin: Order["costOrigin"] | null;
  issuedOn: string;
  saleCents: number;
  costCents: number | null;
  costs: Order["costs"] | null;
  costComplete: boolean;
  missingCosts: string[];
  marginCents: number | null;
  perceivedCents: number | null;
  collectedCents: number | null;
  balanceCents: number | null;
  dueDate: string | null;
};

export type ResultsDTO = {
  cutDate: string;
  demo: boolean;
  rows: ResultRow[];
  /** Margen de los pedidos con costeo cerrado (`orders`); `withoutCost` = confirmados que aún no lo tienen y no suman. */
  byBrand: Array<{ brand: Brand; saleCents: number; marginCents: number | null; perceivedCents: number | null; collectedCents: number; orders: number; withoutCost: number }>;
  byLine: Array<{ line: string; saleCents: number; marginCents: number | null; orders: number }>;
  workshop: null | {
    orderIds: string[];
    costCents: number | null;
    internalChargeCents: number;
    workshopResultCents: number | null;
    commercialResultCents: number;
    consolidatedMarginCents: number | null;
  };
};

/* ---------- Perfil ---------- */

export type ProfileDTO = {
  activity: ActivityItem[] | null;
  counts: Array<{ label: string; value: number }>;
  settings: Settings | null;
  ownOrders: Array<{ id: string; ref: string; customer: string; costCents: number; internalChargeCents: number; saleCents: number }>;
};

/* ---------- Búsqueda y captura ---------- */

export type SearchHit = { id: string; label: string; detail: string; href: string; brand: Brand | null };
export type CaptureOptions = {
  orders: Array<{ id: string; label: string }>;
  customers: Array<{ id: string; name: string }>;
};

/* ---------- Comandos ---------- */

export type ActionResult = { ok: true; message: string; id?: string } | { ok: false; message: string; code?: "aviso_mora" | "no_disponible" };
export type PaymentTerms = { tipo: "contado" | "anticipo" | "credito"; plazoDias: number; anticipoPct: number | null };

export type VoucherInput = {
  brand: Brand;
  orderId: string | null;
  amountCents: number;
  operationRef: string;
  payer: string;
  paidAt: string;
  channel: string;
  file: File | null;
};

export type OrderInput = { customerId: string; description: string; cantidad: number; totalCents: number; entrega: string | null };

/** Contrato común de las dos fuentes de datos. */
export type DataSource = {
  capabilities: Capabilities;
  getDashboard(scope: Scope, role: Role, notify: Preferences["notify"]): Promise<DashboardDTO>;
  getOrderBoard(scope: Scope): Promise<OrderBoardDTO>;
  getOrders(scope: Scope): Promise<OrderRow[]>;
  getOrder(id: string): Promise<OrderDetailDTO | null>;
  getTaller(scope: Scope): Promise<TallerDTO>;
  getQueue(scope: Scope): Promise<PaymentCard[]>;
  getEvidence(id: string): Promise<EvidenceDetailDTO | null>;
  getCobranza(scope: Scope): Promise<CobranzaDTO>;
  getCustomers(scope: Scope): Promise<CustomerRow[]>;
  getCustomer(id: string): Promise<CustomerDetailDTO | null>;
  getStatement(customerId: string): Promise<StatementDTO | null>;
  getResults(scope: Scope): Promise<ResultsDTO>;
  ordersCsv(scope: Scope): Promise<string>;
  getProfile(person: Person): Promise<ProfileDTO>;
  search(q: string, brand: Brand | null): Promise<SearchHit[]>;
  getCaptureOptions(brand: Brand): Promise<CaptureOptions>;
  commands: {
    editField(id: string, field: FieldKey, raw: string, actor: Person): Promise<ActionResult>;
    assignOrder(id: string, orderId: string, actor: Person): Promise<ActionResult>;
    verifyFunds(id: string, actor: Person, acceptMismatch?: boolean): Promise<ActionResult>;
    applyPayment(id: string, actor: Person): Promise<ActionResult>;
    markDuplicate(id: string, actor: Person): Promise<ActionResult>;
    discard(id: string, actor: Person, reason: string): Promise<ActionResult>;
    confirmOrder(orderId: string, terms: PaymentTerms, actor: Person, opts: { moraAcknowledged: boolean; nota: string | null }): Promise<ActionResult>;
    rejectOrder(orderId: string, nota: string, actor: Person): Promise<ActionResult>;
    registerDispatch(orderId: string, fecha: string, acta: string, actor: Person): Promise<ActionResult>;
    resolveAlert(alertId: string, resolucion: string, actor: Person): Promise<ActionResult>;
    retryMessage(id: string, actor: Person): Promise<ActionResult>;
    captureVoucher(input: VoucherInput, actor: Person): Promise<ActionResult>;
    captureOrder(input: OrderInput, actor: Person): Promise<ActionResult>;
    updateSettings(patch: Partial<Pick<Settings, "factorCobro" | "plazoDefecto">>, actor: Person): Promise<ActionResult>;
    setInternalCharge(orderId: string, cents: number, actor: Person): Promise<ActionResult>;
    reset(): Promise<ActionResult>;
  };
};

export const MESSAGE_LABEL: Record<OutgoingMessage["tipo"], string> = {
  cobranza_preventiva: "Aviso preventivo (−3 días)",
  cobranza_vencimiento: "Vence hoy",
  mora_temprana: "Mora temprana (+3 días)",
  estado_cuenta: "Estado de cuenta",
  confirmacion_pago: "Confirmación de pago",
  resumen_orden: "Resumen de la orden",
  recompra: "Invitación a recomprar",
  resumen_vendedor: "Resumen al vendedor",
};
