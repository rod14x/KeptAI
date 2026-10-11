import type { z } from "zod";
import { getAll, getJson, getText, sendForm, sendJson } from "./http";
import * as S from "./schemas";

// Un método por operationId del panel en Backend/docs/openapi.yaml (MIG-02).
// Las rutas /api/v1/ordenes/*, /pagos/voucher y /mensajes/* son de n8n (X-Api-Key) y no se llaman desde el navegador.
// Estado del backend: "Propuesta, no implementado" (contrato-api.md); en modo api fallarán hasta que Spring las exponga.

type Paging = { limit?: number; cursor?: string | null };
const pg = (x?: Paging) => ({ limit: x?.limit ?? 100, cursor: x?.cursor ?? undefined });

export const endpoints = {
  /* Identidad (MIG-03) */
  getMyContext: () => getJson(S.UserContext, "/api/v1/me"),

  /* Evidencias (MIG-04/05) */
  createTextEvidence: (body: { content: string; label?: string | null }) => sendJson(S.Evidence, "POST", "/api/v1/evidences/text", body),
  uploadEvidenceFile: (file: File, label?: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "voucher_image");
    if (label) form.append("label", label);
    return sendForm(S.Evidence, "/api/v1/evidences/files", form);
  },
  listEvidences: (q?: Paging & { kind?: "text_chat" | "voucher_image" | "audio_note" }) => getJson(S.EvidencePage, "/api/v1/evidences", { ...pg(q), kind: q?.kind }),
  getEvidence: (id: string) => getJson(S.Evidence, `/api/v1/evidences/${id}`),
  getEvidenceDownloadLink: (id: string) => getJson(S.EvidenceDownloadLink, `/api/v1/evidences/${id}/download-link`),
  startExtraction: (id: string, expected: "order" | "payment_voucher") =>
    sendJson(S.ExtractionJob, "POST", `/api/v1/evidences/${id}/extractions`, { expected_draft_type: expected }),
  getExtractionJob: (id: string) => getJson(S.ExtractionJob, `/api/v1/extraction-jobs/${id}`),

  /* Borradores (MIG-06) */
  listDrafts: (q?: Paging & { status?: "pending_review" | "confirmed" | "discarded" }) => getJson(S.ExtractionDraftPage, "/api/v1/drafts", { ...pg(q), status: q?.status }),
  getDraft: (id: string) => getJson(S.ExtractionDraft, `/api/v1/drafts/${id}`),
  correctDraft: (id: string, body: S.CorrectDraftRequest) => sendJson(S.ExtractionDraft, "PATCH", `/api/v1/drafts/${id}`, body, false),
  confirmDraft: (id: string, expectedRevision: number) => sendJson(S.ConfirmDraftResponse, "POST", `/api/v1/drafts/${id}/confirmation`, { expected_revision: expectedRevision }),
  discardDraft: (id: string, reason?: string | null) => sendJson(S.ExtractionDraft, "POST", `/api/v1/drafts/${id}/discard`, { reason: reason ?? null }),

  /* Órdenes */
  listOrders: (q?: Paging & { customer_id?: string; status?: z.infer<typeof S.OrderStatus>; receivable_status?: z.infer<typeof S.ReceivableStatus> }) =>
    getJson(S.OrderPage, "/api/v1/orders", { ...pg(q), customer_id: q?.customer_id, status: q?.status, receivable_status: q?.receivable_status }),
  getOrder: (id: string) => getJson(S.Order, `/api/v1/orders/${id}`),
  getCreditDecision: (orderId: string) => getJson(S.CreditAuthorization, `/api/v1/orders/${orderId}/credit-decision`),
  submitCreditDecision: (orderId: string, body: S.CreditDecisionRequest) => sendJson(S.CreditAuthorization, "POST", `/api/v1/orders/${orderId}/credit-decision`, body),
  registerDispatch: (orderId: string, body: S.DispatchRequest) => sendJson(S.Order, "POST", `/api/v1/orders/${orderId}/dispatch`, body),

  /* Pagos (MIG-07) */
  listPayments: (q?: Paging & { phase?: z.infer<typeof S.PaymentPhase>; reconciliation_status?: z.infer<typeof S.ReconciliationStatus> }) =>
    getJson(S.PaymentPage, "/api/v1/payments", { ...pg(q), phase: q?.phase, reconciliation_status: q?.reconciliation_status }),
  getPayment: (id: string) => getJson(S.Payment, `/api/v1/payments/${id}`),
  getReconciliationCandidates: (id: string) => getJson(S.ReconciliationResult, `/api/v1/payments/${id}/reconciliation`),
  registerPaymentVerification: (id: string, body: S.RegisterVerificationRequest) => sendJson(S.Payment, "POST", `/api/v1/payments/${id}/verifications`, body),
  applyPayment: (id: string, body: S.ApplyPaymentRequest) => sendJson(S.PaymentApplicationResult, "POST", `/api/v1/payments/${id}/applications`, body),

  /* Cobranza */
  listReceivables: (q?: Paging & { customer_id?: string; due_bucket?: z.infer<typeof S.DueBucket> }) =>
    getJson(S.ReceivablePage, "/api/v1/receivables", { ...pg(q), customer_id: q?.customer_id, due_bucket: q?.due_bucket }),
  getReceivable: (id: string) => getJson(S.Receivable, `/api/v1/receivables/${id}`),
  listCollectionAlerts: (q?: Paging & { status?: "open" | "resolved" | "cancelled" }) => getJson(S.CollectionAlertPage, "/api/v1/collection-alerts", { ...pg(q), status: q?.status }),
  getCustomerStatement: (customerId: string) => getJson(S.CustomerStatement, `/api/v1/customers/${customerId}/statement`),

  /* Resultados y reportes (GERENTE) */
  getResultsSummary: (asOf?: string) => getJson(S.ResultsSummary, "/api/v1/results/summary", { as_of: asOf }),
  getMarginReport: (q: Paging & { as_of?: string; group_by: "order" | "product_line" | "brand"; production_mode?: "own" | "outsourced" }) =>
    getJson(S.MarginReport, "/api/v1/results/margins", { ...pg(q), as_of: q.as_of, group_by: q.group_by, production_mode: q.production_mode }),
  getProductionCenterResults: (q?: Paging & { as_of?: string }) => getJson(S.ProductionCenterReport, "/api/v1/results/production-center", { ...pg(q), as_of: q?.as_of }),
  getCashForecast: (asOf?: string) => getJson(S.CashForecast, "/api/v1/results/cash-forecast", { as_of: asOf }),
  exportOrdersCsv: (asOf?: string) => getText("/api/v1/reports/orders.csv", { as_of: asOf }),

  /* Auditoría */
  listAuditEvents: (q?: Paging & { entity_id?: string }) => getJson(S.AuditEventPage, "/api/v1/audit-events", { ...pg(q), entity_id: q?.entity_id }),
};

/** Variantes que recorren toda la paginación por cursor. */
export const all = {
  orders: (q?: Parameters<typeof endpoints.listOrders>[0]) => getAll((cursor) => endpoints.listOrders({ ...q, cursor })),
  payments: (q?: Parameters<typeof endpoints.listPayments>[0]) => getAll((cursor) => endpoints.listPayments({ ...q, cursor })),
  receivables: (q?: Parameters<typeof endpoints.listReceivables>[0]) => getAll((cursor) => endpoints.listReceivables({ ...q, cursor })),
  alerts: (q?: Parameters<typeof endpoints.listCollectionAlerts>[0]) => getAll((cursor) => endpoints.listCollectionAlerts({ ...q, cursor })),
  drafts: (q?: Parameters<typeof endpoints.listDrafts>[0]) => getAll((cursor) => endpoints.listDrafts({ ...q, cursor })),
  audit: (q?: Parameters<typeof endpoints.listAuditEvents>[0]) => getAll((cursor) => endpoints.listAuditEvents({ ...q, cursor }), 200),
};
