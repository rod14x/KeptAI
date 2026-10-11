# Auditoría del backend KeptAI — 11/10/2026

Rama `backend-migueltarea2y3`, HEAD `bea0478`, árbol con cambios documentales previos sin commitear (AGENTS.md, estado.md, plan-conexion-frontend-auth.md, guía de configuración y snapshot de la skill). Auditoría de solo lectura: no se modificó código, dependencias, migraciones, env ni datos, y no se hizo fetch/pull/commit/push/cambio de rama.

**Lo remoto (proyecto Supabase real: Auth, Storage, roles, RLS, historial Flyway) NO está verificado.** Miguel descartó conectar su Claude al MCP de Supabase; la inspección remota corresponde a Andrés. Todo lo que sigue es local o por lectura de código.

## 1. Método y límites de la evidencia

| Fuente | Qué es | Fiabilidad |
|---|---|---|
| Comandos ejecutados por el coordinador (sección 2) | Evidencia propia reproducible | Alta |
| Lectura directa de `SecurityConfig`, `JdbcMembershipResolver`, `GlobalExceptionHandler`, V4/V7 (líneas citadas) | Verificada por el coordinador | Alta |
| Tres revisores de solo lectura (seguridad, BD/migraciones, contrato/frontend/n8n) | Lectura de código y tests; no ejecutaron nada | Media: los hallazgos se integraron tras contrastar los puntos críticos. Los números de línea que dieron para V4/V7 no coincidían con los archivos reales; aquí solo se citan líneas comprobadas |
| Tests | Comportamiento comprobado únicamente en lo que corrió (ver 2.2) | — |

**Límite principal:** en esta sesión el usuario `miguel` no pertenece al grupo `docker` (el socket `/var/run/docker.sock` es `root:docker 0660`, `permission denied`). Por eso **no se pudo reproducir ninguna prueba con Testcontainers/PostgreSQL**. No se alteró el grupo ni se usó la base activa como destino de pruebas.

## 2. Comandos ejecutados y resultados

### 2.1 Entorno y servicios
| Comando | Resultado |
|---|---|
| `java -version`; `./mvnw -v` | OpenJDK 21.0.12 (Ubuntu); Maven 3.10.0 vía wrapper; `JAVA_HOME` sin definir (el wrapper usa el `java` del PATH; `scripts/run-local.sh` lo deduce de `javac`) |
| `./mvnw dependency:list` (runtime) | Spring Boot 4.1.1, Spring Security 7.1.1, Hibernate 7.4.5, Flyway 12.4.0, PostgreSQL JDBC 42.7.13, Nimbus JOSE 10.9.1, Jackson 3.1.5, Tomcat 11.0.24 |
| Presencia de variables (solo nombre/estado, sin valores) | `Backend/.env`: PORT, KEPTAI_JWT_ISSUER_URI/JWK_SET_URI/AUDIENCES, KEPTAI_CORS_ALLOWED_ORIGINS, SUPABASE_URL, SUPABASE_STORAGE_BUCKET, SUPABASE_SECRET_KEY: todas con valor. `Frontend/.env.local`: `VITE_API_MODE=mock`, URL y clave publicable con valor. `BD/local/.env`: puerto 5433, BD `keptai`, roles `keptai_migrator`/`keptai_app` con contraseña. Los tres ignorados por Git (`git check-ignore`) y ninguno rastreado |
| `ss -ltn` | 5433 (PostgreSQL local), 5173 (Vite, node), 8080 (java) activos; no se tocaron |
| `curl` a 8080 | `/actuator/health` → 200 `{"status":"UP"}` con grupos liveness/readiness; `/api/v1/me` sin token → 401; Bearer basura → 401 con `X-Request-Id`; `/actuator/env` → 401; `/v3/api-docs` → 401; preflight desde `http://localhost:5173` → 200 con `Allow-Origin` exacto y métodos `GET,POST,PATCH,OPTIONS`; 5173 → 200 |
| `git ls-files` | **`.mcp.json` está rastreado**: contiene un solo servidor `supabase` (tipo http, URL). No se imprimió el valor; no se vieron claves en su estructura |

