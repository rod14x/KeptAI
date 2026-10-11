import { describe, expect, it } from "vitest";
import type { z } from "zod";
import * as S from "./schemas";

// Prueba de contrato EN VIVO contra Spring (INT-FE-API-001). Se omite salvo que se definan:
//   KEPTAI_LIVE_API=http://127.0.0.1:8081
//   KEPTAI_LIVE_TOKEN_VENDEDOR / _ADMIN / _GERENTE / _JEFE_TALLER  (access_token de cada rol)
// Valida cada lectura del panel con los mismos esquemas Zod estrictos que usa el navegador, y que cada rol reciba 403
// donde el contrato no le da acceso. Solo lecturas: no altera datos.

const API = process.env.KEPTAI_LIVE_API ?? "";
const token = (role: string) => process.env[`KEPTAI_LIVE_TOKEN_${role}`] ?? "";
const live = API !== "" && token("ADMIN") !== "";

async function get(role: string, path: string) {
  return fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token(role)}`, Accept: "application/json" } });
}

async function ok<T extends z.ZodTypeAny>(role: string, path: string, schema: T): Promise<z.infer<T>> {
  const res = await get(role, path);
  const body = await res.json();
  expect(res.status, `${role} ${path}: ${JSON.stringify(body)}`).toBe(200);
  const parsed = schema.safeParse(body);
  expect(parsed.success, `${role} ${path}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`).toBe(true);
  return parsed.data;
}

describe.skipIf(!live)("API viva: lecturas del panel", () => {
  it("cada rol obtiene su identidad", async () => {
    for (const role of ["VENDEDOR", "ADMIN", "GERENTE", "JEFE_TALLER"]) {
      const me = await ok(role, "/api/v1/me", S.UserContext);
      expect(me.role).toBe(role);
    }
  });

  it("pedidos, detalle y decisión de crédito", async () => {
    const orders = await ok("ADMIN", "/api/v1/orders", S.OrderPage);
    expect(orders.items.length).toBeGreaterThan(0);
    const first = orders.items[0];
    await ok("VENDEDOR", `/api/v1/orders/${first.id}`, S.Order);
    await ok("VENDEDOR", `/api/v1/orders/${first.id}/credit-decision`, S.CreditAuthorization);
    await ok("JEFE_TALLER", "/api/v1/orders", S.OrderPage);
    await ok("ADMIN", "/api/v1/orders?status=dispatched&limit=1", S.OrderPage);
  });

  it("pagos y conciliación", async () => {
    const payments = await ok("ADMIN", "/api/v1/payments", S.PaymentPage);
    for (const p of payments.items) {
      await ok("ADMIN", `/api/v1/payments/${p.id}`, S.Payment);
      await ok("ADMIN", `/api/v1/payments/${p.id}/reconciliation`, S.ReconciliationResult);
    }
    await ok("GERENTE", "/api/v1/payments", S.PaymentPage);
  });

  it("cobranza, alertas y estado de cuenta", async () => {
    const recs = await ok("VENDEDOR", "/api/v1/receivables", S.ReceivablePage);
    for (const r of recs.items) {
      await ok("ADMIN", `/api/v1/receivables/${r.id}`, S.Receivable);
      await ok("VENDEDOR", `/api/v1/customers/${r.customer.id}/statement`, S.CustomerStatement);
    }
    await ok("ADMIN", "/api/v1/receivables?due_bucket=overdue", S.ReceivablePage);
    await ok("ADMIN", "/api/v1/collection-alerts", S.CollectionAlertPage);
  });

  it("resultados de gerencia, caja, CSV y auditoría", async () => {
    await ok("GERENTE", "/api/v1/results/summary", S.ResultsSummary);
    for (const g of ["order", "brand", "product_line"]) await ok("GERENTE", `/api/v1/results/margins?group_by=${g}`, S.MarginReport);
    await ok("GERENTE", "/api/v1/results/production-center", S.ProductionCenterReport);
    await ok("GERENTE", "/api/v1/results/cash-forecast", S.CashForecast);
    await ok("ADMIN", "/api/v1/audit-events", S.AuditEventPage);
    const csv = await get("GERENTE", "/api/v1/reports/orders.csv");
    expect(csv.status).toBe(200);
    expect((await csv.text()).split("\r\n")[0]).toContain("order_id,order_code");
  });

  it("cada rol recibe 403 fuera de su alcance", async () => {
    const denied: Array<[string, string]> = [
      ["VENDEDOR", "/api/v1/payments"],
      ["VENDEDOR", "/api/v1/results/summary"],
      ["JEFE_TALLER", "/api/v1/receivables"],
      ["JEFE_TALLER", "/api/v1/audit-events"],
      ["ADMIN", "/api/v1/results/cash-forecast"],
      ["GERENTE", "/api/v1/collection-alerts"],
    ];
    for (const [role, path] of denied) expect((await get(role, path)).status, `${role} ${path}`).toBe(403);
  });
});
