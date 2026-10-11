-- Paso Supabase separado de Flyway PostgreSQL: requiere auth.uid() y storage.objects.
-- Revisar estado remoto antes de aplicar. No publicar keptai/keptai_private en Data API.
-- Bucket y RLS de objetos NO quedan cubiertos por RLS de las tablas de negocio.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('keptai-vouchers','keptai-vouchers',false,10485760,ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE OR REPLACE FUNCTION keptai_private.acceso_voucher(p_org text,p_escritura boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM keptai.usuario u WHERE u.auth_user_id=(SELECT auth.uid())
 AND u.activo AND u.organizacion_id::text=p_org AND
 (CASE WHEN p_escritura THEN u.rol='ADMIN' ELSE u.rol IN ('ADMIN','GERENTE') END))
$$;
REVOKE ALL ON FUNCTION keptai_private.acceso_voucher(text,boolean) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA keptai_private TO authenticated;
GRANT EXECUTE ON FUNCTION keptai_private.acceso_voucher(text,boolean) TO authenticated;
-- Esquema privado no expuesto; funcion solo responde pertenencia del JWT propio.
DROP POLICY IF EXISTS keptai_voucher_select ON storage.objects;
DROP POLICY IF EXISTS keptai_voucher_insert ON storage.objects;
CREATE POLICY keptai_voucher_select ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='keptai-vouchers' AND keptai_private.acceso_voucher((storage.foldername(name))[1],false));
CREATE POLICY keptai_voucher_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='keptai-vouchers' AND keptai_private.acceso_voucher((storage.foldername(name))[1],true)
 AND name !~ '(^|/)\.\.(/|$)');
-- No grant UPDATE/DELETE nuevo: archivo inmutable, objeto nuevo en correccion.
-- Auditar OTRAS politicas en storage.objects: las permisivas se suman con OR.

-- Barreras restrictivas: una politica permisiva ajena no abre este bucket.
DROP POLICY IF EXISTS keptai_voucher_read_guard ON storage.objects;
DROP POLICY IF EXISTS keptai_voucher_insert_guard ON storage.objects;
DROP POLICY IF EXISTS keptai_voucher_update_guard ON storage.objects;
DROP POLICY IF EXISTS keptai_voucher_delete_guard ON storage.objects;
DROP POLICY IF EXISTS keptai_voucher_anon_guard ON storage.objects;
CREATE POLICY keptai_voucher_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'keptai-vouchers' OR keptai_private.acceso_voucher((storage.foldername(name))[1],false));
CREATE POLICY keptai_voucher_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'keptai-vouchers' OR keptai_private.acceso_voucher((storage.foldername(name))[1],true));
CREATE POLICY keptai_voucher_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'keptai-vouchers') WITH CHECK(bucket_id<>'keptai-vouchers');
CREATE POLICY keptai_voucher_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'keptai-vouchers');
CREATE POLICY keptai_voucher_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id<>'keptai-vouchers') WITH CHECK(bucket_id<>'keptai-vouchers');
