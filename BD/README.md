# KeptAI — Base de datos vigente (V9)

**Punto de entrada para desarrollar:** [Definicion canonica DB-DEF-001](definicion-base-datos.md). Alcance, 27 tablas V5, RLS, transacciones, vouchers y extensiones pendientes para margen por linea/centro.

Revisión de Miguel/Codex, 10/10/2026, basada en Actores/flujos/DER, D-005 y D-007. V1–V3 originales de Andrés se conservan como historial; **V4/V5** corrigen el modelo. Supabase conectado por MCP según Miguel; este trabajo no verifica ni modifica el remoto.

## Archivos y ejecución
- [Validaciones pre-Supabase (DB-VAL-001)](validaciones-pre-supabase.md): seis condiciones obligatorias de D-009, casos mínimos, responsables y evidencia. Todas siguen abiertas; migrar en local no equivale a cerrar el esquema.


- [Guia local](local/README.md): Docker, Flyway, 127.0.0.1:5433 y perfil Spring local.
- [Semilla demo](semilla/semilla_demo.sql) (Andrés, roadmap §6): datos **ficticios** reiniciables con los mismos UUID e importes de `Backend/docs/openapi.yaml`. Incluye P-001 (propia, costo 340, margen −40) y P-002 (tercerizada, costo 350, margen 150), V-001/V-002 aplicados y V-003 duplicado, saldo 400, mora, alertas, caja (apertura 100, egresos 250/300) y una segunda organización para probar aislamiento. Cargar con `./BD/local/db.sh seed` sobre V7. Solo borra y recrea organizaciones `DEMO …`, exige `SET keptai.permitir_semilla='demo'` y no crea comprobantes sin archivo. Incluye costos por etapa, asignaciones por ítem y el cargo interno de 320 (V9). Falta `display_code` de pagos (no hay columna). Pruebas: `SemillaDemoTests` y `RecorridoDemoTests`. **Cargada también en Supabase** (11/10/2026, mismas cifras verificadas).
- [V10](migrations/V10__obligacion_al_aprobar_credito.sql) (INT-FE-API-001, 11/10/2026, **pendiente de revisión de Andrés**): `keptai_private.crear_obligacion_orden(orden)` DEFINER para que la obligación de cobro nazca cuando el vendedor aprueba el crédito o confirma el contado (brecha H1: VENDEDOR no escribe `obligacion_cobro` por RLS). Solo VENDEDOR/ADMIN de su organización, una por orden, idempotente. Sin tablas ni columnas nuevas. **Aplicada solo en local; no en Supabase** (aplicarla con Flyway antes de usar el panel contra la base remota).
- [Escenarios demo](semilla/semilla_escenarios.sql) (INT-FE-API-002, opcional, datos ficticios): la misma demo del frontend sobre la semilla base — P-003..P-012 históricos (producidos, despachados, varios cobrados, P-007/P-011 en mora), P-013/P-015 por decidir, P-014 retenida por anticipo, P-016 en producción; vouchers V-012..V-014 por revisar, alertas, envíos WF3, caja y auditoría. Renombra clientes, usuarios y líneas de la base y agrega a Luis (segundo vendedor, `link-auth VENDEDOR2`). `./BD/local/db.sh seed-escenarios` después de `seed`.
- [V9](migrations/V9__asignacion_costos_transferencia_interna.sql) (Andrés, AND-RESULTADOS-001): `asignacion_costo_item` (reparto de costos por ítem, C-05) y `transferencia_interna` (cargo interno del taller, C-06), con RLS, autoría e invariantes. Queda en 27 tablas. **Aplicada en local y en Supabase** (historial Flyway con el mismo checksum).
- [V8](migrations/V8__despacho_vencimiento_cobranza.sql) (Andrés, AND-COBRANZA-001): el despacho fija el vencimiento (D-005). Trigger DEFINER: orden liberada o en producción → DESPACHADA y `vence_en = fecha_despacho + plazo`; el acta no cambia de fecha ni de orden. Añade `keptai_private.actualizar_estados_cobranza()` (solo ADMIN o SCHEDULER de su organización) para recalcular MORA, PAGADA, etc. Sin tablas ni columnas nuevas. **Aplicada en local y en Supabase** (historial Flyway con el mismo checksum).
- [V7](migrations/V7__autorizacion_critica.sql): DB-REV-003. Crédito solo VENDEDOR, autoría no suplantable, padres financieros congelados con aplicaciones vigentes, INGESTA limitada a borradores y lecturas por mínimo privilegio. Sin cambios de tablas. Ver [revisión](revision-sql-rls.md).
- [V6](migrations/V6__mvp_25_tablas.sql): aprobacion D-008, 25 tablas; excluye contacto/notas solo si estan vacias, sin CASCADE.

