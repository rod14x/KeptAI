# Revisión SQL, RLS y consultas — DB-REV-002

D-009: aplicar las [seis validaciones de cierre](validaciones-pre-supabase.md). La revisión y el diccionario describen la base; no acreditan aceptación integral ni aislamiento remoto.

DER visible del SQL local: [tres láminas PNG y fuente editable](../cerebro/diagramas/keptai-der-v6.md).

Actualizacion D-008: V6 deja 25 tablas y excluye contacto/notas solo si vacias. La revision V4-V5 siguiente sigue explicando sus mecanismos; el indice de contacto es antecedente retirado en V6. [Guia local](local/README.md).

Fecha: 10/10/2026. Autor: Miguel/Codex. Fuentes obligatorias: [Actores, flujos y DER](../cerebro/conocimientos/decisiones/actores-flujos-y-der-mvp.md), [D-007](../cerebro/conocimientos/decisiones/decisiones-del-proyecto.md), V1–V3 de Andrés y workflows reales de n8n. Usuario pide conservar vouchers, sin mensajes. Revisión ejecutada sobre archivos del repo; no sobre Supabase remoto.

## Fallos identificados y corrección

1. V1 conservaba MENSAJE, archivos de chat y texto de mensajes salientes. V4 elimina contenido y mantiene exclusivamente metadatos de enrutamiento/notificación; comprobante ya no depende de mensaje.
2. V2 permitía todos los comandos por contexto de organización y políticas TO PUBLIC. V4 exige identidad activa y aplica políticas de SELECT/INSERT/UPDATE separadas solo al runtime, sin DELETE; bootstrap y claves de servicio no son públicos. La app sigue siendo el perímetro de JWT y autorización por campo.
3. No había resolución de membresía antes del contexto RLS. Funciones privadas definer con search_path fijo resuelven únicamente membresías activas y servicios por hash; EXECUTE solo runtime, fuera de Data API. No aceptar UUID del cliente como autenticación.
4. Una extracción incompleta no cabía en orden. V4 permite null en BORRADOR, sin inventar cero ni cliente; fuera de borrador exige datos mínimos.
5. El trigger antiguo se ejecutaba solo al cambiar importe/anulación; cambios en pago/obligación podían eludir validación. V5 valida toda inserción/actualización y hace inmutable la aplicación. Corregir es anular con motivo y registrar otra; no borrar.
6. Faltaban validaciones de duplicado, cliente, obligación anulada y moneda de costo. V5 las impone, con FK compuestas y locks padre.
7. Costos ausentes se convertían en cero, mostrando margen falso. V5 añade cierre explícito y distingue margen por venta y sobre cobrado; un nuevo costo invalida cierre.
8. El gate de producción estaba únicamente en prosa. SQL rechaza liberación sin crédito aprobado o contado/anticipo verificado **y conciliado con esa orden**; voucher solo recibido no libera.
9. Índice de outbox global no priorizaba organización. Se sustituye por (organizacion_id,programado_para,id) WHERE PENDIENTE; no escanear todos los tenants con un runtime de uno solo. Scheduler obtiene lista autorizada de organizaciones y abre una transacción por organización.

## Consultas y optimización

- Lista de pagos/pedidos: cursor compuesto (creado_en,id) descendente, no OFFSET creciente. Índices tenant + timestamp + id.
- Vencimientos: tenant + vence_en + id parcial para estados pendientes y fecha conocida. No indexar saldo calculado ni mantener otro saldo persistido.
- Aplicaciones vigentes: índices parciales originales por pago y obligación con anulada_en IS NULL; las sumas añaden tenant explícito. Locks siempre pago y después obligación; en lotes ordenar UUID para reducir deadlocks. Si hay deadlock o serialization failure, reintentar toda transacción con idempotencia.
- FK frecuentes reciben índices tenant + referencia; no crear un índice por columna sin ruta de consulta. Los catálogos pequeños usan UNIQUE ya existentes.
- Vistas security_invoker conservan RLS; filtrar organización y período antes de informes amplios. No usar una vista materializada global sin diseño adicional de aislamiento.
- Prueba real con 10 000 pagos ficticios: EXPLAIN ANALYZE BUFFERS verifica elección ix_pago_reciente para listado por tenant LIMIT25. No es benchmark de Supabase ni acredita SLA.

## Aplicación en Supabase

1. MCP: inspeccionar historial Flyway, esquema real, propietarios, grants, RLS, funciones y datos. No asumir que lo versionado ya está desplegado.
2. V4 exige esquema privado keptai y aborta si hay mensajes previos. En ese caso revisar política de eliminación y preparar limpieza autorizada; no purga automática ni CASCADE. No modificar V1–V3 ni ejecutar Flyway repair para ocultar diferencias.
3. Migrador propietario separado; crear login runtime fuera de Git, miembro keptai_runtime, sin superuser/propiedad/BYPASSRLS. Nunca usar service_role ni postgres como JDBC runtime.
4. Contexto local en transacción: app.organizacion_id + exactamente uno de app.usuario_id/app.servicio_id. Misma conexión, incluye GET, commit/rollback limpia contexto. GUC no es autenticación: solo Spring confiable debe poder ejecutar como runtime después de validar JWT/API key.
5. Ejecutar [Storage](supabase/vouchers_storage.sql) en el proyecto después de inspeccionar políticas. Bucket privado, prefijo UUID organización, lectura ADMIN/GERENTE y carga ADMIN por JWT. Políticas restrictivas impiden que otras permisivas abran este bucket; no permiten sobrescribir/borrar. No usar service key en navegador (bypassa RLS).
6. Verificar realmente upload/read/URL firmada y acceso cruzado. Test local usa catálogos emulados, no reproduce todo Supabase Storage. Si la ingestión n8n carga sin sesión ADMIN, falta diseñar credencial/uploader del servidor; no declarar resuelto ese acceso.
7. n8n procesa mensajes transitoriamente: desactivar guardado de ejecuciones con cuerpos y configurar poda. El límite de no-retención también aplica a logs Spring, auditoría, respuestas idempotentes y proxies.

## Pruebas y límites

SchemaRlsTests ejecuta Flyway V1–V5 y políticas con rol runtime no dueño, ausencia/mal contexto, dos organizaciones, connection reuse/commit/rollback, escrituras cruzadas y FK, append-only, pago recibido, duplicado, sobreaplicación concurrente, costos y plan de consulta. Pruebas Storage emuladas validan anonimato, tenant, insert y bloqueo overwrite/delete aun con política permisiva de control. Resultado final en estado.md; no garantiza JWT real ni aislamiento remoto hasta MIG-03.

## Referencias técnicas primarias

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): grants, políticas y roles privilegiados; los propietarios/BYPASSRLS requieren cuidado.
- [Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control): políticas de storage.objects separadas de las de negocio y claves privilegiadas.
- [Seguridad de datos Supabase](https://supabase.com/docs/guides/database/secure-data): esquemas y acceso vía backend.
