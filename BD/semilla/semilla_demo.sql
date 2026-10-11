-- KeptAI - Semilla ficticia reiniciable (roadmap PROP-ROADMAP-001 §6). Responsable: Andres.
-- DATOS FICTICIOS DE DEMOSTRACION: no son registros de Corpotex. Mismos UUID/importes que Backend/docs/openapi.yaml.
-- Ejecutar como migrador/propietario sobre V8 (BD/local/db.sh seed). No es migracion Flyway.
-- Sigue el flujo real: credito -> produccion -> obligacion -> despacho (V8 fija vence_en) -> pagos -> estados recalculados.
-- Reiniciable: borra y recrea solo las organizaciones DEMO de abajo. Aborta si esos UUID pertenecen a otra organizacion.
-- No crea comprobantes: no existe archivo en Storage (DB-DEF-001 §8). Cargo interno 320 requiere V8 (transferencia_interna).
BEGIN;
SET LOCAL search_path = keptai;

DO $$ BEGIN
 IF current_setting('keptai.permitir_semilla', true) IS DISTINCT FROM 'demo' THEN
  RAISE EXCEPTION 'Semilla bloqueada: ejecutar con SET keptai.permitir_semilla = ''demo'' (db.sh seed lo hace)';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM keptai.flyway_schema_history WHERE version = '8' AND success) THEN
  RAISE EXCEPTION 'La semilla requiere el esquema V8 (despacho fija vencimiento)';
 END IF;
 IF EXISTS (SELECT 1 FROM keptai.organizacion
            WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')
              AND nombre NOT LIKE 'DEMO %') THEN
  RAISE EXCEPTION 'Los UUID de la semilla pertenecen a una organizacion no DEMO: no se borra nada';
 END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Reinicio: elimina solo datos de las organizaciones DEMO, en orden inverso de dependencias.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE semilla_org(id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO semilla_org VALUES ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
DELETE FROM evento_auditoria      WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM solicitud_idempotente WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM envio_notificacion    WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM alerta_cobranza       WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM aplicacion_pago       WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM comprobante           WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM pago                  WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM costo_orden           WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM despacho              WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM orden_etapa           WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM obligacion_cobro      WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM aprobacion_credito    WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM hoja_resumen          WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM orden_item            WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM orden                 WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM canal_whatsapp        WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM cliente               WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM unidad_produccion     WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM linea_producto        WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM marca                 WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM apertura_caja         WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM egreso_caja           WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM integracion_servicio  WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM usuario               WHERE organizacion_id IN (SELECT id FROM semilla_org);
DELETE FROM organizacion          WHERE id              IN (SELECT id FROM semilla_org);

-- ---------------------------------------------------------------------------
-- Organizacion A (demo) y organizacion B (solo para probar aislamiento, QA-13).
-- auth_user_id son marcadores: reemplazar por el UID de Supabase Auth al crear los usuarios reales de prueba.
-- ---------------------------------------------------------------------------
INSERT INTO organizacion (id, nombre) VALUES
 ('10000000-0000-4000-8000-000000000001', 'DEMO Corpotex ficticia'),
 ('10000000-0000-4000-8000-000000000002', 'DEMO Organizacion de aislamiento');

INSERT INTO usuario (id, organizacion_id, auth_user_id, nombre, email, rol) VALUES
 ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Vendedora Demo',      'vendedora.demo@keptai.invalid',  'VENDEDOR'),
 ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'Administracion Demo', 'admin.demo@keptai.invalid',      'ADMIN'),
 ('70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000003', 'Gerencia Demo',       'gerencia.demo@keptai.invalid',   'GERENTE'),
 ('70000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000004', 'Jefe de Taller Demo', 'taller.demo@keptai.invalid',     'JEFE_TALLER'),
 ('70000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000011', 'Admin Aislamiento',   'aislamiento.demo@keptai.invalid','ADMIN');

INSERT INTO marca (id, organizacion_id, nombre) VALUES
 ('12000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Corpotex'),
 ('12000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Unicrack');
INSERT INTO linea_producto (id, organizacion_id, nombre) VALUES
 ('14000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Uniformes'),
 ('14000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Sport');
INSERT INTO unidad_produccion (id, organizacion_id, nombre, tipo) VALUES
 ('13000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Taller interno (demo)', 'TALLER_INTERNO'),
 ('13000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Taller tercero (demo)', 'TERCERO');

INSERT INTO cliente (id, organizacion_id, razon_social, tipo) VALUES
 ('11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', 'Cliente Ficticio Uno', 'EMPRESA'),
 ('22222222-2222-4222-8222-222222222222', '10000000-0000-4000-8000-000000000001', 'Cliente Ficticio Dos', 'COLEGIO'),
 ('33333333-3333-4333-8333-333333333333', '10000000-0000-4000-8000-000000000002', 'Cliente de otra organizacion', 'EMPRESA');

