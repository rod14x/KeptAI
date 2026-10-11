import { z } from "zod";

// Modelo de la demo alineado con el DER fusionado (PROP-FLUJO-DER-001, D-005).
// Importes en céntimos enteros (contrato propuesto en modelo-base-datos-mvp.md).
const cents = z.number().int();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BrandSchema = z.enum(["corpotex", "unicrack"]);
export type Brand = z.infer<typeof BrandSchema>;
export type Scope = Brand | "consolidado";

/** Roles del DER: VENDEDOR, ADMIN, GERENTE, JEFE_TALLER. */
export const RoleSchema = z.enum(["gerencia", "administracion", "vendedor", "jefe_taller"]);
export type Role = z.infer<typeof RoleSchema>;

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: RoleSchema,
  title: z.string(),
  brand: BrandSchema.nullable(),
  since: isoDate,
});
export type Person = z.infer<typeof PersonSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: BrandSchema,
  tipo: z.enum(["colegio", "empresa", "persona"]),
  /** RUC o DNI: no se inventa; null = por confirmar con la empresa. */
  rucDni: z.string().nullable(),
  sellerId: z.string(),
  contactoWhatsapp: z.string(),
  since: isoDate,
  creditLimitCents: cents,
});
export type Customer = z.infer<typeof CustomerSchema>;

export const ChatMessageSchema = z.object({
  from: z.enum(["cliente", "vendedor"]),
  text: z.string(),
  time: z.string(),
  attachment: z.boolean().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const OrderStateSchema = z.enum(["pendiente_aprobacion", "retenida", "en_produccion", "despachada", "rechazada"]);
export type OrderState = z.infer<typeof OrderStateSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  brand: BrandSchema,
  line: z.string(),
  description: z.string(),
  items: z.array(z.object({ descripcion: z.string(), cantidad: z.number().int(), detalle: z.string(), precioUnitCents: cents })),
  modality: z.enum(["propia", "tercerizada"]),
  saleCents: cents,
  costs: z.object({ materiales: cents, manoObra: cents, terceros: cents, indirectos: cents }),
  /** REAL tras producir; TEORICO mientras la orden no se termina (COSTO_ORDEN.origen). */
  costOrigin: z.enum(["real", "teorico"]),
  internalChargeCents: cents.nullable(),
  sellerId: z.string(),
  estado: OrderStateSchema,
  condicionPago: z
    .object({
      tipo: z.enum(["contado", "anticipo", "credito"]),
      plazoDias: z.number().int(),
      anticipoPct: z.number().nullable(),
    })
    .nullable(),
  credito: z
    .object({
      decision: z.enum(["aprobado", "rechazado"]),
      by: z.string(),
      at: z.string(),
      avisoMoraMostrado: z.boolean(),
      saldoReferenciaCents: cents,
      nota: z.string().nullable(),
    })
    .nullable(),
  /** Hoja de resumen que arma n8n (WF1) o la carga manual. null = pedido previo a KeptAI. */
  hoja: z
    .object({
      version: z.number().int(),
      origen: z.enum(["whatsapp", "manual"]),
      md: z.string(),
      faltantes: z.array(z.string()),
      confianza: z.number().nullable(),
      estado: z.enum(["borrador", "confirmada"]),
      revisadoPor: z.string().nullable(),
      revisadoAt: z.string().nullable(),
      chat: z.array(ChatMessageSchema),
    })
    .nullable(),
  issuedOn: isoDate,
  fechaEntregaSolicitada: isoDate.nullable(),
  inicioProduccion: isoDate.nullable(),
  despacho: z.object({ fecha: isoDate, acta: z.string(), by: z.string() }).nullable(),
});
export type Order = z.infer<typeof OrderSchema>;

