-- ============================================================================
-- SCRIPT CONSOLIDADO DE EJECUCIÓN DIRECTA EN SUPABASE (V21)
-- Versión: 1.1 | Fecha: 2026-10-19 | Autora: Isabelita
-- Descripción: Mermas y segundas, balance de masa, inventario de telas con
--              partidas de teñido, insumos y requisición de compras (B-08, B-10).
-- ============================================================================

SET search_path = keptai, public;

DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V21'; END IF;
 IF to_regclass('keptai.inventario_tela') IS NOT NULL THEN RAISE EXCEPTION 'V21 bloqueada: keptai.inventario_tela ya existe; revisar esquema'; END IF;
END $$;

-- 1. Ampliar orden_etapa para mermas, segundas, reproceso y consumo real en corte (B-08)
ALTER TABLE keptai.orden_etapa
    ADD COLUMN IF NOT EXISTS cantidad_entrada integer CHECK (cantidad_entrada >= 0),
    ADD COLUMN IF NOT EXISTS buenas integer CHECK (buenas >= 0),
    ADD COLUMN IF NOT EXISTS segundas integer CHECK (segundas >= 0),
    ADD COLUMN IF NOT EXISTS reproceso integer CHECK (reproceso >= 0),
    ADD COLUMN IF NOT EXISTS causa_merma varchar(100),
    ADD COLUMN IF NOT EXISTS consumo_real_kg numeric(10,3) CHECK (consumo_real_kg >= 0),
    ADD COLUMN IF NOT EXISTS factor_consumo_calculado numeric(8,4);

-- Trigger de validación de conservación de masa en avance de etapa
CREATE OR REPLACE FUNCTION keptai_private.fn_validar_balance_masa_etapa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
    v_merma integer := coalesce(NEW.merma, 0);
    v_segundas integer := coalesce(NEW.segundas, 0);
    v_reproceso integer := coalesce(NEW.reproceso, 0);
    v_buenas integer := coalesce(NEW.buenas, 0);
    v_suma integer;
BEGIN
    IF NEW.cantidad_entrada IS NOT NULL AND NEW.cantidad_entrada > 0 THEN
        v_suma := v_buenas + v_segundas + v_merma + v_reproceso;
        IF v_suma <> NEW.cantidad_entrada THEN
            RAISE EXCEPTION 'MASS_BALANCE_MISMATCH: La entrada (%) debe ser igual a la suma de buenas (%), segundas (%), merma (%) y reproceso (%) = %',
                NEW.cantidad_entrada, v_buenas, v_segundas, v_merma, v_reproceso, v_suma;
        END IF;
    END IF;
    RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION keptai_private.fn_validar_balance_masa_etapa() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_validar_balance_masa_etapa ON orden_etapa;
CREATE TRIGGER tg_validar_balance_masa_etapa
BEFORE INSERT OR UPDATE ON orden_etapa
FOR EACH ROW EXECUTE FUNCTION keptai_private.fn_validar_balance_masa_etapa();

-- 2. Tabla de Inventario de Tela (kg, color, gramaje, partida de teñido, rollos)
CREATE TABLE keptai.inventario_tela (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    codigo_rollo        varchar(60),
    tela_tipo           varchar(100) NOT NULL,
    color               varchar(60) NOT NULL,
    gramaje_gsm         integer,
    partida_tenido      varchar(80) NOT NULL,
    peso_actual_kg      numeric(10,3) NOT NULL DEFAULT 0 CHECK (peso_actual_kg >= 0),
    peso_reservado_kg   numeric(10,3) NOT NULL DEFAULT 0 CHECK (peso_reservado_kg >= 0),
    ubicacion           varchar(60),
    activo              boolean NOT NULL DEFAULT true,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    CONSTRAINT chk_tela_disponible CHECK (peso_actual_kg >= peso_reservado_kg)
);

CREATE INDEX ix_inventario_tela_org ON inventario_tela (organizacion_id, tela_tipo, color);

-- 3. Tabla de Insumos (hilos, botones, cierres, bolsas, etc.)
CREATE TABLE keptai.inventario_insumo (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    codigo              varchar(50) NOT NULL,
    nombre              varchar(150) NOT NULL,
    categoria           varchar(50) NOT NULL CHECK (categoria IN ('HILOS', 'BOTONES', 'CIERRES', 'ETIQUETAS', 'EMBALAJE', 'OTRO')),
    unidad_medida       varchar(20) NOT NULL,
    stock_actual        numeric(10,2) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo        numeric(10,2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, codigo)
);

CREATE INDEX ix_inventario_insumo_org ON inventario_insumo (organizacion_id, categoria);

-- 4. Asignación de Partida de Tela a Pedido (control de mezcla de partidas)
CREATE TABLE keptai.orden_partida_tela (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    orden_id            uuid NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
    inventario_tela_id  uuid NOT NULL REFERENCES inventario_tela(id),
    partida_tenido      varchar(80) NOT NULL,
    kg_asignados        numeric(10,3) NOT NULL CHECK (kg_asignados > 0),
    asignado_en         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, orden_id) REFERENCES orden(organizacion_id, id),
    FOREIGN KEY (organizacion_id, inventario_tela_id) REFERENCES inventario_tela(organizacion_id, id)
);

CREATE INDEX ix_orden_partida_tela_orden ON orden_partida_tela (organizacion_id, orden_id);

