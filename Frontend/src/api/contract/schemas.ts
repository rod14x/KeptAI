import { z } from "zod";

// Esquemas del contrato del panel: Backend/docs/openapi.yaml (MIG-02), JSON snake_case.
// Importes en centavos enteros PEN dentro del rango seguro de JavaScript. Ausente es null, nunca cero.
// Validados contra los ejemplos del YAML en contract.test.ts. Si el contrato cambia, actualizar aquí.

const SAFE = Number.MAX_SAFE_INTEGER;
export const Uuid = z.string().uuid();
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IsoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "date-time inválido");
export const CurrencyCode = z.literal("PEN");
export const DataOrigin = z.enum(["demo_fixture", "manual_entry", "reviewed_extraction"]);

export const Money = z.object({ amount_cents: z.number().int().min(-SAFE).max(SAFE), currency: CurrencyCode }).strict();
export const NonNegativeMoney = z.object({ amount_cents: z.number().int().min(0).max(SAFE), currency: CurrencyCode }).strict();
export const PositiveMoney = z.object({ amount_cents: z.number().int().min(1).max(SAFE), currency: CurrencyCode }).strict();
export type MoneyT = z.infer<typeof Money>;

export const PageInfo = z.object({ limit: z.number().int(), next_cursor: z.string().nullable() }).strict();
export const page = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), page: PageInfo }).strict();

export const ApiError = z
  .object({
    code: z.string(),
    message: z.string(),
    request_id: z.string().nullable(),
    details: z.array(z.object({ field: z.string(), code: z.string(), message: z.string() })).optional(),
    retryable: z.boolean().optional(),
  })
  .passthrough();
export type ApiErrorT = z.infer<typeof ApiError>;

/* ---------- Identidad ---------- */
export const UserRole = z.enum(["VENDEDOR", "ADMIN", "GERENTE", "JEFE_TALLER"]);
// INT-FE-API-002: los campos opcionales nuevos se omiten cuando son nulos (NON_NULL en Spring); por eso son nullish.
export const UserContext = z
  .object({ user_id: Uuid, organization_id: Uuid, role: UserRole, name: z.string().nullish(), organization_name: z.string().nullish() })
  .strict();
export type UserContextT = z.infer<typeof UserContext>;

/* ---------- Evidencias y extracción ---------- */
export const EvidenceKind = z.enum(["text_chat", "voucher_image", "audio_note"]);
export const Evidence = z
  .object({
    id: Uuid,
    kind: EvidenceKind,
    status: z.enum(["stored", "discarded"]),
    content_type: z.string().nullable(),
    size_bytes: z.number().int().nullable(),
    sha256: z.string().nullable(),
    text_preview: z.string().nullable(),
    label: z.string().nullable(),
    data_origin: DataOrigin,
    uploaded_by_user_id: Uuid.nullable(),
    created_at: IsoDateTime,
  })
  .strict();
export type EvidenceT = z.infer<typeof Evidence>;
export const EvidencePage = page(Evidence);
export const EvidenceDownloadLink = z.object({ url: z.string().url(), expires_at: IsoDateTime }).strict();

export const DraftType = z.enum(["order", "payment_voucher"]);
export const JobStatus = z.enum(["queued", "running", "succeeded", "failed"]);
export const ExtractionJob = z
  .object({
    id: Uuid,
    evidence_id: Uuid,
    expected_draft_type: DraftType,
    status: JobStatus,
    attempt: z.number().int(),
    error_code: z.string().nullable(),
    error_message: z.string().nullable(),
    retryable: z.boolean(),
    draft_id: Uuid.nullable(),
    created_at: IsoDateTime,
    finished_at: IsoDateTime.nullable(),
  })
  .strict();

const FieldStatus = z.enum(["present", "missing", "illegible"]);
const extracted = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value: value.nullable(), status: FieldStatus, source_fragment: z.string().nullable(), human_corrected: z.boolean() }).strict();
export const OrderDraftFields = z
  .object({
    customer_name: extracted(z.string()),
    brand: extracted(z.string()),
    product_description: extracted(z.string()),
    quantity: extracted(z.number().int()),
    sale_amount: extracted(PositiveMoney),
  })
  .strict();
