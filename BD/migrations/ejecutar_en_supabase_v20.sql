-- Script consolidado para Supabase SQL Editor: Migración V20
-- Curva de tallas cerrada, reserva atómica de stock y artes de diseño con inmutabilidad (B-03, B-04, B-06)
-- Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
SET search_path = keptai, public;

-- 1. B-04: Reserva de stock en variantes de producto
ALTER TABLE keptai.producto_variante 
ADD COLUMN IF NOT EXISTS stock_reservado integer NOT NULL DEFAULT 0 CHECK (stock_reservado >= 0);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_disponible'
  ) THEN
    ALTER TABLE keptai.producto_variante 
    ADD CONSTRAINT chk_stock_disponible CHECK (stock_actual >= stock_reservado);
  END IF;
END $$;

-- 2. B-03: Estado de curva en orden y recargo de precio por talla en ítem
ALTER TABLE keptai.orden 
ADD COLUMN IF NOT EXISTS curva_estado varchar(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (curva_estado IN ('PENDIENTE', 'CERRADA'));

ALTER TABLE keptai.orden 
ADD COLUMN IF NOT EXISTS stock_reservado boolean NOT NULL DEFAULT false;

ALTER TABLE keptai.orden_item 
ADD COLUMN IF NOT EXISTS recargo_talla_cents integer NOT NULL DEFAULT 0 CHECK (recargo_talla_cents >= 0);

-- 3. B-03: Relación de personal importada
CREATE TABLE IF NOT EXISTS keptai.relacion_personal_pedido (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES keptai.organizacion(id),
    orden_id            uuid NOT NULL REFERENCES keptai.orden(id) ON DELETE CASCADE,
    nombre_completo     varchar(150),
    talla               varchar(20) NOT NULL,
    cantidad            integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    nombre_bordar       varchar(100),
    area_departamento   varchar(100),
    observaciones       text,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden(organizacion_id, id)
);

CREATE INDEX IF NOT EXISTS ix_personal_orden ON keptai.relacion_personal_pedido (organizacion_id, orden_id);

-- 4. B-06: Artes de personalización por pedido
CREATE TABLE IF NOT EXISTS keptai.arte_pedido (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id         uuid NOT NULL REFERENCES keptai.organizacion(id),
    orden_id                uuid NOT NULL REFERENCES keptai.orden(id) ON DELETE CASCADE,
    tecnica                 varchar(30) NOT NULL CHECK (tecnica IN ('SUBLIMADO', 'BORDADO', 'SERIGRAFIA', 'DTF', 'VINIL')),
    ubicacion               varchar(100) NOT NULL,
    ancho_cm                numeric(5,2),
    alto_cm                 numeric(5,2),
    colores_hilos           text,
    puntadas                integer CHECK (puntadas IS NULL OR puntadas >= 0),
    archivo_storage_path    text,
    estado                  varchar(30) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'ENVIADO_CLIENTE', 'APROBADO', 'CAMBIOS')),
    version_actual          integer NOT NULL DEFAULT 1 CHECK (version_actual >= 1),
    aprobado_por            uuid REFERENCES keptai.usuario(id),
    aprobado_en             timestamptz,
    aprobacion_canal        varchar(50),
    aprobacion_evidencia_url text,
    creado_por              uuid REFERENCES keptai.usuario(id),
    creado_en               timestamptz NOT NULL DEFAULT now(),
    actualizado_en          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden(organizacion_id, id),
    FOREIGN KEY (organizacion_id, creado_por) REFERENCES keptai.usuario(organizacion_id, id)
);

CREATE INDEX IF NOT EXISTS ix_arte_pedido_orden ON keptai.arte_pedido (organizacion_id, orden_id, estado);

-- 5. Trigger B-06: Inmutabilidad de la versión aprobada del arte
CREATE OR REPLACE FUNCTION keptai_private.fn_bloquear_arte_aprobado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
    IF OLD.estado = 'APROBADO' AND (
        NEW.tecnica <> OLD.tecnica OR
        NEW.ubicacion <> OLD.ubicacion OR
        NEW.ancho_cm IS DISTINCT FROM OLD.ancho_cm OR
        NEW.alto_cm IS DISTINCT FROM OLD.alto_cm OR
        NEW.puntadas IS DISTINCT FROM OLD.puntadas OR
        NEW.archivo_storage_path IS DISTINCT FROM OLD.archivo_storage_path OR
        NEW.version_actual <> OLD.version_actual
    ) THEN
        RAISE EXCEPTION 'Arte aprobado inmutable: cree una nueva versión si requiere cambios técnicos'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION keptai_private.fn_bloquear_arte_aprobado() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_bloquear_arte_aprobado ON keptai.arte_pedido;
CREATE TRIGGER tg_bloquear_arte_aprobado
BEFORE UPDATE ON keptai.arte_pedido
FOR EACH ROW EXECUTE FUNCTION keptai_private.fn_bloquear_arte_aprobado();

-- 6. Trigger B-03 y B-06: Compuerta de liberación de orden
CREATE OR REPLACE FUNCTION keptai_private.fn_validar_compuertas_liberacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
    v_artes_pendientes integer;
BEGIN
    IF NEW.estado IN ('RELEASED', 'IN_PRODUCTION') AND OLD.estado NOT IN ('RELEASED', 'IN_PRODUCTION') THEN
        IF NEW.curva_estado <> 'CERRADA' THEN
            RAISE EXCEPTION 'Bloqueo de producción: el pedido no puede liberarse sin curva de tallas CERRADA'
            USING ERRCODE = '23514';
        END IF;

        SELECT count(*) INTO v_artes_pendientes
        FROM keptai.arte_pedido
        WHERE orden_id = NEW.id AND estado <> 'APROBADO';

        IF v_artes_pendientes > 0 THEN
            RAISE EXCEPTION 'Bloqueo de producción: el pedido tiene % arte(s) sin aprobación del cliente', v_artes_pendientes
            USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION keptai_private.fn_validar_compuertas_liberacion() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_validar_compuertas_liberacion ON keptai.orden;
CREATE TRIGGER tg_validar_compuertas_liberacion
BEFORE UPDATE ON keptai.orden
FOR EACH ROW EXECUTE FUNCTION keptai_private.fn_validar_compuertas_liberacion();

-- 7. Permisos y RLS
REVOKE ALL ON keptai.relacion_personal_pedido FROM PUBLIC;
REVOKE ALL ON keptai.arte_pedido FROM PUBLIC;

DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.relacion_personal_pedido FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.arte_pedido FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE keptai.relacion_personal_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE keptai.arte_pedido ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON keptai.relacion_personal_pedido TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON keptai.arte_pedido TO keptai_runtime;

DROP POLICY IF EXISTS p_personal_organizacion ON keptai.relacion_personal_pedido;
CREATE POLICY p_personal_organizacion ON keptai.relacion_personal_pedido
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

DROP POLICY IF EXISTS p_arte_organizacion ON keptai.arte_pedido;
CREATE POLICY p_arte_organizacion ON keptai.arte_pedido
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());