### 2.2 Pruebas
| Comando | Resultado |
|---|---|
| `./mvnw -B verify` | **FALLA: 156 tests ejecutados, 0 fallos, 5 errores, 0 omitidos.** Los 5 errores son entornales (Docker inaccesible): `JwtMembershipIntegrationTests`, `SchemaRlsTests`, `PostgresInfraTests`, `SpringDataSourceInfraTests`, `Mvp25MigrationTests`. Los 151 restantes pasan (JWT con JWKS de prueba, CORS/rutas, propiedades, contrato, DTOs, OpenAPI, n8n, semilla en memoria) |
| `Backend/docs/tools/validate-openapi.sh` | OK: OpenAPI 3.1 válido; **38 operaciones, 214 ejemplos, 25 casos negativos** |
| `sincronizar.py --check` (skill, antes de actualizar) | OK 60 archivos; aviso de que 4 archivos de diagramas locales difieren del snapshot (antecedentes conservados) |

**Consecuencia:** el "182 tests sin fallos" de AGENTS.md/estado.md no se reprodujo aquí; la diferencia (182 − 156 = 26) corresponde a tests que viven en las 5 clases que no pudieron arrancar (cada clase cuenta como 1 error). Se mantiene como declaración de sesiones anteriores, no como evidencia de esta auditoría.

### 2.3 Base local activa (5433), solo lectura
Consultas de catálogo con el login runtime `keptai_app` y el migrador, en sesión `default_transaction_read_only=on`, mediante un cliente JDBC temporal en el scratchpad (credenciales leídas del env ignorado, sin imprimirlas). Sin escrituras ni DDL.

- Historial Flyway: rangos 0–7, `V1`…`V7`, **todas `success=true`** (V1 esquema inicial, V2 RLS, V3 nota cliente, V4 vouchers/contexto/RLS, V5 integridad/índices, V6 mvp 25 tablas, V7 autorización crítica).
- **25 tablas de negocio** en `keptai` (+ `flyway_schema_history`): alerta_cobranza, apertura_caja, aplicacion_pago, aprobacion_credito, canal_whatsapp, cliente, comprobante, costo_orden, despacho, egreso_caja, envio_notificacion, evento_auditoria, hoja_resumen, integracion_servicio, linea_producto, marca, obligacion_cobro, orden, orden_etapa, orden_item, organizacion, pago, solicitud_idempotente, unidad_produccion, usuario. Coincide con V6/D-008.
- **RLS habilitado en las 25; `FORCE` en ninguna**; propietario de todas: `keptai_migrator` (superusuario, `BYPASSRLS`, solo local). 70 políticas.
- Roles: `keptai_app` (login runtime) `rolsuper=f`, `rolbypassrls=f`, sin createrole/createdb; `keptai_runtime` (NOLOGIN) idem. El runtime **no es propietario**, por lo que RLS le aplica.
- Funciones: `keptai_private.{actor_actual, resolver_usuario, resolver_servicio, proteger_*, invalidar_costeo}` `SECURITY DEFINER` con `search_path=pg_catalog`; `usuario_actual`/`validar_autoria` invoker; `fn_validar_*` invoker. No hay funciones de motor (aplicar, anular, despachar, caja).
- Runtime: `INSERT` en `pago` sí, `DELETE` no, `UPDATE` de `evento_auditoria` no, `UPDATE` de `aplicacion_pago` sí (necesario para anular).
- **Datos: 0 organizaciones, 0 usuarios, 0 órdenes, 0 pagos.** Sin contexto, el runtime ve 0 filas (RLS cierra). Consecuencia directa: con la base actual **ningún usuario puede obtener `/api/v1/me` 200**: faltan cuenta Auth y membresía local.

## 3. Estado por tarea del roadmap

