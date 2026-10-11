# Matriz de acceso — MIG-03-A

Fecha: 10/10/2026. Rama backend-migueltarea2y3. Estado: matriz y configuración (MIG-03-A) más **validación de JWT y `GET /api/v1/me` (MIG-03-B, probados con JWKS de prueba y PostgreSQL real; Auth real pendiente)**. Sin JWT configurado todo responde 401 salvo `/actuator/health/**`. **Contexto JDBC transaccional de usuario (MIG-03-C, §6.2) implementado y probado con PostgreSQL desechable.** **`X-Api-Key` y contexto de servicio (MIG-03-D1, §6.3) implementados y probados.** **Autorización por método/ruta exacta (MIG-03-D2, §6.4) implementada: permiso de rol/alcance ≠ funcionalidad; /me existe y /ordenes/ingesta tiene recepción validada sin persistencia.** Siguen sin implementar los demás endpoints. Fuentes: `BD/migrations/V4` y `V7` (D-010), `BD/definicion-base-datos.md`, `BD/revision-sql-rls.md`, `contrato-api.md`, `openapi.yaml`, `alineacion-bd-n8n.md`. Las filas marcadas *propuesta* no son aprobaciones del equipo.

## 1. Tres credenciales distintas (una por operación)

| Mecanismo | Quién | Sentido | Cómo se valida | Estado |
|---|---|---|---|---|
| `Authorization: Bearer <JWT>` (`bearerAuth`) | Usuario del panel (Supabase Auth) | Entrante | Firma, issuer, audiencia y expiración con las propiedades `keptai.security.jwt.*`; `sub` → `usuario.auth_user_id` activo (`resolver_usuario`) → organización y rol de la fila, nunca del cuerpo | Decodificador y resolución de membresía implementados en MIG-03-B (RS256/ES256, issuer, audiencia, exp, nbf, `sub` UUID); Auth real sin integrar |
| `X-Api-Key` (`serviceApiKey`) | n8n WF0–WF3 hacia Spring | Entrante | Hash de la clave → `resolver_servicio(hash)` (activo) → organización, instancia y alcance INGESTA o SCHEDULER | D1 (§6.3): SHA-256 → `resolver_servicio` → principal de servicio; D2 autoriza dos rutas INGESTA; las demás siguen cerradas (§6.4), sin controladores de negocio |
| `X-Api-Secret` (`n8nWebhookSecret`) | Spring hacia webhook WF3 | **Saliente** | Spring lo envía; WF3 lo compara. Propiedades `keptai.security.webhook.*` (url + secreto por entorno) | Propiedades listas; cliente en MIG-07 |

Reglas: una operación admite una sola forma; un JWT no sirve en rutas de n8n ni al revés; el navegador nunca recibe ni envía `X-Api-Key`/`X-Api-Secret` (CORS los rechaza); el secreto del webhook no se imprime ni se guarda en BD; la clave n8n solo existe en BD como hash.

## 2. Actores de V7

| Actor | Tipo | Identidad en el contexto transaccional |
|---|---|---|
| VENDEDOR, ADMIN, GERENTE, JEFE_TALLER | Rol de usuario (`usuario.rol`) | `app.organizacion_id` + `app.usuario_id` |
| INGESTA, SCHEDULER | Servicio (`integracion_servicio.alcance`), **no** son roles de usuario | `app.organizacion_id` + `app.servicio_id` |

El contexto exige exactamente un usuario **o** un servicio activo. El código lo refleja en `security/AccessRole` (con prueba). El contrato usa `service_n8n` como etiqueta técnica; en SQL equivale a INGESTA o SCHEDULER según la ruta (sección 4).

## 3. Rutas del panel (JWT) → rol → alcance según V7

Roles = `x-keptai-proposed-roles` del contrato. «Alcance SQL» resume lo que V4/V7 permiten aunque la API deje pasar; la API nunca debe ser más permisiva que la base.

