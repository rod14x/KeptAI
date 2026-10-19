-- V17: Inicializar etapas de fabricación en orden_etapa al liberar pedidos (Fase 4)
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V17'; END IF;
END $$;

-- 1. Función disparador para crear las 4 estaciones de taller al pasar a LIBERADA
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

-- 2. Inicializar etapas para órdenes preexistentes que ya estén liberadas o avanzadas
INSERT INTO orden_etapa (organizacion_id, orden_id, etapa, estado)
SELECT o.organizacion_id, o.id, e.etapa, 'PENDIENTE'
FROM orden o
CROSS JOIN (VALUES ('CORTE'), ('SUBLIMADO_BORDADO'), ('CONFECCION'), ('CALIDAD')) AS e(etapa)
WHERE o.estado IN ('LIBERADA', 'EN_PRODUCCION', 'DESPACHADA', 'CERRADA')
ON CONFLICT (organizacion_id, orden_id, etapa) DO NOTHING;
