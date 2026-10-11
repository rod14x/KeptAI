> Actualización vigente MIG-02/D-007 (10/10/2026): contrato alineado en [docs/contrato-api.md](docs/contrato-api.md) y [docs/alineacion-bd-n8n.md](docs/alineacion-bd-n8n.md). SQL correctivo en BD/V4–V5; solo vouchers y datos de negocio persistentes, sin chat/audio/texto saliente. Los endpoints no están implementados; MIG-03 será JWT/API key y contexto RLS. Las secciones anteriores de propuestas se conservan como historial cuando difieran.

# Backend KeptAI — desarrollo compartido

Servicio Spring Boot 4.1.1 / Java 21 (Maven Wrapper). Estado MIG-01: solo arranque, perfiles, health mínimo y errores básicos; sin base de datos, captura, pagos ni JWT todavía. Miguel construye API/captura/IA; Andrés define datos/migraciones y motor financiero. No iniciar dos scaffolds independientes.

Plan de Miguel: [MIG-GENERAL](../cerebro/conocimientos/desarrollo/miguel/tarea-general.md), [tareas](../cerebro/conocimientos/desarrollo/miguel/tareas.md), [prompt Claude](../cerebro/conocimientos/desarrollo/miguel/prompt-claude.md).

Modelo DB: [PROP-DB-001](../cerebro/conocimientos/decisiones/modelo-base-datos-mvp.md). Andres es dueño de Flyway; migraciones ejecutables viven dentro del servicio Spring, BD/ conserva diseño/acuerdos. Coordinación de contratos antes de código, sin ERP/CRM ni fórmulas duplicadas. 
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
