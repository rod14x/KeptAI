import { z } from "zod";

// Modelo de vista que consumen las pantallas. Lo producen dos fuentes intercambiables:
// - mock/ (semilla local de demostración, se elimina al integrar)
// - contract/ (API Spring, contrato Backend/docs/openapi.yaml)
// Alineado con BD V6 (BD/definicion-base-datos.md): sin chats, transcripciones ni texto saliente.
// Importes en céntimos enteros (contrato del panel).

const cents = z.number().int();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BrandSchema = z.enum(["corpotex", "unicrack"]);
export type Brand = z.infer<typeof BrandSchema>;
export type Scope = Brand | "consolidado";

/** Roles de `usuario.rol`: VENDEDOR, ADMIN, GERENTE, JEFE_TALLER. */
export const RoleSchema = z.enum(["gerencia", "administracion", "vendedor", "jefe_taller"]);
export type Role = z.infer<typeof RoleSchema>;

/** Origen del dato (DataOrigin del contrato). `demo_fixture` muestra la etiqueta de demostración. */
export const DataOriginSchema = z.enum(["demo_fixture", "manual_entry", "reviewed_extraction"]);
export type DataOrigin = z.infer<typeof DataOriginSchema>;

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: RoleSchema,
  title: z.string(),
  brand: BrandSchema.nullable(),
  /** Alta en el equipo: solo la semilla mock la conoce; en modo api el contrato no la expone (null). */
  since: isoDate.nullable(),
});
export type Person = z.infer<typeof PersonSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: BrandSchema,
  tipo: z.enum(["colegio", "empresa", "persona"]),
  /** RUC o DNI: no se inventa; null = por confirmar. */
  rucDni: z.string().nullable(),
  sellerId: z.string(),
  /** Metadato de canal_whatsapp, enmascarado. */
  contactoWhatsapp: z.string(),
  since: isoDate,
  creditLimitCents: cents,
});
export type Customer = z.infer<typeof CustomerSchema>;

/** Estado de un campo extraído por la IA (FieldStatus del contrato). */
export const FieldStatusSchema = z.enum(["present", "missing", "illegible"]);

/**
 * Estados de orden de la vista. Equivalencia con el contrato (OrderStatus):
 * draft/pending_approval → pendiente_aprobacion · held → retenida · released/in_production → en_produccion
 * dispatched/closed → despachada · cancelled → rechazada.
 */
export const OrderStateSchema = z.enum(["pendiente_aprobacion", "retenida", "en_produccion", "despachada", "rechazada"]);
export type OrderState = z.infer<typeof OrderStateSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  /** Código legible (orden.ref / display_code). En mock coincide con el id. */
  ref: z.string(),
  customerId: z.string(),
  brand: BrandSchema,
  line: z.string(),
  description: z.string(),
  items: z.array(z.object({ descripcion: z.string(), cantidad: z.number().int(), detalle: z.string(), precioUnitCents: cents })),
  modality: z.enum(["propia", "tercerizada"]),
  saleCents: cents,
  costs: z.object({ materiales: cents, manoObra: cents, terceros: cents, indirectos: cents }),
  /** REAL tras producir; TEORICO mientras la orden no se termina (costo_orden.origen). */
  costOrigin: z.enum(["real", "teorico"]),
  /** El costeo está cerrado y completo: solo así hay margen (v_margen_orden). */
  costComplete: z.boolean(),
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
  /** hoja_resumen: solo extracción estructurada, versión, confianza, ausentes y revisión. Sin chat. */
  hoja: z
    .object({
      version: z.number().int(),
      origen: z.enum(["whatsapp", "manual"]),
      campos: z.array(z.object({ campo: z.string(), valor: z.string().nullable(), estado: FieldStatusSchema })),
      faltantes: z.array(z.string()),
      confianza: z.number().nullable(),
      estado: z.enum(["borrador", "confirmada"]),
      revisadoPor: z.string().nullable(),
      revisadoAt: z.string().nullable(),
    })
    .nullable(),
  issuedOn: isoDate,
  fechaEntregaSolicitada: isoDate.nullable(),
  inicioProduccion: isoDate.nullable(),
  despacho: z.object({ fecha: isoDate, acta: z.string(), by: z.string() }).nullable(),
  dataOrigin: DataOriginSchema,
});
export type Order = z.infer<typeof OrderSchema>;

