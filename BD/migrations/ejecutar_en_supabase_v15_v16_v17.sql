-- Script consolidado para ejecutar en Supabase SQL Editor (V15, V16 y V17)
-- Proyecto: KeptAI / Corpotex
-- Asegurar que el esquema activo sea keptai:
SET search_path = keptai, public;

-- ============================================================================
-- V15: Campos de contacto directo en cliente y permisos comerciales (Fase 1)
-- ============================================================================
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS telefono_principal varchar(30);
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS canal_origen varchar(30) NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX IF NOT EXISTS ux_cliente_ruc_dni ON cliente (organizacion_id, ruc_dni) WHERE ruc_dni IS NOT NULL;

DROP POLICY IF EXISTS p_insercion ON contacto;
CREATE POLICY p_insercion ON contacto FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']));

DROP POLICY IF EXISTS p_actualizacion ON contacto;
CREATE POLICY p_actualizacion ON contacto FOR UPDATE TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']))
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']));

-- ============================================================================
-- V16: Tabla persistente ficha_tecnica y compuerta de confección/stock (Fase 3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ficha_tecnica (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id         uuid NOT NULL REFERENCES organizacion(id),
    orden_id                uuid NOT NULL UNIQUE REFERENCES orden(id) ON DELETE CASCADE,
    estado                  varchar(30) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'COMPLETA')),
    modalidad               varchar(30) NOT NULL DEFAULT 'STOCK_BORDADO' CHECK (modalidad IN ('STOCK_BORDADO', 'CONFECCION_ROLLO')),
    semaforo_tela           varchar(30) DEFAULT 'HABITUAL_VERDE' CHECK (semaforo_tela IN ('HABITUAL_VERDE', 'POR_CONFIRMAR_AMARILLO', 'ESPECIAL_ROJO')),
    consumo_estimado_kg     numeric(10,2) DEFAULT 0,
    validacion_tela         varchar(30) DEFAULT 'NO_APLICA' CHECK (validacion_tela IN ('NO_APLICA', 'PENDIENTE_TALLER', 'CONFIRMADA_TALLER', 'COMPRA_REQUERIDA')),
    tela_validada_por       uuid REFERENCES usuario(id),
    prenda_tipo             varchar(50),
    tela_nombre             varchar(100),
    gramaje                 varchar(50),
    color_principal         varchar(50),
    color_contraste         varchar(50),
    tipo_cuello             varchar(50),
    curva_tallas            jsonb,
    tecnica_personalizacion varchar(50),
    ubicaciones_arte        jsonb,
    instrucciones_costura   text,
    completada_por          uuid REFERENCES usuario(id),
    completada_en           timestamptz,
    creado_en               timestamptz NOT NULL DEFAULT now(),
    actualizado_en          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, orden_id),
    FOREIGN KEY (organizacion_id, tela_validada_por) REFERENCES usuario(organizacion_id, id),
    FOREIGN KEY (organizacion_id, completada_por) REFERENCES usuario(organizacion_id, id)
);

CREATE INDEX IF NOT EXISTS ix_ficha_tecnica_orden ON ficha_tecnica (organizacion_id, orden_id);

REVOKE ALL ON ficha_tecnica FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.ficha_tecnica FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE ficha_tecnica ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON ficha_tecnica TO keptai_runtime;

DROP POLICY IF EXISTS p_ficha_tecnica_organizacion ON ficha_tecnica;
CREATE POLICY p_ficha_tecnica_organizacion ON ficha_tecnica
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

-- ============================================================================
-- V17: Inicializar etapas de fabricación en orden_etapa al liberar pedidos (Fase 4)
-- ============================================================================
CREATE OR REPLACE FUNCTION keptai_private.inicializar_etapas_orden() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
    IF NEW.estado = 'LIBERADA' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'LIBERADA') THEN
        INSERT INTO keptai.orden_etapa (organizacion_id, orden_id, etapa, estado)
        VALUES 
            (NEW.organizacion_id, NEW.id, 'CORTE', 'PENDIENTE'),
            (NEW.organizacion_id, NEW.id, 'SUBLIMADO_BORDADO', 'PENDIENTE'),
            (NEW.organizacion_id, NEW.id, 'CONFECCION', 'PENDIENTE'),
            (NEW.organizacion_id, NEW.id, 'CALIDAD', 'PENDIENTE')
        ON CONFLICT (organizacion_id, orden_id, etapa) DO NOTHING;
    END IF;
    RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION keptai_private.inicializar_etapas_orden() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_inicializar_etapas ON orden;
CREATE TRIGGER tg_inicializar_etapas
AFTER INSERT OR UPDATE OF estado ON orden
FOR EACH ROW EXECUTE FUNCTION keptai_private.inicializar_etapas_orden();

INSERT INTO orden_etapa (organizacion_id, orden_id, etapa, estado)
SELECT o.organizacion_id, o.id, e.etapa, 'PENDIENTE'
FROM orden o
CROSS JOIN (VALUES ('CORTE'), ('SUBLIMADO_BORDADO'), ('CONFECCION'), ('CALIDAD')) AS e(etapa)
WHERE o.estado IN ('LIBERADA', 'EN_PRODUCCION', 'DESPACHADA', 'CERRADA')
ON CONFLICT (organizacion_id, orden_id, etapa) DO NOTHING;
