# Definición canónica de base de datos — KeptAI

ID: DB-DEF-001. Fecha: 10/10/2026. Responsable de esta definición: Miguel/Codex, por solicitud de Miguel. Responsable de implementación de datos/motor: Andrés; integración API: Miguel.

Estado: **definición técnica para desarrollar**, basada en las últimas instrucciones. El esquema físico vigente es V6 (25 tablas), aprobado por Miguel en D-008. Las extensiones de la sección 9 están definidas para implementación posterior y **todavía no existen en SQL**. No acredita aprobación de políticas comerciales de Corpotex ni despliegue remoto.

## 1. Qué prevalece
D-009 añade [seis validaciones obligatorias de cierre](validaciones-pre-supabase.md). V5/V6 se conservan como línea base; definir tablas no acredita la integridad del motor, la idempotencia HTTP ni el aislamiento con credenciales reales. Las seis condiciones permanecen abiertas hasta registrar evidencia por entorno.


**Necesidad por tabla:** [DB-MAP-001](../cerebro/conocimientos/decisiones/trazabilidad-tablas-mvp.md). Las 25 tablas son la base inicial aprobada por Miguel (D-008); contacto/nota_cliente se retiran mediante V6 solo si estan vacias; las extensiones de linea/centro siguen pendientes y no dependen de alcanzar una cantidad.

Leer esta definición antes de implementar entidades, consultas o nuevas migraciones. Las fuentes son [D-003 a D-007](../cerebro/conocimientos/decisiones/decisiones-del-proyecto.md), [Actores, flujos y DER](../cerebro/conocimientos/decisiones/actores-flujos-y-der-mvp.md), [idea de negocio](../cerebro/conocimientos/empresa/idea-negocio-replanteada.md) y el [contrato MIG-02](../Backend/docs/contrato-api.md).

Las últimas consideraciones son:
- Spring Boot es el único backend y conserva las reglas de crédito, conciliación, fechas y autorización.
- Supabase aporta PostgreSQL, Auth y Storage privado. MCP administra el proyecto; no sustituye la conexión de la aplicación.
- No hay ERP, CRM ni integración bancaria en el MVP. La demo usa datos ficticios identificados.
- Se guardan **vouchers y datos estructurados de negocio**. No conversaciones, mensajes completos, audios, transcripciones ni texto saliente.
- Cada orden tiene una sola obligación de cobro, sin cuotas; admite pagos parciales.
- Crédito de 15 a 30 días por orden. El vendedor decide; la mora genera aviso y registro de decisión, sin rechazo automático.
- Stock, cotizaciones y recompra pertenecen a fase 2. Costos, margen, cobranza y caja pertenecen al núcleo actual.
- El 80% y el significado del 30% siguen sin verificación empresarial; no son reglas ni datos iniciales del motor.

La sección DER histórica de Actores/flujos no sustituye el [DER físico vigente V9](../cerebro/diagramas/keptai-der-v9.md). Ante diferencias, contrastar migraciones/diccionario con esta definición y corregir mediante una migración nueva; no hacer que una contradicción desaparezca solo cambiando documentación.

## 2. Arquitectura de acceso

El frontend inicia sesión mediante Supabase Auth y envía el JWT a Spring. Spring valida firma, issuer, audience y vigencia, resuelve una membresía activa y accede por JDBC a PostgreSQL. Las operaciones de negocio no acceden directamente a tablas mediante Supabase Data API.

Esquemas:
- `keptai`: tablas y vistas de negocio, privadas para la API.
- `keptai_private`: funciones de resolución de identidad/contexto, fuera de esquemas expuestos.
- `auth`: identidad gestionada por Supabase; no duplicar contraseñas ni tokens en tablas de negocio.
- `storage`: objetos gestionados por Supabase; políticas distintas de las tablas de negocio.

Roles PostgreSQL: migrador propietario separado; `keptai_runtime` NOLOGIN como rol de permisos; login JDBC provisionado fuera de Git, miembro del runtime, sin propiedad, superuser ni BYPASSRLS. Ni postgres ni una service key del navegador son credenciales runtime.

