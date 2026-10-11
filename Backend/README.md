# Backend KeptAI

Servicio Spring Boot 4.1.1 / Java 21 (Maven Wrapper). Es el único dueño de las reglas de negocio: seguridad,
contexto multi-organización, fechas, saldos y cálculos financieros. Miguel construye la API, la captura y la
integración; Andrés define los datos, las migraciones y el motor financiero.

## Estado actual (11/10/2026)

| Área | Qué hay | Dónde |
|---|---|---|
| Panel (JWT de Supabase Auth) | `GET /api/v1/me`; pedidos (`/orders`, detalle, decisión de crédito `GET/POST`, despacho `POST`); pagos (`/payments`, detalle, conciliación, verificación, aplicación y marcar duplicado); cobranza (`/receivables`, alertas y su resolución, envíos, estado de cuenta, auditoría); resultados (resumen, márgenes, centro productivo, caja a 4 semanas y `reports/orders.csv`). Las acciones llaman a los motores financieros | `web/`, `panel/` |
| n8n (`X-Api-Key` INGESTA) | `POST /api/v1/ordenes/ingesta` crea pedido y hoja de resumen en BORRADOR para un contacto registrado (V10), con idempotencia. `POST /api/v1/pagos/voucher` registra el pago en fase RECIBIDO y guarda el voucher en Supabase Storage privado (valida JPEG/PNG/PDF, SHA-256, compensación si falla). Ninguna de las dos verifica ni aplica dinero | `web/`, `n8n/`, [docs/integracion-n8n-isabella.md](docs/integracion-n8n-isabella.md) |
| Contrato | 41 operaciones con ejemplos y casos negativos; 26 rutas `/api/v1` implementadas más el health público | [docs/openapi.yaml](docs/openapi.yaml), [docs/contrato-api.md](docs/contrato-api.md) |
| Seguridad | JWT de Supabase (RS256/ES256, issuer, audiencia), membresía resuelta en BD, API key de servicio comparada por hash SHA-256, autorización por método y ruta exacta con denegación por defecto. Errores JSON `{code, message, request_id}`: 401, 403, 404 (ruta autorizada sin controlador) y 503 | `config/`, `security/`, [docs/matriz-acceso.md](docs/matriz-acceso.md) |
| Multi-organización | Cada transacción fija `app.organizacion_id`, `app.usuario_id` o el servicio con `set_config(..., true)`; RLS filtra por ellos | `tenancy/` |
| Motores financieros (Andrés) | `MotorPagos` (verificar, duplicado, aplicar, anular, saldo), `MotorCobranza` (despacho y evaluación −3/0/+3), `MotorCostos` (costos, reparto a ítems, cargo interno), `MotorResultados` (margen, centro taller, CSV) y `MotorCaja` (caja a 4 semanas) | `finanzas/`, [docs/motor-pagos.md](docs/motor-pagos.md) |
| DTOs | Records con Bean Validation y JSON estricto, alineados con el contrato | `contract/` |
| Pruebas | **335 pruebas** sin fallos: contrato, seguridad, tenancy, migraciones V1–V11 con RLS, motores, n8n con Storage simulado, semilla y recorrido demo. Usan PostgreSQL real con Testcontainers (requieren Docker) | `src/test/` |
| Docker | Imagen multietapa JRE 21, usuario sin privilegios, perfil `prod`; no migra la base al arrancar | `Dockerfile`, [docs/despliegue-n8n.md](docs/despliegue-n8n.md) |

**Pendiente:** confirmación del pedido por el vendedor desde WhatsApp y callback de WF3, programador de cobranza y
webhooks salientes reales, carga manual de vouchers desde el panel (MIG-04), prueba con n8n y Storage reales de punta a
punta, despliegue público y revisión de Andrés de V10/V11 antes de llevarlas a Supabase. El login real con Supabase
Auth pasó una aceptación básica local con una cuenta ([detalle](docs/prueba-auth-real-local.md)); falta probarlo con
cuentas por rol.

## Ejecutar

```bash
cd Backend
./mvnw test                     # 335 pruebas (Docker obligatorio)
./mvnw spring-boot:run          # perfil dev: sin base de datos, solo health
./scripts/run-local.sh          # perfil local: PostgreSQL de BD/local (5433) con el rol runtime
curl -i localhost:8080/actuator/health
```

