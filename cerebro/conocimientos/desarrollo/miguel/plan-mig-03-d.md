# MIG-03-D — Autenticacion de servicios y autorizacion
ID: MIG-03-D-PLAN-001. Fecha: 11/10/2026. Responsable: Miguel/Claude.
Estado: D1 revisada con207 tests sin fallos/errores/omitidos. Siguiente D2 tras publicacion D1. MIG-03-C usuario de panel entregado; no se declara MIG-03 completo.

## Fuentes
AGENTS.md, estado vigente, matriz-acceso.md, V4/V7, OpenAPI/contrato y workflows WF0-WF3. Auditoria con precisiones §11.
No MCP personal ni cambios remotos. No modificar V1-V7 ni abrir RLS. INGESTA ya puede insertar pago/comprobante bajo limites; no ampliar sus privilegios.

## D1 — Identidad autentica de servicio y contexto transaccional
### Objetivo
Validar X-Api-Key de n8n por hash en keptai_private.resolver_servicio, generar identidad de servicio separada de KeptaiAuthentication de usuario y aplicar contexto de servicio en la misma conexion/transaccion del negocio.
No habilitar controllers de negocio ni afirmar n8n conectado por tests.

### Credencial y bootstrap
Clave tecnica de alta entropia (minimo256 bits aleatorios), distinta del JWT, SUPABASE_SECRET_KEY y X-Api-Secret del webhook saliente.
El contrato BD tiene clave_hash de64 hex. Usar SHA-256 UTF-8 de la clave exacta para lookup parametrizado con resolver_servicio(hash); documentar esta eleccion tecnica, nunca almacenar/imprimir clave en claro. No usar claves humanas/predecibles ni modificar formato/hash a voluntad.
Reutilizar patron ObjectProvider<DataSource> de membresia, sin SELECT directo de integracion_servicio ni grants extra. Fila debe ser unica/activa, con UUIDs/instancia y alcance INGESTA o SCHEDULER validos.
Bootstrap antes de contexto: firma/lookup resuelven organizacion/servicio; ignorar organizacion/actor/alcance/instancia aportados por cliente. DB sigue autoridad.
Clave ausente/invalida/revocada ->401; servicio valido sin permiso ->403; base indisponible ->503, request_id y error seguro. No devolver el hash ni motivo que permita enumerar claves.
Limitar longitud, rechazar valores duplicados/ambiguos de cabecera y nunca hacer fallback JWT/API key si uno es invalido. JWT de usuario nunca autentica n8n, clave n8n nunca autentica /me/panel. Resolver credenciales simultaneas con rechazo explicito y pruebas, sin escoger silenciosamente.
Health publico conserva comportamiento existente; rutas panel conservan JWT. No permitir X-Api-Key en CORS del navegador.
Credenciales/personales/tokens quedan fuera de getCredentials/toString/logs/excepciones. No usar valores privados en fixtures.

### Contexto
Ampliar tenancy preservando APIs y pruebas de usuario:
- usuario panel: org + usuario y servicio vacio.
- servicio autenticado: org + servicio y usuario vacio.
Exactamente un tipo activo, identidad inmutable ligada a la transaccion REQUIRED. Role/alcance lo consulta PostgreSQL actor_actual(), no fijar GUC rol.
Identidad distinta dentro de transaccion se rechaza, incluidos cambios usuario->servicio o servicio->usuario. No suplantar vendedor por JID: confirmacion de usuario sigue pendiente de acuerdo5.3 para MIG-06.
No generar servicio a partir de body, hash que el cliente ya calcula, UUID arbitrario o JWT metadata.
Conservar la prohibicion de REQUIRES_NEW/conexiones ajenas al negocio. Recursos de contexto son transaction-bound para el flujo REQUIRED documentado; no prometer soporte a suspension/nesting no probado.
Servicios pueden autenticarse y preparar el contexto, pero mantener rutas productivas de negocio cerradas hasta D2/implementacion. Demostrar operaciones permitidas con probe solo src/test.