-- 5. Tabla de Requisición de Compra de Tela (B-10)
CREATE TABLE keptai.requisicion_compra_tela (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    orden_id            uuid REFERENCES orden(id) ON DELETE SET NULL,
    tela_tipo           varchar(100) NOT NULL,
    color               varchar(60) NOT NULL,
    gramaje_gsm         integer,
    kg_requeridos       numeric(10,3) NOT NULL CHECK (kg_requeridos > 0),
    porcentaje_merma    numeric(5,2) NOT NULL DEFAULT 5.0,
    fecha_requerida     date NOT NULL,
    estado              varchar(30) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'APROBADA', 'RECIBIDA', 'CANCELADA')),
    solicitado_por      uuid NOT NULL REFERENCES usuario(id),
    aprobado_por        uuid REFERENCES usuario(id),
    aprobado_en         timestamptz,
    partida_ingresada   varchar(80),
    kg_recibidos        numeric(10,3) CHECK (kg_recibidos IS NULL OR kg_recibidos > 0),
    recibido_en         timestamptz,
    notas               text,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, orden_id) REFERENCES orden(organizacion_id, id),
    FOREIGN KEY (organizacion_id, solicitado_por) REFERENCES usuario(organizacion_id, id),
    FOREIGN KEY (organizacion_id, aprobado_por) REFERENCES usuario(organizacion_id, id)
);

CREATE INDEX ix_req_compra_org ON requisicion_compra_tela (organizacion_id, estado);

-- Permisos y RLS
REVOKE ALL ON keptai.inventario_tela FROM PUBLIC;
REVOKE ALL ON keptai.inventario_insumo FROM PUBLIC;
REVOKE ALL ON keptai.orden_partida_tela FROM PUBLIC;
REVOKE ALL ON keptai.requisicion_compra_tela FROM PUBLIC;

DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.inventario_tela FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.inventario_insumo FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.orden_partida_tela FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.requisicion_compra_tela FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE keptai.inventario_tela ENABLE ROW LEVEL SECURITY;
ALTER TABLE keptai.inventario_insumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE keptai.orden_partida_tela ENABLE ROW LEVEL SECURITY;
ALTER TABLE keptai.requisicion_compra_tela ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON keptai.inventario_tela TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON keptai.inventario_insumo TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON keptai.orden_partida_tela TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON keptai.requisicion_compra_tela TO keptai_runtime;

CREATE POLICY p_inv_tela_org ON keptai.inventario_tela
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

CREATE POLICY p_inv_insumo_org ON keptai.inventario_insumo
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

CREATE POLICY p_orden_partida_tela_org ON keptai.orden_partida_tela
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

CREATE POLICY p_req_compra_org ON keptai.requisicion_compra_tela
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

-- Semillas de demostración si existen organizaciones
DO $$
DECLARE
    org_rec RECORD;
    admin_id uuid;
    tela_piq_wht uuid;
    tela_jer_blk uuid;
BEGIN
    FOR org_rec IN SELECT id FROM keptai.organizacion LOOP
        SELECT id INTO admin_id FROM keptai.usuario WHERE organizacion_id = org_rec.id AND rol = 'ADMIN' LIMIT 1;
        IF admin_id IS NOT NULL THEN
            -- Rollos de tela en almacén con partida de teñido
            tela_piq_wht := gen_random_uuid();
            INSERT INTO keptai.inventario_tela (
                id, organizacion_id, codigo_rollo, tela_tipo, color, gramaje_gsm, partida_tenido, peso_actual_kg, peso_reservado_kg, ubicacion
            ) VALUES (
                tela_piq_wht, org_rec.id, 'ROL-PIQ-001', 'Piqué 24/1 100% Algodón', 'Blanco', 220, 'PART-2026-A12', 48.500, 0, 'ALMACEN-TELA-A1'
            ) ON CONFLICT DO NOTHING;

            tela_jer_blk := gen_random_uuid();
            INSERT INTO keptai.inventario_tela (
                id, organizacion_id, codigo_rollo, tela_tipo, color, gramaje_gsm, partida_tenido, peso_actual_kg, peso_reservado_kg, ubicacion
            ) VALUES (
                tela_jer_blk, org_rec.id, 'ROL-JER-002', 'Jersey 30/1 Peinado', 'Negro', 180, 'PART-2026-B05', 32.200, 0, 'ALMACEN-TELA-B3'
            ) ON CONFLICT DO NOTHING;

            -- Insumos de taller
            INSERT INTO keptai.inventario_insumo (
                organizacion_id, codigo, nombre, categoria, unidad_medida, stock_actual, stock_minimo
            ) VALUES 
                (org_rec.id, 'INS-HIL-01', 'Hilo Poliéster 40/2 Blanco', 'HILOS', 'conos', 25.00, 5.00),
                (org_rec.id, 'INS-BOT-01', 'Botón Camisero 18L Blanco 4 ojos', 'BOTONES', 'millares', 12.00, 2.00),
                (org_rec.id, 'INS-ETQ-01', 'Etiqueta Talla y Cuidado Corpotex', 'ETIQUETAS', 'unidades', 1500.00, 300.00)
            ON CONFLICT (organizacion_id, codigo) DO NOTHING;
        END IF;
    END LOOP;
END $$;