En WSL usar siempre `./mvnw` (el `mvn` del PATH puede ser el de Windows). `run-local.sh` deduce `JAVA_HOME` desde
`javac` y carga `Backend/.env` como properties (sin `source` ni mostrar secretos). Antes hay que levantar la base:
`./BD/local/db.sh up && ./BD/local/db.sh migrate` ([guía](../BD/local/README.md)).

| Perfil | Base de datos | Uso |
|---|---|---|
| `dev` (por defecto) | Ninguna (excluye DataSource, JPA y Flyway) | Arrancar sin credenciales |
| `test` | Ninguna; las pruebas de BD usan Testcontainers | Suite automática |
| `local` | `127.0.0.1:5433/keptai` con el login runtime de `BD/local/.env` | Desarrollo con datos locales |
| `prod` | `SPRING_DATASOURCE_*` obligatorias; sin mensajes ni stack traces en errores | Despliegue |

Flyway no se ejecuta al arrancar la aplicación. Las migraciones viven en [`../BD/migrations/`](../BD/migrations/) y se
aplican como paso aparte con el rol migrador; las pruebas las leen desde `filesystem:../BD/migrations`.

### Variables (`.env.example`)

| Variable | Para qué |
|---|---|
| `PORT`, `SPRING_PROFILES_ACTIVE` | Puerto (8080) y perfil |
| `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` | Solo `prod` |
| `KEPTAI_JWT_ISSUER_URI`, `KEPTAI_JWT_JWK_SET_URI`, `KEPTAI_JWT_AUDIENCES` | JWT del panel (Supabase Auth); las tres juntas |
| `KEPTAI_CORS_ALLOWED_ORIGINS` | Orígenes exactos del navegador (`local` ya admite `localhost:5173`) |
| `KEPTAI_N8N_WEBHOOK_URL`, `KEPTAI_N8N_WEBHOOK_SECRET` | Webhook saliente a WF3; el secreto debe tener 32 caracteres o más |
| `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET`, `SUPABASE_SECRET_KEY` | Storage privado de vouchers (usado por `POST /api/v1/pagos/voucher`). Solo en el entorno del backend, nunca en `VITE_*` |

La API key de n8n **no** va en variables: solo se guarda su hash en `integracion_servicio`.
`scripts/generar-clave-servicio.sh <archivo-fuera-del-repo>` genera la clave, la escribe solo en ese archivo y muestra
únicamente el hash que se registra en la base ([guía](docs/provision-servicios-local.md)).

### Scripts (`scripts/`)

| Script | Qué hace |
|---|---|
| `run-local.sh` | Arranca Spring con el perfil `local` |
| `generar-clave-servicio.sh` | Genera una API key de servicio fuera del repo y muestra solo su hash |
| `servicio-local.sh` | Alta, listado, revocación y rotación de credenciales de servicio (vista previa por defecto, `--apply` explícito) |
| `provisionar-contacto-local.sh` | Registra un cliente y su contacto de WhatsApp (JID) en la base local (vista previa / `--apply`) |
| `provisionar-membresia-local.sh` | Vincula una cuenta de Supabase Auth a una organización y un rol en la base local |
| `verificar-n8n-local.sh` | Recorrido HTTP de las rutas de n8n con PostgreSQL y Storage simulado desechables |

## Historial de etapas

> Las secciones siguientes describen cada etapa en su momento y se conservan como registro. Donde difieran del
> **Estado actual**, prevalece este último (por ejemplo, los conteos de pruebas, «sin endpoints» o «V6, 25 tablas»).

Plan de Miguel: [MIG-GENERAL](../cerebro/conocimientos/desarrollo/miguel/tarea-general.md), [tareas](../cerebro/conocimientos/desarrollo/miguel/tareas.md), [estado](../cerebro/conocimientos/desarrollo/miguel/estado.md). Modelo DB: [PROP-DB-001](../cerebro/conocimientos/decisiones/modelo-base-datos-mvp.md).

