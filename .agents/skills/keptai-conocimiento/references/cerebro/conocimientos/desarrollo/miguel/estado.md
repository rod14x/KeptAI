# Estado de desarrollo de Miguel

> Preparación: 10 de octubre de 2026. Esta plantilla no acredita implementación. Actualizar al terminar cada tarea, evitando escritores simultáneos.

## Última tarea

MIG-01 completada el 10/10/2026: arranque Spring Boot en Backend/ verificado (`./mvnw verify` y arranque local). Siguiente: MIG-02 (no iniciada; requiere acordar campos/DTOs con Andrés). MIG-00 quedó cerrada como parcial y su bloqueo B1 está resuelto.

## Estado

- MIG-00 informe entregado; B1 (JDK 21) resuelto el 10/10/2026. B2 (Docker) resuelto con matiz: ver cierre de MIG-01.
- MIG-01 completada; MIG-02..08 pendientes.
- Andrés: entregables de esquema/motor aún no verificados aquí.
- ClaudeCode2.1.296 y OpenCode1.18.35 detectados; no se abrió una nueva sesión ni se envió un prompt a los panes existentes.
- El repo contiene todos los commits remotos consultados y conserva commit local7002163.

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

## Gate OpenCode

No habilitado ahora. Tras principal verificado, tareas OBR de QA; si Claude alcanza límite antes, Miguel puede autorizar handoff explícito del siguiente ID pendiente. El estado permanece parcial hasta completar y verificar requisitos.
