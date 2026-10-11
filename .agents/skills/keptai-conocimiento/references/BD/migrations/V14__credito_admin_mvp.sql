-- D-014, Miguel 11/10/2026: ADMIN autoriza crédito desde el panel durante el MVP.
-- Nueva migración: no modifica V7 ni decisiones históricas; autoría sigue validada por tg_autoria.
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V14'; END IF;
END $$;
DROP POLICY p_insercion ON aprobacion_credito;
DROP POLICY p_actualizacion ON aprobacion_credito;
CREATE POLICY p_insercion ON aprobacion_credito FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN');
CREATE POLICY p_actualizacion ON aprobacion_credito FOR UPDATE TO keptai_runtime
 USING (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN')
 WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN');
