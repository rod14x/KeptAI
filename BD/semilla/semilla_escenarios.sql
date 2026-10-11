-- KeptAI - Escenarios de demostración amplios (INT-FE-API-001/002). OPCIONAL y aparte de semilla_demo.sql.
-- DATOS FICTICIOS: no son registros de Corpotex; nombres inventados (los mismos de la demo del frontend).
-- Se aplica DESPUÉS de semilla_demo.sql sobre la organización DEMO A (BD/local/db.sh seed-escenarios). Reiniciable:
-- db.sh seed borra ambas capas. Todo pasa por los triggers reales (crédito, gate de producción, despacho V8, costeo V9,
-- validación de aplicaciones): el motor calcula saldos, mora, márgenes y caja sobre estas filas.
--
-- P-001 y P-002 (y V-001..V-003) son los de la semilla base con las mismas cifras del reto; aquí solo cambian nombres,
-- vendedor de P-002 e ítems (mismos totales). Los totales de gerencia cambian porque hay más pedidos.
--   P-003..P-012  históricos: crédito aprobado por el vendedor, producidos, despachados; varios cobrados (pagos de la
--                 carga de historial, sin comprobante digitalizado), P-007 y P-011 en mora, P-009 por vencer.
--   P-013, P-015  por decidir (WhatsApp); P-013 de un cliente en mora: el vendedor ve el aviso, la mora no bloquea.
--   P-014         retenida: anticipo 50 % pendiente; su voucher V-014 llegó y espera verificación.
--   P-016         liberada y en producción: el jefe de taller registra el despacho.
--   V-012 sin cliente identificado, V-013 abono parcial de Club Deportivo Tallán, V-014 anticipo de P-014.
BEGIN;
SET LOCAL search_path = keptai;

DO $$ BEGIN
 IF current_setting('keptai.permitir_semilla', true) IS DISTINCT FROM 'demo' THEN
  RAISE EXCEPTION 'Semilla bloqueada: ejecutar con SET keptai.permitir_semilla = ''demo'' (db.sh seed-escenarios lo hace)';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM keptai.flyway_schema_history WHERE version = '11' AND success) THEN
  RAISE EXCEPTION 'Los escenarios requieren el esquema V11';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM keptai.orden WHERE id = 'a0000000-0000-4000-8000-000000000002'
                AND organizacion_id = '10000000-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'Primero cargar semilla_demo.sql (db.sh seed)';
 END IF;
 IF EXISTS (SELECT 1 FROM keptai.orden WHERE id = 'a0000000-0000-4000-8000-000000000003') THEN
  RAISE EXCEPTION 'Los escenarios ya están cargados: ejecutar db.sh seed para reiniciar y luego seed-escenarios';
 END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------- personas
UPDATE usuario SET nombre = 'Rosa Chunga'     WHERE id = '70000000-0000-4000-8000-000000000001';  -- VENDEDOR Corpotex
UPDATE usuario SET nombre = 'Carmen Ramos'    WHERE id = '70000000-0000-4000-8000-000000000002';  -- ADMIN
UPDATE usuario SET nombre = 'Patricia Zapata' WHERE id = '70000000-0000-4000-8000-000000000003';  -- GERENTE
UPDATE usuario SET nombre = 'Jorge Ipanaqué'  WHERE id = '70000000-0000-4000-8000-000000000004';  -- JEFE_TALLER
INSERT INTO usuario (id, organizacion_id, auth_user_id, nombre, email, rol) VALUES
 ('70000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000005',
  'Luis Yarlequé', 'luis.yarleque.demo@keptai.invalid', 'VENDEDOR');                                  -- VENDEDOR Unicrack

-- ---------------------------------------------------------------------------------------------------- catálogo
UPDATE linea_producto SET nombre = 'Profesional' WHERE id = '14000000-0000-4000-8000-000000000001';
UPDATE linea_producto SET nombre = 'Deportivo'   WHERE id = '14000000-0000-4000-8000-000000000002';
INSERT INTO linea_producto (id, organizacion_id, nombre) VALUES
 ('14000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Escolar');

-- ---------------------------------------------------------------------------------------------------- clientes
UPDATE cliente SET razon_social = 'Constructora Huancabamba Norte', tipo = 'EMPRESA', limite_credito = 1500
 WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE cliente SET razon_social = 'Club Deportivo Tallán', tipo = 'PERSONA', limite_credito = 800
 WHERE id = '22222222-2222-4222-8222-222222222222';