| Operación | Ruta | Roles | Alcance / observación V7 |
|---|---|---|---|
| getMyContext | GET /api/v1/me | los 4 | Solo lectura de la identidad resuelta |
| uploadEvidenceFile, listEvidences, getEvidence, getEvidenceDownloadLink | /api/v1/evidences… | ADMIN | Voucher privado; URL temporal tras validar tenant (MIG-04). `comprobante`: escribe ADMIN (o INGESTA para el alta del voucher) |
| createTextEvidence, startExtraction, getExtractionJob | /api/v1/evidences/text, …/extractions, /extraction-jobs | VENDEDOR, ADMIN | **Fuera del MVP (D-007):** captura/extracción persistente de texto o audio. No implementar ni contar como pendiente |
| listDrafts, getDraft, correctDraft, discardDraft | /api/v1/drafts… | ADMIN | INGESTA solo crea/actualiza borradores; las ediciones humanas son del usuario |
| confirmDraft | POST /api/v1/drafts/{id}/confirmation | ADMIN | `hoja_resumen.revisado_por` = usuario autenticado (trigger V7). No verifica fondos ni aprueba crédito |
| listOrders, getOrder | GET /api/v1/orders… | VENDEDOR, ADMIN, GERENTE, JEFE_TALLER | JEFE_TALLER solo ve LIBERADA, EN_PRODUCCION, DESPACHADA, CERRADA (política `orden`); el resto ve todas |
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
| markPaymentDuplicate | POST /api/v1/payments/{id}/duplicate | ADMIN | INT-FE-API-002. `MotorPagos.marcarDuplicado`: exige un pago anterior con la misma referencia, monto y fecha; el duplicado nunca se aplica |
| listNotifications | GET /api/v1/notifications | VENDEDOR, ADMIN, GERENTE | INT-FE-API-002. Metadatos de `envio_notificacion` (tipo, estado, programación, intentos); sin texto (D-007). RLS V7: lectura VENDEDOR, ADMIN, GERENTE |

Cierre de costos (`costos_*_completos`): solo ADMIN o JEFE_TALLER lo certifican (trigger V7); aún no hay ruta propia en el contrato.

## 4. Rutas de n8n (`X-Api-Key`) → servicio → alcance

| Operación | Ruta | Servicio requerido | Estado actual (MIG-04/05) | Qué permite V7 y qué no |
|---|---|---|---|---|
| n8nIngestOrder (WF1) | POST /api/v1/ordenes/ingesta | INGESTA | **Implementada**: 201 con orden y hoja `BORRADOR` desde datos estructurados, idempotente (409 si cambia el contenido); cliente = el del **contacto registrado** por `chatId` (422 si no existe); sin marca ni vendedor asignados | Crea orden, ítems, hoja de resumen **solo en BORRADOR**, canal y auditoría; no toca crédito, caja, obligaciones ni aplicaciones |
| n8nReceiveVoucher (WF2) | POST /api/v1/pagos/voucher | INGESTA | **Implementada**: 201 con pago `RECIBIDO` y comprobante privado (`imagen_base64`); Storage real comprobado con archivo temporal; flujo completo pendiente | `pago` solo fase RECIBIDO, sin `verificado_*`, nunca APLICADO; comprobante sin fondos verificados |
| n8nConfirmOrder (WF0 `/ok`) | POST /api/v1/ordenes/confirmar | **conflicto, ver 5.3** | **Cerrada** por decisión pendiente (403) | La confirmación fija `revisado_por` y V7 prohíbe que un servicio firme como persona |
| n8nReportMessageStatus (callback WF3) | POST /api/v1/mensajes/{id}/estado | SCHEDULER (propuesta) | **Cerrada** (403) | `envio_notificacion` solo la escriben ADMIN y SCHEDULER; INGESTA no |
| enviarMensajeWF3 (saliente) | POST {n8nUrl}/webhook/enviar-mensaje | — | No es endpoint de Spring; cliente HTTP no implementado | Lleva `X-Api-Secret`; el texto se genera al vuelo y no se guarda |

INGESTA lee en V7: hoja_resumen, cliente, canal_whatsapp, envio_notificacion, orden, auditoría, pago/comprobante (lectura de V4). No lee caja, aplicaciones ni obligaciones. SCHEDULER lee obligaciones, aplicaciones, caja y crédito para alertas, y nunca verifica ni aplica pagos. La auditoría de servicio usa `actor='N8N'` (INGESTA) o `'SCHEDULER'`, sin `usuario_id`.

## 5. Decisiones pendientes (todas son **propuestas**, ninguna aprobada)

