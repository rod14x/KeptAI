# Estado de desarrollo de Miguel

> Preparación: 10 de octubre de 2026. Esta plantilla no acredita implementación. Actualizar al terminar cada tarea, evitando escritores simultáneos.

## Integración con el trabajo de Andrés (10/10/2026)

La rama `backend-miguel` integró `origin/feature/autorizacion` (`1b5375e`): `BD/` (esquema V1-V3, diccionario), `Middleware/n8n/` (WF0-WF3), skills de Supabase y D-005 (WhatsApp). La decisión de Miguel pasó a D-006. Revisión completa y brechas del contrato MIG-02 en [revision-integracion-andres.md](revision-integracion-andres.md). Las menciones posteriores de "BD/ vacío" en la bitácora de MIG-00..MIG-02 eran ciertas al escribirse y se conservan como historial.

## Última tarea

MIG-01 completada. MIG-02: **entrega técnica de alineación completada** (10/10/2026): contrato/DTOs compatibles con SQL y n8n, sin endpoints operativos. DB-REV-002: revisión/corrección SQL local completada con V4/V5 y Storage separado conforme D-007. Interfaces del motor, semilla y upload WF2 siguen pendientes; no se inventa aceptación personal de Andrés. MIG-03 no iniciada.

## Estado

- Aclaración vigente de Miguel: Supabase ya está conectado mediante MCP en el entorno del equipo; no hay `.env` de la app. No se verificó despliegue remoto desde esta sesión. Preparación JDBC/Auth/Storage, roles migrador/runtime y pruebas RLS en [preparacion-supabase-rls.md](preparacion-supabase-rls.md). Esta aclaración actualiza los bloqueos históricos de disponibilidad de Supabase, no acredita conexión de Spring.

- MIG-00 informe entregado; B1 (JDK 21) resuelto el 10/10/2026. B2 (Docker) resuelto con matiz: ver cierre de MIG-01.
- MIG-01 completa; MIG-02 alineación técnica entregada; acuerdos concretos en Backend/docs/contrato-api.md. MIG-03..08 pendientes. V4/V5 revisadas localmente, no desplegadas.
- Andrés: V1–V3 y workflows n8n integrados; V4/V5 correctivas de Miguel/Codex se aplican y prueban en PostgreSQL 17 efímero. Estado remoto Supabase no acreditado. Motor financiero y semilla aún no entregados. Brechas con el contrato MIG-02 en [revision-integracion-andres.md](revision-integracion-andres.md).
- Claude Code inició alineación en sesión aparte; agotó cuota (reset informado 22:50 Lima). Codex continuó y verificó. No se controlaron panes existentes ni se inició OpenCode.
- Rama `backend-miguel`, merge `1b5375e` (integra `53bdad1` de `origin/feature/autorizacion`); respaldo previo en `stash@{0}` (no eliminado). Commit local anterior: 7002163/2ef47fc.

## Registro por entrega

Formato: ID / estado / branch y commit de base / archivos modificados / pruebas y salida resumida / integración real o fixture / pendientes / siguiente ID. Nunca pegar tokens, vouchers reales o claves.

### MIG-00 — preflight (10/10/2026) — parcial, sin delegación (lectura directa bastó)

- **Base:** rama main, commit 7002163, adelantado 1 sobre origin/main; no se hizo fetch/pull. Árbol con cambios sin commit de la preparación (docs, skill, Backend/README.md); no se tocó nada de eso salvo este archivo y AGENTS.md.
- **Archivos modificados por MIG-00:** estado.md, AGENTS.md (resumen). Sin código.
- **Comandos y resultado real:**
  - `java -version` en WSL: no existe; sin JAVA_HOME ni /usr/lib/jvm ni SDKMAN. `sudo` pide contraseña (no se instaló nada).
  - Windows sí tiene JDK: `C:\Program Files\Java\jdk-21` (`java.exe` 21.0.1 LTS, JAVA_HOME de Windows apunta ahí). No sirve para compilar desde WSL sin JDK Linux.
  - `mvn` en PATH de WSL es el de Windows (chocolatey 3.9.10) y falla: JAVA_HOME no definido en Linux. Maven Wrapper aún no existe (se crea en MIG-01).
  - `docker` no existe en WSL (integración WSL de Docker Desktop desactivada). `docker.exe` de Windows (27.3.1) existe, pero el daemon no responde (Docker Desktop apagado).
  - `psql` no instalado. Python 3.12.3, Node 22.23.3 (la infra documenta Node 24 para frontend; no afecta al backend). Claude Code 2.1.296, OpenCode 1.18.35.
  - Puertos: solo 3000 ocupado (node, servidor MCP excalidraw, no se tocó). 8080, 5432, 5173, 54322, 8000 libres.
  - Variables GEMINI/SUPABASE en el entorno: ninguna. Sin acceso comprobado a proyecto Supabase ni a clave Gemini.
  - Disco: 944 GB libres.