INSERT INTO cliente (id, organizacion_id, razon_social, tipo, limite_credito, creado_en) VALUES
 ('44444444-4444-4444-8444-444444444441', '10000000-0000-4000-8000-000000000001', 'Agroindustrias Sullana Verde',      'EMPRESA', 3000, '2025-06-12 09:00-05'),
 ('44444444-4444-4444-8444-444444444442', '10000000-0000-4000-8000-000000000001', 'Transportes Sechura Sur',           'EMPRESA', 2000, '2026-02-20 09:00-05'),
 ('44444444-4444-4444-8444-444444444443', '10000000-0000-4000-8000-000000000001', 'Academia Deportiva Cuatro Vientos', 'EMPRESA', 1500, '2025-09-15 09:00-05'),
 ('44444444-4444-4444-8444-444444444444', '10000000-0000-4000-8000-000000000001', 'Colegio Nuevo Horizonte',           'COLEGIO', 4000, '2025-02-10 09:00-05');

-- Contacto registrado de cada cliente (V10, D-011: n8n identifica al cliente por este JID) y su canal de WhatsApp
-- (solo metadatos de origen; sin conversación, D-007). Números ficticios.
INSERT INTO contacto (organizacion_id, cliente_id, nombre, whatsapp_jid)
SELECT '10000000-0000-4000-8000-000000000001', v.cliente, v.nombre, v.jid FROM (VALUES
 ('11111111-1111-4111-8111-111111111111'::uuid, 'Compras Huancabamba Norte', '51900000214@s.whatsapp.net'),
 ('22222222-2222-4222-8222-222222222222'::uuid, 'Delegado Club Tallán',      '51900000146@s.whatsapp.net'),
 ('44444444-4444-4444-8444-444444444441'::uuid, 'Logística Sullana Verde',   '51900000587@s.whatsapp.net'),
 ('44444444-4444-4444-8444-444444444442'::uuid, 'Flota Sechura Sur',         '51900000903@s.whatsapp.net'),
 ('44444444-4444-4444-8444-444444444443'::uuid, 'Academia Cuatro Vientos',   '51900000731@s.whatsapp.net'),
 ('44444444-4444-4444-8444-444444444444'::uuid, 'Dirección Nuevo Horizonte', '51900000368@s.whatsapp.net')) v(cliente, nombre, jid);