| ID | Estado | Evidencia | Qué falta |
|---|---|---|---|
| MIG-00 | **Completo** | Informe en estado.md; JDK 21 y wrapper operativos aquí; puertos y servicios existentes verificados | — (nota: Docker no accesible desde esta sesión) |
| MIG-01 | **Completo** | `verify` arranca el contexto (`KeptaiBackendApplicationTests` 3/3), health 200 en 8080, perfiles dev/local/test/prod, `.env.example` | — |
| MIG-02 | **Parcial** (contrato completo, sin implementación) | OpenAPI válido (38/214/25); 37 rutas con `x-keptai-status: proposed`; DTOs con 36+18+56+7 tests pasando; SQL y WF0–WF3 alineados por lectura | Solo 1/37 rutas implementada; interfaces del motor de Andrés y upload de voucher WF2 sin acordar; `/me` sigue marcado `proposed` en el YAML |
| MIG-03 | **Parcial** | 03-A (propiedades, CORS, matriz) y 03-B (JWT + membresía + `/me`) implementados con fixtures: 151 tests de seguridad/contrato pasan; `JwtMembershipIntegrationTests` (BD real) no reproducido aquí | 03-C contexto JDBC por transacción (0 usos de `set_config` en `src/main`), 03-D `X-Api-Key`/permisos por rol, 03-E prueba con JWT real de Supabase |
| MIG-04 | **Pendiente** | Sin cliente Storage; env `SUPABASE_*` presentes pero sin consumidor; `vouchers_storage.sql` solo versionado | Depende de 03-C/D; política uploader servidor sin diseño |
| MIG-05 | **Bloqueado** | Rutas n8n cerradas por diseño (`SecurityConfig.java:48,66`) | MIG-03-D, MIG-04; WF2 no envía imagen/hash/path |
| MIG-06 | **Pendiente (dependiente de MIG-05)** | Sin servicios ni repositorios | Esquema permite; falta lógica y actor que cree la obligación (ver H1) |
| MIG-07 | **Bloqueado** | No existe motor financiero, semilla ni V8; solo vistas `v_saldo_obligacion`, `v_cliente_mora`, `v_margen_orden` | Motor de Andrés y contrato de interfaz |
| MIG-08 | **Pendiente** | VAL-02 y VAL-06 sin cubrir; sin recorrido real | MIG-00..07 |
| AUTH-FE-01 | **Parcial** | env backend y frontend con valores; `VITE_API_MODE=mock`; Spring en 8080 cargó CORS para 5173 | Cuenta Auth de prueba y membresía local (base vacía); no se re-verificó el JWKS remoto; credenciales las aporta Miguel |
| AUTH-FE-02 | **Pendiente** | `Frontend/src/context/AuthContext.tsx` sin cambios (revisor): `loadPerson` descarta `organization_id` (:80-85); cualquier fallo de `/me` en `signIn` cierra sesión y dice "sin rol" (:112-118); sin `onAuthStateChange` | Implementar el flujo del plan §5 |
| AUTH-FE-03 | **Pendiente** | `App.tsx:94` aterriza en Dashboard/Taller de negocio; `AppLayout` hace prefetch de módulos; `LoginPage` hace `prefetch(["dashboard"])` también en modo api | Vista de identidad conectada, módulos pendientes bloqueados |
| AUTH-FE-04 | **Pendiente** | Única prueba frontend: `contract.test.ts` (ejemplos OpenAPI vs Zod); sin tests de Auth ni e2e de login real | Tests Vitest de `AuthContext`; recorrido en navegador |

## 4. Endpoints: realidad frente al OpenAPI

Spring tiene **un** controlador de negocio: `web/MeController.java:15` (`GET /api/v1/me`). `GlobalExceptionHandler` es solo `@RestControllerAdvice`. El OpenAPI declara 38 operaciones: 37 rutas entrantes más 1 webhook saliente (`n8nOutboundSendMessage`, ruta de n8n). **1 de 37 implementada; 36 sin implementar** (evidencias 7, borradores 5, órdenes 2, pagos 5, cobranza 4, resultados/auditoría 6, crédito/despacho 3, n8n 4).

