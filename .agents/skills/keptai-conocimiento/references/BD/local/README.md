# KeptAI — Base local y coordinación con Supabase

ID: DB-LOCAL-001. Alcance: PostgreSQL del negocio V7 sobre V6, 25 tablas, sin datos reales. Esta instalación no incluye Supabase Auth, Storage ni Studio.

## Qué se adapta de Andrés
El estado Running y Flyway Success acreditan infraestructura y migraciones locales. El cierre funcional exige [DB-VAL-001](../validaciones-pre-supabase.md), pruebas del motor/API y comprobaciones del entorno Supabase real.


V7 de Andrés (6875bab) refuerza autorización de crédito, autoría, protección de padres financieros y lecturas por rol. No añade tablas ni cierra JWT/Storage/motor. V1–V6 se conservan sin cambios.

V1–V3 se conservan byte a byte. V4–V5 corrigen vouchers/RLS/integridad/costos. **V6**, aprobada como alcance por Miguel (D-008), retira contacto y nota_cliente solo si están vacías y sin dependencias externas; de otro modo aborta. No se usa CASCADE, repair ni limpieza de datos reales.

Esquema canónico: keptai. Historial único: BD/migrations/ y keptai.flyway_schema_history. Hay **25 tablas de negocio**, además de las tablas internas de Flyway/Supabase que no forman parte de ese conteo. Las extensiones para margen por línea y transferencias internas siguen definidas pero sin SQL; no son una entrega completa de C-05/C-06.

## Requisitos

Ejecutar en **Ubuntu WSL**, no directamente en PowerShell: Docker Desktop abierto e integración WSL activa; docker info debe funcionar en esa sesión. Python3 para generar claves locales. Java21/Maven Wrapper solo para arrancar Spring, no para levantar la DB.

Herramientas: Docker Compose; postgres:17-alpine; flyway/flyway:12.4.0. La versión PostgreSQL es la base local probada, no una afirmación de la versión del proyecto remoto: Andrés debe consultarla y alinear la major antes de usar diferencias de motor. No instalar PostgreSQL/Maven global en Windows para este flujo.

## Primera ejecución en una pestaña Zellij

Desde el repositorio:
```bash
cd /home/miguel/dev/hackaton/conocimiento
./BD/local/db.sh up
./BD/local/db.sh migrate
./BD/local/db.sh status
./BD/local/db.sh validate
```

Para actualizar una base V6 existente, ejecutar up, migrate y validate en ese orden: Flyway aplica únicamente V7 pendiente, conservando datos y volumen. El status debe mostrar Schema version: 7 y V1–V7 Success.

up crea BD/local/.env si falta, con dos contraseñas aleatorias, permisos 0600 y valores locales; conserva cualquier archivo existente. .env está ignorado por Git. No copiar secretos remotos aquí ni publicar el archivo. .env.example sí se comparte.

El contenedor guarda datos en un volumen Docker y publica **127.0.0.1:5433**. migrate usa el migrador y luego provisiona keptai_app miembro de keptai_runtime, sin propiedad/superuser/BYPASSRLS. La contraseña no se imprime. Ejecutar migrate de nuevo valida/reutiliza el historial; no recrea datos.

Si se cambian credenciales en .env tras crear el volumen, PostgreSQL no cambia automáticamente la contraseña de roles existentes. Conservar .env o hacer rotación explícita; no borrar el volumen para resolver ese error.

## Ver y probar la base

Acceso administrativo local:
```bash
./BD/local/db.sh psql
```

Dentro de psql:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname='keptai' AND tablename<>'flyway_schema_history'
ORDER BY tablename;
SELECT version, description, success FROM keptai.flyway_schema_history
WHERE version IS NOT NULL ORDER BY installed_rank;
```

Salir con \q. Para probar los permisos de la app:
```bash
./BD/local/db.sh app-psql
```

Sin identidad/contexto, SELECT a negocio debe devolver cero filas. La base inicial está vacía: no confundir cero clientes con fallo. Semilla ficticia financiera/motor sigue siendo entrega de Andrés; no se copian registros de Corpotex.

El rol migrador local tiene privilegios administrativos para crear roles y objetos. No usarlo en Spring ni como credencial productiva.

## Conectar Spring en otra pestaña

```bash
cd /home/miguel/dev/hackaton/conocimiento/Backend
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