INSERT INTO canal_whatsapp (organizacion_id, cliente_id, vendedor_id, instancia, chat_jid) VALUES
 ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '70000000-0000-4000-8000-000000000001', 'ventas-demo', '51900000214@s.whatsapp.net'),
 ('10000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '70000000-0000-4000-8000-000000000005', 'ventas-demo', '51900000146@s.whatsapp.net'),
 ('10000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444441', '70000000-0000-4000-8000-000000000001', 'ventas-demo', '51900000587@s.whatsapp.net'),
 ('10000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444442', '70000000-0000-4000-8000-000000000001', 'ventas-demo', '51900000903@s.whatsapp.net'),
 ('10000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444443', '70000000-0000-4000-8000-000000000005', 'ventas-demo', '51900000731@s.whatsapp.net'),
 ('10000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', '70000000-0000-4000-8000-000000000005', 'ventas-demo', '51900000368@s.whatsapp.net');

UPDATE canal_whatsapp c SET contacto_id = k.id
  FROM contacto k
 WHERE k.organizacion_id = c.organizacion_id AND k.cliente_id = c.cliente_id AND k.whatsapp_jid = c.chat_jid
   AND c.organizacion_id = '10000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------------------------------- P-001 y P-002
-- Mismos totales que la semilla base (300 = 12 x 25; 500 = 20 x 25); P-002 la vendió Luis (Unicrack).
UPDATE orden_item SET descripcion = 'Camisas drill con bordado', tela = 'Drill', talla = 'S-XL', logo = 'Bordado al pecho',
       cantidad = 12, precio_unit = 25.00 WHERE id = '15000000-0000-4000-8000-000000000001';
UPDATE orden_item SET descripcion = 'Camisetas sublimadas', tela = 'Dry-fit', talla = 'S-L', logo = 'Sublimado completo',
       cantidad = 20, precio_unit = 25.00 WHERE id = '15000000-0000-4000-8000-000000000002';
UPDATE orden SET vendedor_id = '70000000-0000-4000-8000-000000000005' WHERE id = 'a0000000-0000-4000-8000-000000000002';
UPDATE aprobacion_credito SET aprobado_por = '70000000-0000-4000-8000-000000000005'
 WHERE orden_id = 'a0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------------------------------- funciones de la carga
-- Temporales (pg_temp): desaparecen al cerrar la sesión. Ids derivados de n: orden a0..n, ítem 15..n, obligación b0..n.
CREATE FUNCTION pg_temp.uid(prefijo text, n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS
 $$ SELECT (prefijo || '-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- Pedido histórico: crédito aprobado por el vendedor, producido (etapas y costos reales cerrados, asignados a su ítem y,
-- si es propio, con cargo interno del taller) y despachado (V8 fija el vencimiento).
CREATE FUNCTION pg_temp.historica(n int, p_cliente uuid, p_marca uuid, p_linea uuid, p_vendedor uuid, p_desc text,
  p_tela text, p_talla text, p_logo text, p_cant int, p_precio numeric, p_propia boolean, p_mp numeric, p_mo numeric,
  p_cif numeric, p_tercero numeric, p_cargo numeric, p_emision date, p_plazo int, p_despacho date) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
 org uuid := '10000000-0000-4000-8000-000000000001';
 o uuid := pg_temp.uid('a0000000', n); item uuid := pg_temp.uid('15000000', n);
 taller uuid := '13000000-0000-4000-8000-000000000001'; tercero uuid := '13000000-0000-4000-8000-000000000002';
 jefe uuid := '70000000-0000-4000-8000-000000000004'; admin uuid := '70000000-0000-4000-8000-000000000002';
 creado timestamptz := (p_emision + time '10:00') AT TIME ZONE 'America/Lima';
 e_corte uuid; e_conf uuid; costo uuid;
BEGIN
 INSERT INTO keptai.orden (id, organizacion_id, ref, cliente_id, marca_id, vendedor_id, estado, condicion_pago, plazo_dias,
                           total, tipo_produccion, fecha_inicio_produccion, origen, creado_en, actualizado_en)
 VALUES (o, org, 'P-' || lpad(n::text, 3, '0'), p_cliente, p_marca, p_vendedor, 'PENDIENTE_APROBACION', 'CREDITO', p_plazo,
         p_cant * p_precio, CASE WHEN p_propia THEN 'INTERNA' ELSE 'TERCERIZADA' END, p_emision + 1, 'MANUAL', creado, creado);
 INSERT INTO keptai.orden_item (id, organizacion_id, orden_id, linea_id, descripcion, tela, talla, logo, cantidad, precio_unit)
 VALUES (item, org, o, p_linea, p_desc, p_tela, p_talla, p_logo, p_cant, p_precio);
 INSERT INTO keptai.aprobacion_credito (organizacion_id, orden_id, aprobado_por, decision, aviso_mora_mostrado,
                                        saldo_referencia, plazo_dias, motivo, decidido_en, creado_en)
 VALUES (org, o, p_vendedor, 'APROBADO', false, 0, p_plazo, 'Cliente al día (demo)', creado + interval '1 hour', creado);
 UPDATE keptai.orden SET estado = 'EN_PRODUCCION' WHERE id = o;
 INSERT INTO keptai.obligacion_cobro (id, organizacion_id, orden_id, monto, plazo_dias, creado_en, actualizado_en)
 VALUES (pg_temp.uid('b0000000', n), org, o, p_cant * p_precio, p_plazo, creado + interval '1 hour', creado + interval '1 hour');
 IF p_propia THEN
  INSERT INTO keptai.orden_etapa (organizacion_id, orden_id, unidad_id, etapa, estado, responsable_id, cantidad_procesada, merma, inicio, fin)
  VALUES (org, o, taller, 'CORTE', 'TERMINADA', jefe, p_cant, 0, creado + interval '1 day', creado + interval '2 days') RETURNING id INTO e_corte;
  INSERT INTO keptai.orden_etapa (organizacion_id, orden_id, unidad_id, etapa, estado, responsable_id, cantidad_procesada, merma, inicio, fin)
  VALUES (org, o, taller, 'CONFECCION', 'TERMINADA', jefe, p_cant, 0, creado + interval '3 days', creado + interval '6 days') RETURNING id INTO e_conf;
  INSERT INTO keptai.orden_etapa (organizacion_id, orden_id, unidad_id, etapa, estado, responsable_id, cantidad_procesada, merma, inicio, fin)
  VALUES (org, o, taller, 'CALIDAD', 'TERMINADA', jefe, p_cant, 0, creado + interval '7 days', creado + interval '7 days 4 hours');
  INSERT INTO keptai.costo_orden (organizacion_id, orden_id, etapa_id, concepto, monto, origen, fuente, registrado_por)
  VALUES (org, o, e_corte, 'MATERIA_PRIMA', p_mp, 'REAL', 'semilla_escenarios', jefe),
         (org, o, e_conf, 'MANO_OBRA', p_mo, 'REAL', 'semilla_escenarios', jefe),
         (org, o, e_conf, 'CIF', p_cif, 'REAL', 'semilla_escenarios', jefe);
  INSERT INTO keptai.transferencia_interna (organizacion_id, orden_id, unidad_origen_id, monto, moneda, criterio, fuente, registrado_por, creado_en)
  VALUES (org, o, taller, p_cargo, 'PEN', 'Precio interno ficticio de demostración', 'semilla_escenarios', admin, creado + interval '7 days');
 ELSE
  INSERT INTO keptai.orden_etapa (organizacion_id, orden_id, unidad_id, etapa, estado, responsable_id, cantidad_procesada, merma, inicio, fin)
  VALUES (org, o, tercero, 'CONFECCION', 'TERMINADA', jefe, p_cant, 0, creado + interval '1 day', creado + interval '8 days') RETURNING id INTO e_conf;
  INSERT INTO keptai.costo_orden (organizacion_id, orden_id, etapa_id, concepto, monto, origen, fuente, registrado_por)
  VALUES (org, o, e_conf, 'TERCERO', p_tercero, 'REAL', 'semilla_escenarios', jefe);
 END IF;
 INSERT INTO keptai.asignacion_costo_item (organizacion_id, costo_id, orden_item_id, monto, moneda, metodo, fuente, registrado_por)
 SELECT org, c.id, item, c.monto, c.moneda, 'UNIDADES', 'semilla_escenarios', jefe FROM keptai.costo_orden c WHERE c.orden_id = o;
 INSERT INTO keptai.despacho (organizacion_id, orden_id, fecha_despacho, registrado_por, creado_en)
 VALUES (org, o, p_despacho, jefe, (p_despacho + time '15:00') AT TIME ZONE 'America/Lima');
 UPDATE keptai.orden SET costos_reales_completos = true WHERE id = o;
END $$;

-- Pago registrado en la carga de historial (04/10, sin comprobante digitalizado): verificado y aplicado a su pedido.
CREATE FUNCTION pg_temp.cobro(n int, p_orden int, p_cliente uuid, p_monto numeric, p_fecha date, p_medio text, p_banco text,
  p_ref text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 org uuid := '10000000-0000-4000-8000-000000000001'; admin uuid := '70000000-0000-4000-8000-000000000002';
 v_pago uuid := pg_temp.uid('c0000000', n); cargado timestamptz := '2026-10-04 12:00-05'::timestamptz + n * interval '1 minute';
 aplicado timestamptz := (p_fecha + time '11:00') AT TIME ZONE 'America/Lima';
BEGIN
 INSERT INTO keptai.pago (id, organizacion_id, cliente_id, monto, fecha_pago, medio, banco, codigo_operacion, fase,
                          estado_conciliacion, verificado_por, verificado_en, creado_en, actualizado_en)
 VALUES (v_pago, org, p_cliente, p_monto, p_fecha, p_medio, p_banco, p_ref, 'APLICADO', 'APLICADO', admin, aplicado, cargado, cargado);
 INSERT INTO keptai.aplicacion_pago (organizacion_id, pago_id, obligacion_id, monto_aplicado, aplicado_por, aplicado_en)
 VALUES (org, v_pago, pg_temp.uid('b0000000', p_orden), p_monto, admin, aplicado);
 -- Un pago que no salda su obligación queda PARCIAL, como lo deja MotorPagos.recalcularPago.
 UPDATE keptai.pago SET estado_conciliacion = 'PARCIAL'
  WHERE id = v_pago AND (SELECT s.saldo FROM keptai.v_saldo_obligacion s WHERE s.obligacion_id = pg_temp.uid('b0000000', p_orden)) > 0;
END $$;

-- ---------------------------------------------------------------------------------------------------- pedidos históricos
--                    n  cliente                                  marca                                    línea                                    vendedor                                 descripción                                      tela         talla        logo                     cant precio  propia  MP     MO     CIF   tercero cargo  emisión       plazo despacho
SELECT pg_temp.historica(3,  '11111111-1111-4111-8111-111111111111', '12000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Polos piqué con logo',                      'Piqué',     'S-XL',      'Bordado pecho',         24,  20.00, true,   260,   90,    50,   NULL,   430,   '2026-07-28', 15,   '2026-08-08');
SELECT pg_temp.historica(4,  '44444444-4444-4444-8444-444444444441', '12000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Overoles de drill con cinta reflectiva',    'Drill',     'M-XXL',     'Cinta reflectiva',      30,  42.00, false,  NULL,  NULL,  NULL, 920,    NULL,  '2026-08-03', 30,   '2026-08-14');
SELECT pg_temp.historica(5,  '44444444-4444-4444-8444-444444444441', '12000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Camisas manga larga para campo',            'Oxford',    'S-XL',      'Bordado manga',         40,  24.50, true,   520,   180,   90,   NULL,   850,   '2026-09-10', 30,   '2026-09-20');
SELECT pg_temp.historica(6,  '44444444-4444-4444-8444-444444444442', '12000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Casacas para conductores',                  'Taslán',    'M-XL',      'Estampado espalda',     18,  40.00, true,   340,   150,   90,   NULL,   620,   '2026-07-15', 30,   '2026-07-25');
SELECT pg_temp.historica(7,  '44444444-4444-4444-8444-444444444442', '12000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Chalecos y pantalones de trabajo (juegos)', 'Drill',     'M-XL',      'Bordado pecho',         25,  34.00, true,   410,   170,   80,   NULL,   710,   '2026-08-18', 30,   '2026-08-22');
SELECT pg_temp.historica(8,  '22222222-2222-4222-8222-222222222222', '12000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', 'Shorts y medias de entrenamiento (juegos)', 'Dry-fit',   'S-L',       'Sublimado',             20,  18.00, false,  NULL,  NULL,  NULL, 250,    NULL,  '2026-08-20', 15,   '2026-08-28');
SELECT pg_temp.historica(9,  '44444444-4444-4444-8444-444444444443', '12000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', 'Buzos deportivos sublimados',               'Franela',   'S-XL',      'Sublimado completo',    32,  20.00, false,  NULL,  NULL,  NULL, 470,    NULL,  '2026-08-30', 30,   '2026-09-13');
SELECT pg_temp.historica(10, '44444444-4444-4444-8444-444444444443', '12000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', 'Camisetas de competencia',                  'Dry-fit',   'S-L',       'Número y escudo',       30,  19.00, false,  NULL,  NULL,  NULL, 410,    NULL,  '2026-06-10', 30,   '2026-06-20');
SELECT pg_temp.historica(11, '44444444-4444-4444-8444-444444444444', '12000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000005', 'Buzos escolares',                           'Franela',   '6-16',      'Escudo bordado',        60,  20.00, false,  NULL,  NULL,  NULL, 880,    NULL,  '2026-07-20', 30,   '2026-08-01');
SELECT pg_temp.historica(12, '44444444-4444-4444-8444-444444444444', '12000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000005', 'Uniformes de gala escolar (juegos)',        'Gabardina', '6-16',      'Escudo bordado',        50,  30.00, false,  NULL,  NULL,  NULL, 1080,   NULL,  '2026-09-05', 30,   '2026-09-28');
-- P-005 se emitió el 10/09 y su producción empezó al día siguiente: el despacho es posterior, como exige V8.

-- Montos de los históricos: P-003 480, P-004 1260, P-005 980, P-006 720, P-007 850, P-008 360, P-009 640, P-010 570,
-- P-011 1200, P-012 1500.
--                n   orden cliente                                 monto   fecha         medio           banco        referencia
SELECT pg_temp.cobro(4,  3,  '11111111-1111-4111-8111-111111111111', 480.00,  '2026-08-21', 'TRANSFERENCIA', 'BCP',       'H-48213301');
SELECT pg_temp.cobro(5,  4,  '44444444-4444-4444-8444-444444444441', 1260.00, '2026-09-25', 'TRANSFERENCIA', 'BBVA',      'H-60117725');
SELECT pg_temp.cobro(6,  5,  '44444444-4444-4444-8444-444444444441', 400.00,  '2026-09-22', 'TRANSFERENCIA', 'BCP',       'H-48299410');
SELECT pg_temp.cobro(7,  6,  '44444444-4444-4444-8444-444444444442', 720.00,  '2026-09-02', 'DEPOSITO',      'BCP',       'H-30021877');
SELECT pg_temp.cobro(8,  8,  '22222222-2222-4222-8222-222222222222', 360.00,  '2026-09-12', 'YAPE',          NULL,        'H-91827364');
SELECT pg_temp.cobro(9,  10, '44444444-4444-4444-8444-444444444443', 570.00,  '2026-07-18', 'TRANSFERENCIA', 'Interbank', 'H-77003412');
SELECT pg_temp.cobro(10, 11, '44444444-4444-4444-8444-444444444444', 500.00,  '2026-08-05', 'TRANSFERENCIA', 'BCP',       'H-48170055');
SELECT pg_temp.cobro(11, 12, '44444444-4444-4444-8444-444444444444', 600.00,  '2026-09-15', 'TRANSFERENCIA', 'BCP',       'H-48256690');

-- Cobrados por completo: el pedido se cierra (CERRADA), como P-001 en la semilla base.
UPDATE orden o SET estado = 'CERRADA'
  FROM obligacion_cobro ob JOIN v_saldo_obligacion s ON s.obligacion_id = ob.id
 WHERE ob.orden_id = o.id AND o.organizacion_id = '10000000-0000-4000-8000-000000000001' AND o.estado = 'DESPACHADA' AND s.saldo = 0;

-- ---------------------------------------------------------------------------------------------------- pedidos en curso
INSERT INTO orden (id, organizacion_id, ref, cliente_id, marca_id, vendedor_id, estado, condicion_pago, plazo_dias, total,
                   tipo_produccion, fecha_entrega_solicitada, origen, creado_en, actualizado_en) VALUES
 -- Por decidir (WhatsApp): la condición es la que pidió el cliente; el vendedor decide crédito, anticipo o contado.
 ('a0000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 'P-013', '22222222-2222-4222-8222-222222222222',
  '12000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', 'PENDIENTE_APROBACION', 'CREDITO', 15, 600.00,
  'TERCERIZADA', '2026-10-24', 'WHATSAPP', '2026-10-10 09:38-05', '2026-10-10 09:38-05'),
 ('a0000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', 'P-015', '44444444-4444-4444-8444-444444444441',
  '12000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CREDITO', 30, 520.00,
  'INTERNA', '2026-10-30', 'WHATSAPP', '2026-10-10 10:16-05', '2026-10-10 10:16-05'),
 -- Anticipo del 50 %: queda retenida hasta verificar y aplicar el anticipo.
 ('a0000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 'P-014', '44444444-4444-4444-8444-444444444443',
  '12000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', 'PENDIENTE_APROBACION', 'ANTICIPO', 30, 720.00,
  'TERCERIZADA', '2026-10-30', 'WHATSAPP', '2026-10-08 15:50-05', '2026-10-08 15:50-05'),
 -- Crédito a 15 días aprobado: liberada a producción, falta el despacho.
 ('a0000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', 'P-016', '11111111-1111-4111-8111-111111111111',
  '12000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CREDITO', 15, 450.00,
  'INTERNA', '2026-10-14', 'MANUAL', '2026-10-07 11:30-05', '2026-10-07 11:30-05');

INSERT INTO orden_item (id, organizacion_id, orden_id, linea_id, descripcion, tela, talla, logo, cantidad, precio_unit) VALUES
 ('15000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000013',
  '14000000-0000-4000-8000-000000000002', 'Camiseta sublimada con número', 'Dry-fit', 'Por confirmar', 'Número y nombre', 30, 20.00),
 ('15000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000015',
  '14000000-0000-4000-8000-000000000001', 'Polo piqué con logo bordado', 'Piqué verde', 'M-XL', 'Bordado pecho', 25, 20.80),
 ('15000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000014',
  '14000000-0000-4000-8000-000000000002', 'Casaca cortavientos con logo', 'Taslán', 'S-XL según lista', 'Estampado', 24, 30.00),
 ('15000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016',
  '14000000-0000-4000-8000-000000000001', 'Chaleco reflectivo con bordado', 'Malla naranja', 'Única', 'Bordado espalda', 15, 30.00);

-- P-014: anticipo 50 % (360) y saldo a 30 días desde el despacho; el cliente tenía saldo por vencer (P-009), sin mora.
UPDATE orden SET anticipo_requerido = 360.00 WHERE id = 'a0000000-0000-4000-8000-000000000014';
INSERT INTO aprobacion_credito (organizacion_id, orden_id, aprobado_por, decision, aviso_mora_mostrado, saldo_referencia,
                                plazo_dias, anticipo_pct, motivo, decidido_en, creado_en) VALUES
 ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000014', '70000000-0000-4000-8000-000000000005', 'APROBADO',
  false, 0, 30, 50.00, 'Anticipo del 50 %; saldo a 30 días desde el despacho.', '2026-10-08 16:20-05', '2026-10-08 16:00-05'),
 ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016', '70000000-0000-4000-8000-000000000001', 'APROBADO',
  false, 0, 15, NULL, 'Cliente al día.', '2026-10-07 12:05-05', '2026-10-07 11:45-05');
UPDATE orden SET estado = 'RETENIDA' WHERE id = 'a0000000-0000-4000-8000-000000000014';
UPDATE orden SET estado = 'LIBERADA', fecha_inicio_produccion = '2026-10-07' WHERE id = 'a0000000-0000-4000-8000-000000000016';
INSERT INTO obligacion_cobro (id, organizacion_id, orden_id, monto, plazo_dias, creado_en, actualizado_en) VALUES
 ('b0000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000014', 720.00, 30,
  '2026-10-08 16:20-05', '2026-10-08 16:20-05'),
 ('b0000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016', 450.00, 15,
  '2026-10-07 12:05-05', '2026-10-07 12:05-05');
INSERT INTO orden_etapa (organizacion_id, orden_id, unidad_id, etapa, estado, responsable_id, cantidad_procesada, merma, inicio, fin) VALUES
 ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016', '13000000-0000-4000-8000-000000000001', 'CORTE',
  'TERMINADA', '70000000-0000-4000-8000-000000000004', 15, 0, '2026-10-07 14:00-05', '2026-10-08 17:00-05'),
 ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016', '13000000-0000-4000-8000-000000000001', 'CONFECCION',
  'EN_CURSO', '70000000-0000-4000-8000-000000000004', 8, 0, '2026-10-09 08:00-05', NULL);