- **Carpetas:** Backend/ solo .gitkeep y README (sin scaffold: MIG-01 puede inicializar). BD/ y Frontend/ solo .gitkeep: Andrés aún no entregó diseño/migraciones aquí; modelo vigente es la propuesta PROP-DB-001 (decisiones/modelo-base-datos-mvp.md).
- **Diagramas:** revisados nombres y fuentes de v1.3 (cerebro/diagramas/keptai-roadmap-fuentes-spring-v1-3.md) como dato; no se abrieron los .excalidraw. Conservados sin cambios. Los diagramas sin sufijo son antecedente (Edge Functions).
- **Base técnica documentada (propuesta, PROP-INFRA-001):** Java 21, Spring Boot 4.1.1, Maven Wrapper, Render Docker, Supabase, Gemini `gemini-3.5-flash-lite` configurable. No verificada aquí; confirmar versión de Boot en MIG-01 antes de fijarla.
- **Bloqueos:**
  - B1: JDK 21 en WSL. Resolver con Miguel, p. ej. `sudo apt install openjdk-21-jdk` o SDKMAN (`! sudo apt install -y openjdk-21-jdk`), luego `java -version` y `JAVA_HOME`. Alternativa: usar el JDK de Windows con `mvnw.cmd`, pero rompe la regla de trabajar en Linux; no recomendado.
  - B2: Docker no disponible: iniciar Docker Desktop y activar integración WSL (o Docker Engine en WSL). Necesario para PostgreSQL/Testcontainers (MIG-03 en adelante); MIG-01 puede arrancar sin él si el perfil de test no exige BD.
  - B3 (no bloquea MIG-01): Supabase (URL, JWKS, audiencia, bucket) y clave Gemini no disponibles; esquema/motor de Andrés no entregado.
- **Fronteras acordadas (según documentos, sin confirmar con Andrés):** Miguel = controllers, DTOs, contrato, auth, captura/Gemini, revisión, despliegue; Andrés = modelo, Flyway (un solo dueño), entidades/servicios transaccionales. Pendiente de acordar con Andrés: nombres de DTO/campos, paquete base Java, ubicación de migraciones. Sin mensajes a terceros enviados.
- **Plan mínimo MIG-01/02:** MIG-01: tras B1, `Backend/` con Spring Initializr (Web, Validation, Actuator, Security, Data JPA, PostgreSQL, Flyway según acuerdo con Andrés), mvnw, perfiles, health, `.env.example`, test de arranque, `./mvnw verify`; un solo escritor. MIG-02: `Backend/docs/openapi.yaml` + DTOs + ejemplos tras acordar campos con Andrés.
- **Siguiente ID:** MIG-01 (cuando B1 resuelto).

### MIG-01 — arranque Spring y configuración (10/10/2026) — completada