### Provision local preparada, no ejecutada en DB activa
Documentar como generar cada clave aleatoria fuera de Git y almacenar solo su hash con migrador por organizacion/instancia/alcance, dos claves independientes INGESTA y SCHEDULER.
Guia/script parametrizado sin clave real ni password hardcoded. No modificar BD activa, crear claves reales/remotas ni imprimir secretos como parte de pruebas. Instrucciones/manual de Miguel en etapa posterior.
Si workflow tiene una sola apiKey, registrar brecha; no sobrescribir workflows ni activar un flujo externo en D1.

### Pruebas D1
JUnit/MockMvc y PostgreSQL17 desechable V1-V7 con login runtime real NOSUPERUSER NOBYPASSRLS no propietario.
Casos: valida/invalida/ausente/inactiva; org y alcance forjados ignorados; alcance diferente no gana permisos; JWT vs API key aislados; credenciales ambiguas; fallo DB503.
Flujo real de prueba X-Api-Key -> resolver_servicio -> principal -> transaccion -> GUC -> actor/RLS. Dos orgs, commit/rollback y poolsize1/PID, secuencia usuario A -> servicio A -> sin contexto -> servicio B -> usuario B sin fugas.
Comprobar que INGESTA solo registra RECIBIDO donde esta permitido, no verifica fondos/aplica pagos ni se convierte en SCHEDULER. No usar ficticio ADMIN para que las pruebas pasen.
Mantener192 tests previos y suite completa verify. Sin Docker session usar sg docker; JDK21/Linux.
Sin llamadas reales a n8n/Supabase ni escrituras en base manual.

### Archivos y cierre
Cambiar solo seguridad/tenancy/tests y guias necesarias. Un escritor por archivo.
Actualizar matriz §5.2/5.4 distinguiendo eleccion tecnica de reglas empresariales pendientes, estado y resumen AGENTS; snapshot skill/check.
Cierre D1: principal de servicio resuelto, contexto exclusivo y aislamiento probado con DB; controllers/metodos/roles finos, workflows y Auth real pendientes.
No commit/push/fetch/merge ni detener servidores5433/8080/5173.

## D2 — Permisos por metodo/ruta y errores
Despues de revisar D1, aplicar matriz existente a rutas exactas del contrato, roles de usuario vs alcances de servicio y deny por defecto para rutas desconocidas.
No permisos comodin para todas /api/v1/** ni suplantacion de usuario de negocio. /me mantiene usuarioSINGLE.
Revisar AccessDeniedException/AuthenticationException desde MVC/method security:401/403 seguros, no500 por handler generico; infraestructura503, conflictos409 actuales.
No habilitar funcionalidades inexistentes; contrato/fixtures no son endpoints implementados. Matriz autorizacion JWT no reemplaza RLS ni propiedad del objeto.
Decisiones marca/cartera/segregacion y confirmacion por vendedorJid no resueltas siguen limitadas y documentadas, sin conceder permiso expansivo.

## D3 — Webhooks y comprobacion integrada de seguridad
Contrato de credenciales por instancia/alcance y llamadas WF0->WF1/WF2 deben autenticarse. Cambiar definiciones n8n solo cuando se ejecute esta tarea explicita, conservar placeholders y no secretos/activaciones.
Separar credencial ingreso n8n de X-Api-Key hacia Spring y X-Api-Secret salienteWF3. Dos claves INGESTA/SCHEDULER para callback correcto.
Verificar errores y pruebas contrato, no llamadas externas automaticas. Transporte binario de voucher se define con MIG-04/05, no adivinar hash/path.
Cierre local MIG-03-D con pruebas; integracion real n8n/Auth/Storage no acreditada sin recorrido real.

## Orden posterior
Revisar y publicar D1 antes de D2/D3. AUTH-FE-01..04 sigue como bloque separado; requiere cuenta Auth y membresia local para real. MIG-03-E prueba Auth real; MIG-04 uploader; MIG-05 ingesta e idempotencia; MIG-06 revision; MIG-07 motor; MIG-08 aceptacion D-009. No cerrar requisitos por numero de tests.