/** Fases del pago del DER: RECIBIDO → VERIFICADO_BANCO → APLICADO. */
export const EvidenceStatusSchema = z.enum(["recibido", "verificado_banco", "aplicado", "descartado"]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const ExtractedFieldsSchema = z.object({
  amountCents: cents.nullable(),
  operationRef: z.string().nullable(),
  payer: z.string().nullable(),
  paidAt: z.string().nullable(),
  channel: z.string().nullable(),
});
export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;
export type FieldKey = keyof ExtractedFields;

export const CorrectionSchema = z.object({
  field: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  by: z.string(),
  at: z.string(),
});

export const EvidenceSchema = z.object({
  id: z.string(),
  brand: BrandSchema,
  kind: z.enum(["voucher", "chat", "audio"]),
  origen: z.enum(["whatsapp", "manual"]),
  receivedAt: z.string(),
  orderId: z.string().nullable(),
  fields: ExtractedFieldsSchema,
  declaredAmountCents: cents.nullable(),
  legible: z.boolean(),
  chat: z.array(ChatMessageSchema),
  transcript: z.string().nullable(),
  status: EvidenceStatusSchema,
  mismatchAccepted: z.boolean(),
  verifiedBy: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  appliedAt: z.string().nullable(),
  discardReason: z.string().nullable(),
  corrections: z.array(CorrectionSchema),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ApplicationSchema = z.object({
  id: z.string(),
  // null = pago histórico registrado antes de KeptAI (sin comprobante digitalizado).
  evidenceId: z.string().nullable(),
  orderId: z.string(),
  amountCents: cents,
  channel: z.string(),
  at: z.string(),
  by: z.string(),
});
export type Application = z.infer<typeof ApplicationSchema>;

/** Lo que el sistema envía al cliente por WhatsApp (n8n WF3). Solo al contacto de prueba. */
export const OutgoingMessageSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  orderId: z.string().nullable(),
  tipo: z.enum(["cobranza_preventiva", "cobranza_vencimiento", "mora_temprana", "estado_cuenta", "confirmacion_pago", "resumen_orden"]),
  texto: z.string(),
  estado: z.enum(["pendiente", "enviado", "error", "cancelado"]),
  programadoPara: z.string(),
  intentos: z.number().int(),
  enviadoAt: z.string().nullable(),
  error: z.string().nullable(),
});
export type OutgoingMessage = z.infer<typeof OutgoingMessageSchema>;

/** Alerta interna de cobranza: tiene responsable y resolución (ALERTA_COBRANZA). */
export const CollectionAlertSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  regla: z.string(),
  responsable: z.string(),
  estado: z.enum(["abierta", "resuelta", "cancelada"]),
  creadaAt: z.string(),
  resolucion: z.string().nullable(),
  resueltaBy: z.string().nullable(),
  resueltaAt: z.string().nullable(),
});
export type CollectionAlert = z.infer<typeof CollectionAlertSchema>;

export const ShareLinkSchema = z.object({
  token: z.string(),
  customerId: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
});
export type ShareLink = z.infer<typeof ShareLinkSchema>;

export const AuditKindSchema = z.enum([
  "recibido",
  "aplicado",
  "verificado",
  "duplicado",
  "descartado",
  "corregido",
  "orden_ingresada",
  "credito_aprobado",
  "credito_rechazado",
  "orden_confirmada",
  "produccion",
  "despacho",
  "mensaje",
  "alerta_resuelta",
  "configuracion",
  "enlace_creado",
  "enlace_revocado",
]);
export type AuditKind = z.infer<typeof AuditKindSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  by: z.string(),
  kind: AuditKindSchema,
  brand: BrandSchema.nullable(),
  evidenceId: z.string().nullable(),
  orderId: z.string().nullable(),
  customerId: z.string().nullable(),
  amountCents: cents.nullable(),
  text: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const OutflowSchema = z.object({
  id: z.string(),
  brand: BrandSchema,
  week: z.number().int().min(0).max(3),
  label: z.string(),
  amountCents: cents,
});
export type Outflow = z.infer<typeof OutflowSchema>;

export const CashOpeningSchema = z.object({
  brand: BrandSchema,
  amountCents: cents,
  date: isoDate,
  source: z.string(),
});
export type CashOpening = z.infer<typeof CashOpeningSchema>;

/** CONFIG_ESCENARIO del DER. */
export const SettingsSchema = z.object({
  /** Probabilidad de cobro aplicada a la proyección (1 = 100%). */
  factorCobro: z.number().min(0.1).max(1),
  plazoDefecto: z.number().int().min(15).max(30),
  alertOffsets: z.array(z.number().int()),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const PLAZO_MIN = 15;
export const PLAZO_MAX = 30;

export const DemoStateSchema = z.object({
  version: z.literal(3),
  cutDate: isoDate,
  settings: SettingsSchema,
  people: z.array(PersonSchema),
  customers: z.array(CustomerSchema),
  orders: z.array(OrderSchema),
  evidences: z.array(EvidenceSchema),
  applications: z.array(ApplicationSchema),
  messages: z.array(OutgoingMessageSchema),
  alerts: z.array(CollectionAlertSchema),
  shareLinks: z.array(ShareLinkSchema),
  audit: z.array(AuditEventSchema),
  outflows: z.array(OutflowSchema),
  openings: z.array(CashOpeningSchema),
});
export type DemoState = z.infer<typeof DemoStateSchema>;
