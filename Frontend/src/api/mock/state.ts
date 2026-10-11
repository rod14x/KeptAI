import { z } from "zod";
import {
  ApplicationSchema,
  AuditEventSchema,
  CashOpeningSchema,
  CollectionAlertSchema,
  CustomerSchema,
  EvidenceSchema,
  OrderSchema,
  OutflowSchema,
  OutgoingMessageSchema,
  PersonSchema,
  SettingsSchema,
} from "../model";

// MOCK: forma del estado de la demo guardado en localStorage. Eliminar al integrar.
export const DemoStateSchema = z.object({
  version: z.literal(4),
  cutDate: z.string(),
  settings: SettingsSchema,
  people: z.array(PersonSchema),
  customers: z.array(CustomerSchema),
  orders: z.array(OrderSchema),
  evidences: z.array(EvidenceSchema),
  applications: z.array(ApplicationSchema),
  messages: z.array(OutgoingMessageSchema),
  alerts: z.array(CollectionAlertSchema),
  audit: z.array(AuditEventSchema),
  outflows: z.array(OutflowSchema),
  openings: z.array(CashOpeningSchema),
});
export type DemoState = z.infer<typeof DemoStateSchema>;