-- ---------------------------------------------------------------------------------------------------- vouchers por revisar
-- Recibidos por WhatsApp (WF2): solo recibidos. El voucher no verifica fondos; Administración confirma en su banca.
INSERT INTO pago (id, organizacion_id, cliente_id, monto, fecha_pago, medio, codigo_operacion, fase, estado_conciliacion,
                  idempotency_key, creado_en, actualizado_en) VALUES
 ('c0000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', NULL, 250.00, '2026-10-09', 'PLIN',
  '7731045', 'RECIBIDO', 'SIN_ORDEN', 'demo-wa-0012', '2026-10-09 20:47-05', '2026-10-09 20:47-05'),
 ('c0000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 180.00,
  '2026-10-10', 'YAPE', '5520198', 'RECIBIDO', 'PENDIENTE', 'demo-wa-0013', '2026-10-10 08:21-05', '2026-10-10 08:21-05'),
 ('c0000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444443', 360.00,
  '2026-10-10', 'YAPE', '61190427', 'RECIBIDO', 'PENDIENTE', 'demo-wa-0014', '2026-10-10 09:40-05', '2026-10-10 09:40-05');

-- ---------------------------------------------------------------------------------------------------- alertas internas
-- Mora temprana (+3 días) de los pedidos vencidos con saldo; P-002 ya la trae la semilla base.
INSERT INTO alerta_cobranza (organizacion_id, obligacion_id, responsable_id, regla, estado, creado_en)
SELECT ob.organizacion_id, ob.id, '70000000-0000-4000-8000-000000000002', 'MORA_TEMPRANA', 'ABIERTA',
       ((ob.vence_en + 3) + time '09:00') AT TIME ZONE 'America/Lima'
  FROM obligacion_cobro ob JOIN v_saldo_obligacion s ON s.obligacion_id = ob.id
 WHERE ob.organizacion_id = '10000000-0000-4000-8000-000000000001' AND s.saldo > 0 AND ob.vence_en + 3 <= DATE '2026-10-10'
   AND NOT EXISTS (SELECT 1 FROM alerta_cobranza a WHERE a.obligacion_id = ob.id AND a.regla = 'MORA_TEMPRANA');