| # | Decisión | Propuesta | Dueño | Bloquea |
|---|---|---|---|---|
| 5.1 | Usuario con varias organizaciones: `resolver_usuario` devuelve N filas y el contrato no define la elección (hoy `/me` responde 409 sin elegir) | Una membresía → automática; varias → 409 con la lista permitida o cabecera `X-Organization-Id` validada solo contra esas filas. El frontend actual no envía esa cabecera | Miguel | MIG-03-B (caso multi-membresía; el caso de una sola puede avanzar) |
| 5.2 | Hash y provisión de la clave de n8n (`clave_hash` char(64) hex, única) | SHA-256 hex del valor de `X-Api-Key`; la clave aleatoria se genera fuera de Git y solo el migrador/provisionador inserta el hash; comparación sobre la fila ya hallada por hash | Miguel (SQL de provisión: Andrés) | MIG-03-D |
| 5.3 | `n8nConfirmOrder`: el contrato dice que Spring resuelve al vendedor por `vendedorJid`, pero V7 hace fallar `revisado_por` ≠ usuario del contexto cuando el actor es servicio | Tras autenticar el servicio y resolver al vendedor, ejecutar la transacción con contexto de **ese usuario** (actor VENDEDOR), no como INGESTA; requiere confirmar que el contexto "usuario activo" es válido sin JWT | Miguel + Andrés | MIG-06 (no MIG-03-A/B) |
| 5.4 | Una sola `apiKey` en la configuración de WF0–WF3, pero SQL separa INGESTA y SCHEDULER (`UNIQUE(org, instancia, alcance)`) | Dos claves por instancia: INGESTA para WF0–WF2 y SCHEDULER para el callback de WF3; hoy el workflow usaría la de INGESTA y V7 rechazaría la escritura | Miguel + Isabella (n8n) | MIG-03-D y MIG-07 |
| 5.5 | Alcance del vendedor (por marca o cartera), segregación registrar ≠ verificar pago, corrección de crédito por ADMIN | Sin decidir en D-010 | Miguel/Andrés | MIG-03-D (matriz fina), MIG-07 |
| 5.6 | Issuer, JWKS y audiencia reales del proyecto Supabase | Valores solo por entorno; sin ellos se usa un JWKS local de pruebas | Miguel (config privada) | MIG-03-E |
| 5.7 | Origen CORS de producción | Lista exacta por entorno; local `http://localhost:5173` y `http://127.0.0.1:5173` | Miguel | Despliegue |

## 6. Configuración externa (código en `config/KeptaiSecurityProperties`)

| Propiedad | Variable | Regla de validación |
|---|---|---|
| `keptai.security.jwt.issuer-uri`, `jwk-set-uri`, `audiences` | `KEPTAI_JWT_ISSUER_URI`, `KEPTAI_JWT_JWK_SET_URI`, `KEPTAI_JWT_AUDIENCES` | Los tres juntos o ninguno; https (http solo localhost); sin credenciales en la URL; audiencias sin comodines; `clock-skew` 0–2 min |
| `keptai.security.cors.allowed-origins` | `KEPTAI_CORS_ALLOWED_ORIGINS` | Orígenes exactos `http(s)://host[:puerto]`, sin `*` ni rutas; `http` solo localhost. Vacío = sin CORS. Perfil `local` admite el frontend en 5173 |
| `keptai.security.cors.allowed-headers` / `-methods` | — | Por defecto Authorization, Content-Type, Idempotency-Key, Accept y GET/POST/PATCH/OPTIONS; nunca `*`, `X-Api-Key` ni `X-Api-Secret`; sin cookies (`allowCredentials=false`) |
| `keptai.security.webhook.url`, `secret` | `KEPTAI_N8N_WEBHOOK_URL`, `KEPTAI_N8N_WEBHOOK_SECRET` | Juntos o ninguno; secreto ≥ 32 caracteres, no aparece en `toString`; https (http solo localhost) |

`.env.example` documenta las variables con valores `example.invalid`. Perfiles `dev`, `test` y `prod` no abren ninguna ruta por estas propiedades. El frontend en modo `api` usa `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` y envía `Authorization: Bearer` e `Idempotency-Key`, coherente con esta matriz.