El contexto es LOCAL a la transacción: `app.organizacion_id` más exactamente uno de `app.usuario_id` o `app.servicio_id`. También los GET abren transacción en la misma conexión. Spring determina esos valores tras autenticar; no se confía en UUID/rol enviados por el cliente. El pool no debe reutilizar contexto de otra organización.

## 3. Convenciones de datos

- Nombres SQL en español, snake_case. UUID para identidad; `orden.ref` es el código legible, no la PK.
- Organización es tenant. Toda tabla dependiente contiene `organizacion_id`; FK compuestas impiden cruzar empresas. Una marca no representa automáticamente una entidad legal/RUC.
- `usuario` es membresía: el mismo sub Auth puede tener varias organizaciones, cada una con rol y estado. Elegir solo entre membresías resueltas en servidor.
- Dinero: PostgreSQL numeric(18,2), Java BigDecimal y moneda ISO explícita. Panel: centavos enteros seguros para JavaScript; n8n: decimales en soles, según MIG-02. Conversión exacta, sin float ni redondeo implícito.
- Fechas de negocio date; eventos timestamptz. Zona por organización, inicialmente America/Lima. La mora usa la fecha local de negocio.
- null significa dato ausente; cero significa un importe conocido de cero cuando la regla lo admite. No fabricar cliente, total, vencimiento ni costo.
- Estados como text + CHECK y enums Java con mapeo explícito. No mezclar estado productivo con fase de verificación del pago.

## 4. Las 25 tablas vigentes

Campos, nulabilidad, PK/FK y restricciones completos: [diccionario V5](diccionario-datos.md). Este listado fija el propósito de cada tabla.

### Identidad y clasificación
1. `organizacion`: tenant, moneda y zona.
2. `usuario`: membresía Auth, rol, JID y activo.
3. `marca`: clasificación comercial del pedido.
4. `linea_producto`: clasificación de cada ítem.
5. `integracion_servicio`: instancia/alcance INGESTA o SCHEDULER, clave hash y activo. Solo provisionador escribe; no guardar clave en claro.

### Cliente, origen y venta
6. `cliente`: identidad comercial y referencia de límite; mora calculada en vista.
7. `canal_whatsapp`: instancia/JID, cliente/vendedor cuando se identifican; solo metadatos.
8. `orden`: cliente, marca, vendedor, canal, condición, importe, moneda, producción y estado; versión para concurrencia y cierre de costos.
9. `orden_item`: prendas/especificación, cantidad, precio unitario y línea.
10. `hoja_resumen`: extracción estructurada permitida, versión, confianza, campos ausentes y revisión humana. No transcript ni cuerpo original.
11. `aprobacion_credito`: una decisión por orden, vendedor, saldo de referencia, aviso de mora, plazo y anticipo.

### Cobranza y evidencia
12. `obligacion_cobro`: una por orden, monto/moneda, plazo, vencimiento y estado.
13. `pago`: recibido/verificado/aplicado, monto, cliente identificado o null, medio, referencia y duplicado de otro pago.
14. `comprobante`: voucher asociado a un pago, ruta privada, SHA-256, OCR estructurado, confianza y evento proveedor.
15. `aplicacion_pago`: vínculo pago-obligación e importe; corrección por anulación y nueva aplicación.
16. `alerta_cobranza`: obligación o pago, regla, responsable y resolución.
17. `envio_notificacion`: destino, referencias, programación, reintentos y resultado proveedor; sin texto.

### Producción y finanzas
18. `unidad_produccion`: taller interno o tercero.
19. `orden_etapa`: orden, unidad/responsable, corte/sublimado-confección-calidad, estado y merma.
20. `despacho`: una acta/fecha por orden en V5; fecha inicial del plazo.
21. `costo_orden`: costo REAL o TEORICO, concepto, fuente, moneda y etapa opcional.
22. `apertura_caja`: saldo inicial por fecha/moneda, con fuente.
23. `egreso_caja`: salida prevista/realizada/anulada, con fechas e importe.

### Trazabilidad operativa
24. `evento_auditoria`: actor, entidad, operación, request_id y cambios de negocio mínimos; append-only.
25. `solicitud_idempotente`: PK organización/operación/clave, hash y respuesta estructurada segura. No cuerpo del chat.

