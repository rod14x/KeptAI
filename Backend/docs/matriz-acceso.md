# Matriz de acceso por endpoint (MIG-03-D2)

Versión: 3.0 | Fecha: 2026-10-19 | Autora: Isabelita

Esta matriz resume la política de autorización implementada en `pe.keptai.backend.security.AccessPolicy` y declarada en `openapi.yaml`.

Roles = `x-keptai-proposed-roles` del contrato. «Alcance SQL» resume lo que V4/V7 permiten aunque la API deje pasar; la API nunca debe ser más permisiva que la base.

| Operación | Ruta | Roles | Alcance / observación V7 |
|---|---|---|---|
| getMyContext | GET /api/v1/me | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO | Solo lectura de la identidad resuelta |
| uploadEvidenceFile, listEvidences, getEvidence, getEvidenceDownloadLink | /api/v1/evidences… | ADMIN | Voucher privado; URL temporal tras validar tenant (MIG-04). `comprobante`: escribe ADMIN (o INGESTA para el alta del voucher) |
| createTextEvidence, startExtraction, getExtractionJob | /api/v1/evidences/text, …/extractions, /extraction-jobs | VENDEDOR, ADMIN | **Fuera del MVP (D-007):** captura/extracción persistente de texto o audio. No implementar ni contar como pendiente |
| listDrafts, getDraft, correctDraft, discardDraft | /api/v1/drafts… | ADMIN | INGESTA solo crea/actualiza borradores; las ediciones humanas son del usuario |
| confirmDraft | POST /api/v1/drafts/{id}/confirmation | ADMIN | `hoja_resumen.revisado_por` = usuario autenticado (trigger V7). No verifica fondos ni aprueba crédito |
| listCustomers, getCustomer, createCustomer, createCustomerContact | /api/v1/customers... | VENDEDOR, ADMIN, GERENTE (lectura); VENDEDOR, ADMIN (alta) | Fase 1: Directorio y alta de clientes comerciales y contactos de WhatsApp |
| createOrder | POST /api/v1/orders | VENDEDOR, ADMIN | Fase 2: Alta comercial de pedidos en BORRADOR con hoja_resumen y ficha_tecnica |
| listProductionOrders, getProductionOrder | GET /api/v1/orders/production, /orders/{id}/production | JEFE_TALLER, ADMIN, GERENTE, DISENO | B-05: Órdenes de producción para taller y planta, sin precios, costos, márgenes ni pagos |
| listArts, createArt, approveArt | /api/v1/orders/{id}/arts... | DISENO, VENDEDOR, ADMIN, JEFE_TALLER, GERENTE (lectura); DISENO, ADMIN (alta); DISENO, ADMIN, VENDEDOR (aprobación) | B-06: Gestión de artes con versiones e inmutabilidad de la versión aprobada |
| importPersonnel | POST /api/v1/orders/{id}/personnel | VENDEDOR, ADMIN | B-03: Importación de nómina de personal para generación automática de curva de tallas |
| getFabricSemaphore, getOrderFabricLots, assignFabricLot | /api/v1/orders/{id}/fabric-semaphore, .../fabric-lots | ADMIN, JEFE_TALLER, VENDEDOR, GERENTE (semáforo); ADMIN, JEFE_TALLER, GERENTE (ver partidas); ADMIN, JEFE_TALLER (asignar) | Fase 3: Semáforo automático según kg en inventario y asignación de partidas con advertencia de mezcla |
| listFabricRolls, createFabricRoll, listSupplies, createSupply | /api/v1/fabric/rolls, /api/v1/supplies | ADMIN, JEFE_TALLER, GERENTE (lectura); ADMIN, JEFE_TALLER (alta rollo); ADMIN (alta insumo) | Fase 3: Inventario de rollos de tela con partidas de teñido e insumos de producción |
| listRequisitions, createRequisition, approveRequisition, receiveRequisition | /api/v1/fabric/requisitions... | ADMIN, JEFE_TALLER, GERENTE (lectura); ADMIN, JEFE_TALLER (alta/recepción); ADMIN (aprobación) | B-10: Requisición de compra de tela con merma configurable, aprobación admin y recepción con partida |
| getOrderTechSheet, updateOrderTechSheet, validateFabric | /api/v1/orders/{id}/tech-sheet... | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO (lectura); VENDEDOR, ADMIN (edición); JEFE_TALLER, ADMIN (validación tela) | Fase 3: Ficha técnica persistente y validación de telas base |
| advanceStation, getOrderStages | /api/v1/orders/{id}/station-advance, .../stages | ADMIN, JEFE_TALLER (avance); VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO (lectura) | Fase 4 & B-08: Avance de manufactura, balance de masa, control de segundas y factor de consumo en corte |
| listProducts, createProduct, registerStockMatrix, listProductMovements | /api/v1/inventory/products... | ADMIN, VENDEDOR, GERENTE, JEFE_TALLER (lectura); ADMIN (alta producto y matriz); ADMIN, GERENTE (movimientos) | Defecto 1: Catálogo de productos, variantes y matriz de stock por talla |
| listOrders, getOrder | GET /api/v1/orders… | VENDEDOR, ADMIN, GERENTE | Consulta comercial con precios, costos y márgenes. JEFE_TALLER no tiene acceso (403 Forbidden). |
| listPayments, getPayment | GET /api/v1/payments… | ADMIN, GERENTE | Pagos recibidos ≠ verificados ≠ aplicados |
| getReconciliationCandidates, registerPaymentVerification, applyPayment | /api/v1/payments/{id}/… | ADMIN | Solo ADMIN escribe `pago`/`aplicacion_pago`; `verificado_por`/`aplicado_por` = usuario autenticado. Decisión Miguel 11/10: verificar/aplicar exige dos ADMIN distintos (API) |
| listReceivables, getReceivable, getCustomerStatement | /api/v1/receivables…, /customers/{id}/statement | VENDEDOR, ADMIN, GERENTE | `obligacion_cobro`/`aplicacion_pago` visibles a VENDEDOR, ADMIN, GERENTE y SCHEDULER; no a JEFE_TALLER ni INGESTA |
| listCollectionAlerts | GET /api/v1/collection-alerts | VENDEDOR, ADMIN | Alertas las escribe SCHEDULER (o ADMIN) |
| getResultsSummary, getMarginReport, getProductionCenterResults, getCashForecast, exportOrdersCsv | /api/v1/results/…, /reports/orders.csv | GERENTE | Contrato más estricto que SQL: `v_margen_orden` solo devuelve filas a VENDEDOR, ADMIN, GERENTE; caja (`apertura_caja`, `egreso_caja`) a ADMIN, GERENTE, SCHEDULER |
| listAuditEvents | GET /api/v1/audit-events | ADMIN, GERENTE | JEFE_TALLER solo vería auditoría de orden, orden_etapa, costo_orden, despacho (no se le abre la ruta) |
| getCreditDecision | GET /api/v1/orders/{id}/credit-decision | VENDEDOR, ADMIN, GERENTE | Lectura de `aprobacion_credito` |
| **submitCreditDecision** | POST /api/v1/orders/{id}/credit-decision | **ADMIN** | D-014/V14: ADMIN de la organización; autoría real, idempotencia y obligación atómica. No n8n ni otros roles |
| registerDispatch | POST /api/v1/orders/{id}/dispatch | ADMIN, JEFE_TALLER | `despacho.registrado_por` = usuario autenticado; el vencimiento nace del despacho |
| resolveCollectionAlert | POST /api/v1/collection-alerts/{id}/resolution | ADMIN | INT-FE-API-002. Cierre manual con nota (`alerta_cobranza.resolucion`); RLS: escriben ADMIN/SCHEDULER. No toca saldos ni mensajes |
| markPaymentDuplicate | POST /api/v1/payments/{id}/duplicate | ADMIN | INT-FE-API-002 / MotorPagos: marca en revisión con alerta. Idempotente con clave |
| listNotifications | GET /api/v1/notifications | VENDEDOR, ADMIN, GERENTE | INT-FE-API-002: bitácora de mensajes y cobranza en WhatsApp (metadatos; sin texto saliente, D-007) |
| n8nIngestOrder | POST /api/v1/ordenes/ingesta | INGESTA | Ingesta n8n con X-Api-Key; escribe `hoja_resumen` y `orden` |
| n8nConfirmOrder | POST /api/v1/ordenes/confirmar | INGESTA | **Cerrada (MIG-06):** confirmación sin acuerdo; un servicio no firma como vendedor |
| n8nReceiveVoucher | POST /api/v1/pagos/voucher | INGESTA | Ingesta de voucher n8n; escribe `pago` y `comprobante` |
| n8nReportMessageStatus | POST /api/v1/mensajes/{id}/estado | SCHEDULER | **Cerrada (D3):** callback saliente de n8n; credencial técnica dedicada pendiente |
