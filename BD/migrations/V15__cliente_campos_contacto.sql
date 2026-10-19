-- V15: Campos de contacto directo en cliente y permisos comerciales (Fase 1)
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V15'; END IF;
END $$;

-- 1. Campos adicionales en tabla cliente para captura en mostrador y sincronización
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS telefono_principal varchar(30);
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS canal_origen varchar(30) NOT NULL DEFAULT 'MANUAL';

-- 2. Asegurar que ruc_dni con organizacion_id tenga índice único cuando no sea nulo
CREATE UNIQUE INDEX IF NOT EXISTS ux_cliente_ruc_dni ON cliente (organizacion_id, ruc_dni) WHERE ruc_dni IS NOT NULL;

-- 3. Permitir a VENDEDOR insertar y actualizar en tabla contacto (además de ADMIN)
DROP POLICY IF EXISTS p_insercion ON contacto;
CREATE POLICY p_insercion ON contacto FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']));

DROP POLICY IF EXISTS p_actualizacion ON contacto;
CREATE POLICY p_actualizacion ON contacto FOR UPDATE TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']))
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']));