- Código operativo: `RequestIdFilter`, `SecurityConfig`, `JwtDecoders` (RS256/ES256), `KeptaiJwtConverter`, `JdbcMembershipResolver`, `AuthInfrastructureFailureFilter`, `MeController`, `GlobalExceptionHandler`/`ApiError`.
- Solo contrato (usado únicamente por tests): `AuditDtos`, `EvidenceDtos`, `ExtractionDtos`, `OrderDtos`, `PaymentDtos`, `ReceivableDtos`, `ResultsDtos`, `N8nDtos`, `ContractJson`, `MoneyBridge`. De `contract/` solo `UserContext` y `UserRole` se usan en `main`.
- Mocks/semilla en `src/main`: ninguno. `SeedCoherenceTests` opera sobre objetos Java en memoria.
- Dependencias: el starter JPA/Hibernate y Flyway están en el pom, pero no hay entidades ni repositorios; el acceso a datos es un único `PreparedStatement` JDBC.

## 5. Hallazgos priorizados

No hay hallazgo **crítico** en lo implementado: la única ruta con lógica no lee organización ni rol del cliente, y el diseño falla cerrado. Los riesgos graves están en lo que aún no existe o en decisiones de datos que bloquean el flujo.

### Alto

**H1. RLS de escritura financiera solo para ADMIN bloquea los flujos del negocio.** `BD/migrations/V4__vouchers_contexto_y_rls.sql:97` fija como único escritor de `aplicacion_pago, pago, comprobante, obligacion_cobro, apertura_caja, egreso_caja` a `ADMIN`; V5–V7 no reabren esas políticas (comprobado con `grep CREATE POLICY` en V5–V7). Observado: el servicio INGESTA (WF2) no puede insertar `pago`/`comprobante`; el VENDEDOR no puede crear la `obligacion_cobro` al confirmar la orden (`definicion-base-datos.md` lo asigna a ese paso); el despacho (JEFE_TALLER, línea 98) necesita fijar `vence_en` en `obligacion_cobro`, que solo escribe ADMIN. Además `orden` solo la actualizan VENDEDOR/ADMIN/INGESTA (línea 100, ELSE), y V7:91-94 permite a JEFE_TALLER certificar costos, algo que RLS le impide ejecutar. Impacto: cuando se implemente MIG-05/06/07 o se usará ADMIN para todo (rompe autoría y segregación) o fallará. Solución: Andrés decide actor por paso y emite V8 (no reescribir V1–V7) con pruebas por actor. *(Hallazgo de BD-AUD; las filas de V4/V7 verificadas por el coordinador.)*

**H2. MIG-03-C no existe: ningún contexto JDBC por transacción.** `grep set_config|SET LOCAL` en `src/main` = 0. Solo lo emplea `SchemaRlsTests`. Hoy es seguro por defecto (sin contexto `actor_actual()` es NULL y RLS devuelve 0 filas, comprobado con el login runtime real en 2.3). Impacto: no hay aislamiento multiempresa demostrado desde Spring; el criterio de cierre de MIG-03 (segunda organización, pool reutilizado) no se cumple. Solución: fijar org/usuario/servicio con `set_config(..., true)` en la misma transacción que cada consulta (también lecturas), solo desde `KeptaiAuthentication`; tests de reutilización de pool y dos organizaciones. Nota de diseño (BD-AUD): el GUC es falsificable por cualquier sesión runtime; es riesgo asumido en `revision-sql-rls.md`, por lo que la disciplina de Spring es el único control.

**H3. Autenticación de servicio n8n inexistente y webhooks de n8n sin autenticar.** `SecurityConfig.java:48,66` deniega siempre `/api/v1/ordenes|pagos|mensajes/**` (fail-closed, correcto), pero no hay filtro `X-Api-Key` ni uso de `resolver_servicio` (MIG-03-D). Aparte, según el revisor, los webhooks `venta-cerrar` (WF1) y `voucher` (WF2) no exigen cabecera (`WF1_cierre_venta.json:27`, `WF2_voucher_pago.json:27`) y WF0 los invoca sin credencial: cualquiera con la URL de n8n podría disparar la lectura de un chat o voucher. Solo WF3 valida `X-Api-Secret`. Solución: implementar 03-D con credencial por instancia (hash) y exigir cabecera compartida en los webhooks internos.