- **Revalidación B1 (shell propia):** `java -version` y `javac -version` = OpenJDK 21.0.12.1 (/usr/bin, JDK en /usr/lib/jvm/java-21-openjdk-amd64). `JAVA_HOME` está en ~/.bashrc (comprobado con `bash -ic`) pero la shell no interactiva de Claude no lo hereda: se exporta explícitamente en cada comando. El `mvn` del PATH sigue siendo el de Windows; no se usa. Red a start.spring.io y Maven Central OK. Puertos 8080/5432 libres. B1 resuelto; B2 (Docker) sin cambios.
- **Base:** rama main, commit 7002163; árbol con cambios sin commit previos de otros. Sin commit/push/reset.
- **Delegación:** 1 constructor general-purpose con archivos delimitados (Backend/src/**, Backend/.env.example). El coordinador creó el scaffold desde Spring Initializr y posee pom.xml, README, estado.md y AGENTS.md. El constructor halló que el parent `4.1.1.RELEASE` generado por Initializr no existe en Central; el coordinador lo corrigió a `4.1.1` en pom.xml.
- **Archivos (todos en Backend/):** pom.xml (starters webmvc, actuator, security, validation + sus test; sin JPA/Flyway/PostgreSQL/OAuth2 a propósito: la BD y Flyway son de Andrés y JWT es MIG-03), mvnw, mvnw.cmd, .mvn/, .gitignore, .gitattributes, README.md, .env.example, src/main/resources/application.yml + application-dev/test/prod.yml, src/main/java/pe/keptai/backend/{KeptaiBackendApplication, web/RequestIdFilter, web/ApiError, web/GlobalExceptionHandler, config/SecurityConfig}.java, src/test/java/pe/keptai/backend/KeptaiBackendApplicationTests.java.
- **Pruebas reales (coordinador, WSL):** `./mvnw verify` → Tests run: 3, Failures 0, Errors 0, BUILD SUCCESS (contexto, health 200 sin detalles con X-Request-Id, ruta protegida 401 JSON sin trace). Arranque local del jar: perfil dev por defecto, 0 contraseñas generadas en log, `GET /actuator/health` 200 `{"groups":["liveness","readiness"],"status":"UP"}`, `GET /api/v1/x` 401 `{"code":"UNAUTHORIZED","message":"No autenticado","request_id":"…"}`; proceso detenido y puerto 8080 libre.
- **Real vs fixture:** todo real; no hay integración con BD, Auth, Gemini ni motor. Sin pagos, captura ni cambios al motor de Andrés.
- **Pendientes/decisiones:** health expone `groups` por los probes (sin datos privados); los códigos de error usan el nombre del HttpStatus y MIG-03 puede refinarlos; Mockito/byte-buddy avisa de agente dinámico (aviso del JDK, no falla); `~/.m2` se creó con las descargas de Maven. (Actualización: ya añadidas, ver preparación posterior) Dependencias JPA/Flyway/PostgreSQL se añadirán cuando Andrés y Miguel acuerden paquete base y ubicación de migraciones.
- **Siguiente ID:** MIG-02 (contrato OpenAPI y DTOs). Detenido antes de iniciarlo.

### Cierre corto de MIG-01 (10/10/2026)

- **B2 Docker — revalidado:** `docker --version` = 27.3.1 en /usr/bin/docker (WSL). En esta sesión de Claude `docker info` falla con *permission denied* sobre /var/run/docker.sock: el proceso se inició antes de que Miguel entrara al grupo `docker` (el grupo existe, `miguel` es miembro, pero `id` de esta sesión no lo lista). Con `sg docker -c "docker info && docker run --rm hello-world"`, el daemon responde (servidor 27.3.1) y hello-world termina correctamente. Miguel confirmó lo mismo en una sesión WSL nueva. Estado: **resuelto para sesiones nuevas**; una sesión de Claude ya abierta necesita reiniciarse o usar `sg docker -c` para usar Docker. No se usó sudo ni se cambiaron permisos. Puerto 5432 libre. PostgreSQL/Testcontainers aún no probados.
- **Secretos:** Backend/.gitignore ahora excluye `.env`, `.env.*` y conserva `!.env.example`. `git check-ignore` confirmó: `.env`, `.env.local` y `.env.prod` ignorados; `.env.example` no ignorado (la línea que muestra con -v es la regla de negación) y aparece como publicable en `git status`.
- **Alcance real de los tests actuales:** los 3 tests verifican solo arranque del contexto, `GET /actuator/health` (200, sin detalles, con X-Request-Id) y un 401 JSON uniforme en una ruta protegida. **No acreditan** validación de endpoints, JWT, base de datos, persistencia ni lógica de negocio; esos criterios pertenecen a MIG-02 en adelante.
- **Acuerdos pendientes con Andrés para MIG-02** (lista al entregar; ningún mensaje enviado a terceros):
  1. Paquete base Java y estructura de módulos (¿`pe.keptai.backend` con subpaquetes por dominio?) y quién crea las entidades JPA: Andrés (propuesto) frente a DTOs de Miguel.
  2. Ubicación y dueño único de Flyway: `Backend/src/main/resources/db/migration`, nombre de la primera migración y cuándo se añaden las dependencias JPA/Flyway/PostgreSQL al pom (Miguel mantiene el pom, Andrés las migraciones).
  3. Nombres definitivos de tablas/columnas y estados (evidencia, borrador, pago: recibido/verificado/aplicado/duplicado, obligación, alerta, autorización) para alinear campos de los DTO con PROP-DB-001.
  4. Dinero: confirmar centavos enteros en el contrato frente a `numeric(18,2)` en BD y `BigDecimal` en Java, con conversión explícita en un solo punto; moneda ISO (PEN) y límites.
  5. Fechas: fecha de negocio local (`date`) frente a instantes `timestamptz`, zona America/Lima, formato ISO 8601 en JSON.
  6. Identificadores: UUID frente a bigint y su formato en la API; clave de idempotencia (cabecera `Idempotency-Key`, unicidad por organización/operación y respuesta a repeticiones con contenido distinto).
  7. Interfaz del motor: firmas de los servicios `@Transactional` que Miguel invocará (candidatos de conciliación, registrar verificación, aplicar pago, saldo/alertas, margen, caja, CSV): entradas, salidas, excepciones y códigos de error; Miguel no recalcula saldos.
  8. Contrato de errores compartido: códigos estables (p. ej. duplicado, huérfano, diferencia, saldo insuficiente) y mapeo a HTTP, ampliando el `{code,message,request_id}` actual.
  9. Ejemplos del contrato: confirmar que los ejemplos para Germán usan la semilla ficticia P-001/P-002/V-001..V-003 (saldo 400, cobrado 400, margen 110) y cuáles rutas son de Miguel y cuáles adapters de Andrés.
  10. Organización/membresía: cómo se resuelve `organization_id` desde el JWT (tabla `membership`) y roles mínimos, para fijar el modelo de permisos antes de MIG-03.
  11. Perfil de pruebas: PostgreSQL con Testcontainers (Docker ya disponible) frente a una BD de Supabase; semilla reiniciable y quién la ejecuta.
  12. Si Andrés aún no ha entregado ER/diccionario (BD/ está vacío): fecha/hito de entrega para no bloquear MIG-02 más allá de B0/B1.

### Preparación de dependencias backend al cerrar MIG-01 (10/10/2026) — completada, sin avanzar a MIG-02

- **Archivos (Backend/):** pom.xml, src/main/resources/application.yml + application-dev/test.yml, .env.example, README.md (tabla de dependencias y comandos), src/test/java/pe/keptai/backend/infra/{PostgresInfraTests,SpringDataSourceInfraTests}.java. Sin delegación (cambio pequeño y de un solo escritor).
- **Dependencias:** añadidas data-jpa, flyway (+ flyway-database-postgresql), postgresql runtime, security-oauth2-resource-server (trae Nimbus/oauth2-jose) y en test data-jpa-test, oauth2-resource-server-test, spring-boot-testcontainers, testcontainers-junit-jupiter y testcontainers-postgresql; versiones solo del BOM 4.1.1 (Flyway 12.4.0, Hibernate 7.4.5, JDBC 42.7.13, Testcontainers 2.0.5). Sin Lombok, Redis, Kafka, Swagger ni SDKs (Gemini/Storage usarán RestClient).
- **Configuración:** dev/test excluyen explícitamente autoconfiguración de DataSource/Hibernate/repos JPA/Flyway; prod no excluye nada, ddl-auto validate, flyway.enabled false, open-in-view false.
- **Pruebas reales:** `./mvnw verify` → 7 tests, 0 fallos, 0 skips, BUILD SUCCESS (3 previos + 2 JDBC/Flyway-módulo contra postgres:17-alpine por Testcontainers + 2 con DataSource/JdbcTemplate/EntityManager de Spring). Docker funciona en esta sesión (`docker ps` sin sudo). Jar en puerto 18081: health 200, /api/v1/x 401 JSON, sin contraseña generada; proceso detenido (el servidor del usuario en 8080 no se tocó). Prod sin DB: "Failed to configure a DataSource", no arranca. `dependency:tree -Dverbose`: sin conflictos (solo android-json en test, preexistente).
- **No acredita:** JWT, entidades, migraciones, motor de Andrés ni integración financiera; los tests de infra no usan tablas de negocio.
- **Pendiente:** configuración real de prod (datasource, emisor/JWKS/audiencia), migraciones y ubicación de Flyway (Andrés), acuerdos 1-12 del cierre de MIG-01. Snapshot de skill regenerado con `--repo . --preserve-historical-diagrams` y `--check`.
- **Siguiente ID:** MIG-02, no iniciada.

### MIG-02-PROPUESTA — contrato OpenAPI 3.1 y DTOs (10/10/2026) — propuesta revisada técnicamente; MIG-02 NO completada

- **Estado:** contrato y DTOs entregados como **propuesta**. Gate pendiente: aceptación de Andrés (BD/ solo tiene `.gitkeep`, sin ER/diccionario/motor) y confirmación humana de los acuerdos mínimos (lista de 18 en `Backend/docs/contrato-api.md`). Ninguna ruta es operativa; solo `GET /actuator/health` y el `401` JSON de MIG-01. No se creó ninguna entidad, migración, servicio ni controlador de negocio; no se adelantó MIG-03. Sin Git mutante, sin mensajes a terceros, servidor del usuario en 8080 no tocado.
- **Archivos (Backend/):** `docs/openapi.yaml` (30 operaciones, ~50 ejemplos), `docs/contrato-api.md` (matriz endpoint→dueño→estado, convenciones, supuestos, acuerdos, limitaciones), `docs/tools/{validate-openapi.sh,validate_openapi.py,requirements.txt}`, `src/main/java/pe/keptai/backend/contract/` (ContractEnums, ContractJson, CommonDtos, EvidenceDtos, ExtractionDtos, OrderDtos, PaymentDtos, ReceivableDtos, ResultsDtos, AuditDtos), `src/test/java/pe/keptai/backend/contract/` (OpenApiSpec, OpenApiExamplesTests, OpenApiConsistencyTests, DtoValidationTests, SeedCoherenceTests, ApiErrorContractTests), `.gitignore` (+`docs/tools/.venv/`), `README.md` (sección MIG-02). **pom.xml, application*.yml, tests de infraestructura y `web/ApiError` NO se modificaron** (otro proceso verificaba dependencias).
- **Decisiones propuestas (no aprobadas):** UUID + `display_code` (P-001/V-001) aparte; dinero `{amount_cents, currency}` entero con límite ±(2^53-1), `PEN`, negativos solo en margen/resultado/caja; `null`+estado explícito para ausente/incompleto; `date` America/Lima e instantes con desfase; membresía en backend (sin `organization_id` del cliente, cuerpos cerrados, 404 para otra organización); `Idempotency-Key` obligatorio en POST (replay con `Idempotency-Replayed`, 409 en conflicto/en curso); extensión compatible de `ApiError` (`details`, `retryable`); cursor `limit` 1..100; recibido/verificado/aplicado separados y `funds_verified:false` al confirmar; sin porcentaje de confianza inventado; sin 30%, ERP/CRM ni bancos.
- **Verificación real:** `docs/tools/validate-openapi.sh` → OK (OpenAPI 3.1 válido, ejemplos validados contra sus esquemas, reglas del contrato y 25 casos negativos; se comprobó con mutaciones que detecta un ejemplo erróneo). `./mvnw verify` → **108 tests, 0 fallos, 0 errores, 0 skips**, BUILD SUCCESS (7 de MIG-01/infra con PostgreSQL por Testcontainers + 101 nuevos: ida y vuelta YAML↔DTO de 52 ejemplos, enums/propiedades/matriz, 36 de validación, 4 de coherencia de semilla, 3 de error). Se comprobó con mutaciones que las pruebas fallan si el YAML, un DTO o la matriz cambian. Health 200 y 401 JSON intactos (KeptaiBackendApplicationTests).
- **Delegación:** 1 revisor read-only (consistencia financiera/seguridad) con 14 hallazgos; se aplicaron los de contrato/idempotencia (huella con usuario+ruta+cuerpo), semántica de `unapplied_amount`, duplicados (422 también por referencia ya usada), invariantes `if/then` de Payment/ResultsSummary/CashForecast en el YAML, requeridos↔@NotNull, límites de corrección, fechas y ejemplos de estados received/verified, regla CSV ampliada, tests débiles retirados y roles comparados en la matriz. Quedan como acuerdos 12–17 (roles múltiples, entidad, confianza por campo, convenciones de caja, marcado de duplicados, privacidad de evidencias). Contrato y DTO escritos por el coordinador (un escritor) para mantener YAML y Java sincronizados.
- **Real vs fixture:** contrato y DTOs reales como artefactos; todos los datos de ejemplo son ficticios (semilla PROP-DB-001). No hay integración alguna.
- **Limitaciones:** las pruebas comprueban consistencia interna del contrato y forma de los DTO, no comportamiento servidor (idempotencia, permisos, concurrencia) porque no existe; los warnings HV000272 de Hibernate Validator por `@Valid` sobre el valor genérico de `ExtractedField<T>` son inocuos. Estados, roles, `match_score` y códigos de error son propuestas.
- **Siguiente ID:** gate MIG-02 (Andrés + humano). Detenido antes de MIG-03.

### Integración con Andrés y revisión del cerebro (10/10/2026) — completada como diagnóstico; MIG-02 NO cerrada

- **Qué se hizo:** lectura de todo `cerebro/conocimientos` (26 documentos), fuentes de `cerebro/diagramas`, `BD/` y `Middleware/n8n/` como datos; 2 revisores read-only (bloques de 14 y 11 archivos) más lectura directa de lo nuevo; renombrado de las referencias de Miguel de D-005 a D-006 solo donde correspondía (`infraestructura-desarrollo-mvp.md`, `roadmap-hackathon-equipo.md`, `prompt-claude.md`, `mapa-fuentes.md`); D-005 WhatsApp intacta.
- **Resultado:** [revision-integracion-andres.md](revision-integracion-andres.md) con 18 contradicciones/desalineaciones, 10 brechas del contrato y pendientes por dueño. No se creó ninguna decisión aprobada.
- **Pruebas reales:** V1-V3 aplicadas en un contenedor PostgreSQL 17 efímero (sin red publicada, eliminado): sin errores, 27 tablas, 3 vistas, 27 políticas RLS (sintaxis/aplicación, no comportamiento). `./mvnw verify` con `JAVA_HOME` Linux: EXIT=0, 108 tests, 0 fallos, 0 errores, 0 skips (el merge solo trajo BD/documentación; código de `Backend/` sin cambios).
- **Skill `keptai-conocimiento`:** `SKILL.md`, `mapa-fuentes.md` y `precedencia-y-pendientes.md` actualizados; `sincronizar.py` ahora empaqueta `BD/` y `Middleware/` como evidencia técnica sanada con hashes de fuente y de copia, y falla ante secretos.
- **Sin tocar:** `Backend/` (código, DTOs, tests, contrato), diagramas originales, `.mcp.json`, servidor 8080, terminales ajenas. Sin commit/push/fetch/merge ni mensajes a terceros.
- **Siguiente ID:** gate MIG-02 (alinear contrato con BD y n8n; aceptación de Andrés y confirmación humana). MIG-03 no iniciada.

### MIG-02-ALINEACION + DB-REV-002 (10/10/2026) — entrega técnica completa, integración runtime pendiente

- **Base:** backend-miguel, merge 1b5375e; cambios locales preservados, stash anterior intacto. Sin commit/push/fetch/merge nuevos. Servidor del usuario 8080 y sesiones ajenas intactos.
- **Cambio de agente:** Claude agotó su sesión mientras editaba contrato/DTOs; dejó marcador temporal en OpenAPI y pruebas desalineadas. Codex retiró el marcador, completó la alineación y recompiló fuentes reales. El `-DskipTests` inicial no se contó como validación. No se adelantó MIG-03.
- **Dirección explícita de Miguel D-007:** lectura obligatoria de Actores/flujos/DER, actualizado v1.4: vouchers privados y datos estructurados, sin mensajes/transcript/audio/texto saliente. Canal y envíos son metadatos. n8n procesa transitoriamente; retención de ejecuciones todavía por configurar.
- **SQL:** V1–V3 originales conservadas, nuevas V4/V5. Retira mensaje; chat→canal_whatsapp; mensaje_saliente→envio_notificacion sin texto. Admite borradores incompletos. Contexto RLS exige org+usuario o servicio activo, rol runtime no propietario/sin BYPASSRLS, sin grants públicos ni DELETE; funciones privadas bootstrap, Data API cerrada para negocio. Storage Supabase separado con bucket privado y barreras restrictivas, sin overwrite/delete.
- **Integridad/queries:** pago duplicado no aplicable, comprobante evento/hash/path, aplicaciones inmutables con anulación motivada, cliente/moneda/fondos/límites y locks concurrentes; gate de producción; costo no cerrado→margen null, cierre invalidado ante cambio. Mora por timezone del tenant. Índices por tenant/cursor/fecha/FK. EXPLAIN ANALYZE BUFFERS con 10 000 pagos ficticios comprueba ix_pago_reciente; no benchmark remoto.
- **Contrato/DTO:** 37 operaciones backend + 1 webhook saliente (38 en validador). Cuatro roles SQL, canal X-Api-Key n8n distinto de JWT y X-Api-Secret; rutas y payloads WF0–WF3, decisiones de crédito/despacho, MoneyBridge exacto, recibido/verificado/aplicado separados; fechas nulas antes de despacho; borradores nulos sin inventar. Captura persistente de texto/audio y cliente IA Spring quedan fuera del MVP. Ejemplos históricos rotulados, todos ficticios.
- **Pruebas finales reales:** `docs/tools/validate-openapi.sh`: OpenAPI 3.1 OK, 38 operaciones, 212 usos de ejemplos y 25 negativos. `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./mvnw -o verify`: **140 tests, 0 fallos, 0 errores, 0 skips, BUILD SUCCESS** (19:52 Lima). Incluye 10 tests SchemaRlsTests con V1–V5, rol runtime, ausencia/mal contexto, A/B/commit/rollback/conexión reutilizada, FK, permisos, pagos recibido/duplicado/huérfano, límites e inmutabilidad, concurrencia, costo e índice. Storage usa auth.uid/catalogos mínimos emulados, valida políticas aun con política permisiva de control; no acredita servicio Supabase real. Health/401 de MIG-01 permanecen cubiertos.
- **Documentación/skill:** DER, D-007, BD README/diccionario/revisión, contrato/mapeo, plan/tareas de Miguel, preparación Supabase, índice, AGENTS. Skill incluye documentos completos, BD, Middleware y Backend/docs sanados. Graphify marcado como instantánea anterior a D-007, sin regenerar ni modificar diagramas históricos.
- **Pendientes concretos:** conexión .env/JDBC/JWT/Storage; verificar historial/roles/datos reales Supabase antes de aplicar (V4 aborta con mensajes previos o schema != keptai); WF2 no entrega imagen/hash/path; resolver uploader autenticado, motor/semilla/firmas de Andrés, garantías de reintentos y retención n8n. No declarar endpoints o integración financiera listos por los DTOs/tests.
- **Siguiente ID:** MIG-03 (JWT/API key, membresía/contexto por transacción y prueba RLS desde Spring). No iniciado. OpenCode puede recibir handoff explícito de este ID, no una tarea financiera ficticiamente terminada.

## DB-DEF-001 — Definicion de base (10/10/2026)

- Skill keptai-conocimiento y fuentes D-003/004/005/007, Actores/flujos/DER, V1-V5 y contrato. Entrega BD/definicion-base-datos.md: Supabase/PostgreSQL, 27 tablas, sin mensajes; solo vouchers como evidencia.
- Fijados ciclo de obligacion previa al anticipo, RLS/roles, fechas/dinero, permisos, uploader servidor, no retencion, caja sin duplicar aplicaciones. Extensiones por item y transferencia interna definidas, aun sin migraciones/motor/pruebas.
- Enlaces desde BD, indice, modelo previo, Actores/flujos, API, skill y AGENTS. Sin SQL/Java ni pruebas backend repetidas por documentacion; verificar enlaces y paquete. Sin remoto/.env/commit/push. MIG-03 pendiente.

## DB-MAP-001 — Necesidad y trazabilidad de las 27 tablas

- Miguel pide comprobar que cada tabla responda al cerebro, no a un numero impuesto. Skill/idea/ficha C-01..C-07/entrevistas/Actores/D-003..D-007 contrastados con V5.
- Entrega: decisiones/trazabilidad-tablas-mvp.md, con 27 entradas, dato, fuente, alcance y recomendacion. 16 nucleo, 6 flujo, 3 soporte, 2 opcionales. Recomendar 25 actuales no cambia el SQL ni aprueba eliminacion de las 2 restantes. Extensiones por linea/centro siguen pendientes y son requisitos del nucleo.
- Actualizadas rutas de lectura skill/indice/definicion/diccionario/README, modelo previo y roadmap frontend. Corregido flujo: separar margen de venta/cobrado y no cancelar toda cobranza tras verificar un parcial. Ficha empresarial se preserva, su recorrido propuesto se interpreta con D-007.
- Verificacion documental de nombres/categorias/enlaces e integridad del paquete. Sin SQL/Java/remoto/commit/push; no repetir tests backend por cambios documentales. MIG-03 sigue pendiente.

## D-008 / V6 — Base de 25 tablas y entorno local

- Miguel aprueba 25 tablas y solicita adaptarlas a Andres/local. V1-V5 se conservan; V6 retira contacto/nota_cliente sin CASCADE y aborta si contienen datos o hay dependencias. No cambio de Supabase remoto.
- Entrega: BD/local/{compose.yaml,db.sh,provisionar-runtime.sql,.env.example,README.md}, BD/.gitignore, V6; application-local.yml conecta a runtime leyendo .env local generado sin mostrar claves. PostgreSQL17/Flyway12.4.0 local con volumen, 127.0.0.1:5433. Base vacia, no datos reales; migrador y app separados. Auth/Storage/Studio completos no instalados.
- Verificacion real: up/migrate/validate; 25 tablas y V1-V6. Tests de SchemaRls + guardas de V6: 11 tests sin fallos. ./mvnw -o verify: 141 tests, 0 fallos/errores/skips, BUILD SUCCESS (log /tmp/keptai-v6-verify.log). Guardas probadas con contactos/notas ficticias conservadas tras fallo y rollback.
- Perfil local probado en 18080: health200 UP con DB, ruta sin autenticacion401 JSON; servidor de prueba detenido, puerto8080 del usuario no intervenido. .env local ignorado por Git. El contenedor PostgreSQL local queda activo para Miguel; down conserva datos.
- Documentos/skill/D-008 y DER V6 actualizados; V5 historico conservado. Guia incluye coordinacion MCP de Andres y stack Supabase completo como siguiente entorno, no como instalado. MIG-03 y C-05/C-06 siguen pendientes; no commit/push ni secretos publicados.

## Gate OpenCode
### Registro D-009 — Validaciones pre-Supabase (10/10/2026)
Fuente: solicitud directa de Miguel (USR-DB-VALIDACION-001). Entrega documental: BD/validaciones-pre-supabase.md (DB-VAL-001); definición, diccionario, guía local, roadmap, MIG-03 a MIG-08, AGENTS y skill alineados.

V5/V6 conservadas, 25 tablas vigentes. Se adoptaron seis condiciones obligatorias: integridad financiera, idempotencia real, seguridad multiempresa, trazabilidad/anulación/reversión, concurrencia y aceptación del reto. VAL-01/03/04/05 tienen cobertura local parcial; VAL-02/06 siguen pendientes integradas. Costos compartidos y transferencias internas aún no cuentan con implementación completa.

No se ejecutaron nuevas pruebas financieras ni se modificó SQL, Java, secretos o Supabase en esta actualización documental. Los 141 tests y la migración V6 previa conservan su alcance original. Sin commit ni push. Próximo trabajo: cerrar evidencia de estas condiciones en las etapas pendientes y validar roles/entorno reales antes del cierre de destino.



No habilitado ahora. Tras principal verificado, tareas OBR de QA; si Claude alcanza límite antes, Miguel puede autorizar handoff explícito del siguiente ID pendiente. El estado permanece parcial hasta completar y verificar requisitos.
