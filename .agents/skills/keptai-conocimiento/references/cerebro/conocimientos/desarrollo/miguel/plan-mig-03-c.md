# MIG-03-C — Contexto JDBC transaccional
ID: MIG-03-C-PLAN-001. Fecha: 11/10/2026. Responsable: Miguel/Claude. Estado: siguiente implementacion; no codigo entregado por este plan.

## Objetivo
Establecer contexto de organizacion y usuario para consultas de negocio en la misma transaccion y conexion usada por Spring, sin fuga entre peticiones, organizaciones o conexiones reutilizadas.
La identidad procede de KeptaiAuthentication autenticada con Access.SINGLE y su Membership, nunca de body, cabeceras, query, JWT metadata o UUID elegido manualmente.
No requiere MCP ni credenciales Supabase. Integracion real Auth y AUTH-FE-01..04 permanecen posteriores.

## Fuentes y precisiones
Auditoria Backend/docs/auditoria-backend-2026-10-11.md, incluida su revision posterior. AGENTS, V4/V7, seguridad actual, matriz de acceso y DB-VAL-001.
V4 define app.organizacion_id, app.usuario_id, app.servicio_id. actor_actual() exige organizacion y exactamente un usuario o servicio activos. El rol se consulta en PostgreSQL; no establecer un rol arbitrario mediante GUC.
El bootstrap resolver_usuario(sub) es la excepcion anterior al contexto: recibe solo sub validado y resuelve la membresia con login runtime. No exigir contexto para esa consulta ni romper /me.
KeptaiAuthentication hoy representa usuarios del panel. La autenticacion de servicio no existe: no fabricar una identidad INGESTA ni aceptar un UUID de servicio del cliente en esta entrega. Servicio/SCHEDULER queda MIG-03-D o entrega acotada posterior.
V4 ya permite INSERT a INGESTA en pago/comprobante con restricciones; no abrir RLS por un hallazgo incorrecto. Las restricciones de obligacion, despacho y costeo requieren acuerdos separados con Andres.

## Entregas pequenas
### C1 — Elegir y documentar frontera de transaccion
Inspeccionar gestor de transaccion Spring efectivo (JPA/Hibernate presentes), DataSource runtime y JdbcTemplate/DataSourceUtils. Elegir un unico mecanismo explicito para aplicar contexto dentro de transaccion; documentar como lo usaran futuros servicios.
No filtro HTTP que abra conexion independiente ni SET SESSION. No agregar un transaction manager competidor sin resolver su seleccion y participacion JPA/JDBC.
Si un servicio ya tiene transaccion, usar la conexion vinculada a esa transaccion. No usar una conexion directa del pool o un REQUIRES_NEW inadvertido para ejecutar set_config separado del negocio.
El componente debe rechazar uso sin transaccion real o abrirla explicitamente mediante una frontera documentada. No procesar negocio antes de fijar contexto. Nested/join debe mantener identidad; no permitir que una operacion cambie a otra organizacion/actor en la misma transaccion.
No crear controllers publicos adicionales para mostrar contextos.

### C2 — Implementar contexto de usuario
Tomar la Authentication actual, comprobar tipo/autenticacion/SINGLE y Membership usuario/organizacion/rol de panel validos.
Aplicar parametros PreparedStatement/set_config(nombre,valor,true):
- app.organizacion_id = UUID de Membership.organizacionId
- app.usuario_id = UUID de Membership.usuarioId (no confundir con sub Auth)
- app.servicio_id = cadena vacia
Comprobar mismo contexto en operaciones siguientes y respetar reglas del actor en DB.
SET LOCAL debe expirar en commit y rollback, sin contextos de sesion ni secretos en logs. Limpiar explicitamente actor alternativo para impedir contexto mixto.
Anonimo, NONE, MULTIPLE y tipos inesperados fallan cerrado, sin consultas de negocio. Mantener respuestas actuales401/403/409 y /me; no conceder acceso alternativo.
No crear entidades, repositorios de negocio, semillas en DB activa, motor ni migraciones para demostrar funcionalidad.

### C3 — Pruebas PostgreSQL reales desechables
Reutilizar estilo Testcontainers PostgreSQL17 y migraciones V1-V7 existentes.
Migrador/owner solo crea fixture en contenedor desechable. Todas las operaciones probadas usan LOGIN NOSUPERUSER NOBYPASSRLS no propietario que hereda keptai_runtime, no solo SET ROLE.
Fixtures: dos organizaciones y sus usuarios; suficiente entidad de lectura/escritura permitida por RLS. Assert del rol runtime real y de privilegios.
Casos:
1. Sin contexto, runtime no ve filas de negocio.
2. Usuario A ve solo A; B ve solo B y no puede modificar A.
3. GUC usuario es ID de miembro DB, diferente de sub.
4. Lectura y escritura legitimas bajo contexto; escritura cruzada rechazada con la causa esperada.
5. Datos enviados por cliente no cambian organizacion/actor.
6. Commit y rollback eliminan contexto; una conexion reutilizada no conserva usuario/organizacion/servicio anterior.
7. Pool size1 y PID PostgreSQL prueban reutilizacion efectiva A -> sin contexto -> B, tanto tras commit como rollback.
8. Operacion en transaccion existente no fija contexto en otra conexion; identidades incompatibles en transaccion se rechazan.
9. Actor inexistente/inactivo o contexto mixto no concede acceso.
10. Prueba Spring/JWT fixture -> membresia -> servicio transaccional -> RLS usando controller o servicio de prueba solo en src/test si hace falta.
No confundir pasar /me con pasar la prueba RLS: /me solo devuelve membresia y no consulta datos tenant.
No bajar seguridad para admitir usuarios con multiples organizaciones. No implementar API keys ni fake autenticacion de servicios.

### C4 — Validacion y documentacion
Ejecutar ./mvnw verify con JDK Linux y Docker accesible. No usar mvn Windows.
Si sesion Claude no hereda grupo docker, usar sg docker -c './mvnw verify' con JAVA_HOME y PATH Linux exportados; no chmod666 al socket, no sudo requerido ni omitir tests para declarar exito.
No detener servidores del usuario5433/8080/5173; tests escriben solo en contenedores desechables. No arrancar segunda API en8080.
Registrar gestor/frontera de transaccion, archivos, tests/resultados, alcance usuario y limites servicio/realAuth. Actualizar estado y AGENTS, matriz/guia pertinente y snapshot skill/check.
No cambiar contrato /me ni adjudicar todas las condiciones D-009 como cerradas.
Sin commit/push/fetch/merge/cambio de rama por Claude.

## Salida para revision de Codex
Codigo y pruebas MIG-03-C terminados, evidencia de login runtime, conexion/transaccion compartidas, aislamiento entre dos organizaciones y ausencia de fuga en pool/rollback. Suite sin fallos.
AUTH-FE, MIG-03-D, uploader, idempotencia y motor quedan separados.
Siguiente orden: MIG-03-D; AUTH-FE-01..04 para recorrido de panel; MIG-04; MIG-05/06/07 segun acuerdos y motor. No delegar varias etapas a la vez.