**H4. WF2 no transporta el voucher.** `Parsear voucher` (`WF2_voucher_pago.json:188`) y `Enviar pago al backend` (:251) mandan solo `extraccion`; la imagen se usa para el LLM y se descarta, y `N8nPagoVoucherRequest` no tiene campo. `comprobante.archivo_storage_path/archivo_hash` son obligatorios. Reconocido como brecha en `openapi.yaml` y `alineacion-bd-n8n.md`. Sin decidir esto (multipart a Spring o subida a Storage desde n8n) no hay evidencia persistible (D-007) ni MIG-05 posible.

**H5. El reto no tiene motor ni semilla en SQL, y VAL-02/VAL-06 siguen sin cubrir.** Solo hay vistas (`v_saldo_obligacion`, `v_margen_orden` en V7:~144-150). Saldo 400 y cobrado 400 salen de aritmética sobre `v_saldo_obligacion` si se carga la semilla, pero **el margen 110 corresponde a `margen_venta_real` (venta − costo real), no a `margen_real_cobrado`**: la definición de "margen" para el reto debe fijarse antes de MIG-07. Faltan `asignacion_costo_item`, `transferencia_interna`, consolidado por marca/línea/moneda, caja a 4 semanas y despacho que fije vencimiento. Ningún test ejecuta esos números en PostgreSQL (`SeedCoherenceTests` es memoria). **No se declara cerrado ningún requisito del reto.**

**H6. Frontend AUTH-FE-02: una indisponibilidad de `/me` destruye la sesión.** `AuthContext.tsx:112-118` captura cualquier error (503, red, 409) y hace `signOut` con "no tiene un rol asignado"; la restauración (:92-106) convierte todo error en "sin sesión"; sin `onAuthStateChange`; cachés `memo` no se limpian al cambiar identidad. Es el comportamiento que el plan §5 pide corregir. Solución: usar `HttpError.status/code`, conservar `organization_id`, versionar cargas, limpiar cachés.

**H7. La suite no es verificable en un entorno sin Docker y no hay `FORCE`/rol real en los tests de BD.** (Proceso.) Cinco clases (incluidas toda la verificación SQL/RLS y la membresía contra PostgreSQL) dependen de Testcontainers; sin acceso a Docker `verify` falla. Además `SchemaRlsTests` abre como propietario y usa `SET ROLE keptai_runtime` (según BD-AUD), lo que `validaciones-pre-supabase.md` pide no sustituir por un login runtime real. Solución: documentar el requisito (usuario en grupo `docker` o `DOCKER_HOST`), y añadir un test con login runtime real.

**H8. `solicitud_idempotente` es manipulable y no hay idempotencia operativa.** Su política de escritura es `read_actors` (V4:100): cualquier actor, incluso JEFE_TALLER/GERENTE, puede reescribir `hash_contenido` o `respuesta` y anular la detección de conflicto; `hash_contenido` sin CHECK de formato; las claves `idempotency_key` de `orden/pago/envio_notificacion` son UNIQUE sin hash (repetición con otro contenido → 23505, no conflicto controlado). No existe ningún test de VAL-02. Solución: V8 con inmutabilidad de hash/respuesta, y reserva con `INSERT … ON CONFLICT` en la misma transacción que la mutación.

### Medio

