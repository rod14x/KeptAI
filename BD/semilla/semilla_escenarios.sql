-- KeptAI - Escenarios ficticios para recorrer el panel conectado (INT-FE-API-001). OPCIONAL y aparte de semilla_demo.sql.
-- DATOS FICTICIOS: no son registros de Corpotex. Solo en la organizacion DEMO A; se aplica DESPUES de semilla_demo.sql
-- (BD/local/db.sh seed-escenarios). Reiniciable: db.sh seed la borra junto con la semilla base.
-- Agrega trabajo pendiente para cada rol sin tocar P-001/P-002 ni V-001..V-003 (las cifras del reto siguen en esas filas;
-- los totales de gerencia cambian porque hay mas pedidos):
--   P-003 credito pendiente de decidir (cliente sin mora)       -> VENDEDOR aprueba
--   P-004 credito pendiente con cliente en mora (Cliente Dos)   -> VENDEDOR ve el aviso; la mora no bloquea
--   P-005 pendiente, propuesta al contado                       -> VENDEDOR confirma contado/anticipo
--   P-006 credito aprobado y liberado, en produccion            -> JEFE_TALLER registra despacho
--   V-004 voucher recibido de Cliente Uno por 240               -> ADMIN verifica y aplica a P-005
--   V-005 voucher recibido sin cliente identificado             -> ADMIN lo ve como huerfano
BEGIN;
SET LOCAL search_path = keptai;

DO $$ BEGIN
 IF current_setting('keptai.permitir_semilla', true) IS DISTINCT FROM 'demo' THEN
  RAISE EXCEPTION 'Semilla bloqueada: ejecutar con SET keptai.permitir_semilla = ''demo'' (db.sh seed-escenarios lo hace)';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM keptai.orden WHERE id = 'a0000000-0000-4000-8000-000000000002'
                AND organizacion_id = '10000000-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'Primero cargar semilla_demo.sql (db.sh seed)';
 END IF;
 IF EXISTS (SELECT 1 FROM keptai.orden WHERE id = 'a0000000-0000-4000-8000-000000000003') THEN
  RAISE EXCEPTION 'Los escenarios ya estan cargados: ejecutar db.sh seed para reiniciar y luego seed-escenarios';
 END IF;
END $$;

INSERT INTO cliente (id, organizacion_id, razon_social, tipo) VALUES
 ('44444444-4444-4444-8444-444444444444', '10000000-0000-4000-8000-000000000001', 'Colegio Ficticio Tres', 'COLEGIO');

INSERT INTO orden (id, organizacion_id, ref, cliente_id, marca_id, vendedor_id, estado, condicion_pago, plazo_dias,
                   total, tipo_produccion, fecha_entrega_solicitada, origen, creado_en, actualizado_en) VALUES
 ('a0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'P-003', '44444444-4444-4444-8444-444444444444',
  '12000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CREDITO', 30,
  450.00, 'INTERNA', '2026-10-30', 'WHATSAPP', '2026-10-09 09:30-05', '2026-10-09 09:30-05'),
 ('a0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'P-004', '22222222-2222-4222-8222-222222222222',
  '12000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CREDITO', 30,
  600.00, 'TERCERIZADA', '2026-11-05', 'WHATSAPP', '2026-10-10 11:00-05', '2026-10-10 11:00-05'),
 ('a0000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'P-005', '11111111-1111-4111-8111-111111111111',
  '12000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CONTADO', NULL,
  240.00, 'INTERNA', '2026-10-25', 'MANUAL', '2026-10-10 16:00-05', '2026-10-10 16:00-05'),
 ('a0000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'P-006', '44444444-4444-4444-8444-444444444444',
  '12000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'PENDIENTE_APROBACION', 'CREDITO', 15,
  350.00, 'INTERNA', '2026-10-15', 'MANUAL', '2026-10-01 10:00-05', '2026-10-01 10:00-05');

INSERT INTO orden_item (id, organizacion_id, orden_id, linea_id, descripcion, tela, talla, logo, cantidad, precio_unit) VALUES
 ('15000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
  '14000000-0000-4000-8000-000000000001', 'Buzo escolar (demo)', 'franela', 'mix', 'bordado escudo', 15, 30.00),
 ('15000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004',
  '14000000-0000-4000-8000-000000000002', 'Camiseta de futbol Unicrack (demo)', 'dry-fit', 'mix', 'sublimado', 40, 15.00),
 ('15000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
  '14000000-0000-4000-8000-000000000001', 'Mandil corporativo (demo)', 'drill', 'mix', 'estampado', 12, 20.00),
 ('15000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006',
  '14000000-0000-4000-8000-000000000002', 'Polo deportivo escolar (demo)', 'dry-fit', 'mix', 'sublimado', 35, 10.00);

-- P-006: el vendedor ya aprobo el credito a 15 dias; la orden esta liberada y tiene su obligacion sin vencimiento.
INSERT INTO aprobacion_credito (id, organizacion_id, orden_id, aprobado_por, decision, aviso_mora_mostrado, saldo_referencia,
                                plazo_dias, motivo, decidido_en, creado_en) VALUES
 ('16000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006',
  '70000000-0000-4000-8000-000000000001', 'APROBADO', false, 0, 15, 'Cliente nuevo sin deuda (demo)', '2026-10-01 11:00-05', '2026-10-01 10:30-05');
UPDATE orden SET estado = 'LIBERADA', fecha_inicio_produccion = '2026-10-02' WHERE id = 'a0000000-0000-4000-8000-000000000006';
INSERT INTO obligacion_cobro (id, organizacion_id, orden_id, monto, plazo_dias, creado_en, actualizado_en) VALUES
 ('b0000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 350.00, 15,
  '2026-10-01 11:00-05', '2026-10-01 11:00-05');

-- Vouchers recibidos: aun sin fondos verificados (el voucher no verifica nada por si solo).
INSERT INTO pago (id, organizacion_id, cliente_id, monto, fecha_pago, medio, codigo_operacion, fase, estado_conciliacion,
                  creado_en, actualizado_en) VALUES
 ('c0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 240.00,
  '2026-10-10', 'YAPE', 'DEMO-OP-0004', 'RECIBIDO', 'PENDIENTE', '2026-10-10 17:05-05', '2026-10-10 17:05-05'),
 ('c0000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', NULL, 150.00,
  '2026-10-10', 'PLIN', 'DEMO-OP-0005', 'RECIBIDO', 'SIN_ORDEN', '2026-10-10 18:20-05', '2026-10-10 18:20-05');

COMMIT;