## 5. Relaciones y ciclo transaccional

Cliente tiene muchas órdenes y varios contactos de WhatsApp (V10, D-011): `contacto` (organización, cliente, nombre, JID canónico único por organización, activo) identifica al cliente que escribe; `canal_whatsapp.contacto_id` liga el canal a su contacto. No existía tabla contacto en V6 (se reintroduce por dirección de producto, no por conteo). Orden tiene muchos ítems/resúmenes/etapas/costos, cero o una aprobación y cero o una obligación/despacho. El borrador puede existir antes de crear la obligación.

Pago tiene muchos comprobantes y aplicaciones; obligación recibe muchas aplicaciones. Un pago puede cubrir varias obligaciones del **mismo cliente, tenant y moneda**. Un pago sin cliente u orden identificados permanece en revisión, sin reducir saldos.

Secuencia:
1. WF1 crea BORRADOR con campos conocidos y resumen permitido; revisión humana completa faltantes.
2. Confirmación establece cliente, condición y total positivo. Spring verifica consistencia total/ítems; SQL no acredita por sí solo esa suma.
3. Crear la única obligación por el total confirmado **antes de aplicar anticipos**; vence_en permanece null hasta despacho. Así no hay un ciclo imposible entre anticipo y liberación.
4. Si es crédito, vendedor registra decisión, plazo 15–30 y aviso ante mora. /ok no equivale a aprobar crédito.
5. WF2 crea pago RECIBIDO y voucher; OCR no verifica fondos.
6. Administración verifica en banco y aplica. Bloquear pago y luego obligación; verificar saldo, duplicado, cliente y moneda; aplicación, auditoría, estados y alertas se confirman juntos.
7. Producción se libera con crédito aprobado o contado/anticipo **verificado y aplicado a esa orden**.
8. Despacho fija vence_en = fecha_despacho + plazo_dias; Spring mantiene la transacción coherente con acta y obligación.
9. Corrección de aplicación: anular con autor/motivo/fecha y registrar nueva; recalcular estados/saldos en la misma transacción.

Cancelaciones tras producción, cambios de total con aplicaciones y reversos bancarios necesitan flujo explícito del motor. No borrar pagos/aplicaciones ni modificar el total para cuadrar reportes. El esquema V5 no implementa una política completa de devolución.

## 6. Saldos, margen y caja

`v_saldo_obligacion`: saldo = monto de obligación − aplicaciones vigentes. Pago recibido, duplicado y promesa no reducen deuda. `v_cliente_mora`: solo saldo positivo con vencimiento anterior a la fecha local; no un booleano manual de cliente.

`v_margen_orden`: margen_venta_real = venta − costos reales cerrados; margen_real_cobrado = aplicado − costos reales cerrados. Son indicadores distintos. Con costos incompletos ambos quedan null. Cambiar un costo invalida su cierre. El cierre requiere una acción explícita, autor y auditoría en Spring.

Marca: agregar ventas/costos/márgenes por marca y moneda, sin inventar clasificación. Línea: ventas salen de ítems; **no replicar el costo total del pedido en cada línea**. La extensión de la sección 9 define asignación cuando hay varias líneas.

Caja de cuatro semanas: saldo inicial a fecha de corte + cobros previstos + egresos previstos, por día/semana y moneda. Los escenarios no crean pagos ni cambian deuda. Sin apertura o supuestos suficientes, mostrar incompleto.

Distinguir conciliación de caja bancaria: un ingreso verificado todavía no aplicado existe en caja, aunque no reduzca deuda. Para reportar caja realizada, contar pagos verificados no duplicados por fecha_pago una sola vez; no excluir huérfanos verificados ni sumar además sus aplicaciones. Al proyectar, usar una apertura conciliada a la fecha de corte y solo movimientos posteriores; restar del cobro futuro únicamente lo aplicado. Señalar dinero sin asignar para evitar proyectar ingresos ya recibidos como nueva recuperación garantizada. No hay vista de caja ejecutable en V5: estas consultas corresponden al motor de Andrés.

## 7. RLS y autorización

