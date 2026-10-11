# Contrato API KeptAI — MIG-02 alineado

Fecha inicial: 10/10/2026. Contrato y DTOs versionados. Actualización11/10: JWT, contexto usuario/servicio y permisos implementados y probados; /me disponible. /ordenes/ingesta ahora solo recibe/valida y responde200 sin persistir/procesar; creación201 e idempotencia de MIG-05 y motor siguen pendientes. Ejemplos ficticios. Se completó la alineación con archivos de Andrés, sin inventar aprobación personal ni despliegue remoto. Ver [alineación](alineacion-bd-n8n.md). Claude inició; Codex continuó al agotarse la sesión de Claude (reset anunciado 22:50 Lima).

## Matriz de operaciones

Los cuatro roles son los de `usuario.rol`; `service_n8n` es una credencial técnica, no un rol de usuario. Cada operación requiere una sola forma de autenticación. Las filas fuera del MVP son antecedentes, no tareas habilitadas. El webhook de WF3 es saliente y figura aparte en OpenAPI.

| operationId | Método | Ruta | Dueño | Tarea | Roles propuestos | Estado |
|---|---|---|---|---|---|---|
| `getMyContext` | GET | `/api/v1/me` | `miguel` | MIG-03 | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER | Propuesta; implementado en MIG-03-B con JWKS de prueba, Auth real pendiente |
| `createTextEvidence` | POST | `/api/v1/evidences/text` | `miguel` | MIG-04 | VENDEDOR, ADMIN | Propuesta, no implementado (fuera del MVP) |
| `uploadEvidenceFile` | POST | `/api/v1/evidences/files` | `miguel` | MIG-04 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `listEvidences` | GET | `/api/v1/evidences` | `miguel` | MIG-04 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `getEvidence` | GET | `/api/v1/evidences/{evidence_id}` | `miguel` | MIG-04 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `getEvidenceDownloadLink` | GET | `/api/v1/evidences/{evidence_id}/download-link` | `miguel` | MIG-04 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `startExtraction` | POST | `/api/v1/evidences/{evidence_id}/extractions` | `miguel` | MIG-05 | VENDEDOR, ADMIN | Propuesta, no implementado (fuera del MVP) |
| `getExtractionJob` | GET | `/api/v1/extraction-jobs/{job_id}` | `miguel` | MIG-05 | VENDEDOR, ADMIN | Propuesta, no implementado (fuera del MVP) |
| `listDrafts` | GET | `/api/v1/drafts` | `miguel` | MIG-06 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `getDraft` | GET | `/api/v1/drafts/{draft_id}` | `miguel` | MIG-06 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `correctDraft` | PATCH | `/api/v1/drafts/{draft_id}` | `miguel` | MIG-06 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `confirmDraft` | POST | `/api/v1/drafts/{draft_id}/confirmation` | `miguel_adapter_andres_engine` | MIG-06 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `discardDraft` | POST | `/api/v1/drafts/{draft_id}/discard` | `miguel` | MIG-06 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `listOrders` | GET | `/api/v1/orders` | `miguel_adapter_andres_engine` | MIG-06 | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER | Propuesta, no implementado |
| `getOrder` | GET | `/api/v1/orders/{order_id}` | `miguel_adapter_andres_engine` | MIG-06 | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER | Propuesta, no implementado |
| `listPayments` | GET | `/api/v1/payments` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, GERENTE | Propuesta, no implementado |
| `getPayment` | GET | `/api/v1/payments/{payment_id}` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, GERENTE | Propuesta, no implementado |
| `getReconciliationCandidates` | GET | `/api/v1/payments/{payment_id}/reconciliation` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Propuesta, no implementado |
| `registerPaymentVerification` | POST | `/api/v1/payments/{payment_id}/verifications` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Propuesta, no implementado |
| `applyPayment` | POST | `/api/v1/payments/{payment_id}/applications` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN | Propuesta, no implementado |
| `listReceivables` | GET | `/api/v1/receivables` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Propuesta, no implementado |
| `getReceivable` | GET | `/api/v1/receivables/{receivable_id}` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Propuesta, no implementado |
| `listCollectionAlerts` | GET | `/api/v1/collection-alerts` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN | Propuesta, no implementado |
| `getCustomerStatement` | GET | `/api/v1/customers/{customer_id}/statement` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Propuesta, no implementado |
| `getResultsSummary` | GET | `/api/v1/results/summary` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Propuesta, no implementado |
| `getMarginReport` | GET | `/api/v1/results/margins` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Propuesta, no implementado |
| `getProductionCenterResults` | GET | `/api/v1/results/production-center` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Propuesta, no implementado |
| `getCashForecast` | GET | `/api/v1/results/cash-forecast` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Propuesta, no implementado |
| `exportOrdersCsv` | GET | `/api/v1/reports/orders.csv` | `miguel_adapter_andres_engine` | MIG-07 | GERENTE | Propuesta, no implementado |
| `listAuditEvents` | GET | `/api/v1/audit-events` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, GERENTE | Propuesta, no implementado |
| `getCreditDecision` | GET | `/api/v1/orders/{order_id}/credit-decision` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR, ADMIN, GERENTE | Propuesta, no implementado |
| `submitCreditDecision` | POST | `/api/v1/orders/{order_id}/credit-decision` | `miguel_adapter_andres_engine` | MIG-07 | VENDEDOR | Propuesta, no implementado |
| `registerDispatch` | POST | `/api/v1/orders/{order_id}/dispatch` | `miguel_adapter_andres_engine` | MIG-07 | ADMIN, JEFE_TALLER | Propuesta, no implementado |
| `n8nIngestOrder` | POST | `/api/v1/ordenes/ingesta` | `miguel` | MIG-05 | service_n8n | Propuesta de contrato; **implementado** (MIG-05): orden y hoja BORRADOR desde datos estructurados, 201, idempotencia y 409; sin confirmar ni asociar cliente |
| `n8nConfirmOrder` | POST | `/api/v1/ordenes/confirmar` | `miguel_adapter_andres_engine` | MIG-06 | service_n8n | Propuesta, no implementado; **cerrada por decisión pendiente** (403 a cualquier servicio) |
| `n8nReceiveVoucher` | POST | `/api/v1/pagos/voucher` | `miguel_adapter_andres_engine` | MIG-04-05 | service_n8n | Propuesta de contrato; **implementado** (MIG-04/05): pago RECIBIDO + comprobante privado con `imagen_base64`, sin verificar ni aplicar; Storage real pendiente de prueba |
| `n8nReportMessageStatus` | POST | `/api/v1/mensajes/{id}/estado` | `miguel_adapter_andres_engine` | MIG-07 | service_n8n | Propuesta, no implementado; **cerrada** (403) hasta aprobar el alcance SCHEDULER |

