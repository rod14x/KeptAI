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