/** Fases del pago del contrato: received → bank_verified → applied. */
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

/** Pago + comprobante (pago, comprobante). El voucher es la única evidencia que se guarda. */
export const EvidenceSchema = z.object({
  id: z.string(),
  /** display_code del pago; puede faltar en la API. */
  ref: z.string(),
  brand: BrandSchema,
  kind: z.literal("voucher"),
  origen: z.enum(["whatsapp", "manual"]),
  receivedAt: z.string(),
  orderId: z.string().nullable(),
  fields: ExtractedFieldsSchema,
  /** Monto anunciado por el cliente (mock). En la API la diferencia llega como amount_mismatch. */
  declaredAmountCents: cents.nullable(),
  legible: z.boolean(),
  status: EvidenceStatusSchema,
  mismatchAccepted: z.boolean(),
  verifiedBy: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  appliedAt: z.string().nullable(),
  discardReason: z.string().nullable(),
  corrections: z.array(CorrectionSchema),
  /** Ids de comprobante para pedir la URL firmada (getEvidenceDownloadLink). */
  evidenceIds: z.array(z.string()),
  dataOrigin: DataOriginSchema,
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

/** envio_notificacion: destino, referencias, programación y resultado. La BD no guarda el texto. */
export const OutgoingMessageSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  orderId: z.string().nullable(),
  tipo: z.enum(["cobranza_preventiva", "cobranza_vencimiento", "mora_temprana", "estado_cuenta", "confirmacion_pago", "resumen_orden"]),
  estado: z.enum(["pendiente", "enviado", "error", "cancelado"]),
  programadoPara: z.string(),
  intentos: z.number().int(),
  enviadoAt: z.string().nullable(),
  error: z.string().nullable(),
});
export type OutgoingMessage = z.infer<typeof OutgoingMessageSchema>;

/** alerta_cobranza: regla, responsable y resolución. */
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

/** Supuestos de escenario (CashAssumptions del contrato). */
export const SettingsSchema = z.object({
  /** Probabilidad de cobro aplicada a la proyección (1 = 100%). En la API: 1 − collection_risk_factor_bps/10000. */
  factorCobro: z.number().min(0.1).max(1),
  plazoDefecto: z.number().int().min(15).max(30),
  alertOffsets: z.array(z.number().int()),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const PLAZO_MIN = 15;
export const PLAZO_MAX = 30;

/* ---------- Clasificaciones compartidas por ambas fuentes ---------- */

/**
 * Estado de conciliación de la vista. Equivalencia con el contrato (ReconciliationStatus):
 * pending → pendiente · applied → total · partial → parcial · duplicate → duplicado
 * orphan → sin_orden · amount_mismatch → no_cuadra. `excede` e `incompleto` son validaciones de la vista.
 */
export type MatchKind = "pendiente" | "total" | "parcial" | "duplicado" | "sin_orden" | "no_cuadra" | "excede" | "incompleto";
export const IN_REVIEW: MatchKind[] = ["duplicado", "sin_orden", "no_cuadra", "excede", "incompleto"];

/** DueBucket del contrato más los estados de la vista. */
export type OrderFinance = "cobrado" | "vencido" | "vence_hoy" | "por_vencer" | "al_dia" | "sin_vencimiento";

export type CreditStatus = "al_dia" | "por_vencer" | "en_mora" | "sobre_linea";

export function inScope(brand: Brand, scope: Scope) {
  return scope === "consolidado" || brand === scope;
}