-- ---------------------------------------------------------------------------
-- Pedidos. Se insertan como PENDIENTE_APROBACION; tras la decision de credito del vendedor pasan a
-- EN_PRODUCCION (el gate fn_validar_liberacion exige credito aprobado) y el despacho los deja DESPACHADA.
-- ---------------------------------------------------------------------------
INSERT INTO orden (id, organizacion_id, ref, cliente_id, marca_id, vendedor_id, estado, condicion_pago, plazo_dias,
                   total, tipo_produccion, fecha_entrega_solicitada, fecha_inicio_produccion, origen, creado_en, actualizado_en) VALUES
 ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'P-001', '11111111-1111-4111-8111-111111111111',
  '12000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CREDITO', 30,
  300.00, 'INTERNA', '2026-09-18', '2026-09-02', 'MANUAL', '2026-09-01 10:00-05', '2026-09-01 10:00-05'),
 ('a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'P-002', '22222222-2222-4222-8222-222222222222',
  '12000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CREDITO', 30,
  500.00, 'TERCERIZADA', '2026-09-04', '2026-08-22', 'MANUAL', '2026-08-20 10:00-05', '2026-08-20 10:00-05'),
 ('a0000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000002', 'P-001', '33333333-3333-4333-8333-333333333333',
  NULL, NULL, 'BORRADOR', 'CONTADO', NULL, 999.00, 'INTERNA', NULL, NULL, 'MANUAL', '2026-10-01 09:00-05', '2026-10-01 09:00-05');