Matriz ruta → identidad → rol → alcance (coherente con V7) y configuración de seguridad externa: [matriz-acceso.md](matriz-acceso.md) (MIG-03-A, propuesta sin implementación de autenticación).

## Convenciones vigentes

Panel: UUID y etiquetas separadas, JSON snake_case, importes enteros en centavos PEN, dentro de ±9007199254740991. n8n: nombres españoles/camelCase que generan WF0–WF3, soles BigDecimal y conversión exacta con MoneyBridge. Más de dos decimales se rechaza; no se redondea dinero de OCR. Ausente es null, nunca cero. Fechas de negocio de Lima y timestamptz con desfase.

JWT del panel se valida en MIG-03. n8n usa X-Api-Key; Spring resuelve servicio/instancia y vendedor activos, no confía en organización enviada. WF3 recibe X-Api-Secret separado. El transcript de WF1 se admite transitoriamente por compatibilidad, **nunca se persiste** (D-007). Captura de audio/texto persistente y cliente IA en Spring quedan fuera del MVP.

Idempotencia panel: organización + operación/recurso + clave, hash del contenido por separado; n8n deriva clave porque no manda Idempotency-Key. V4 conserva únicamente hash y respuesta segura, sin cuerpo/transcript. Retención, reextracción de WF1 (generadoEn cambia) y garantías de envío pendientes de implementación: no prometer entrega exactly-once en WhatsApp.

Voucher recibido no equivale a fondos verificados ni saldo aplicado. Crédito 15–30 días aprobado por vendedor, aviso de mora sin bloqueo automático; una obligación por orden, parciales en aplicaciones. Despacho inicia vencimiento; antes due_date null.

Los DTOs y tests validan formas y ejemplos; **no sustituyen** controllers, servicios ni permisos runtime. ApiError existente permanece compatible.

## Pendientes concretos de integración

1. WF2 no transmite imagen, hash ni Storage path: incorporar upload seguro para registrar COMPROBANTE; no inventar evidencia.
2. Resolver semilla de marcas/líneas y firmas reales del motor de Andrés; conciliación PARCIAL antes/después de aplicación debe acordarse con él.
3. Credenciales fuera de Git: login JDBC miembro runtime, JWT issuer/JWKS/audiencia, claves n8n y bucket privado.
4. Inspeccionar historial y permisos remotos Supabase antes de ejecutar V4/V5 y Storage. Si hay mensajes previos V4 aborta y exige procedimiento de revisión/purga autorizado.
5. MIG-03-A entregó la matriz y las propiedades de configuración; pendientes 5.1–5.7 de [matriz-acceso.md](matriz-acceso.md). MIG-03: JWT real, contexto usuario/servicio por transacción, RLS con conexión reutilizada, CORS y pruebas integración. No bloquear el contrato por volver a aprobar nombres ya definidos en el SQL.