V4 aplica aislamiento por organización e identidad activa; sin contexto, identidad inválida o identidad dual no hay acceso. No hay DELETE runtime. Las vistas usan security_invoker. Las funciones bootstrap privadas tienen search_path fijo y EXECUTE limitado.

Permisos SQL actuales (V4 + V7), que Spring debe restringir además por recurso/campo:
- Catálogos/organización/membresías: lectura según actor; alta/configuración por provisionador.
- VENDEDOR: órdenes, resúmenes, cliente/canal y **única decisión de crédito** (firmada por sí mismo); no verificar/aplicar pagos, no certificar costeo, no leer caja.
- ADMIN: verificar/aplicar/anular pagos, caja y revisión; también gestiona producción y certifica costeo. No decide crédito (D-005).
- JEFE_TALLER: etapas, costos y despacho; ve solo órdenes liberadas y auditoría de producción; sin pagos, vouchers, margen ni clientes.
- GERENTE: consulta total; no escritura de negocio.
- INGESTA: captura; orden, ítems y resumen solo en BORRADOR, pago solo RECIBIDO; sin crédito, caja, obligaciones ni aplicaciones.
- SCHEDULER: alertas y metadatos de envío, nunca verificación/aplicación.
- Autoría (`*_por`, `evento_auditoria.usuario_id`): siempre el usuario autenticado; los servicios no firman como personas.
- Padres financieros: con aplicaciones vigentes, pago/obligación/orden no cambian importe, cliente, moneda ni anulación; primero se anula la aplicación.
- Auditoría: INSERT sin UPDATE; idempotencia requiere actualización del resultado por actores autorizados.
- integracion_servicio: sin lectura directa runtime; bootstrap privado por hash.

Las políticas no restringen las lecturas del vendedor a sus pedidos o marca (decisión pendiente, ver DB-REV-003) ni implementan la máquina de estados de orden. Esas restricciones van en Spring; RLS no equivale a autorización completa de la API. Análisis de roles: [revisión V7](revision-sql-rls.md).

## 8. Voucher y no retención

Bucket `keptai-vouchers` privado: JPEG/PNG/PDF, máximo 10 MiB. Ruta canónica `<organizacion_uuid>/<pago_uuid>/<comprobante_uuid>.<extension>`; objeto nuevo por corrección, sin overwrite. En DB guardar ruta y hash, no URL firmada persistente ni imagen base64.

Storage permite lectura ADMIN/GERENTE y carga ADMIN con sesión válida; anonimato, overwrite y DELETE bloqueados. Storage no usa automáticamente los GUC JDBC. Ver [políticas](supabase/vouchers_storage.sql).

Para WF2 queda definido un uploader **servidor de Spring**, nunca una clave privilegiada en n8n/navegador. Autentica servicio INGESTA, deriva tenant/pago, comprueba MIME real/tamaño y genera ruta; carga mediante credencial servidor en secreto cuando no hay sesión ADMIN. Ese acceso privilegiado omite RLS: Spring valida tenant y operación antes de llamar. Implementación y prueba remota pendientes, no conceder carga pública como atajo.

Storage y PostgreSQL no comparten transacción: reservar IDs, cargar objeto inmutable, registrar comprobante/pago idempotentemente; ante fallo registrar metadatos mínimos para limpiar objetos huérfanos mediante proceso administrativo acotado. No dejar una referencia que simule archivo disponible si upload falló.

Permitir únicamente campos estructurados conocidos en extracción, OCR, resumen, auditoría y respuestas idempotentes. El CHECK V4 solo bloquea ciertas claves superiores; no prueba ausencia de contenido anidado. Aplicar proyección/validación en Spring y excluir cuerpos en logs. n8n debe evitar guardar cuerpos de ejecución y configurar poda; la IA procesa texto/audio de manera transitoria.

## 9. Extensiones definidas que aún faltan en SQL

No se crean automáticamente en esta entrega documental ni se representan como existentes en el DER V6. Son necesarias antes de declarar completos margen por línea y centro de resultados.

### Asignación de costos por ítem
Nueva `asignacion_costo_item`: id/organizacion_id UUID, costo_id FK, orden_item_id FK, monto numeric(18,2), moneda char(3), metodo text, fuente text, registrado_por FK, creado_en timestamptz. UNIQUE(organizacion_id,costo_id,orden_item_id).