application-local.yml lee ../BD/local/.env como properties, conecta a keptai con el usuario runtime y conserva Hibernate validate/Flyway desactivado. El perfil dev anterior sigue arrancando sin DB. Mantener .env en formato generado: pares CLAVE=valor, sin export ni comillas añadidas.

El perfil local acredita conexión, no motor financiero/JWT/API terminados. MIG-03 debe resolver identidad y establecer GUC LOCAL en cada transacción; JWT no fija automáticamente contexto JDBC. Los endpoints de negocio continúan pendientes.

En tercera pestaña:
```bash
curl -i http://localhost:8080/actuator/health
curl -i http://localhost:8080/api/v1/x
```
Esperar 200 health y 401 JSON para ruta sin autenticación. El health no revela credenciales.

## Trabajo diario

- Arranque: db.sh up; después de nuevos cambios SQL: db.sh migrate y validate.
- Al terminar: Ctrl+C en Spring; db.sh down detiene los contenedores y **conserva el volumen**.
- No usar down -v, Flyway clean, db reset ni repair como parte del flujo normal.
- Los compañeros levantan una base independiente con los mismos archivos y sus claves propias. Se comparte estructura e historial; los datos no se sincronizan automáticamente.

## Qué hace Andrés con el MCP

El MCP sirve para inspeccionar y administrar Supabase remoto. **No necesitas su MCP para reproducir el esquema local.** Andrés debe:
1. Identificar el proyecto correcto, versión PostgreSQL, esquemas y si ya existe historial Flyway.
2. Comparar versiones/checksums con BD/migrations/, propietarios/grants, funciones, RLS y esquemas expuestos.
3. Detectar datos en mensajes/contacto/nota_cliente antes de V4/V6. Si existen, presentar procedimiento de conservación/purga autorizado; no saltar los guards.
4. Ejecutar release con Flyway y migrador separado, manteniendo la misma configuración keptai. No pegar cada migración manualmente por MCP si luego se va a asumir un historial Flyway que nunca se creó.
5. Aplicar BD/supabase/vouchers_storage.sql aparte y probar Auth/Storage, upload, lectura y aislamiento real.
6. Entregar versión/resultado del esquema y semilla ficticia reproducible por Git, sin secretos ni datos empresariales.

Si el remoto fue construido manualmente y no tiene historial, primero definir reconciliación/baseline con inventario de objetos. Nunca marcar V1–V6 aplicadas solo para ocultar diferencias. MCP conectado no significa Spring conectado.

### Prompt de traspaso para Andrés

> Usa keptai-conocimiento y lee D-008, BD/definicion-base-datos.md, BD/local/README.md y decisiones/trazabilidad-tablas-mvp.md. Miguel aprobó 25 tablas de base, excluyendo contacto/nota_cliente; V1–V3 originales siguen intactas, V4–V6 adaptan el esquema. Con tu MCP inspecciona el proyecto Supabase correcto, versión, schema/historial/checksums, roles/RLS, funciones, policies Storage y datos que bloquean V4/V6. Entrega un informe de diferencias y el procedimiento reproducible Flyway para igualarlo al local. No borres datos, no uses repair ni declares aplicada una migración sin evidencia. Coordina semilla/motor y credenciales por canal privado; no publiques secretos. C-05/C-06 tienen extensiones definidas pero aún sin SQL.

## Si se necesitan también Auth y Storage locales

La CLI de Supabase levanta PostgreSQL/Auth/Storage/Studio mediante Docker; es distinta del PostgreSQL simple de esta guía. Ver [documentación oficial](https://supabase.com/docs/guides/local-development).

Para esa etapa: instalar CLI como dependencia local, inicializar un proyecto local separado y usar supabase start. Usar la misma carpeta BD/migrations/ mediante Flyway contra el puerto de ese Postgres, aprovisionar runtime y aplicar Storage aparte; no crear un segundo historial duplicado de migraciones de negocio en la CLI. Revisar esquema antes del primer migrate. Los puertos habituales 54322/54323 no sustituyen el 5433 de esta instalación.

Ese stack completo **no se instaló ni arrancó en esta entrega**. Es necesario antes de acreditar JWT Auth/Storage locales reales; las pruebas con catálogos emulados no lo sustituyen.

Referencias técnicas: [Docker Compose](https://docs.docker.com/reference/compose-file/services/), [Flyway migrate/validate/info](https://documentation.red-gate.com/flyway/reference/usage/maven-goal).