## Comandos verificados (MIG-01, 10/10/2026, WSL Ubuntu)

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64   # el `mvn` del PATH de WSL es el de Windows: usar siempre ./mvnw
cd Backend
./mvnw verify                  # 3 tests de arranque, health y 401 uniforme
./mvnw spring-boot:run         # perfil dev por defecto; puerto ${PORT:8080}
curl -i localhost:8080/actuator/health   # 200 {"status":"UP",...} sin detalles
```

Perfiles: `dev` (por defecto), `test`, `prod` (sin mensajes ni stack traces en errores). Todo salvo `/actuator/health/**` responde 401 JSON `{code,message,request_id}` hasta MIG-03. `.env.example` solo lista PORT y SPRING_PROFILES_ACTIVE. La versión del parent es `4.1.1` (el id `4.1.1.RELEASE` de Initializr no existe en Maven Central).


## Dependencias de infraestructura (10/10/2026, cierre de preparación de MIG-01)

Versiones gestionadas por el BOM de Spring Boot 4.1.1 (sin versiones propias en el pom): Hibernate 7.4.5, Flyway 12.4.0, PostgreSQL JDBC 42.7.13, Spring Security 7.1.1 (Nimbus JOSE 10.9.1), Testcontainers 2.0.5. Nombres de starters según la guía de migración de Boot 4 y verificados contra el BOM.

| Estado | Artefacto | Para qué |
|---|---|---|
| Ya disponible | starters webmvc, validation, actuator, security (+ sus `-test`) | API, DTOs, health, seguridad |
| Incorporada | `spring-boot-starter-data-jpa` | JPA/Hibernate (sin entidades todavía) |
| Incorporada | `spring-boot-starter-flyway` + `flyway-database-postgresql` | Migraciones; el módulo PostgreSQL es obligatorio desde Flyway 10 |
| Incorporada | `org.postgresql:postgresql` (runtime) | Driver JDBC |
| Incorporada | `spring-boot-starter-security-oauth2-resource-server` | Incluye `spring-security-oauth2-jose`/Nimbus; el `oauth2-resource-server` sin `security-` está deprecado |
| Incorporada (test) | `starter-data-jpa-test`, `starter-security-oauth2-resource-server-test`, `spring-boot-testcontainers`, `testcontainers-junit-jupiter`, `testcontainers-postgresql` | Pruebas con PostgreSQL real |
| No requiere librería | Gemini y Supabase Storage | Cliente HTTP de Spring (`RestClient`) ya incluido; sin SDK |
| No incluida a propósito | Lombok, Redis, Kafka, Swagger/springdoc, SDKs | Sin necesidad verificada (OpenAPI será un `openapi.yaml` versionado) |

Agregar dependencias **no** implementa JWT (MIG-03), entidades, migraciones ni el motor de Andrés. `SecurityConfig` no configura todavía el resource server.

### Configuración por perfil

- `dev` (por defecto) y `test`: excluyen explícitamente las autoconfiguraciones de DataSource, Hibernate, repositorios JPA y Flyway para arrancar sin BD ni credenciales. Es una excepción solo de estos dos perfiles.
- `prod`: no excluye nada. Sin `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` la aplicación **falla al iniciar** (verificado). Base común: `ddl-auto: validate`, `open-in-view: false`, `flyway.enabled: false` (Flyway se ejecuta como paso de release con rol migrador, según infraestructura-desarrollo-mvp.md).
- Pendiente para prod: emisor/JWKS/audiencia de Supabase (MIG-03), esquema y migraciones (Andrés), valores reales en Render/CI.

### Reproducibilidad y comandos manuales

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd Backend
./mvnw dependency:tree                       # árbol resuelto
./mvnw verify                                # 7 tests; los de infra requieren Docker (sin @Disabled ni skip)
docker info                                  # si falla por permisos: sesión nueva de WSL o `sg docker -c "./mvnw verify"`
PORT=18081 java -jar target/keptai-backend-0.0.1-SNAPSHOT.jar   # tras verify; no usar 8080 si está ocupado
curl -i localhost:18081/actuator/health      # 200
curl -i localhost:18081/api/v1/x             # 401 JSON
SPRING_PROFILES_ACTIVE=prod java -jar target/keptai-backend-0.0.1-SNAPSHOT.jar   # debe fallar sin DataSource
```

Pruebas de infraestructura (`src/test/.../infra`): `PostgresInfraTests` (JDBC `SELECT` y Flyway-PostgreSQL sin migraciones contra `postgres:17-alpine`) y `SpringDataSourceInfraTests` (DataSource, JdbcTemplate y EntityManager Hibernate vía `@ServiceConnection`). Solo prueban infraestructura: no hay tablas de negocio y no acreditan integración financiera. La primera ejecución descarga la imagen Docker (~1 min).

## Contrato API y DTOs — PROPUESTA MIG-02 (10/10/2026)

> **Estado: propuesta técnicamente revisada; el gate de aceptación de Andrés está pendiente y MIG-02 NO está completada.** Ningún endpoint de este contrato existe: solo `GET /actuator/health` y el `401` JSON de MIG-01 son operativos. Todos los ejemplos son ficticios.

- Contrato: [`docs/openapi.yaml`](docs/openapi.yaml) (OpenAPI 3.1, 30 operaciones). Matriz endpoint → dueño → estado, convenciones, supuestos, limitaciones y los 18 acuerdos que un humano debe confirmar antes de cerrar MIG-02: [`docs/contrato-api.md`](docs/contrato-api.md).
- DTOs de transporte: `src/main/java/pe/keptai/backend/contract/` (records con Bean Validation y `@JsonProperty` explícito, enums con valor JSON explícito, `ContractJson.newMapper()` estricto). No son entidades JPA ni contienen fórmulas financieras; `web/ApiError` no se modificó.
- Pruebas (`src/test/java/pe/keptai/backend/contract/`): cada ejemplo del YAML se deserializa en su DTO, valida y vuelve a serializarse idéntico; enums y propiedades YAML ↔ Java; matriz de la guía ↔ YAML; validación de importes (centavos, límite seguro de JS, negativos), fechas, estados y campos desconocidos; coherencia aritmética de la semilla entre ejemplos.

### Validar el YAML (herramienta reproducible, sin dependencias Java)

```bash
cd Backend
docs/tools/validate-openapi.sh        # crea docs/tools/.venv (ignorado por Git) con versiones fijadas
```

Usa `openapi-spec-validator` 0.8.4 (OpenAPI 3.1) y `jsonschema` 4.24.1 (formatos `uuid`, `date`, `date-time`, `uri`): valida la especificación y los `$ref`, cada ejemplo contra su esquema, reglas del contrato (propuesta, `Idempotency-Key` en `POST`, paginación, sin `organization_id` del cliente, cuerpos cerrados) y 25 casos negativos. Si `python3 -m venv` falla por falta de `ensurepip`, el script crea el entorno sin pip y descarga el instalador oficial `get-pip.py` (requiere red). No instala nada global.

## Base local V6 (25 tablas)

Ver [BD/local/README.md](../BD/local/README.md). Ejecutar db.sh up/migrate y arrancar desde Backend/ con ./mvnw spring-boot:run -Dspring-boot.run.profiles=local. El perfil lee BD/local/.env, usa runtime y no ejecuta Flyway; dev sigue sin DB. Health/401 probados; JWT/API/motor siguen pendientes.

## Seguridad: configuración y matriz (MIG-03-A, 10/10/2026)
Matriz de acceso y decisiones pendientes: [docs/matriz-acceso.md](docs/matriz-acceso.md). Propiedades tipadas `keptai.security.*` (`config/KeptaiSecurityProperties`): JWT del panel (issuer, JWKS, audiencia), CORS por orígenes exactos y webhook saliente a WF3. Variables de ejemplo en `.env.example` (sin valores reales). El perfil `local` admite el frontend en `http://localhost:5173`. **Todavía no hay validación de JWT, API key ni endpoints de negocio**: salvo `/actuator/health/**`, todo responde 401.

## JWT del panel y `GET /api/v1/me` (MIG-03-B, 10/10/2026)
Valida el JWT (RS256/ES256, issuer, audiencia, exp, nbf) con `keptai.security.jwt.*` y resuelve usuario, organización y rol con `keptai_private.resolver_usuario` por la conexión runtime. Detalle y límites en [docs/matriz-acceso.md](docs/matriz-acceso.md) §6.1.
- Pruebas (fixtures; JWKS local de prueba y PostgreSQL de Testcontainers, no tocan tu base): `sg docker -c "./mvnw -o test -Dtest='Jwt*Tests'"`.
- Prueba manual con tu base local y un Auth real, sin pegar secretos en Git ni en el chat: (1) exporta `KEPTAI_JWT_ISSUER_URI`, `KEPTAI_JWT_JWK_SET_URI` y `KEPTAI_JWT_AUDIENCES` desde tu proyecto Supabase; (2) asegura que existe una fila en `usuario` con `auth_user_id` igual al `sub` de tu sesión (la insertas tú como migrador); (3) arranca con `-Dspring-boot.run.profiles=local` en un puerto libre; (4) toma el `access_token` de tu sesión y ejecuta `curl -i -H "Authorization: Bearer $TOKEN" localhost:<puerto>/api/v1/me`. Esperado: 200 con `user_id`, `organization_id` y `role`; sin token 401; con varias membresías 409.