- **M1. Sin autorización por rol en `/api/v1/**`.** `SecurityConfig.java:55-56,67` admite cualquier rol con una membresía; no hay `@EnableMethodSecurity`. Sin controladores hoy no hay impacto; con ellos, solo RLS separaría roles. Va con 03-D.
- **M2. `GlobalExceptionHandler.java:24-32` captura `Exception` y devolvería 500** ante `AccessDeniedException`/`AuthenticationException` lanzadas desde un controlador (latente). Solución: relanzar esas excepciones o handlers específicos, más un test.
- **M3. D-007 solo protegido en el primer nivel del JSON** (`ck_hoja_sin_historial`, V4:110 según BD-AUD) y `transcript` es obligatorio (`@NotNull`, `N8nDtos.java:57`) en la ingesta WF1 con hasta 60 000 caracteres: la afirmación "se descarta tras validar" (`alineacion-bd-n8n.md`) es declarativa, sin código ni test. Los campos de texto libre (`ocr_extraccion`, `evento_auditoria.cambios`, `solicitud_idempotente.respuesta`, `resumen_md`, motivos) no tienen CHECK. Solución: descartar sin persistir, test que lo demuestre, extender el CHECK, valorar retirar `transcript` del contrato.
- **M4. Segregación registrar ≠ verificar ≠ aplicar ausente:** `pago` sin `registrado_por`; ADMIN puede registrar, verificar y aplicar; `fase='VERIFICADO_BANCO'` sin comprobante; ninguna restricción liga `APLICADO` a aplicaciones vigentes (BD-AUD; pendiente reconocido en `revision-sql-rls.md`).
- **M5. Estado de orden sin máquina de transiciones;** INGESTA puede escribir `cliente.limite_credito` (ELSE de V4:100); `orden.total`/`obligacion_cobro.monto` sin vínculo con ítems; FKs sin coherencia cruzada (`costo_orden.etapa_id`, `envio_notificacion.obligacion_id`). Reconocidos parcialmente en `definicion-base-datos.md`.
- **M6. Falta test de JWKS inalcanzable → 503** (el filtro lo documenta, `JwtWithoutDatabaseTests` solo cubre base caída) y no hay JWT real de Supabase probado (MIG-03-E). Tampoco se comprueba rechazo de `is_anonymous`/`role` (defensa en profundidad; el acceso real depende de la fila `usuario`).
- **M7. Cada petición autenticada consulta la base** (`KeptaiJwtConverter`) sin caché; la membresía queda siempre vigente. Vigilar.
- **M8. Concurrencia solo parcial (VAL-05):** un test de dos aplicaciones sobre el mismo pago; faltan pagos distintos sobre la misma obligación, anular vs aplicar, orden estable en lotes.
- **M9. Base local vacía:** sin organizaciones ni usuarios, el recorrido real es imposible hasta que Miguel provea cuenta Auth y membresía.

### Bajo

- B1. `.mcp.json` rastreado en Git (solo URL del servidor, sin clave visible). Confirmar que no incorpora tokens y decidir si debe ignorarse; la skill nunca lo copia.
- B2. Perfil por defecto `dev` (sin DataSource); un despliegue sin `SPRING_PROFILES_ACTIVE` fallaría cerrado (503), pero con DEBUG de `pe.keptai`.
- B3. `ApiError.toJson()` concatena JSON sin escapar (hoy solo constantes y UUID propio); frágil.
- B4. Rechazo CORS en petición real devuelve texto plano de Spring, no `ApiError`.
- B5. Faltan índices de FKs compuestas; `ALTER DEFAULT PRIVILEGES` no cubre funciones nuevas (cada migración repite `REVOKE`); `apertura_caja`/`egreso_caja` sin CHECK de rango; `evento_auditoria` append-only solo por GRANT (BD-AUD).
- B6. Storage (`vouchers_storage.sql`): lectura ADMIN/GERENTE y subida ADMIN con JWT; uploader de servidor sin diseño; sin vínculo objeto↔`comprobante`; `service_role` omite RLS. No aplicado ni verificado en ningún entorno.
- B7. Tests PostgreSQL 17 (`postgres:17-alpine`); no hay evidencia de la versión del PostgreSQL remoto.
- B8. Frontend: `DemoBadge` visible en login en modo api (`LoginPage.tsx:80`).

## 6. VAL-01..06 (D-009) — situación real

| VAL | Veredicto | Motivo |
|---|---|---|
| 01 Integridad financiera | Parcial | CHECKs, FKs compuestas, triggers de aplicación y padres congelados en SQL; faltan monto/total, estado de obligación, orden cancelada con pagos |
| 02 Idempotencia | **No cubierto** | Solo estructura (H8); cero tests |
| 03 Multiempresa/permisos | Parcial | RLS por organización+actor probada (en sesiones previas, con Docker); falta JWT→contexto→RLS extremo a extremo (H2) |
| 04 Trazabilidad/reversión | Parcial | Anulación, autoría fijada, sin DELETE; sin atomicidad probada ni reversión bancaria |
| 05 Concurrencia | Parcial | Una carrera probada |
| 06 Aceptación del reto | **No cubierto** | H5 |

