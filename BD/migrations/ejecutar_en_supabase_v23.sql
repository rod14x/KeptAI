-- V23: Asegurar ON DELETE CASCADE en tablas dependientes de orden y RLS a keptai_runtime para Supabase SQL Editor
-- Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
SET search_path = keptai, public;

-- 1. Cascada para orden_etapa hacia orden
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orden_etapa_organizacion_id_orden_id_fkey') THEN
    ALTER TABLE keptai.orden_etapa
      DROP CONSTRAINT orden_etapa_organizacion_id_orden_id_fkey,
      ADD CONSTRAINT orden_etapa_organizacion_id_orden_id_fkey
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Cascada para ficha_tecnica hacia orden
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ficha_tecnica_orden') THEN
    ALTER TABLE keptai.ficha_tecnica
      DROP CONSTRAINT fk_ficha_tecnica_orden,
      ADD CONSTRAINT fk_ficha_tecnica_orden
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Cascada para tablas auxiliares de producción hacia orden si existen
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reserva_stock_orden') THEN
    ALTER TABLE keptai.reserva_stock
      DROP CONSTRAINT fk_reserva_stock_orden,
      ADD CONSTRAINT fk_reserva_stock_orden
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orden_arte_orden') THEN
    ALTER TABLE keptai.orden_arte
      DROP CONSTRAINT fk_orden_arte_orden,
      ADD CONSTRAINT fk_orden_arte_orden
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orden_personal_orden') THEN
    ALTER TABLE keptai.orden_personal
      DROP CONSTRAINT fk_orden_personal_orden,
      ADD CONSTRAINT fk_orden_personal_orden
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orden_avance_orden') THEN
    ALTER TABLE keptai.orden_avance
      DROP CONSTRAINT fk_orden_avance_orden,
      ADD CONSTRAINT fk_orden_avance_orden
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orden_partida_orden') THEN
    ALTER TABLE keptai.orden_partida_tela
      DROP CONSTRAINT fk_orden_partida_orden,
      ADD CONSTRAINT fk_orden_partida_orden
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Reasignar politicas RLS de keptai a keptai_runtime para restringir acceso public
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'keptai' AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO keptai_runtime', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;