-- El voucher V-012 sin cliente queda en revisión con responsable.
INSERT INTO alerta_cobranza (organizacion_id, pago_id, responsable_id, regla, estado, creado_en) VALUES
 ('10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000012', '70000000-0000-4000-8000-000000000002',
  'PAGO_EN_REVISION', 'ABIERTA', '2026-10-09 20:48-05');

-- ---------------------------------------------------------------------------------------------------- envíos de cobranza (WF3)
-- Lo que el scheduler habría programado a -3/0/+3 días del vencimiento: enviados hasta el corte de la demo (10/10),
-- cancelados si el pedido ya estaba pagado y pendientes después. Solo metadatos: la base no guarda el texto (D-007).
INSERT INTO envio_notificacion (organizacion_id, cliente_id, orden_id, obligacion_id, instancia, numero_destino, tipo,
                                idempotency_key, estado, intentos, programado_para, enviado_en)
SELECT ob.organizacion_id, o.cliente_id, o.id, ob.id, cw.instancia, split_part(cw.chat_jid, '@', 1), h.tipo,
       ob.id::text || ':' || h.tipo,
       CASE WHEN pagado.dia IS NOT NULL AND pagado.dia <= h.fecha THEN 'CANCELADO'
            WHEN h.fecha <= DATE '2026-10-10' THEN 'ENVIADO' ELSE 'PENDIENTE' END,
       CASE WHEN (pagado.dia IS NULL OR pagado.dia > h.fecha) AND h.fecha <= DATE '2026-10-10' THEN 1 ELSE 0 END,
       (h.fecha + time '09:00') AT TIME ZONE 'America/Lima',
       CASE WHEN (pagado.dia IS NULL OR pagado.dia > h.fecha) AND h.fecha <= DATE '2026-10-10'
            THEN (h.fecha + time '09:00') AT TIME ZONE 'America/Lima' END
  FROM obligacion_cobro ob
  JOIN orden o ON o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
  JOIN v_saldo_obligacion s ON s.obligacion_id = ob.id
  JOIN LATERAL (SELECT c.instancia, c.chat_jid FROM canal_whatsapp c
                 WHERE c.organizacion_id = ob.organizacion_id AND c.cliente_id = o.cliente_id LIMIT 1) cw ON true
  LEFT JOIN LATERAL (SELECT max(a.aplicado_en::date) AS dia FROM aplicacion_pago a
                      WHERE a.obligacion_id = ob.id AND a.anulada_en IS NULL HAVING s.saldo = 0) pagado ON true
  CROSS JOIN LATERAL (VALUES ('COBRANZA_PREVENTIVA', ob.vence_en - 3), ('COBRANZA_VENCIMIENTO', ob.vence_en),
                             ('MORA_TEMPRANA', ob.vence_en + 3)) h(tipo, fecha)
 WHERE ob.organizacion_id = '10000000-0000-4000-8000-000000000001' AND ob.vence_en IS NOT NULL;