Las clasificaciones de 01, 03, 04 y 05 provienen de lectura de SQL y tests; los tests no pudieron reejecutarse aquí.

## 7. Diferencias entre documentación y código

1. **Conteo de tablas:** el SQL y la base local tienen 25; `BD/README.md:3,43`, `actores-flujos-y-der-mvp.md:89` y `trazabilidad-tablas-mvp.md:9,35` todavía hablan de 27 como si fuera vigente (V5 es histórica). *(BD-AUD; coincide con la comprobación de 25 hecha aquí.)*
2. **Tests:** AGENTS.md/estado.md dicen 182 sin fallos; aquí 156 ejecutados, 151 pasan y 5 clases no arrancan por Docker. Número de ejemplos OpenAPI: 212 (AGENTS.md MIG-03-A) frente a 214 (plan y validador actual).
3. **`contrato-api.md:3`** dice que endpoints/JWT no están implementados, mientras `:11` y `openapi.yaml:61` dicen que `/me` sí lo está; el YAML mantiene `x-keptai-status: proposed` en `/me`.
4. **`Middleware/n8n/README.md`** contradice OpenAPI/DTOs (marca `UNICRACK`, campos `precio_unit/talla/logo`, estado `PENDIENTE_APROBACION`/`APLICADO`).
5. **`alineacion-bd-n8n.md`:** "transcript y crudo se descartan tras validación": sin código que lo haga.
6. **`revision-sql-rls.md:247`** cita Flyway V1–V5 para `SchemaRlsTests`; el test ejecuta V1–V7. **`definicion-base-datos.md`** asigna certificar costos solo a ADMIN; V7:91-94 también permite JEFE_TALLER.
7. **"Login runtime local":** las guías lo usan para SQL, pero `SchemaRlsTests` usa `SET ROLE`.
8. **"MCP Supabase solo lectura / OAuth pendiente"** (resumen AGENTS.md anterior y estado.md) quedó reemplazado por la dirección del 11/10/2026 (Miguel descarta el MCP personal).
9. **Resumen AGENTS.md** de MIG-03-B "Reiniciar Spring para cargar CORS": verificado que el Spring activo ya responde CORS para 5173.

## 8. Integraciones: configuración frente a implementación

| Tramo | Estado |
|---|---|
| Frontend → Supabase Auth | Código de login existe; **modo mock activo**; sin cuenta de prueba verificada |
| Frontend → Spring (`/me`) | Cliente y esquema Zod existen; sin vista conectada ni manejo de estados (AUTH-FE-02/03) |
| Spring → validación JWT | Implementada y probada con JWKS de prueba; **no contra Supabase real** |
| Spring → PostgreSQL | Resolución de membresía por función de arranque; sin contexto transaccional; base vacía |
| Storage | Solo variables y SQL de políticas; sin cliente ni bucket verificado |
| n8n | Workflows alineados con el contrato por lectura; sin rutas Spring ni autenticación de servicio; webhooks internos sin cabecera |
| Motor de Andrés | No existe en SQL ni en Java más allá de vistas y triggers |

## 9. Próxima tarea recomendada

**MIG-03-C — contexto JDBC por transacción**, antes de AUTH-FE-02..04 completas o MIG-04.
- **Dependencias:** V7 aplicada (cumplida); acceso a Docker/Testcontainers para validar; **decisión de Andrés sobre H1** (qué actor ejecuta cada paso financiero) antes de MIG-05/06; cuenta Auth + membresía local de Miguel para AUTH-FE-01 real.
- **Trabajo en paralelo sin conflicto:** AUTH-FE-02/03/04 (solo `Frontend/`) pueden avanzar con stub de `/me`.
- **Criterio de cierre:** org/usuario/servicio fijados solo desde `KeptaiAuthentication`, en la misma transacción que cada consulta; tests con login runtime real que prueben (1) sin contexto 0 filas, (2) segunda organización aislada, (3) conexión de pool reutilizada sin fuga, (4) rollback sin fuga; `./mvnw verify` sin errores en un entorno con Docker. Después MIG-03-D (X-Api-Key, roles por ruta, corrección de H3/M1/M2).
- **Para Andrés (no se contactó):** decisión H1, hardening de idempotencia (H8), definición de margen del reto (H5) y transporte del voucher WF2 (H4).