## 6.1 MIG-03-B — comportamiento implementado
- Resource Server con las propiedades `keptai.security.jwt.*`: firma por JWKS (solo RS256 y ES256; HS256 y `none` rechazados), issuer exacto, audiencia, `exp` obligatorio, `nbf` y `clock-skew`; `sub` debe ser UUID. El token solo aporta el `sub`: organización y rol de claims, cuerpo, query o cabeceras se ignoran.
- El `sub` validado se resuelve con `keptai_private.resolver_usuario(uuid)` por la conexión JDBC runtime (login no propietario, sin SELECT global ni grants nuevos). Solo devuelve filas activas de ese `sub`.
- Una membresía → `ROLE_<rol>` y `/me` responde 200 `{user_id, organization_id, role}`. Sin membresía activa (inexistente, `usuario.activo=false`) → 403 `FORBIDDEN`. **Varias → 409 `ORGANIZATION_SELECTION_REQUIRED`** (propuesta): no se elige ninguna, no se listan y el caso **no está completo** hasta decidir 5.1.
- Base o JWKS no disponibles → 503 `SERVICE_UNAVAILABLE` (sin identidad). JWT ausente, mal formado, vencido o inválido → 401 `UNAUTHORIZED` con `request_id`.
- Rutas de n8n (`/api/v1/ordenes/**`, `/api/v1/pagos/**`, `/api/v1/mensajes/**`): un JWT de usuario recibe 403; sin credencial 401; `X-Api-Key` aún no autentica nada. Cualquier otra ruta fuera de `/api/v1/**` y del health se deniega.
- `/api/v1/**` del panel exige una única membresía resuelta; el control por rol y recurso llega en MIG-03-D.
- Límite del modelo: V1–V7 no tienen estado «inactivo» para `organizacion` (solo `usuario.activo`); una organización inactiva no es representable y no se inventó.

## 6.2 MIG-03-C — contexto JDBC transaccional (usuarios del panel)
Paquete `pe.keptai.backend.tenancy`. **Frontera única:** `TenantTransaction.execute/executeReadOnly(Supplier)`, que usa el `PlatformTransactionManager` de la aplicación (JpaTransactionManager con JPA; JDBC y EntityManager comparten conexión) con propagación REQUIRED: se une a una transacción existente o abre una, fija el contexto como primera acción y solo después ejecuta el trabajo. `TenantContext.apply()` ejecuta `set_config('app.organizacion_id', …, true)`, `set_config('app.usuario_id', …, true)` y `set_config('app.servicio_id', '', true)` (equivalente a SET LOCAL: expira en commit y rollback) sobre la conexión vinculada a la transacción; sin transacción real, o con conexión no vinculada, falla.
- La identidad sale solo de `KeptaiAuthentication` SINGLE (`Membership`): `usuario_id` es la fila de `keptai.usuario`, **no** el `sub` de Auth; roles de servicio y NONE/MULTIPLE/anónimo fallan cerrado (`TenantContextException`) antes de cualquier consulta. El rol no se fija: PostgreSQL lo lee de la fila del usuario (`actor_actual`).
- Una segunda identidad en la misma transacción se rechaza (queda rollback-only). Reaplicar la misma es idempotente. `requireApplied()` es la guardia para futuros repositorios.
- `resolver_usuario(sub)` sigue siendo el bootstrap previo al contexto (JdbcMembershipResolver, sin cambios).
- Uso futuro: los servicios de negocio llaman a `tenant.execute(() -> repositorio…)`; no usar conexiones directas del pool, REQUIRES_NEW ni SET de sesión.
- Alcance: solo usuarios del panel. Contexto de servicio (`app.servicio_id`, INGESTA/SCHEDULER) queda para MIG-03-D.