-- Un envío fallido para mostrar el estado de error y el reintento.
UPDATE envio_notificacion SET estado = 'ERROR', intentos = 2, enviado_en = NULL,
       ultimo_error = 'Evolution API no confirmó la entrega al contacto de prueba.'
 WHERE idempotency_key = 'b0000000-0000-4000-8000-000000000011:MORA_TEMPRANA';
INSERT INTO envio_notificacion (organizacion_id, cliente_id, orden_id, obligacion_id, instancia, numero_destino, tipo,
                                idempotency_key, estado, intentos, programado_para, enviado_en) VALUES
 ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001', 'ventas-demo', '51900000214', 'CONFIRMACION_PAGO', 'demo-confirmacion-v001', 'ENVIADO', 1,
  '2026-10-02 10:26-05', '2026-10-02 10:26-05');

-- ---------------------------------------------------------------------------------------------------- caja
-- Apertura del escenario (supuesto de demostración) y egresos previstos de las próximas cuatro semanas.
UPDATE apertura_caja SET fecha = '2026-10-01', importe = 3200.00, fuente = 'semilla_escenarios (supuesto de demostración)'
 WHERE id = '1a000000-0000-4000-8000-000000000001';
INSERT INTO egreso_caja (organizacion_id, concepto, fecha_prevista, monto, estado, fuente) VALUES
 ('10000000-0000-4000-8000-000000000001', 'Planilla taller',                      '2026-10-13', 600.00,  'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Taller tercero (sublimado)',           '2026-10-15', 350.00,  'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Proveedor de tela',                    '2026-10-20', 450.00,  'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Compra de tela drill (lote octubre)',  '2026-10-21', 1800.00, 'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Planilla comercial',                   '2026-10-22', 520.00,  'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Alquiler local',                       '2026-10-27', 380.00,  'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Publicidad pagada',                    '2026-10-29', 240.00,  'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Planilla taller',                      '2026-11-03', 700.00,  'PREVISTO', 'semilla_escenarios'),
 ('10000000-0000-4000-8000-000000000001', 'Planilla comercial',                   '2026-11-05', 520.00,  'PREVISTO', 'semilla_escenarios');