INSERT INTO orden_item (id, organizacion_id, orden_id, linea_id, descripcion, tela, talla, logo, cantidad, precio_unit) VALUES
 ('15000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000001', 'Uniforme corporativo (demo)', 'drill', 'mix', 'bordado pecho', 10, 30.00),
 ('15000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  '14000000-0000-4000-8000-000000000002', 'Polo deportivo Unicrack (demo)', 'dry-fit', 'mix', 'sublimado', 50, 10.00);

INSERT INTO aprobacion_credito (id, organizacion_id, orden_id, aprobado_por, decision, aviso_mora_mostrado, saldo_referencia,
                                plazo_dias, motivo, decidido_en, creado_en) VALUES
 ('16000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001', 'APROBADO', false, 0, 30, 'Cliente sin saldo vencido (demo)', '2026-09-01 11:00-05', '2026-09-01 10:30-05'),
 ('16000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000001', 'APROBADO', false, 0, 30, 'Cliente sin saldo vencido (demo)', '2026-08-20 11:00-05', '2026-08-20 10:30-05');

UPDATE orden SET estado = 'EN_PRODUCCION'
 WHERE id IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');

-- Produccion: P-001 propia (4 etapas), P-002 tercerizada.
INSERT INTO orden_etapa (id, organizacion_id, orden_id, unidad_id, etapa, estado, responsable_id, cantidad_procesada, merma, inicio, fin) VALUES
 ('17000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'CORTE',             'TERMINADA', '70000000-0000-4000-8000-000000000004', 10, 0, '2026-09-02 08:00-05', '2026-09-04 17:00-05'),
 ('17000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'SUBLIMADO_BORDADO', 'TERMINADA', '70000000-0000-4000-8000-000000000004', 10, 0, '2026-09-05 08:00-05', '2026-09-09 17:00-05'),
 ('17000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'CONFECCION',        'TERMINADA', '70000000-0000-4000-8000-000000000004', 10, 0, '2026-09-10 08:00-05', '2026-09-16 17:00-05'),
 ('17000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'CALIDAD',           'TERMINADA', '70000000-0000-4000-8000-000000000004', 10, 0, '2026-09-17 08:00-05', '2026-09-18 12:00-05'),
 ('17000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000002', 'CONFECCION',        'TERMINADA', '70000000-0000-4000-8000-000000000004', 50, 0, '2026-08-22 08:00-05', '2026-09-03 17:00-05');

-- Una sola obligacion por orden, por el total confirmado (D-005); sin vencimiento hasta el despacho.
INSERT INTO obligacion_cobro (id, organizacion_id, orden_id, monto, plazo_dias, vence_en, creado_en, actualizado_en) VALUES
 ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 300.00, 30, NULL, '2026-09-01 11:00-05', '2026-09-01 11:00-05'),
 ('b0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 500.00, 30, NULL, '2026-08-20 11:00-05', '2026-08-20 11:00-05');

-- El despacho fija el vencimiento (trigger V8): P-001 20/09+30 = 20/10; P-002 05/09+30 = 05/10.
INSERT INTO despacho (id, organizacion_id, orden_id, fecha_despacho, registrado_por, creado_en) VALUES
 ('18000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '2026-09-20', '70000000-0000-4000-8000-000000000004', '2026-09-20 15:00-05'),
 ('18000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', '2026-09-05', '70000000-0000-4000-8000-000000000004', '2026-09-05 15:00-05');
UPDATE orden SET estado = 'CERRADA' WHERE id = 'a0000000-0000-4000-8000-000000000001';

-- Costos reales (P-001 propio 200+80+60 = 340; P-002 tercero 350) y cierre explicito del costeo.
INSERT INTO costo_orden (id, organizacion_id, orden_id, concepto, monto, origen, fuente, registrado_por, creado_en) VALUES
 ('19000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'MATERIA_PRIMA', 200.00, 'REAL', 'semilla_demo', '70000000-0000-4000-8000-000000000004', '2026-09-18 18:00-05'),
 ('19000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'MANO_OBRA',      80.00, 'REAL', 'semilla_demo', '70000000-0000-4000-8000-000000000004', '2026-09-18 18:00-05'),
 ('19000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'CIF',            60.00, 'REAL', 'semilla_demo', '70000000-0000-4000-8000-000000000004', '2026-09-18 18:00-05'),
 ('19000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'TERCERO',       350.00, 'REAL', 'semilla_demo', '70000000-0000-4000-8000-000000000004', '2026-09-04 18:00-05');
UPDATE orden SET costos_reales_completos = true
 WHERE id IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Pagos. V-001 y V-002 verificados (simulado de demo, sin banco) y aplicados; V-003 copia de V-002: duplicado, no aplicable.
-- ---------------------------------------------------------------------------
INSERT INTO pago (id, organizacion_id, cliente_id, monto, fecha_pago, medio, codigo_operacion, fase, estado_conciliacion,
                  verificado_por, verificado_en, duplicado_de_pago_id, creado_en, actualizado_en) VALUES
 ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 300.00, '2026-10-02', 'YAPE', 'DEMO-OP-0001',
  'APLICADO', 'APLICADO', '70000000-0000-4000-8000-000000000002', '2026-10-02 10:20-05', NULL, '2026-10-02 10:16-05', '2026-10-02 10:25-05'),
 ('c0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 100.00, '2026-10-03', 'YAPE', 'DEMO-OP-0002',
  'APLICADO', 'PARCIAL',  '70000000-0000-4000-8000-000000000002', '2026-10-03 11:10-05', NULL, '2026-10-03 11:08-05', '2026-10-03 11:15-05'),
 ('c0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 100.00, '2026-10-03', 'YAPE', 'DEMO-OP-0002',
  'RECIBIDO', 'DUPLICADO', NULL, NULL, 'c0000000-0000-4000-8000-000000000002', '2026-10-04 08:00-05', '2026-10-04 08:05-05');

-- El trigger fn_validar_aplicacion_pago valida fondos, cliente, moneda y limites tambien para la semilla.
INSERT INTO aplicacion_pago (id, organizacion_id, pago_id, obligacion_id, monto_aplicado, aplicado_por, aplicado_en) VALUES
 ('90000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001', 300.00, '70000000-0000-4000-8000-000000000002', '2026-10-02 10:25-05'),
 ('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000002', 100.00, '70000000-0000-4000-8000-000000000002', '2026-10-03 11:15-05');

-- Alertas internas: mora temprana de P-002 y V-003 en revision.
INSERT INTO alerta_cobranza (id, organizacion_id, obligacion_id, pago_id, responsable_id, regla, estado, creado_en) VALUES
 ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', NULL,
  NULL, 'MORA_TEMPRANA', 'ABIERTA', '2026-10-08 09:00-05'),
 ('80000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', NULL, 'c0000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000002', 'PAGO_EN_REVISION', 'ABIERTA', '2026-10-04 08:05-05');

-- Caja: apertura ficticia 100 al corte 10/10 y egresos previstos de las semanas 1 y 3.
INSERT INTO apertura_caja (id, organizacion_id, fecha, importe, fuente) VALUES
 ('1a000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-10-10', 100.00, 'semilla_demo');
INSERT INTO egreso_caja (id, organizacion_id, concepto, fecha_prevista, monto, estado, fuente) VALUES
 ('1b000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Compra de telas (ficticio)',   '2026-10-14', 250.00, 'PREVISTO', 'semilla_demo'),
 ('1b000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Planilla quincenal (ficticio)', '2026-10-28', 300.00, 'PREVISTO', 'semilla_demo');

-- Estados de obligacion derivados de saldo y fecha local (P-001 PAGADA, P-002 MORA), como hace el motor.
DO $$ BEGIN PERFORM keptai_private.recalcular_obligaciones(id, NULL) FROM semilla_org; END $$;

COMMIT;