## 10. Qué no se hizo
- No se inspeccionó Supabase remoto ni se solicitó OAuth.
- No se reprodujo ningún test con base de datos (Docker inaccesible); no se ejecutaron `npm test`, build ni navegador.
- No se probó el JWKS remoto ni se emitieron tokens reales.
- No se corrigió ningún hallazgo.

## 11. Contraste posterior de Codex — 11/10/2026
Esta seccion corrige conclusiones del informe inicial sin borrar sus resultados de sesion.
- H1: V4 linea del CREATE POLICY p_insercion agrega INGESTA expresamente para pago/comprobante con array_append(write_actors,'INGESTA'). Ademas p_ingesta_pago_limite restringe fase RECIBIDO, sin verificador y sin APLICADO. Por tanto es incorrecto afirmar que WF2 no puede INSERT esas dos tablas por ser solo ADMIN. Las cuestiones de obligacion/despacho/certificacion siguen separadas; no crear V8 ni abrir roles sin decidir operaciones y actores.
- H7: JwtMembershipIntegrationTests crea y usa un login keptai_app NOSUPERUSER NOBYPASSRLS no propietario, con GRANT keptai_runtime. SchemaRlsTests usa SET ROLE; el faltante real es probar contexto JDBC transaccional y fugas del pool desde Spring, no ausencia total de login runtime real en la suite. FORCE no es requisito para que RLS se aplique a runtime no propietario.
- MIG-02: el criterio es contrato/DTO/ejemplos validados, no implementar las37 rutas. 36 rutas pendientes no demuestra por si solo que MIG-02 este incompleta; las brechas de WF2/interfaz del motor se registran por separado. No reconstruir el contrato entero.
- La suite fallida original sigue siendo evidencia de la sesion Claude, sin invalidar automaticamente ejecuciones anteriores. Revision independiente ejecutada con JDK21 Linux, ./mvnw -o verify mediante sg docker: 182 tests, 0 fallos/errores/omitidos, BUILD SUCCESS. Log local /tmp/keptai-auditoria-review-20261011.log. Pruebas PostgreSQL en contenedores desechables, sin cambios en base activa.
- El siguiente bloque es MIG-03-C con usuario de panel y transaccion/conexion Spring; servicios requieren identidad autenticada MIG-03-D, aun ausente. Bootstrap resolver_usuario precede al contexto y es la excepcion deliberada.
Plan ejecutable: cerebro/conocimientos/desarrollo/miguel/plan-mig-03-c.md.

## 12. Actualizacion tras MIG-03-C y MIG-03-D1 — 11/10/2026
El estado inicial del informe es historico: ahora hay contexto transaccional de usuario y servicio. MIG-03-C verificada por Codex con192 tests; D1 original206 tests. Verificacion final Codex:207 tests,0 fallos/errores/omitidos,BUILD SUCCESS con JDK21 Linux y sg docker; log /tmp/keptai-mig03d1-fixed.log. Un test de regresion adicional a los206 originales.
H2 deja de describir ausencia de contexto: ahora TenantTransaction y TenantContext aplican contexto local bajo REQUIRED, con runtime real, dos empresas y pool/rollback probados. No acredita suspensiones/REQUIRES_NEW ni Auth remoto.
H3: X-Api-Key/bootstrap y principal de servicio implementados por D1. Autorizacion por metodo/ruta y webhooks WF0-WF2 siguen pendientes D2/D3. Ningun controller de negocio n8n se habilito.
H1/H7 mantienen precisiones de§11. El resto de requisitos/limitaciones del informe no se cierra por estas entregas; Auth frontend, uploader, transportevoucher, idempotencia/motor y validaciones D-009 siguen pendientes.
Correcciones de revision D1: credenciales simultaneas como parametro servlet rechazadas; guia de rotacion compatible con UNIQUE(org,instancia,alcance), generador mantiene secreto fuera de repo desde otro cwd. No cambios en migraciones/BD activa/Supabase/servidores.