-- Estados de las obligaciones según saldo y fecha local (PAGADA, PARCIAL, MORA, PENDIENTE), como hace el motor.
DO $$ BEGIN PERFORM keptai_private.recalcular_obligaciones('10000000-0000-4000-8000-000000000001', NULL); END $$;

-- ---------------------------------------------------------------------------------------------------- auditoría
-- Historial de las acciones de la escena (semilla base incluida), con las mismas operaciones y claves que escriben los
-- motores y comandos del panel: crédito, verificación, aplicación, duplicado y despacho. Sin texto de mensajes (D-007).
INSERT INTO evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, ocurrido_en)
SELECT a.organizacion_id, a.aprobado_por, 'USUARIO', 'CREDITO_APROBADO', 'orden', a.orden_id,
       jsonb_build_object('condicion_pago', o.condicion_pago, 'plazo_dias', a.plazo_dias::text,
                          'aviso_mora_mostrado', a.aviso_mora_mostrado::text), a.decidido_en
  FROM aprobacion_credito a JOIN orden o ON o.organizacion_id = a.organizacion_id AND o.id = a.orden_id
 WHERE a.organizacion_id = '10000000-0000-4000-8000-000000000001' AND a.decision = 'APROBADO' AND a.decidido_en IS NOT NULL