## 6.3 MIG-03-D1 — autenticación de servicios por X-Api-Key
Elección técnica (no regla empresarial aprobada): clave aleatoria ≥256 bits, SHA-256 hex de la clave exacta (UTF-8) como `clave_hash`; guía en [provision-servicios-local.md](provision-servicios-local.md).
- `ApiKeyAuthenticationFilter` (tras el filtro de infraestructura, antes del Bearer) actúa solo en `SERVICE_PATHS`. Resuelve con `JdbcServiceResolver` → `keptai_private.resolver_servicio(hash)` (sin SELECT directo) y crea `ServiceAuthentication`, un principal **distinto** de `KeptaiAuthentication` (sin clave, hash ni identificadores en `toString`).
- Rechazo uniforme `401 UNAUTHORIZED` (sin distinguir inexistente, revocada, mal formada o ambigua) para: clave ausente en ruta de servicio, formato fuera de 32–128 ASCII visibles, cabecera repetida, `Authorization` o `access_token` simultáneos, clave en ruta del panel (incluida `/me`) y fila ambigua. Base caída → 503. Nunca hay respaldo JWT/clave; un JWT sigue dando 403 en rutas de servicio.
- Organización, instancia y alcance salen de la fila; los valores enviados por el cliente se ignoran. `serviceRouteAuthorization` (bean) mantiene **todas** las rutas de servicio denegadas (403 a un servicio válido) hasta D2.
- `TenantContext` aplica org + servicio con usuario vacío (o org + usuario con servicio vacío): exactamente un actor, inmutable en la transacción; usuario↔servicio y entre servicios se rechazan. El alcance lo decide `actor_actual()`.

## 6.4 MIG-03-D2 — autorización por método y ruta
Fuente única: `security/AccessPolicy` (una regla por operación entrante del contrato, 37; el webhook saliente `enviarMensajeWF3` no es un endpoint Spring). `SecurityConfig` registra una regla `método + ruta exacta` por cada operación abierta y deniega todo lo demás: métodos no declarados (incluidos HEAD/OPTIONS no preflight), variantes de ruta (barra final, mayúsculas, segmentos extra), `/api/v2`, `/error`, `/v3/api-docs`, actuator salvo health. Un test compara la tabla con `openapi.yaml` (método, ruta, roles) y con esta matriz.
- **Panel:** `KeptaiAuthentication` con membresía SINGLE y rol (leído de PostgreSQL) incluido en la regla; varias membresías → 409 en cualquier ruta del panel; sin membresía → 403. **Servicios:** `ServiceAuthentication` con alcance en la regla. Un tipo de credencial nunca entra por la ruta del otro (tampoco en la capa de autorización).
- **Abiertas (29):** las del §3 con los roles del contrato (incluidas las de VENDEDOR sobre borradores, órdenes, cuentas por cobrar, alertas, crédito y despacho de ADMIN/JEFE_TALLER), `/me` (los 4 roles) y, para INGESTA, `n8nIngestOrder` y `n8nReceiveVoucher`. **Abrir la ruta solo concede el permiso: sin controlador responde 404** (probado) y ninguna funcionalidad queda implementada por ello.
- **Antecedente D2: cerradas (8) en esa entrega:** `createTextEvidence`, `startExtraction`, `getExtractionJob` (fuera del MVP, D-007); `getReconciliationCandidates`, `registerPaymentVerification`, `applyPayment` (segregación registrar/verificar/aplicar sin decidir, 5.5, y motor de Andrés); `n8nConfirmOrder` (confirmación por `vendedorJid`, 5.3/MIG-06); `n8nReportMessageStatus` (alcance SCHEDULER del callback solo propuesto, 5.4/D3).
- **Pendiente explícito (5.5):** el alcance del vendedor por marca o cartera **no está definido ni aplicado**, ni en esta capa ni en RLS (V7 le da lectura de toda la organización). Las rutas de VENDEDOR están abiertas solo a nivel de rol; ningún controlador real debe publicarse sin ese filtro o una decisión explícita. Tampoco se resuelve la corrección de crédito por ADMIN.
- **Errores:** `GlobalExceptionHandler` convierte `AccessDeniedException` (incl. `AuthorizationDeniedException`) en 403 `FORBIDDEN`, `AuthenticationServiceException` en 503 `SERVICE_UNAVAILABLE`, otras `AuthenticationException` en 401 `UNAUTHORIZED` (`WWW-Authenticate: Bearer`), con `request_id` y sin mensaje de la excepción, SQL ni credenciales; el resto sigue siendo 500 genérico. El log del handler registra solo la clase de excepción, sin mensajes, causas ni stack trace potencialmente sensibles. El 409 de selección de organización lo emite la capa de autorización.
- Puntos de sustitución para probes de `src/test`: `PanelFallbackAuthorization` y `ServiceFallbackAuthorization` (producción: siempre denegado, solo para rutas no listadas).