export const VoucherDraftFields = z
  .object({
    payer_name: extracted(z.string()),
    channel: extracted(z.string()),
    amount: extracted(PositiveMoney),
    operation_reference: extracted(z.string()),
    paid_at: extracted(IsoDateTime),
  })
  .strict();
export const ExtractionDraft = z
  .object({
    id: Uuid,
    // Null en borradores que llegan por n8n sin archivo (ingesta de pedido).
    evidence_id: Uuid.nullable(),
    draft_type: DraftType,
    status: z.enum(["pending_review", "confirmed", "discarded"]),
    revision: z.number().int(),
    order_fields: OrderDraftFields.nullable(),
    voucher_fields: VoucherDraftFields.nullable(),
    resulting_order_id: Uuid.nullable(),
    resulting_payment_id: Uuid.nullable(),
    reviewed_by_user_id: Uuid.nullable(),
    model_reported_confidence_permille: z.number().int().nullable(),
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .strict();
export type ExtractionDraftT = z.infer<typeof ExtractionDraft>;
export const ExtractionDraftPage = page(ExtractionDraft);
export const ConfirmDraftResponse = z
  .object({ draft: ExtractionDraft, order_id: Uuid.nullable(), payment_id: Uuid.nullable(), funds_verified: z.literal(false), balance_changed: z.literal(false) })
  .strict();

/* ---------- Órdenes ---------- */
export const OrderStatus = z.enum(["draft", "pending_approval", "held", "released", "in_production", "dispatched", "closed", "cancelled"]);
export const ReceivableStatus = z.enum(["pending", "partially_paid", "paid", "overdue", "voided"]);
export const PaymentCondition = z.enum(["cash", "advance", "credit"]);
export const PersonRef = z.object({ id: Uuid, name: z.string() }).strict();
export type PersonRefT = z.infer<typeof PersonRef>;
export const CustomerType = z.enum(["school", "company", "person"]);
export const CustomerRef = z
  .object({ id: Uuid, name: z.string(), type: CustomerType.nullish(), tax_id: z.string().nullish(), credit_limit: NonNegativeMoney.nullish() })
  .strict();
export type CustomerRefT = z.infer<typeof CustomerRef>;
export const OrderItem = z
  .object({ description: z.string(), quantity: z.number().int(), unit_price: NonNegativeMoney, product_line: z.string().nullable(), detail: z.string().nullable() })
  .strict();
export const Order = z
  .object({
    id: Uuid,
    display_code: z.string(),
    customer: CustomerRef.nullable(),
    brand: z.string().nullable(),
    product_line: z.string().nullable(),
    production_mode: z.enum(["own", "outsourced"]),
    sale: PositiveMoney.nullable(),
    status: OrderStatus,
    source: z.enum(["whatsapp", "manual", "csv"]),
    payment_condition: PaymentCondition.nullable(),
    credit_term_days: z.number().int().nullable(),
    advance_required: NonNegativeMoney,
    requested_delivery_date: IsoDate.nullable(),
    production_start_date: IsoDate.nullable(),
    dispatch_date: IsoDate.nullable(),
    receivable_status: ReceivableStatus.nullable(),
    due_date: IsoDate.nullable(),
    source_evidence_id: Uuid.nullable(),
    data_origin: DataOrigin,
    created_at: IsoDateTime,
    seller: PersonRef.nullish(),
    items: z.array(OrderItem).optional(),
    dispatched_by: PersonRef.nullish(),
  })
  .strict();
export type OrderT = z.infer<typeof Order>;
export const OrderPage = page(Order);

/* ---------- Clientes y Contactos (Fase 1) ---------- */
export const Customer = z
  .object({
    id: Uuid,
    organizacion_id: Uuid.optional(),
    tipo_persona: z.string().optional(),
    razon_social: z.string(),
    ruc_dni: z.string().nullable().optional(),
    telefono_principal: z.string().nullable().optional(),
    canal_origen: z.string().nullable().optional(),
    limite_credito: NonNegativeMoney.nullable().optional(),
    creado_en: IsoDateTime.optional(),
  })
  .passthrough();
export type CustomerT = z.infer<typeof Customer>;
export const CustomerPage = page(Customer);

export const Contact = z
  .object({
    id: Uuid,
    cliente_id: Uuid.optional(),
    nombre: z.string(),
    telefono: z.string(),
    whatsapp_jid: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    es_principal: z.boolean().optional(),
  })
  .passthrough();
export type ContactT = z.infer<typeof Contact>;

/* ---------- Ficha Técnica Textil (Fase 3) ---------- */
export const TechSheet = z
  .object({
    id: Uuid.optional(),
    order_id: Uuid,
    estado: z.string().optional(),
    modalidad: z.string(),
    semaforo_tela: z.string().optional(),
    consumo_estimado_kg: z.number().optional(),
    validacion_tela: z.string().optional(),
    tela_validada_por: z.string().nullable().optional(),
    tela_validada_at: IsoDateTime.nullable().optional(),
    prenda_tipo: z.string().optional(),
    tela_nombre: z.string().optional(),
    gramaje: z.string().optional(),
    color_principal: z.string().optional(),
    color_contraste: z.string().nullable().optional(),
    tipo_cuello: z.string().optional(),
    curva_tallas: z.any().optional(),
    tecnica_personalizacion: z.string().optional(),
    ubicaciones_arte: z.any().optional(),
    instrucciones_costura: z.any().optional(),
    completada_por: z.string().nullable().optional(),
    completada_en: IsoDateTime.nullable().optional(),
  })
  .passthrough();
export type TechSheetT = z.infer<typeof TechSheet>;

/* ---------- Pagos y conciliación ---------- */
export const PaymentPhase = z.enum(["received", "bank_verified", "applied"]);
export const ReconciliationStatus = z.enum(["pending", "applied", "partial", "duplicate", "orphan", "amount_mismatch"]);
export const PaymentChannel = z.enum(["yape", "plin", "bank_transfer", "deposit", "cash", "other"]);
export const VerificationMethod = z.enum(["simulated_demo", "manual_confirmation"]);
export const PaymentVerification = z
  .object({
    method: VerificationMethod,
    is_simulated: z.boolean(),
    verified_by_user_id: Uuid,
    verified_at: IsoDateTime,
    note: z.string().nullable(),
    verified_by_name: z.string().nullish(),
  })
  .strict();
export const PaymentAllocation = z
  .object({
    application_id: Uuid,
    receivable_id: Uuid,
    order_id: Uuid,
    order_code: z.string(),
    amount: PositiveMoney,
    applied_at: IsoDateTime,
    applied_by: PersonRef.nullish(),
  })
  .strict();
export const Payment = z
  .object({
    id: Uuid,
    display_code: z.string().nullable(),
    phase: PaymentPhase,
    reconciliation_status: ReconciliationStatus,
    channel: PaymentChannel,
    operation_reference: z.string().nullable(),
    payer_name: z.string().nullable(),
    paid_at: IsoDateTime.nullable(),
    received_amount: PositiveMoney,
    verified_amount: NonNegativeMoney.nullable(),
    applied_amount: NonNegativeMoney,
    unapplied_amount: NonNegativeMoney,
    duplicate_of_payment_id: Uuid.nullable(),
    evidence_ids: z.array(Uuid),
    verification: PaymentVerification.nullable(),
    model_reported_confidence_permille: z.number().int().nullable(),
    data_origin: DataOrigin,
    created_at: IsoDateTime,
    applications: z.array(PaymentAllocation).optional(),
  })
  .strict();
export type PaymentT = z.infer<typeof Payment>;
export const PaymentPage = page(Payment);
export const MatchReason = z.enum(["amount_equal", "amount_below_balance", "amount_above_balance", "reference_already_used", "customer_name_similar"]);
export const ReconciliationResult = z
  .object({
    payment_id: Uuid,
    classification: z.enum(["matches", "partial", "duplicate", "orphan", "amount_mismatch"]),
    candidates: z.array(
      z
        .object({
          receivable_id: Uuid,
          order_id: Uuid,
          order_code: z.string(),
          customer_name: z.string(),
          balance: NonNegativeMoney,
          match_score: z.number().int().nullable(),
          reasons: z.array(MatchReason),
        })
        .strict(),
    ),
  })
  .strict();
export type ReconciliationResultT = z.infer<typeof ReconciliationResult>;

export const DueBucket = z.enum(["awaiting_dispatch", "not_due", "due_today", "overdue"]);
export const ReceivableApplication = z
  .object({
    application_id: Uuid,
    payment_id: Uuid,
    payment_code: z.string().nullable(),
    channel: PaymentChannel,
    amount: PositiveMoney,
    applied_at: IsoDateTime,
    applied_by: PersonRef.nullish(),
  })
  .strict();
export const Receivable = z
  .object({
    id: Uuid,
    order_id: Uuid,
    order_code: z.string(),
    customer: CustomerRef,
    original_amount: PositiveMoney,
    applied_amount: NonNegativeMoney,
    balance: NonNegativeMoney,
    credit_term_days: z.number().int(),
    term_start_event: z.literal("dispatch"),
    due_date: IsoDate.nullable(),
    due_bucket: DueBucket,
    days_overdue: z.number().int(),
    status: ReceivableStatus,
    applications: z.array(ReceivableApplication).optional(),
  })
  .strict();
export type ReceivableT = z.infer<typeof Receivable>;
export const ReceivablePage = page(Receivable);
export const PaymentApplication = z
  .object({ id: Uuid, payment_id: Uuid, receivable_id: Uuid, applied_amount: PositiveMoney, applied_at: IsoDateTime, applied_by_user_id: Uuid })
  .strict();
export const PaymentApplicationResult = z
  .object({ application: PaymentApplication, payment: Payment, receivable: Receivable, resolved_alert_ids: z.array(Uuid) })
  .strict();

export const CollectionAlert = z
  .object({
    id: Uuid,
    receivable_id: Uuid.nullable(),
    payment_id: Uuid.nullable(),
    rule: z.enum(["early_arrears", "payment_in_review", "advance_pending"]),
    status: z.enum(["open", "resolved", "cancelled"]),
    responsible_user_id: Uuid.nullable(),
    resolution: z.enum(["payment_applied", "manual"]).nullable(),
    created_at: IsoDateTime,
    closed_at: IsoDateTime.nullable(),
    responsible_name: z.string().nullish(),
    resolution_note: z.string().nullish(),
  })
  .strict();
export type CollectionAlertT = z.infer<typeof CollectionAlert>;
export const CollectionAlertPage = page(CollectionAlert);

/* ---------- Decisión de crédito ---------- */
export const CreditAuthorization = z
  .object({
    status: z.enum(["not_required", "pending", "approved", "rejected"]),
    responsible_user_id: Uuid.nullable(),
    arrears_notice_shown: z.boolean(),
    overdue_balance_reference: NonNegativeMoney.nullable(),
    credit_term_days: z.number().int().nullable(),
    advance_pct_bps: z.number().int().nullable(),
    reason: z.string().nullable(),
    decided_at: IsoDateTime.nullable(),
    responsible_name: z.string().nullish(),
  })
  .strict();
export type CreditAuthorizationT = z.infer<typeof CreditAuthorization>;

/* ---------- Estado de cuenta ---------- */
export const CustomerStatement = z
  .object({
    customer: CustomerRef,
    generated_at: IsoDateTime,
    total_balance: NonNegativeMoney,
    next_due_date: IsoDate.nullable(),
    orders: z.array(
      z
        .object({ order_id: Uuid, order_code: z.string(), sale: PositiveMoney, applied_amount: NonNegativeMoney, balance: NonNegativeMoney, due_date: IsoDate.nullable() })
        .strict(),
    ),
    applications: z.array(
      z.object({ payment_code: z.string().nullable(), order_code: z.string(), applied_amount: PositiveMoney, applied_at: IsoDateTime }).strict(),
    ),
    credit_authorization: CreditAuthorization,
    data_origin: DataOrigin,
  })
  .strict();
export type CustomerStatementT = z.infer<typeof CustomerStatement>;

/* ---------- Resultados ---------- */
export const CostComponent = z.enum(["raw_materials", "labor", "outsourced", "overhead", "logistics"]);
export const ResultsSummary = z
  .object({
    as_of: IsoDate,
    sales_total: NonNegativeMoney,
    applied_collections_total: NonNegativeMoney,
    pending_balance_total: NonNegativeMoney,
    cost_total: NonNegativeMoney.nullable(),
    margin_total: Money.nullable(),
    cost_status: z.enum(["complete", "incomplete"]),
    missing_cost_components: z.array(CostComponent),
    data_origin: DataOrigin,
  })
  .strict();
export type ResultsSummaryT = z.infer<typeof ResultsSummary>;
export const MarginRow = z
  .object({
    group_key: z.string(),
    group_id: Uuid.nullable(),
    production_mode: z.enum(["own", "outsourced"]).nullable(),
    revenue: NonNegativeMoney,
    total_cost: NonNegativeMoney.nullable(),
    margin: Money.nullable(),
    cost_status: z.enum(["complete", "incomplete"]),
    missing_cost_components: z.array(CostComponent),
    orders_count: z.number().int(),
    perceived_margin: Money.nullish(),
  })
  .strict();
export type MarginRowT = z.infer<typeof MarginRow>;
export const MarginReport = z
  .object({ as_of: IsoDate, group_by: z.enum(["order", "product_line", "brand"]), items: z.array(MarginRow), totals: MarginRow, page: PageInfo, data_origin: DataOrigin })
  .strict();
export type MarginReportT = z.infer<typeof MarginReport>;
export const ProductionCenterReport = z
  .object({
    as_of: IsoDate,
    items: z.array(
      z
        .object({
          order_id: Uuid,
          order_code: z.string(),
          internal_charge: NonNegativeMoney,
          workshop_cost: NonNegativeMoney.nullable(),
          workshop_result: Money.nullable(),
          commercial_result: Money,
          consolidated_margin: Money.nullable(),
          internal_charge_eliminated_in_consolidation: z.literal(true),
        })
        .strict(),
    ),
    page: PageInfo,
    data_origin: DataOrigin,
  })
  .strict();
export type ProductionCenterReportT = z.infer<typeof ProductionCenterReport>;
export const CashForecast = z
  .object({
    as_of: IsoDate,
    forecast_status: z.enum(["complete", "missing_opening_cash"]),
    opening_cash: z.object({ amount: Money, as_of: IsoDate, source: z.enum(["demo_fixture", "manual_entry"]) }).strict().nullable(),
    assumptions: z.object({ collection_risk_factor_bps: z.number().int(), source: z.literal("scenario_assumption") }).strict(),
    weeks: z.array(
      z
        .object({
          week_start: IsoDate,
          week_end: IsoDate,
          expected_inflows: NonNegativeMoney,
          realized_inflows: NonNegativeMoney,
          outflows: NonNegativeMoney,
          net: Money,
          closing_balance: Money.nullable(),
        })
        .strict(),
    ),
    data_origin: DataOrigin,
  })
  .strict();
export type CashForecastT = z.infer<typeof CashForecast>;

/* ---------- Auditoría ---------- */
export const AuditEvent = z
  .object({
    id: Uuid,
    occurred_at: IsoDateTime,
    actor: z.enum(["user", "n8n", "scheduler", "system"]),
    actor_user_id: Uuid.nullable(),
    operation: z.string(),
    entity_type: z.string(),
    entity_id: Uuid,
    request_id: z.string().nullable(),
    changes: z.array(z.object({ field: z.string(), old_value: z.string().nullable(), new_value: z.string().nullable() }).strict()),
    actor_name: z.string().nullish(),
  })
  .strict();
export type AuditEventT = z.infer<typeof AuditEvent>;
export const AuditEventPage = page(AuditEvent);

/* ---------- Envíos de cobranza (WF3, solo metadatos; D-007) ---------- */
export const NotificationType = z.enum([
  "collection_preventive",
  "collection_due",
  "early_arrears",
  "repurchase",
  "account_statement",
  "payment_confirmation",
  "seller_summary",
]);
export const Notification = z
  .object({
    id: Uuid,
    customer: CustomerRef.nullable(),
    order_id: Uuid.nullable(),
    order_code: z.string().nullable(),
    type: NotificationType,
    status: z.enum(["pending", "sent", "error", "cancelled"]),
    scheduled_for: IsoDateTime,
    attempts: z.number().int(),
    sent_at: IsoDateTime.nullable(),
    last_error: z.string().nullable(),
  })
  .strict();
export type NotificationT = z.infer<typeof Notification>;
export const NotificationPage = page(Notification);

/* ---------- Cuerpos de petición ---------- */
export type CorrectDraftRequest = {
  expected_revision: number;
  order_fields?: Partial<{ customer_name: string; brand: string; product_description: string; quantity: number; sale_amount: z.infer<typeof PositiveMoney> }>;
  voucher_fields?: Partial<{ payer_name: string; channel: string; amount: z.infer<typeof PositiveMoney>; operation_reference: string; paid_at: string }>;
};
export type CreditDecisionRequest = {
  decision: "approved" | "rejected";
  arrears_notice_acknowledged: boolean;
  credit_term_days?: number;
  advance_pct_bps?: number;
  reason?: string;
};
export type ApplyPaymentRequest = { receivable_id: string; amount: z.infer<typeof PositiveMoney> };
export type RegisterVerificationRequest = { method: "simulated_demo" | "manual_confirmation"; note?: string | null };
export type DispatchRequest = { dispatch_date: string; note?: string | null };
export type ResolveAlertRequest = { note: string };

export type CreateCustomerRequest = {
  tipo_persona: string;
  razon_social: string;
  ruc_dni: string;
  telefono_principal: string;
  canal_origen: string;
  limite_credito?: z.infer<typeof NonNegativeMoney>;
};

export type CreateContactRequest = {
  nombre: string;
  telefono: string;
  whatsapp_jid?: string;
  email?: string;
  es_principal?: boolean;
};

export type CreateOrderRequest = {
  customer_id: string;
  description: string;
  quantity: number;
  total_amount: z.infer<typeof PositiveMoney>;
  requested_delivery_date?: string | null;
};

export type SaveTechSheetRequest = {
  modalidad: string;
  semaforo_tela?: string;
  consumo_estimado_kg?: number;
  prenda_tipo?: string;
  tela_nombre?: string;
  gramaje?: string;
  color_principal?: string;
  color_contraste?: string | null;
  tipo_cuello?: string;
  curva_tallas?: any;
  tecnica_personalizacion?: string;
  ubicaciones_arte?: any;
  instrucciones_costura?: any;
};

export type ValidateFabricRequest = {
  validacion: "CONFIRMADA_TALLER" | "COMPRA_REQUERIDA" | "NO_APLICA";
  nota?: string;
};

export type StationAdvanceRequest = {
  station: string;
  note?: string;
};

/** Esquema por nombre del componente OpenAPI, para validar ejemplos del YAML. */
export const SCHEMAS_BY_NAME: Record<string, z.ZodTypeAny> = {
  UserContext,
  Evidence,
  EvidencePage,
  EvidenceDownloadLink,
  ExtractionJob,
  ExtractionDraft,
  ExtractionDraftPage,
  ConfirmDraftResponse,
  Order,
  OrderPage,
  Customer,
  CustomerPage,
  Contact,
  TechSheet,
  Payment,
  PaymentPage,
  ReconciliationResult,
  Receivable,
  ReceivablePage,
  PaymentApplicationResult,
  CollectionAlert,
  CollectionAlertPage,
  Notification,
  NotificationPage,
  CreditAuthorization,
  CustomerStatement,
  ResultsSummary,
  MarginReport,
  ProductionCenterReport,
  CashForecast,
  AuditEvent,
  AuditEventPage,
  ApiError,
};