UNION ALL
SELECT p.organizacion_id, p.verificado_por, 'USUARIO', 'PAGO_VERIFICADO', 'pago', p.id,
       jsonb_build_object('metodo', 'manual_confirmation', 'simulado', false), p.verificado_en
  FROM pago p
 WHERE p.organizacion_id = '10000000-0000-4000-8000-000000000001' AND p.verificado_en IS NOT NULL AND p.verificado_por IS NOT NULL
UNION ALL
SELECT ap.organizacion_id, ap.aplicado_por, 'USUARIO', 'PAGO_APLICADO', 'aplicacion_pago', ap.id,
       jsonb_build_object('pago_id', ap.pago_id, 'obligacion_id', ap.obligacion_id, 'monto', ap.monto_aplicado), ap.aplicado_en
  FROM aplicacion_pago ap
 WHERE ap.organizacion_id = '10000000-0000-4000-8000-000000000001' AND ap.anulada_en IS NULL
UNION ALL
SELECT p.organizacion_id, '70000000-0000-4000-8000-000000000002', 'USUARIO', 'PAGO_DUPLICADO', 'pago', p.id,
       jsonb_build_object('duplicado_de', p.duplicado_de_pago_id), p.creado_en + interval '5 minutes'
  FROM pago p
 WHERE p.organizacion_id = '10000000-0000-4000-8000-000000000001' AND p.estado_conciliacion = 'DUPLICADO'
UNION ALL
SELECT d.organizacion_id, d.registrado_por, 'USUARIO', 'DESPACHO_REGISTRADO', 'despacho', d.id,
       jsonb_build_object('orden_id', d.orden_id, 'fecha_despacho', d.fecha_despacho), d.creado_en
  FROM despacho d
 WHERE d.organizacion_id = '10000000-0000-4000-8000-000000000001' AND d.registrado_por IS NOT NULL;

COMMIT;
