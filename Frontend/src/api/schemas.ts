import { z } from "zod";

// Importes en céntimos enteros (contrato propuesto en modelo-base-datos-mvp.md).
const cents = z.number().int();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BrandSchema = z.enum(["corpotex", "unicrack"]);
export type Brand = z.infer<typeof BrandSchema>;
export type Scope = Brand | "consolidado";

export const RoleSchema = z.enum(["gerencia", "administracion", "registro", "vendedor"]);
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
  kind: z.enum(["corporativo", "de_a_pie"]),
  sellerId: z.string(),
  phone: z.string(),
  since: isoDate,
  creditLimitCents: cents,
  termDays: z.number().int(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  brand: BrandSchema,
  line: z.string(),
  description: z.string(),
  modality: z.enum(["propia", "tercerizada"]),
  saleCents: cents,
  costs: z.object({
    materiales: cents,
    manoObra: cents,
    terceros: cents,
    indirectos: cents,
  }),
  // Precio de transferencia del taller a la marca; solo producción propia.
  internalChargeCents: cents.nullable(),
  issuedOn: isoDate,
  deliveredOn: isoDate,
  dueDate: isoDate,
  sellerId: z.string(),
  dispute: z.object({ since: isoDate, note: z.string() }).nullable(),
});
export type Order = z.infer<typeof OrderSchema>;

export const ChatMessageSchema = z.object({
  from: z.enum(["cliente", "vendedor"]),
  text: z.string(),
  time: z.string(),
  attachment: z.boolean().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const EvidenceStatusSchema = z.enum(["borrador", "comprobante_pendiente", "pago_verificado", "pago_aplicado", "descartado"]);
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
  receivedAt: z.string(),
  orderId: z.string().nullable(),
  fields: ExtractedFieldsSchema,
  // Monto anunciado en el chat, para detectar diferencias con el comprobante.
  declaredAmountCents: cents.nullable(),
  legible: z.boolean(),
  chat: z.array(ChatMessageSchema),
  transcript: z.string().nullable(),
  status: EvidenceStatusSchema,
  validatedBy: z.string().nullable(),
  validatedAt: z.string().nullable(),
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
  // null = pago histórico registrado antes de KeptAI (sin evidencia digitalizada).
  evidenceId: z.string().nullable(),
  orderId: z.string(),
  amountCents: cents,
  channel: z.string(),
  at: z.string(),
  by: z.string(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const CreditRequestSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
  amountCents: cents,
  termDays: z.number().int(),
  reason: z.string(),
  status: z.enum(["pendiente", "aprobada", "rechazada"]),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
});
export type CreditRequest = z.infer<typeof CreditRequestSchema>;

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
  "validado",
  "duplicado",
  "descartado",
  "entregado",
  "corregido",
  "borrador",
  "credito_solicitado",
  "credito_aprobado",
  "credito_rechazado",
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
  customerId: z.string().nullable().optional(),
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

export const SettingsSchema = z.object({
  factorMora: z.number().min(0).max(0.9),
  termOptions: z.array(z.number().int()),
  termStartEvent: z.enum(["entrega", "confirmacion"]),
  alertOffsets: z.array(z.number().int()),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DemoStateSchema = z.object({
  version: z.literal(2),
  cutDate: isoDate,
  settings: SettingsSchema,
  people: z.array(PersonSchema),
  customers: z.array(CustomerSchema),
  orders: z.array(OrderSchema),
  evidences: z.array(EvidenceSchema),
  applications: z.array(ApplicationSchema),
  creditRequests: z.array(CreditRequestSchema),
  shareLinks: z.array(ShareLinkSchema),
  audit: z.array(AuditEventSchema),
  outflows: z.array(OutflowSchema),
  openings: z.array(CashOpeningSchema),
});
export type DemoState = z.infer<typeof DemoStateSchema>;