Reglas: costo e ítem de la misma orden, organización y moneda; importe no negativo; suma de asignaciones no supera costo. Para certificar margen por línea, la suma debe cubrir exactamente cada costo incluido y los ítems deben tener línea. Método explícito manual, unidades o valor de venta, registrado sin asumir que uno sea política empresarial. Prorrateos en centavos con residuo determinista, nunca pérdida de céntimos. Correcciones invalidan cierre del costeo; transacción bloquea costo y orden. RLS: ADMIN/JEFE_TALLER escritura, GERENTE lectura; resto denegado salvo decisión posterior. Índices tenant+costo y tenant+ítem.

### Producción como centro de resultados
Nueva `transferencia_interna`: id/organizacion_id UUID, orden_id FK, unidad_origen_id FK, monto numeric(18,2), moneda char(3), criterio/fuente text, registrado_por FK, creado_en timestamptz, anulada_en/anulada_por/motivo_anulacion. Origen debe ser TALLER_INTERNO; importe no negativo, moneda de orden. Destino lógico: operación comercial de esa orden; no inventar otra empresa ni otro RUC.

Una transferencia activa por (organizacion_id,orden_id,unidad_origen_id), índice UNIQUE parcial; corrección por anulación y nueva versión. No es pago, obligación de cliente, factura fiscal ni ingreso de caja. RLS ADMIN escritura y ADMIN/GERENTE lectura; auditoría obligatoria. Al certificar resultado de una unidad, sus costos deben estar asignados a ella mediante etapa, sin doble conteo de costos compartidos; si no se conoce unidad/método, resultado incompleto.

Resultado taller = transferencia interna − costos reales de esa unidad; resultado comercial = venta − transferencias internas − costos comerciales externos. Consolidado = venta externa − todos los costos reales externos, eliminando transferencias internas. Para el ejemplo ficticio de P-001: venta 300, costo taller 340, transferencia 320 → taller −20, comercial −20, consolidado −40. Con varios talleres, sumar sin duplicar costos.

La implementación deberá agregar migraciones posteriores a V6, diccionario, RLS, pruebas y DER nuevos. No reescribir V1–V6 ni llamar entregado a este módulo.

### Fuera de la base inicial
Stock, cotización y recompra: fase 2. Enlace público de estado de cuenta, configuración de escenarios persistida y exportación contable requieren contrato/alcance propios; por ahora no existe token público y el estado de cuenta se consulta autenticado. No dar SELECT anónimo a cliente/orden/obligación.

## 10. Índices y consultas

Usar índices V5: pedidos/pagos por (organizacion_id,creado_en DESC,id DESC), vencimientos pendientes con fecha, outbox pendiente por tenant/fecha/id y aplicaciones vigentes por pago/obligación. Evitar OFFSET creciente; cursor usa fecha + UUID. No indexar ni persistir una copia del saldo calculado.

Consultas de reportes filtran tenant, período y moneda antes de agregar. No sumar PEN/USD. Locks de lote mantienen orden estable de UUID; reintento de transacción completo para deadlock/serialization failure. Medir EXPLAIN ANALYZE BUFFERS con semilla y volumen representativo antes de añadir índices. No particionado, vector DB ni otro motor por necesidad hipotética.

## 11. Migración e integración

Guia ejecutable: [base local DB-LOCAL-001](local/README.md). D-008 aprueba V6; V1-V5 quedan intactas. V6 aborta ante contactos/notas existentes o dependencias ajenas. PostgreSQL local en 127.0.0.1:5433; perfil Spring local separado de dev. Auth/Storage completos locales no instalados.

Fuente SQL única: `BD/migrations/`, Flyway V1→V6. Supabase Storage se aplica aparte. Hibernate validate; Flyway runtime apagado; release usa migrador separado con schemas/defaultSchema keptai.

Antes de remoto: inventariar historial, esquema, datos, propietarios/grants y políticas mediante MCP. V4 aborta si hay mensajes previos o schema incorrecto; resolver explícitamente antes de aplicar. Sin repair/purga automática.