## 6.5 MIG-03-D3 — contrato de credenciales y conexión con n8n (alcance local)
- **Contrato de credenciales:** una clave aleatoria por **organización + instancia + alcance** (`UNIQUE(organizacion_id, instancia, alcance)`), SHA-256 en `integracion_servicio.clave_hash`; organización, instancia y alcance salen de PostgreSQL. Alta, listado, revocación y rotación con `Backend/scripts/servicio-local.sh` (vista previa por defecto, `--apply` explícito, sin sobrescrituras ni secretos impresos): [provision-servicios-local.md](provision-servicios-local.md).
- **Ingesta y voucher:** la instancia del JSON debe ser la registrada para la clave (403 si no); el JSON nunca elige organización, instancia, propietario ni ruta de Storage; ni `chatId`, `vendedorJid` ni `clienteJid`/`pushName` se resuelven contra usuarios o clientes.
- **Cuatro autenticaciones separadas** (Evolution→WF0, WF0→WF1/WF2, `X-Api-Key` n8n→Spring, `X-Api-Secret` Spring→WF3): detalle en [integracion-n8n-isabella.md](integracion-n8n-isabella.md).
- **Comprobación:** `Backend/scripts/verificar-n8n-local.sh` (PostgreSQL desechable, Spring propio, datos ficticios, 20/20) y `N8nIngestaServiceKeyIntegrationTests` (5). No acreditan n8n real, persistencia ni Storage. Confirmación por `vendedorJid` y callback SCHEDULER siguen cerrados.

## 6.6 MIG-04/05 — ingesta y voucher de n8n (alcance de estas dos rutas)
Implementadas con `TenantTransaction` (contexto de servicio INGESTA, login runtime sin BYPASSRLS), sin ampliar permisos ni RLS: orden/hoja/ítems/canal/auditoría/idempotencia son escrituras que V4/V7 ya permiten a INGESTA, y el pago `RECIBIDO` y el comprobante también (`p_ingesta_pago_limite`). Cuerpo HTTP acotado antes de leerlo (`keptai.n8n.ingesta.max-body-bytes`; voucher derivado de `keptai.n8n.voucher.max-file-bytes`, 10 485 760 bytes = 10 MiB como el bucket). La clave secreta de Storage solo la usa el backend, después de autenticar al servicio y de construir la ruta con la organización de la credencial. Las pruebas de negocio usan Storage simulado; adicionalmente Codex comprobó subida, lectura y eliminación de un PNG temporal en Supabase real. No acredita el flujo completo de negocio ni lectura por panel. No cierra MIG-04 (lectura/URLs firmadas del panel), MIG-05/06/07 completos ni VAL-03.

## 6.7 V10 — contacto registrado (D-011)
INGESTA puede LEER contactos ACTIVOS de su organización (política `p_lectura_ingesta`) para resolver el JID; no los crea, modifica ni borra (probado con el login runtime). Los contactos los administra ADMIN; la provisión demo usa el migrador. El contacto no autoriza nada: no es vendedor ni usuario. SCHEDULER y JEFE_TALLER no leen la agenda. Las FK compuestas impiden contactos/canales/órdenes/pagos cruzados entre organizaciones, clientes y canales sin ampliar permisos de INGESTA.

## 7. Qué no cubre esta entrega
Webhooks y workflows n8n (D3), controllers distintos de `/me`, Storage, motor financiero, cambios en V1–V7 ni Supabase remoto. Las pruebas usan un JWKS local de prueba y PostgreSQL de Testcontainers: **no acreditan** integración con Supabase Auth real.

## Recepción WF1 solicitada por Miguel — 11/10/2026
POST /api/v1/ordenes/ingesta implementa solo validación estricta del objeto JSON e instancia vinculada al servicio INGESTA, HTTP200 VALIDADO_SIN_PERSISTIR. No recibe credenciales en body, no persiste texto ni genera orden, no resuelve vendedorJid ni verifica negocio. 201/idempotencia pendiente MIG-05. Otros endpoints conservan permisos D2; voucher sin controller, confirmación/callback cerrados.

## 6.5 Integración del motor y contexto (padre-nuestro, 11/10/2026)
TenantContext.apply y TransaccionFinanciera.enTransaccion comparten TenantContext.applyIdentity. Ambos requieren transacción real/conexión vinculada y conservan una única TenantIdentity (organización + exactamente un actor) hasta commit/rollback. El motor conserva sus firmas y reglas financieras; ContextoFinanciero debe construirlo un caller interno a partir del principal autenticado, nunca un DTO del cliente.
Las pruebas de MotorPagos con runtime PostgreSQL validan TenantTransaction→motor con la misma identidad/PID, rechazos de cambio de empresa/usuario/servicio, motor→TenantTransaction con identidad incompatible y limpieza después del rollback.
Esto integra la frontera Java; no implementa controllers financieros ni modifica las decisiones de autorización por ruta, marca/cartera o segregación de funciones.


