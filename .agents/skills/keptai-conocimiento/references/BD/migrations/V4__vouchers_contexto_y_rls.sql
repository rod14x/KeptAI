-- D-007 (Miguel, 2026-10-10): vouchers persistentes, sin historial de mensajes.
-- Mantener V1-V3: Flyway schemas/defaultSchema=keptai. NO ejecutar sobre public.
-- Roles runtime y migrador separados; esta migracion requiere permiso CREATE ROLE.
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar Flyway defaultSchema=keptai antes de migrar'; END IF;
 IF EXISTS (SELECT 1 FROM keptai.mensaje) OR EXISTS (SELECT 1 FROM keptai.mensaje_saliente) THEN
  RAISE EXCEPTION 'Hay mensajes previos: revisar y purgar con procedimiento autorizado antes de V4; no se destruyen silenciosamente';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='keptai_runtime') THEN CREATE ROLE keptai_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='keptai_runtime' AND (rolsuper OR rolbypassrls OR rolcreaterole)) THEN RAISE EXCEPTION 'keptai_runtime tiene privilegios incompatibles con RLS'; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS keptai_private;
REVOKE ALL ON SCHEMA keptai, keptai_private FROM PUBLIC;
GRANT USAGE ON SCHEMA keptai, keptai_private TO keptai_runtime;
-- Solo metadatos de canal para identificar origen; no contenido ni archivo de chat.
ALTER TABLE chat RENAME TO canal_whatsapp;
ALTER TABLE orden RENAME COLUMN chat_id TO canal_id;
ALTER TABLE hoja_resumen RENAME COLUMN chat_id TO canal_id;
ALTER TABLE comprobante DROP COLUMN mensaje_id;
ALTER TABLE comprobante ADD COLUMN instancia_origen text;
ALTER TABLE comprobante ADD COLUMN provider_message_id text;
ALTER TABLE comprobante ADD CONSTRAINT ck_comprobante_origen CHECK ((instancia_origen IS NULL) = (provider_message_id IS NULL));
ALTER TABLE comprobante ADD CONSTRAINT ck_comprobante_hash CHECK (archivo_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE comprobante ADD CONSTRAINT ck_comprobante_path CHECK (archivo_storage_path LIKE organizacion_id::text || '/%' AND archivo_storage_path !~ '(^|/)\.\.(/|$)' AND archivo_storage_path !~ '://');
DROP TABLE mensaje; -- sin CASCADE; V4 aborta si hay datos o dependencias inesperadas.
ALTER TABLE mensaje_saliente RENAME TO envio_notificacion;
ALTER TABLE envio_notificacion DROP COLUMN texto;
COMMENT ON TABLE envio_notificacion IS 'Outbox de metadatos; texto se genera al enviar y nunca se persiste. No historial WhatsApp.';
COMMENT ON TABLE canal_whatsapp IS 'Instancia/JID de enrutamiento, no historial ni transcript.';
-- Extraccion incompleta cabe en BORRADOR; no inventar clientes/total/condicion.
ALTER TABLE orden ALTER COLUMN cliente_id DROP NOT NULL;
ALTER TABLE orden ALTER COLUMN total DROP NOT NULL;
ALTER TABLE orden ALTER COLUMN condicion_pago DROP NOT NULL;
ALTER TABLE orden ADD CONSTRAINT ck_orden_confirmable CHECK (estado='BORRADOR' OR (cliente_id IS NOT NULL AND total > 0 AND condicion_pago IS NOT NULL));
ALTER TABLE orden ADD CONSTRAINT ck_credito_plazo CHECK (condicion_pago IS DISTINCT FROM 'CREDITO' OR plazo_dias BETWEEN 15 AND 30);
ALTER TABLE hoja_resumen ADD CONSTRAINT ck_hoja_sin_historial CHECK (NOT (extraccion ?| ARRAY['transcript','mensajes','contenido_texto','audio_base64','crudo']));
-- Credenciales hash de servicio: solo migrador provisiona; nunca un secreto en claro.
CREATE TABLE integracion_servicio (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organizacion_id uuid NOT NULL REFERENCES organizacion(id),
 instancia text NOT NULL, alcance text NOT NULL CHECK (alcance IN ('INGESTA','SCHEDULER')),
 clave_hash char(64) NOT NULL CHECK (clave_hash ~ '^[0-9a-f]{64}$'), activo boolean NOT NULL DEFAULT true,
 UNIQUE (organizacion_id,id), UNIQUE (clave_hash), UNIQUE (organizacion_id,instancia,alcance)
);
CREATE INDEX ix_usuario_auth_activo ON usuario(auth_user_id,organizacion_id) WHERE activo;
-- Bootstrap restringido a JDBC confiable, despues de validar firma/issuer/audience del JWT.
-- Sin SELECT directo sin contexto; NO se expone este schema por Data API.
CREATE FUNCTION keptai_private.resolver_usuario(p_auth uuid) RETURNS TABLE(usuario_id uuid, organizacion_id uuid, rol text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id,u.organizacion_id,u.rol FROM keptai.usuario u WHERE u.auth_user_id=p_auth AND u.activo
$$;
CREATE FUNCTION keptai_private.resolver_servicio(p_hash text) RETURNS TABLE(servicio_id uuid,organizacion_id uuid,instancia text,alcance text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT s.id,s.organizacion_id,s.instancia,s.alcance FROM keptai.integracion_servicio s WHERE s.clave_hash=p_hash AND s.activo
$$;
-- Un UUID de organizacion solo no concede acceso: exige usuario o servicio activos.
CREATE FUNCTION keptai_private.actor_actual() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o uuid; u uuid; s uuid; a text;
BEGIN
 o:=nullif(current_setting('app.organizacion_id',true),'')::uuid;
 u:=nullif(current_setting('app.usuario_id',true),'')::uuid;
 s:=nullif(current_setting('app.servicio_id',true),'')::uuid;
 IF o IS NULL OR (u IS NULL)=(s IS NULL) THEN RETURN NULL; END IF;
 IF u IS NOT NULL THEN SELECT rol INTO a FROM keptai.usuario WHERE id=u AND organizacion_id=o AND activo;
 ELSE SELECT alcance INTO a FROM keptai.integracion_servicio WHERE id=s AND organizacion_id=o AND activo; END IF;
 RETURN a;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION app_organizacion_actual() RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
BEGIN RETURN nullif(current_setting('app.organizacion_id',true),'')::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA keptai FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA keptai,keptai_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION keptai.app_organizacion_actual(),keptai_private.actor_actual(),keptai_private.resolver_usuario(uuid),keptai_private.resolver_servicio(text) TO keptai_runtime;
-- Supabase: Data API bloqueada para negocio; el navegador usa Spring con JWT.
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA keptai,keptai_private FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA keptai FROM %I',r);
   EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA keptai,keptai_private FROM %I',r);
  END IF;
 END LOOP;
END $$;
-- Remplaza politicas TO PUBLIC. SELECT separado de INSERT/UPDATE; no DELETE runtime.
DO $$ DECLARE t record; p record; read_actors text[]; write_actors text[]; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='keptai' AND tablename <> 'flyway_schema_history' LOOP
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='keptai' AND c.relname=t.tablename AND r.rolname='keptai_runtime') THEN RAISE EXCEPTION 'Runtime no puede ser propietario'; END IF;
  EXECUTE format('ALTER TABLE keptai.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='keptai' AND tablename=t.tablename LOOP EXECUTE format('DROP POLICY %I ON keptai.%I',p.policyname,t.tablename); END LOOP;
  IF t.tablename='integracion_servicio' THEN CONTINUE; END IF;
  read_actors:=CASE WHEN t.tablename IN ('pago','comprobante','aplicacion_pago','obligacion_cobro','apertura_caja','egreso_caja','nota_cliente','aprobacion_credito') THEN ARRAY['VENDEDOR','ADMIN','GERENTE','INGESTA','SCHEDULER'] ELSE ARRAY['VENDEDOR','ADMIN','GERENTE','JEFE_TALLER','INGESTA','SCHEDULER'] END;
  write_actors:=CASE
   WHEN t.tablename IN ('usuario','organizacion','marca','linea_producto','unidad_produccion') THEN ARRAY[]::text[]
   WHEN t.tablename IN ('aplicacion_pago','pago','comprobante','obligacion_cobro','apertura_caja','egreso_caja') THEN ARRAY['ADMIN']
   WHEN t.tablename IN ('costo_orden','orden_etapa','despacho') THEN ARRAY['ADMIN','JEFE_TALLER']
   WHEN t.tablename IN ('envio_notificacion','alerta_cobranza') THEN ARRAY['ADMIN','SCHEDULER']
   WHEN t.tablename IN ('evento_auditoria','solicitud_idempotente') THEN read_actors
   ELSE ARRAY['VENDEDOR','ADMIN','INGESTA'] END;
  EXECUTE format('GRANT SELECT ON keptai.%I TO keptai_runtime',t.tablename);
  EXECUTE format('CREATE POLICY p_lectura ON keptai.%I FOR SELECT TO keptai_runtime USING (%s = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (%L::text[]))',t.tablename,CASE WHEN t.tablename='organizacion' THEN 'id' ELSE 'organizacion_id' END,read_actors);
  IF cardinality(write_actors)>0 THEN
   EXECUTE format('GRANT INSERT, UPDATE ON keptai.%I TO keptai_runtime',t.tablename);
   EXECUTE format('CREATE POLICY p_insercion ON keptai.%I FOR INSERT TO keptai_runtime WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (%L::text[]))',t.tablename,CASE WHEN t.tablename IN ('pago','comprobante') THEN array_append(write_actors,'INGESTA') ELSE write_actors END);
   EXECUTE format('CREATE POLICY p_actualizacion ON keptai.%I FOR UPDATE TO keptai_runtime USING (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (%L::text[])) WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (%L::text[]))',t.tablename,write_actors,write_actors);
  END IF;
 END LOOP;
END $$;
-- El servicio INGESTA solo puede registrar fase RECIBIDO, nunca fingir fondos verificados.
CREATE POLICY p_ingesta_pago_limite ON pago AS RESTRICTIVE FOR INSERT TO keptai_runtime WITH CHECK
 ((SELECT keptai_private.actor_actual()) <> 'INGESTA' OR (fase='RECIBIDO' AND verificado_por IS NULL AND verificado_en IS NULL AND estado_conciliacion<>'APLICADO'));
REVOKE UPDATE ON evento_auditoria FROM keptai_runtime; -- append-only.
GRANT SELECT ON v_saldo_obligacion,v_cliente_mora,v_margen_orden TO keptai_runtime;
-- Nuevos objetos del migrador no heredan grants publicos.
ALTER DEFAULT PRIVILEGES IN SCHEMA keptai REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA keptai_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE POLICY p_ingesta_orden_limite ON orden AS RESTRICTIVE FOR ALL TO keptai_runtime
 USING (true) WITH CHECK ((SELECT keptai_private.actor_actual()) <> 'INGESTA' OR estado='BORRADOR');
