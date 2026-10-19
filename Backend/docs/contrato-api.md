# Contrato API KeptAI — MIG-02 alineado

Fecha inicial: 10/10/2026. Actualización vigente 19/10/2026: código y pruebas locales para las rutas marcadas implementadas, ingesta persistente idempotente, vouchers privados, revisión ADMIN, adaptadores financieros y flujos de inventario/taller por rol. Versión: 2.0 | Autora: Isabelita.

## Matriz de operaciones

Los roles son los de `usuario.rol`; `service_n8n` es una credencial técnica, no un rol de usuario. Cada operación requiere una sola forma de autenticación. Las filas fuera del MVP son antecedentes, no tareas habilitadas. El webhook de WF3 es saliente y figura aparte en OpenAPI.

| operationId | Método | Ruta | Dueño | Tarea | Roles propuestos | Estado |
|---|---|---|---|---|---|---|
| `getMyContext` | GET | `/api/v1/me` | `miguel` | MIG-03 | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO | Implementado localmente; aceptación remota pendiente |
| `createTextEvidence` | POST | `/api/v1/evidences/text` | `miguel` | MIG-04 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `uploadEvidenceFile` | POST | `/api/v1/evidences/files` | `miguel` | MIG-04 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `listEvidences` | GET | `/api/v1/evidences` | `miguel` | MIG-04 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `getEvidence` | GET | `/api/v1/evidences/{evidence_id}` | `miguel` | MIG-04 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `getEvidenceDownloadLink` | GET | `/api/v1/evidences/{evidence_id}/download-link` | `miguel` | MIG-04 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `startExtraction` | POST | `/api/v1/evidences/{evidence_id}/extractions` | `miguel` | MIG-05 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `getExtractionJob` | GET | `/api/v1/extraction-jobs/{job_id}` | `miguel` | MIG-05 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `listDrafts` | GET | `/api/v1/drafts` | `miguel` | MIG-06 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `getDraft` | GET | `/api/v1/drafts/{draft_id}` | `miguel` | MIG-06 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `correctDraft` | PATCH | `/api/v1/drafts/{draft_id}` | `miguel` | MIG-06 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `confirmDraft` | POST | `/api/v1/drafts/{draft_id}/confirmation` | `miguel_adapter_andres_engine` | MIG-06 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `discardDraft` | POST | `/api/v1/drafts/{draft_id}/discard` | `miguel` | MIG-06 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `listCustomers` | GET | `/api/v1/customers` | `miguel` | Fase 1 | VENDEDOR, ADMIN, GERENTE | Implementado localmente |
| `getCustomer` | GET | `/api/v1/customers/{customer_id}` | `miguel` | Fase 1 | VENDEDOR, ADMIN, GERENTE | Implementado localmente |
| `createCustomer` | POST | `/api/v1/customers` | `miguel` | Fase 1 | VENDEDOR, ADMIN | Implementado localmente |
| `createCustomerContact` | POST | `/api/v1/customers/{customer_id}/contacts` | `miguel` | Fase 1 | VENDEDOR, ADMIN | Implementado localmente |
| `createOrder` | POST | `/api/v1/orders` | `miguel` | Fase 2 | VENDEDOR, ADMIN | Implementado localmente |
| `listProductionOrders` | GET | `/api/v1/orders/production` | `miguel` | B-05 | JEFE_TALLER, ADMIN, GERENTE, DISENO | Implementado localmente |
| `getProductionOrder` | GET | `/api/v1/orders/{order_id}/production` | `miguel` | B-05 | JEFE_TALLER, ADMIN, GERENTE, DISENO | Implementado localmente |
| `listArts` | GET | `/api/v1/orders/{order_id}/arts` | `miguel` | B-06 | DISENO, VENDEDOR, ADMIN, JEFE_TALLER, GERENTE | Implementado localmente |
| `createArt` | POST | `/api/v1/orders/{order_id}/arts` | `miguel` | B-06 | DISENO, ADMIN | Implementado localmente |
| `approveArt` | POST | `/api/v1/orders/{order_id}/arts/{art_id}/approval` | `miguel` | B-06 | DISENO, ADMIN, VENDEDOR | Implementado localmente |
| `importPersonnel` | POST | `/api/v1/orders/{order_id}/personnel` | `miguel` | B-03 | VENDEDOR, ADMIN | Implementado localmente |
| `getFabricSemaphore` | GET | `/api/v1/orders/{order_id}/fabric-semaphore` | `miguel` | Fase 3 | ADMIN, JEFE_TALLER, VENDEDOR, GERENTE | Implementado localmente |
| `getOrderFabricLots` | GET | `/api/v1/orders/{order_id}/fabric-lots` | `miguel` | Fase 3 | ADMIN, JEFE_TALLER, GERENTE | Implementado localmente |
| `assignFabricLot` | POST | `/api/v1/orders/{order_id}/fabric-lots` | `miguel` | Fase 3 | ADMIN, JEFE_TALLER | Implementado localmente |
| `listFabricRolls` | GET | `/api/v1/fabric/rolls` | `miguel` | Fase 3 | ADMIN, JEFE_TALLER, GERENTE | Implementado localmente |
| `createFabricRoll` | POST | `/api/v1/fabric/rolls` | `miguel` | Fase 3 | ADMIN, JEFE_TALLER | Implementado localmente |
| `listSupplies` | GET | `/api/v1/supplies` | `miguel` | Fase 3 | ADMIN, JEFE_TALLER, GERENTE | Implementado localmente |
| `createSupply` | POST | `/api/v1/supplies` | `miguel` | Fase 3 | ADMIN | Implementado localmente |
| `listRequisitions` | GET | `/api/v1/fabric/requisitions` | `miguel` | B-10 | ADMIN, JEFE_TALLER, GERENTE | Implementado localmente |
| `createRequisition` | POST | `/api/v1/fabric/requisitions` | `miguel` | B-10 | ADMIN, JEFE_TALLER | Implementado localmente |
| `approveRequisition` | POST | `/api/v1/fabric/requisitions/{requisition_id}/approve` | `miguel` | B-10 | ADMIN | Implementado localmente |
| `receiveRequisition` | POST | `/api/v1/fabric/requisitions/{requisition_id}/receive` | `miguel` | B-10 | ADMIN, JEFE_TALLER | Implementado localmente |
| `getOrderTechSheet` | GET | `/api/v1/orders/{order_id}/tech-sheet` | `miguel` | Fase 3 | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO | Implementado localmente |
| `updateOrderTechSheet` | PUT | `/api/v1/orders/{order_id}/tech-sheet` | `miguel` | Fase 3 | VENDEDOR, ADMIN | Implementado localmente |
| `validateFabric` | POST | `/api/v1/orders/{order_id}/tech-sheet/validate-fabric` | `miguel` | Fase 3 | ADMIN, JEFE_TALLER | Implementado localmente |
| `advanceStation` | POST | `/api/v1/orders/{order_id}/station-advance` | `miguel` | Fase 4 | ADMIN, JEFE_TALLER | Implementado localmente |
| `getOrderStages` | GET | `/api/v1/orders/{order_id}/stages` | `miguel` | Fase 4 | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO | Implementado localmente |
| `listProducts` | GET | `/api/v1/inventory/products` | `miguel` | Defecto 1 | ADMIN, VENDEDOR, GERENTE, JEFE_TALLER | Implementado localmente |
| `createProduct` | POST | `/api/v1/inventory/products` | `miguel` | Defecto 1 | ADMIN | Implementado localmente |
| `registerStockMatrix` | POST | `/api/v1/inventory/products/{productId}/stock-matrix` | `miguel` | Defecto 1 | ADMIN | Implementado localmente |
| `listProductMovements` | GET | `/api/v1/inventory/products/{productId}/movements` | `miguel` | Defecto 1 | ADMIN, GERENTE | Implementado localmente |
| `listOrders` | GET | `/api/v1/orders` | `miguel_adapter_andres_engine` | MIG-06 | VENDEDOR, ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `getOrder` | GET | `/api/v1/orders/{order_id}` | `miguel_adapter_andres_engine` | MIG-06 | VENDEDOR, ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `listPayments` | GET | `/api/v1/payments` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `getPayment` | GET | `/api/v1/payments/{payment_id}` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `getReconciliationCandidates` | GET | `/api/v1/payments/{payment_id}/reconciliation` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `registerPaymentVerification` | POST | `/api/v1/payments/{payment_id}/verifications` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `applyPayment` | POST | `/api/v1/payments/{payment_id}/applications` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `listReceivables` | GET | `/api/v1/receivables` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `getReceivable` | GET | `/api/v1/receivables/{receivable_id}` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `listCollectionAlerts` | GET | `/api/v1/collection-alerts` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN | Implementado localmente; aceptación remota pendiente |
| `getCustomerStatement` | GET | `/api/v1/customers/{customer_id}/statement` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `getResultsSummary` | GET | `/api/v1/results/summary` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Implementado localmente; aceptación remota pendiente |
| `getMarginReport` | GET | `/api/v1/results/margins` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Implementado localmente; aceptación remota pendiente |
| `getProductionCenterResults` | GET | `/api/v1/results/production-center` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Implementado localmente; aceptación remota pendiente |
| `getCashForecast` | GET | `/api/v1/results/cash-forecast` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Implementado localmente; aceptación remota pendiente |
| `exportOrdersCsv` | GET | `/api/v1/reports/orders.csv` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Implementado localmente; aceptación remota pendiente |
| `listAuditEvents` | GET | `/api/v1/audit-events` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `getCreditDecision` | GET | `/api/v1/orders/{order_id}/credit-decision` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Implementado localmente; aceptación remota pendiente |
| `submitCreditDecision` | POST | `/api/v1/orders/{order_id}/credit-decision` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Implementado localmente; aceptación remota pendiente |
| `registerDispatch` | POST | `/api/v1/orders/{order_id}/dispatch` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, JEFE_TALLER | Implementado localmente; aceptación remota pendiente |
| `resolveCollectionAlert` | POST | `/api/v1/collection-alerts/{alert_id}/resolution` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Propuesta; implementado en INT-FE-API-002 |
| `markPaymentDuplicate` | POST | `/api/v1/payments/{payment_id}/duplicate` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Propuesta; implementado en INT-FE-API-002 con MotorPagos |
| `listNotifications` | GET | `/api/v1/notifications` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Propuesta; implementado en INT-FE-API-002 (solo metadatos, D-007) |
| `n8nIngestOrder` | POST | `/api/v1/ordenes/ingesta` | `miguel` | MIG-05 | service_n8n | Implementado localmente; aceptación remota pendiente |
| `n8nConfirmOrder` | POST | `/api/v1/ordenes/confirmar` | `miguel_adapter_andres_engine` | MIG-06 | service_n8n | Propuesta, no implementado |
| `n8nReceiveVoucher` | POST | `/api/v1/pagos/voucher` | `miguel_adapter_andres_engine` | MIG-04-05 | service_n8n | Implementado localmente; aceptación remota pendiente |
| `n8nReportMessageStatus` | POST | `/api/v1/mensajes/{id}/estado` | `miguel_adapter_andres_engine` | MIG-07 | service_n8n | Propuesta, no implementado |