Después provisionar secreto JDBC/Auth/Storage en entorno; publicar solo .env.example sin valores privados. Verificar conexión real, JWT, contexto, dos tenants y uploader. Esta documentación no crea .env ni modifica Supabase.

## 12. Entregables y orden de trabajo

1. MIG-03/Miguel: JWT/API key, resolver membresía/servicio, contexto por transacción, autorización API y aislamiento desde Spring. No implementar pagos antes de ese perímetro.
2. Andrés: mapear entidades y motor sobre V6, crear semilla opt-in y servicios con firmas alineadas al contrato. Apertura/egresos y cálculo de caja con fecha de corte explícita.
3. Miguel/Andrés: WF2 uploader y asociación comprobante/pago, reintentos, cleanup acotado y no retención.
4. Motor: confirmar orden/obligación, crédito, verificar/aplicar/anular, liberación y despacho; estado/auditoría/alertas atómicos.
5. Costeo: cierre explícito y consultas de pedido/marca; implementar extensiones de sección 9 antes de cerrar línea/centro de resultados.
6. Germán/Isabella: consumir DTOs; indicar pendiente, incompleto, duplicado y margen negativo correctamente. No calcular saldo confiable en navegador.

Aceptación: pago recibido no reduce deuda; duplicado no aplica; parcial correcto; mismo reintento no duplica; conflicto cambia contenido→409; concurrencia no sobreaplica; fallo revierte aplicación/auditoría; tenant ajeno sin filas/archivos; contexto ausente/reutilizado seguro; anticipo recibido no libera; crédito con aviso de mora; vencimiento desde despacho; costo incompleto no genera margen; transferencias eliminadas al consolidar; caja no duplica pago/aplicación; sin transcript en tablas, logs, Storage o n8n. Pruebas locales previas no sustituyen prueba remota ni acreditan nuevas extensiones.

## 13. Evidencia y referencias

Esquema/diccionario/DER V6 estan locales; V5 es antecedente. La bitácora registra las pruebas SQL anteriores; esta entrega define y organiza el diseño, sin repetir tests de código ni declarar nuevas rutas operativas.

Fuentes técnicas consultadas: [grants y RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [políticas Storage](https://supabase.com/docs/guides/storage/security/access-control) y [RLS de PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html). Fundamentan los mecanismos, no la configuración del proyecto remoto.


## V10 — contacto de WhatsApp y asociación contextual (D-011, 11/10/2026)
- **`contacto`**: `id`, `organizacion_id`, `cliente_id` (FK compuesta organización+cliente), `nombre`, `whatsapp_jid` (CHECK `^[0-9]{5,20}@s\.whatsapp\.net$`: sin dispositivo, sin `@lid`, sin grupos), `activo`, `creado_en`. UNIQUE (organización, jid). Solo metadatos de enrutamiento: ningún mensaje, nota ni texto. Un contacto NO es vendedor, tenant ni usuario de Auth.
- **RLS/grants**: lectura humana (VENDEDOR, ADMIN, GERENTE); INGESTA lee solo contactos ACTIVOS de su organización y no los crea ni modifica; alta/cambio solo ADMIN (la provisión demo usa el migrador, `Backend/scripts/provisionar-contacto-local.sh`); runtime sin DELETE; `anon`/`authenticated`/`service_role` sin acceso.
- **Integridad**: `canal_whatsapp` (organización, contacto, cliente, chat_jid) → `contacto`; `orden` (organización, canal, cliente) → `canal_whatsapp`; `pago` (organización, canal, cliente) → canal y (organización, `orden_contexto_id`, cliente/canal) → `orden`; CHECK: una orden de contexto exige cliente y canal. Los cruces entre organizaciones, clientes, contactos y canales fallan en SQL.
- **`pago.orden_contexto_id`**: último pedido no cancelado del contacto al registrar el voucher; NO es `aplicacion_pago`, no verifica fondos ni cambia saldos. Sin pedido elegible: `estado_conciliacion = SIN_ORDEN`.
- **Pendiente**: aplicar V10 a la base local activa (hoy en V7; requiere V8/V9) y validar el esquema remoto; vendedor del contacto/cartera sin decidir.
