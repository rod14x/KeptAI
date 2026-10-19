-- Script consolidado para ejecutar en Supabase SQL Editor (V18 y V19)
-- Proyecto: KeptAI / Corpotex
-- Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
-- Descripción: Catálogo de productos, variantes con talla obligatoria, movimientos de inventario y bloqueo de ficha técnica entregada.

SET search_path = keptai, public;

-- ============================================================================
-- V18: Catálogo de productos, variantes con talla obligatoria y movimientos
-- ============================================================================
CREATE TABLE IF NOT EXISTS producto (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    codigo              varchar(50) NOT NULL,
    nombre              varchar(150) NOT NULL,
    prenda_tipo         varchar(50) NOT NULL,
    tela                varchar(100),
    color               varchar(50),
    categoria           varchar(50) NOT NULL DEFAULT 'PRENDA_BASE',
    unidad_medida       varchar(20) NOT NULL DEFAULT 'prendas',
    activo              boolean NOT NULL DEFAULT true,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, codigo)
);

CREATE INDEX IF NOT EXISTS ix_producto_organizacion ON producto (organizacion_id, activo);

CREATE TABLE IF NOT EXISTS producto_variante (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    producto_id         uuid NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    talla               varchar(20) NOT NULL,
    sku                 varchar(60),
    stock_actual        integer NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo        integer NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, producto_id, talla),
    FOREIGN KEY (organizacion_id, producto_id) REFERENCES producto(organizacion_id, id)
);

CREATE INDEX IF NOT EXISTS ix_variante_producto ON producto_variante (organizacion_id, producto_id);

CREATE TABLE IF NOT EXISTS movimiento_inventario (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    variante_id         uuid NOT NULL REFERENCES producto_variante(id) ON DELETE RESTRICT,
    tipo                varchar(30) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    cantidad            integer NOT NULL CHECK (cantidad <> 0),
    motivo              varchar(250) NOT NULL,
    usuario_id          uuid NOT NULL REFERENCES usuario(id),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, variante_id) REFERENCES producto_variante(organizacion_id, id),
    FOREIGN KEY (organizacion_id, usuario_id) REFERENCES usuario(organizacion_id, id)
);

CREATE INDEX IF NOT EXISTS ix_movimiento_variante ON movimiento_inventario (organizacion_id, variante_id, creado_en DESC);

-- Permisos y RLS
REVOKE ALL ON producto FROM PUBLIC;
REVOKE ALL ON producto_variante FROM PUBLIC;
REVOKE ALL ON movimiento_inventario FROM PUBLIC;

DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.producto FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.producto_variante FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.movimiento_inventario FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_variante ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_inventario ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON producto TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON producto_variante TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON movimiento_inventario TO keptai_runtime;

DROP POLICY IF EXISTS p_producto_organizacion ON producto;
CREATE POLICY p_producto_organizacion ON producto
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

DROP POLICY IF EXISTS p_variante_organizacion ON producto_variante;
CREATE POLICY p_variante_organizacion ON producto_variante
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

DROP POLICY IF EXISTS p_movimiento_organizacion ON movimiento_inventario;
CREATE POLICY p_movimiento_organizacion ON movimiento_inventario
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

-- ============================================================================
-- V19: Bloqueo de edición de Ficha Técnica cuando el pedido está entregado
-- ============================================================================
CREATE OR REPLACE FUNCTION keptai_private.fn_bloquear_ficha_entregada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
    v_estado varchar(30);
BEGIN
    SELECT estado INTO v_estado FROM keptai.orden WHERE id = NEW.orden_id;
    IF v_estado IN ('DESPACHADA', 'CERRADA', 'ENTREGADO') THEN
        RAISE EXCEPTION 'Ficha cerrada: no se puede modificar la ficha tecnica de un pedido en estado %', v_estado
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION keptai_private.fn_bloquear_ficha_entregada() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_bloquear_ficha_entregada ON keptai.ficha_tecnica;
CREATE TRIGGER tg_bloquear_ficha_entregada
BEFORE UPDATE ON keptai.ficha_tecnica
FOR EACH ROW EXECUTE FUNCTION keptai_private.fn_bloquear_ficha_entregada();
