# Matriz de acceso por endpoint (MIG-03-D2)

Versión: 3.1 | Fecha: 2026-10-19 | Autora: Isabelita

Esta matriz resume la política de autorización implementada en `pe.keptai.backend.security.AccessPolicy` y declarada en `openapi.yaml`.

Roles = `x-keptai-proposed-roles` del contrato. «Alcance SQL» resume lo que V4/V7 permiten aunque la API deje pasar; la API nunca debe ser más permisiva que la base.

| Operación | Ruta | Roles | Alcance / observación V7 |
|---|---|---|---|
| getMyContext | GET /api/v1/me | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO | Solo lectura de la identidad resuelta |
| uploadEvidenceFile, listEvidences, getEvidence, getEvidenceDownloadLink | /api/v1/evidences… | ADMIN | Voucher privado; URL temporal tras validar tenant (MIG-04). `comprobante`: escribe ADMIN (o INGESTA para el alta del voucher) |
| createTextEvidence, startExtraction, getExtractionJob | /api/v1/evidences/text, …/extractions, /extraction-jobs | VENDEDOR, ADMIN | **Fuera del MVP (D-007):** captura/extracción persistente de texto o audio. No implementar ni contar como pendiente |
| listDrafts, getDraft, correctDraft, discardDraft | /api/v1/drafts… | ADMIN | INGESTA solo crea/actualiza borradores; las ediciones humanas son del usuario |
| confirmDraft | POST /api/v1/drafts/{id}/confirmation | ADMIN | `hoja_resumen.revisado_por` = usuario autenticado (trigger V7). No verifica fondos ni aprueba crédito |
| listCustomers, getCustomer, createCustomer, updateCustomer, reassignCustomerPortfolio, mergeCustomers, getCustomerHistory, createCustomerContact | /api/v1/customers... | VENDEDOR, ADMIN, GERENTE (lectura/historial); VENDEDOR, ADMIN (alta/edición); ADMIN (cartera y fusión) | Fase 1 & Fase 4 (B-01, B-02): Directorio, edición con RUC/DNI verificado, segregación de cartera, fusión e historial |
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


## 4. Rutas de n8n (`X-Api-Key`) → servicio → alcance

| Operación | Ruta | Servicio requerido | Estado actual (MIG-04/05) | Qué permite V7 y qué no |
|---|---|---|---|---|
| n8nIngestOrder (WF1) | POST /api/v1/ordenes/ingesta | INGESTA | **Implementada**: 201 con orden y hoja `BORRADOR` desde datos estructurados, idempotente (409 si cambia el contenido); cliente = el del **contacto registrado** por `chatId` (422 si no existe); sin marca ni vendedor asignados | Crea orden, ítems, hoja de resumen **solo en BORRADOR**, canal y auditoría; no toca crédito, caja, obligaciones ni aplicaciones |
| n8nReceiveVoucher (WF2) | POST /api/v1/pagos/voucher | INGESTA | **Implementada**: 201 con pago `RECIBIDO` y comprobante privado (`imagen_base64`); Storage real comprobado con archivo temporal; flujo completo pendiente | `pago` solo fase RECIBIDO, sin `verificado_*`, nunca APLICADO; comprobante sin fondos verificados |

## 6.5 MIG-03-D3 — contrato de credenciales y conexión con n8n (alcance local)
- **Contrato de credenciales:** una clave aleatoria por **organización + instancia + alcance** (`UNIQUE(organizacion_id, instancia, alcance)`), SHA-256 en `integracion_servicio.clave_hash`; organización, instancia y alcance salen de PostgreSQL. Alta, listado, revocación y rotación con `Backend/scripts/servicio-local.sh` (vista previa por defecto, `--apply` explícito, sin sobrescrituras ni secretos impresos): [provision-servicios-local.md](provision-servicios-local.md).
- **Ingesta y voucher:** la instancia del JSON debe ser la registrada para la clave (403 si no); el JSON nunca elige organización, instancia, propietario ni ruta de Storage; ni `chatId`, `vendedorJid` ni `clienteJid`/`pushName` se resuelven contra usuarios o clientes.
- **Cuatro autenticaciones separadas** (Evolution→WF0, WF0→WF1/WF2, `X-Api-Key` n8n→Spring, `X-Api-Secret` Spring→WF3): detalle en [integracion-n8n-isabella.md](integracion-n8n-isabella.md).
- **Comprobación:** `Backend/scripts/verificar-n8n-local.sh` (PostgreSQL desechable, Spring propio, datos ficticios, 20/20) y `N8nIngestaServiceKeyIntegrationTests` (5). No acreditan n8n real, persistencia ni Storage. Confirmación por `vendedorJid` y callback SCHEDULER siguen cerrados.

## 6.6 MIG-04/05 — ingesta y voucher de n8n (alcance de estas dos rutas)
Implementadas con `TenantTransaction` (contexto de servicio INGESTA, login runtime sin BYPASSRLS), sin ampliar permisos ni RLS: orden/hoja/ítems/canal/auditoría/idempotencia son escrituras que V4/V7 ya permiten a INGESTA, y el pago `RECIBIDO` y el comprobante también (`p_ingesta_pago_limite`). Cuerpo HTTP acotado antes de leerlo (`keptai.n8n.ingesta.max-body-bytes`; voucher derivado de `keptai.n8n.voucher.max-file-bytes`, 10 485 760 bytes = 10 MiB como el bucket). La clave secreta de Storage solo la usa el backend, después de autenticar al servicio y de construir la ruta con la organización de la credencial. Las pruebas de negocio usan Storage simulado; adicionalmente Codex comprobó subida, lectura y eliminación de un PNG temporal en Supabase real. No acredita el flujo completo de negocio ni lectura por panel. No cierra MIG-04 (lectura/URLs firmadas del panel), MIG-05/06/07 completos ni VAL-03.