- migrations/V1__esquema_inicial.sql, V2__rls_organizacion.sql y V3__nota_cliente.sql: originales, no reescribir checksums.
- [V4](migrations/V4__vouchers_contexto_y_rls.sql): vouchers sin mensajes; borradores incompletos; contexto usuario/servicio, bootstrap privado y RLS/grants separados.
- [V5](migrations/V5__integridad_financiera_indices.sql): aplicación inmutable, duplicados, gate de producción, cierre de costos y consultas/indexación.
- [Storage Supabase](supabase/vouchers_storage.sql): bucket privado y políticas independientes; se aplica aparte después de verificar el proyecto.
- [Revisión y operación](revision-sql-rls.md) y [diccionario](diccionario-datos.md).

Un solo historial Flyway: ubicación canónica `BD/migrations/`, no copiar manualmente a otro directorio. El paso de release usa rol migrador propietario, `schemas=keptai`, `defaultSchema=keptai`, `locations=filesystem:BD/migrations` desde raíz. En tests Maven, ruta `filesystem:../BD/migrations`. Runtime: Flyway desactivado, Hibernate validate, conexión al esquema keptai.

V4 requiere permiso CREATE ROLE para crear keptai_runtime NOLOGIN (sin contraseña). Provisionar fuera de Git un login JDBC miembro de ese rol; no usar postgres ni migrador para la app. Si el historial remoto está en public o ya hay mensajes, V4 aborta: inspeccionar/migrar/purgar con procedimiento explícito, no repair ni drop automático.

## DER visible

Las imágenes se ven sin soporte Mermaid. [Abrir las tres láminas y la fuente editable (V9, 27 tablas)](../cerebro/diagramas/keptai-der-v9.md). El [DER V6](../cerebro/diagramas/keptai-der-v6.md) se conserva como antecedente.

### Pedidos, vouchers y cobranza

![DER V9: Pedidos, vouchers y cobranza](../cerebro/diagramas/keptai-der-v9-01.png)

### Catalogo, produccion y costos

![DER V9: Catalogo, produccion y costos](../cerebro/diagramas/keptai-der-v9-02.png)

### Organizacion, identidad y soporte

![DER V9: Organizacion, identidad y soporte](../cerebro/diagramas/keptai-der-v9-03.png)

## Modelo vigente

[Mapeo individual de las 27 tablas a fuentes y requisitos](../cerebro/conocimientos/decisiones/trazabilidad-tablas-mvp.md): 16 nucleo, 6 flujo vigente, 3 soporte tecnico y 2 opcionales. No todas las tablas son exigencias explicitas de la empresa ni tienen que tener una pantalla.

Se guardan datos de negocio y vouchers privados. No se guardan mensajes, transcript, audios ni imágenes generales. `canal_whatsapp` identifica origen; `envio_notificacion` conserva solo entrega/idempotencia y no texto. Una sola `obligacion_cobro` por orden; varios pagos parciales posibles. Cliente y total pueden faltar en BORRADOR, nunca tras confirmación.

RLS para el rol runtime exige organización e identidad activa de usuario o servicio. `resolver_usuario`/`resolver_servicio` están en esquema privado, sin EXECUTE público. El JWT se valida en Spring antes del bootstrap. Data API no tiene acceso a negocio; Storage puede usar JWT del administrador con políticas propias.

La vista diferencia margen_venta_real y margen_real_cobrado. Un costo ausente/incompleto devuelve null; cualquier cambio de costo invalida su cierre previo. Spring mantiene la transacción aplicación + auditoría + alertas; SQL refuerza invariantes sin reemplazar el motor de Andrés.

## Verificar localmente

Desde Backend/: `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./mvnw -o test -Dtest=SchemaRlsTests`. Docker debe responder. Testcontainers aplica V1–V7 en PostgreSQL 17 efímero y elimina el contenedor al terminar. No requiere .env ni proyecto remoto. El test Storage usa catálogos mínimos emulados: acredita SQL/políticas, no el servicio Supabase real.