## 6.5 Avance MIG-04/06/07 (11/10/2026)

Dirección explícita de Miguel: ADMIN puede revisar, corregir, confirmar y descartar pedidos desde el panel sin vendedor WhatsApp; verificación/aplicación de pagos requieren dos usuarios ADMIN distintos. `getEvidenceDownloadLink`, `listDrafts`, `getDraft`, `correctDraft`, `confirmDraft` y `discardDraft` quedan solo ADMIN; no se concede cartera general a VENDEDOR. Las tres operaciones financieras del §6.4 ya no están cerradas por segregación: API ADMIN, aplicación con identidad distinta del verificador bajo lock de pago. `createTextEvidence`, `startExtraction`, `getExtractionJob`, `n8nConfirmOrder` y `n8nReportMessageStatus` siguen cerradas. Idempotency-Key obligatoria en confirmación y escrituras financieras. Los permisos son de ruta y de objeto; el contexto PostgreSQL es previo al acceso. Cartera de VENDEDOR sigue pendiente: servicios del panel deniegan hasta definirla.


### 6.6 Lectura privada y revisión ADMIN (11/10/2026)

Aprobación expresa de Miguel: ADMIN revisa/corrige/confirma/descarta desde el panel mientras no exista vendedor registrado. Evidencias (carga/listado/metadatos/enlace) y borradores quedan reservados a ADMIN. PanelContext rechaza VENDEDOR antes de consultar negocio hasta definir su cartera; D-013 por sí sola no autorizaba crédito; D-014 en §6.7 añade esa autorización explícita de ADMIN durante el MVP. `/me` continúa disponible para los cuatro roles.

Carga manual: multipart con file, kind=voucher_image, payment_id y label opcional; Idempotency-Key obligatorio. Solo adjunta a un pago RECIBIDO del tenant y no crea ni verifica fondos. MIME/bytes/hash se calculan del binario; la clave privilegiada de Storage se usa después de autorizar el pago. Metadata histórica desconocida queda null. Link temporal de 60 segundos, no-store, autorizado antes de firmar, auditado sin token/URL.

La segregación de dos ADMIN se aplica al adaptador HTTP. Los motores/RLS existentes de Andrés conservan sus reglas internas: no acreditar que esta regla nueva se impone a cualquier llamada interna o SQL directo. Verificación disponible solo simulated_demo. Dispatch también usa Idempotency-Key y una sola transacción que reúne motor y respuesta.

## 6.7 D-014 — crédito ADMIN durante el MVP

Miguel autoriza ADMIN desde el panel. V14 cambia únicamente escritura de aprobacion_credito, preserva V7 histórico y el trigger de autoría. Idempotency-Key obligatoria (autor, pedido y contenido); replay sin duplicación, 409 por contenido/autor distinto. No cambia vendedor_id. La cartera de VENDEDOR sigue sin habilitarse.

## 6.8 Extensiones del contrato para el panel (INT-FE-API-002, 11/10/2026)
Campos opcionales que se omiten si no hay dato (`@JsonInclude(NON_NULL)`; los ejemplos del contrato siguen válidos): nombres en `/me`, vendedor, ítems y autor del despacho en `Order`, ficha del cliente en `CustomerRef` (tipo, RUC/DNI, línea de crédito), verificador y aplicaciones en `Payment`, pagos en `Receivable`, responsable y nota en `CollectionAlert`, autor de la decisión en `CreditAuthorization`, margen percibido (`v_margen_orden.margen_real_cobrado`) en `MarginRow` y nombre del actor en `AuditEvent`. Todo sale de la base bajo RLS: JEFE_TALLER no recibe cliente ni obligaciones. Operaciones nuevas `resolveCollectionAlert`, `markPaymentDuplicate` (ADMIN) y `listNotifications` (VENDEDOR, ADMIN, GERENTE); 40 operaciones entrantes en `AccessPolicy`.
