package pe.keptai.backend.infra;

import java.sql.*;
import java.util.UUID;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

/** Migraciones reales V1-V9, rol no propietario, tenant y transacciones reales; sin Supabase remoto. */
class SchemaRlsTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final String A="10000000-0000-4000-8000-000000000001", B="10000000-0000-4000-8000-000000000002";
 static final String UA="20000000-0000-4000-8000-000000000001", UB="20000000-0000-4000-8000-000000000002";
 static final String CA="30000000-0000-4000-8000-000000000001", CB="30000000-0000-4000-8000-000000000002";
 static final String OA="40000000-0000-4000-8000-000000000001", OB="40000000-0000-4000-8000-000000000002";
 static final String RA="50000000-0000-4000-8000-000000000001", RB="50000000-0000-4000-8000-000000000002";
 static final String PA="60000000-0000-4000-8000-000000000001", PB="60000000-0000-4000-8000-000000000002";
 static final String SA="70000000-0000-4000-8000-000000000001";
 static final String UV="20000000-0000-4000-8000-000000000003", UJ="20000000-0000-4000-8000-000000000004", OC="40000000-0000-4000-8000-000000000003";
 @BeforeAll static void setup() throws Exception {
  PG.start();
  try(Connection c=owner()){exec(c,"CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role");}
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  try(Connection c=owner()){
   exec(c,"SET search_path=keptai,public");
   for(int i=1;i<=2;i++){
    String g=i==1?A:B,u=i==1?UA:UB,cl=i==1?CA:CB,o=i==1?OA:OB,r=i==1?RA:RB,p=i==1?PA:PB;
    exec(c,"INSERT INTO organizacion(id,nombre) VALUES ('"+g+"','Demo'); INSERT INTO usuario(id,organizacion_id,auth_user_id,nombre,rol) VALUES ('"+u+"','"+g+"','"+u+"','Demo','ADMIN'); INSERT INTO cliente(id,organizacion_id,razon_social,tipo) VALUES ('"+cl+"','"+g+"','Demo','EMPRESA'); INSERT INTO orden(id,organizacion_id,ref,cliente_id,condicion_pago,plazo_dias,total) VALUES ('"+o+"','"+g+"','P-00"+i+"','"+cl+"','CREDITO',30,100); INSERT INTO obligacion_cobro(id,organizacion_id,orden_id,monto,plazo_dias) VALUES ('"+r+"','"+g+"','"+o+"',100,30); INSERT INTO pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,fase,verificado_por,verificado_en) VALUES ('"+p+"','"+g+"','"+cl+"',100,current_date,'YAPE','VERIFICADO_BANCO','"+u+"',now())");
   }
   exec(c,"INSERT INTO integracion_servicio(id,organizacion_id,instancia,alcance,clave_hash) VALUES ('"+SA+"','"+A+"','ventas-01','INGESTA',repeat('a',64))");
   exec(c,"INSERT INTO usuario(id,organizacion_id,auth_user_id,nombre,rol) VALUES ('"+UV+"','"+A+"','"+UV+"','Demo','VENDEDOR'),('"+UJ+"','"+A+"','"+UJ+"','Demo','JEFE_TALLER')");
   exec(c,"INSERT INTO orden(id,organizacion_id,ref,cliente_id,condicion_pago,total,estado) VALUES ('"+OC+"','"+A+"','P-003','"+CA+"','CONTADO',100,'PENDIENTE_APROBACION')");
   exec(c,"INSERT INTO apertura_caja(organizacion_id,fecha,importe,fuente) VALUES ('"+A+"',current_date,1000,'demo'); INSERT INTO egreso_caja(organizacion_id,concepto,fecha_prevista,monto,fuente) VALUES ('"+A+"','demo',current_date,10,'demo')");
   exec(c,"INSERT INTO evento_auditoria(organizacion_id,actor,operacion,entidad,entidad_id) VALUES ('"+A+"','SISTEMA','PAGO_APLICADO','pago','"+PA+"'),('"+A+"','SISTEMA','ETAPA_AVANZADA','orden_etapa','"+OA+"')");
   // Emulacion minima de catalogos Storage y auth.uid para validar SQL/politicas;
   // no acredita API Storage, JWT real ni configuracion remota de Supabase.
   exec(c,"CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage,auth TO authenticated,anon; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon; CREATE POLICY test_broad_permissive ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true)");
   exec(c,java.nio.file.Files.readString(java.nio.file.Path.of("../BD/supabase/vouchers_storage.sql")));
   exec(c,"INSERT INTO storage.objects(bucket_id,name) VALUES ('keptai-vouchers','"+A+"/demo-a.png'),('keptai-vouchers','"+B+"/demo-b.png')");
  }
 }
 @AfterAll static void stop(){PG.stop();}
 static Connection owner() throws SQLException{return DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());}
 static Connection runtime() throws SQLException{Connection c=owner();exec(c,"SET ROLE keptai_runtime; SET search_path=keptai,public");c.setAutoCommit(false);return c;}
 static void exec(Connection c,String sql)throws SQLException{try(Statement s=c.createStatement()){s.execute(sql);}}
 static String scalar(Connection c,String sql)throws SQLException{try(Statement s=c.createStatement();ResultSet rs=s.executeQuery(sql)){rs.next();return rs.getString(1);}}
 static void context(Connection c,String org,String user,String service)throws SQLException{
  try(PreparedStatement p=c.prepareStatement("SELECT set_config('app.organizacion_id',?,true),set_config('app.usuario_id',?,true),set_config('app.servicio_id',?,true)")){p.setString(1,org);p.setString(2,user);p.setString(3,service);p.execute();}
 }
 static void denied(Connection c,String sql)throws SQLException{
  Savepoint s=c.setSavepoint();assertThatThrownBy(()->exec(c,sql)).isInstanceOf(SQLException.class);c.rollback(s);
 }
 static String application(String id,String amount){return "INSERT INTO aplicacion_pago(id,organizacion_id,pago_id,obligacion_id,monto_aplicado,aplicado_por) VALUES ('"+id+"','"+A+"','"+PA+"','"+RA+"',"+amount+",'"+UA+"')";}
 @Test void migrationsAndPrivacy()throws Exception{try(Connection c=owner()){
  assertThat(scalar(c,"SELECT count(*) FROM keptai.flyway_schema_history WHERE success AND version IS NOT NULL")).isEqualTo("14");
  assertThat(scalar(c,"SELECT count(*) FROM information_schema.tables WHERE table_schema='keptai' AND table_name IN ('mensaje','mensaje_saliente','nota_cliente')")).isEqualTo("0");
  // V10 (dirección de Miguel, 11/10/2026): contacto vuelve SOLO como metadatos de WhatsApp de un cliente; sin mensajes ni notas.
  assertThat(scalar(c,"SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='keptai' AND table_name='contacto'")).isEqualTo("activo,cliente_id,creado_en,id,nombre,organizacion_id,whatsapp_jid");
  assertThat(scalar(c,"SELECT count(*) FROM information_schema.columns WHERE table_schema='keptai' AND column_name IN ('contenido_texto','texto','mensaje_id')")).isEqualTo("0");
  assertThat(scalar(c,"SELECT count(*) FROM pg_tables WHERE schemaname='keptai' AND tablename<>'flyway_schema_history' AND NOT rowsecurity")).isEqualTo("0");
  assertThat(scalar(c,"SELECT count(*) FROM pg_policies WHERE schemaname='keptai' AND 'public'=ANY(roles)")).isEqualTo("0");
  assertThat(scalar(c,"SELECT has_function_privilege('anon','keptai_private.resolver_usuario(uuid)','EXECUTE')")).isEqualTo("f");
 }}
 @Test void contextIsRequiredAndDoesNotLeakOnReusedConnection()throws Exception{try(Connection c=runtime()){
  assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("0");
  context(c,A,"","");assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("0");
  context(c,A,UB,"");assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("0");
  context(c,A,UA,"");assertThat(scalar(c,"SELECT id FROM cliente")).isEqualTo(CA);assertThat(scalar(c,"SELECT count(*) FROM v_saldo_obligacion")).isEqualTo("1");
  c.commit();assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("0");
  context(c,B,UB,"");assertThat(scalar(c,"SELECT id FROM cliente")).isEqualTo(CB);
  c.rollback();assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("0");
  context(c,"bad-uuid",UA,"");assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("0");
 }}
 @Test void bootstrapAndCrossTenantWriteAndDeleteAreRestricted()throws Exception{try(Connection c=runtime()){
  assertThat(scalar(c,"SELECT organizacion_id FROM keptai_private.resolver_usuario('"+UA+"')")).isEqualTo(A);
  context(c,A,UA,"");
  assertThat(scalar(c,"SELECT count(*) FROM cliente WHERE id='"+CB+"'")).isEqualTo("0");
  denied(c,"INSERT INTO cliente(organizacion_id,razon_social,tipo) VALUES ('"+B+"','Demo','EMPRESA')");
  denied(c,"INSERT INTO orden_item(organizacion_id,orden_id,descripcion,cantidad,precio_unit) VALUES ('"+A+"','"+OB+"','Demo',1,1)");
  denied(c,"DELETE FROM aplicacion_pago");denied(c,"UPDATE evento_auditoria SET operacion='x'");denied(c,"SELECT * FROM integracion_servicio");
 }}
 @Test void ingestionCannotVerifyFundsOrApplyPayments()throws Exception{try(Connection c=runtime()){
  context(c,A,"",SA);
  denied(c,"INSERT INTO pago(organizacion_id,monto,fecha_pago,medio,fase,verificado_por,verificado_en) VALUES ('"+A+"',10,current_date,'YAPE','VERIFICADO_BANCO','"+UA+"',now())");
  denied(c,application(UUID.randomUUID().toString(),"10"));
  assertThat(scalar(c,"WITH t AS (UPDATE pago SET fase='APLICADO' WHERE id='"+PA+"' RETURNING id) SELECT count(*) FROM t")).isEqualTo("0");
 }}
 @Test void applicationsAreVerifiedImmutableAndBounded()throws Exception{try(Connection c=runtime()){
  context(c,A,UA,"");String id=UUID.randomUUID().toString();
  exec(c,application(id,"60"));assertThat(scalar(c,"SELECT saldo FROM v_saldo_obligacion WHERE obligacion_id='"+RA+"'")).isEqualTo("40.00");
  denied(c,application(UUID.randomUUID().toString(),"41"));
  denied(c,"UPDATE aplicacion_pago SET pago_id='"+PB+"' WHERE id='"+id+"'");
  denied(c,"UPDATE aplicacion_pago SET monto_aplicado=1 WHERE id='"+id+"'");
  denied(c,"UPDATE aplicacion_pago SET anulada_en=now(),anulada_por='"+UA+"' WHERE id='"+id+"'");
  exec(c,"UPDATE aplicacion_pago SET anulada_en=now(),anulada_por='"+UA+"',motivo_anulacion='Correccion demo' WHERE id='"+id+"'");
  assertThat(scalar(c,"SELECT saldo FROM v_saldo_obligacion WHERE obligacion_id='"+RA+"'")).isEqualTo("100.00");
  denied(c,"UPDATE aplicacion_pago SET anulada_en=NULL,anulada_por=NULL WHERE id='"+id+"'");
 }}
 @Test void incompleteCostIsNullAndCurrencyCannotMix()throws Exception{try(Connection c=runtime()){
  context(c,A,UA,"");assertThat(scalar(c,"SELECT margen_real_cobrado FROM v_margen_orden WHERE orden_id='"+OA+"'")).isNull();
  denied(c,"INSERT INTO costo_orden(organizacion_id,orden_id,concepto,monto,moneda,origen,fuente) VALUES ('"+A+"','"+OA+"','MANO_OBRA',30,'USD','REAL','demo')");
  exec(c,"INSERT INTO costo_orden(organizacion_id,orden_id,concepto,monto,origen,fuente) VALUES ('"+A+"','"+OA+"','MANO_OBRA',30,'REAL','demo')");
  exec(c,"UPDATE orden SET costos_reales_completos=true WHERE id='"+OA+"'");
  assertThat(scalar(c,"SELECT margen_venta_real FROM v_margen_orden WHERE orden_id='"+OA+"'")).isEqualTo("70.00");
  exec(c,"INSERT INTO costo_orden(organizacion_id,orden_id,concepto,monto,origen,fuente) VALUES ('"+A+"','"+OA+"','CIF',10,'REAL','demo')");
  assertThat(scalar(c,"SELECT margen_real_cobrado FROM v_margen_orden WHERE orden_id='"+OA+"'")).isNull();
 }}
 @Test void duplicateAndOrphanDoNotMoveBalancesAndCreditGateApplies()throws Exception{try(Connection c=runtime()){
 context(c,A,UA,"");
 denied(c,"UPDATE orden SET estado='LIBERADA' WHERE id='"+OA+"'");
 exec(c,"UPDATE pago SET fase='RECIBIDO',verificado_por=NULL,verificado_en=NULL WHERE id='"+PA+"'");
 denied(c,application(UUID.randomUUID().toString(),"10"));
 denied(c,"UPDATE pago SET estado_conciliacion='DUPLICADO',duplicado_de_pago_id='"+PA+"' WHERE id='"+PA+"'");
 String other=UUID.randomUUID().toString();
 exec(c,"INSERT INTO pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio) VALUES ('"+other+"','"+A+"','"+CA+"',100,current_date,'YAPE')");
 exec(c,"UPDATE pago SET estado_conciliacion='DUPLICADO',duplicado_de_pago_id='"+other+"' WHERE id='"+PA+"'");
 denied(c,application(UUID.randomUUID().toString(),"10"));
 denied(c,"UPDATE pago SET fase='VERIFICADO_BANCO',verificado_por='"+UA+"',verificado_en=now() WHERE id='"+PA+"'");
 exec(c,"UPDATE pago SET estado_conciliacion='SIN_ORDEN',duplicado_de_pago_id=NULL,cliente_id=NULL,fase='VERIFICADO_BANCO',verificado_por='"+UA+"',verificado_en=now() WHERE id='"+PA+"'");
 denied(c,application(UUID.randomUUID().toString(),"10"));
 assertThat(scalar(c,"SELECT saldo FROM v_saldo_obligacion WHERE obligacion_id='"+RA+"'")).isEqualTo("100.00");
 }}
 @Test void queryUsesTenantRecentPaymentIndexAtRepresentativeCardinality()throws Exception{try(Connection c=owner()){
 c.setAutoCommit(false);exec(c,"SET search_path=keptai,public");
 exec(c,"INSERT INTO pago(organizacion_id,monto,fecha_pago,medio) SELECT CASE WHEN i%2=0 THEN '"+A+"'::uuid ELSE '"+B+"'::uuid END,1,current_date,'YAPE' FROM generate_series(1,10000) i");
 exec(c,"ANALYZE pago");
 String plan=scalar(c,"EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,creado_en FROM pago WHERE organizacion_id='"+A+"' ORDER BY creado_en DESC,id DESC LIMIT 25");
 assertThat(plan).contains("ix_pago_reciente");
 c.rollback();
 }}
 @Test void storagePoliciesBlockCrossTenantAndBroadPolicyAndAnonymous()throws Exception{try(Connection c=owner()){
 exec(c,"SET ROLE authenticated");c.setAutoCommit(false);
 exec(c,"SELECT set_config('request.jwt.claim.sub','"+UA+"',true)");
 assertThat(scalar(c,"SELECT name FROM storage.objects")).isEqualTo(A+"/demo-a.png");
 denied(c,"INSERT INTO storage.objects(bucket_id,name) VALUES ('keptai-vouchers','"+B+"/forbidden.png')");
 exec(c,"INSERT INTO storage.objects(bucket_id,name) VALUES ('keptai-vouchers','"+A+"/allowed.png')");
 assertThat(scalar(c,"WITH t AS (DELETE FROM storage.objects RETURNING id) SELECT count(*) FROM t")).isEqualTo("0");
 assertThat(scalar(c,"WITH t AS (UPDATE storage.objects SET name='overwrite' RETURNING id) SELECT count(*) FROM t")).isEqualTo("0");
 c.rollback();exec(c,"RESET ROLE;SET ROLE anon");
 assertThat(scalar(c,"SELECT count(*) FROM storage.objects")).isEqualTo("0");
 }}
 static String credit(String by){return "INSERT INTO aprobacion_credito(organizacion_id,orden_id,decision,aprobado_por,decidido_en,plazo_dias) VALUES ('"+A+"','"+OA+"','APROBADO','"+by+"',now(),30)";}
 @Test void onlyAdminDecidesCreditAndAsThemself()throws Exception{try(Connection c=runtime()){
  context(c,A,"",SA);denied(c,credit(UV));
  context(c,A,UV,"");denied(c,credit(UV));
  context(c,A,UA,"");denied(c,credit(UV));
  exec(c,credit(UA));
 }}
 @Test void authorshipAndAuditActorCannotBeSpoofed()throws Exception{try(Connection c=runtime()){
  context(c,A,UA,"");
  denied(c,"INSERT INTO aplicacion_pago(organizacion_id,pago_id,obligacion_id,monto_aplicado,aplicado_por) VALUES ('"+A+"','"+PA+"','"+RA+"',10,'"+UV+"')");
  String audit="INSERT INTO evento_auditoria(organizacion_id,usuario_id,actor,operacion,entidad,entidad_id) VALUES ('"+A+"',";
  denied(c,audit+"'"+UV+"','USUARIO','X','pago','"+PA+"')");
  denied(c,audit+"'"+UV+"','SISTEMA','X','pago','"+PA+"')");
  denied(c,audit+"NULL,'N8N','X','pago','"+PA+"')");
  exec(c,audit+"'"+UA+"','USUARIO','X','pago','"+PA+"')");
  context(c,A,"",SA);
  denied(c,audit+"'"+UA+"','USUARIO','X','pago','"+PA+"')");
  exec(c,audit+"NULL,'N8N','X','pago','"+PA+"')");
 }}
 @Test void financialParentsAreFrozenWhileApplicationsAreActive()throws Exception{try(Connection c=runtime()){
  context(c,A,UA,"");String id=UUID.randomUUID().toString();exec(c,application(id,"60"));
  denied(c,"UPDATE pago SET monto=50 WHERE id='"+PA+"'");
  denied(c,"UPDATE pago SET fase='RECIBIDO',verificado_por=NULL,verificado_en=NULL WHERE id='"+PA+"'");
  denied(c,"UPDATE obligacion_cobro SET estado='ANULADA' WHERE id='"+RA+"'");
  denied(c,"UPDATE obligacion_cobro SET monto=50 WHERE id='"+RA+"'");
  denied(c,"UPDATE orden SET total=200 WHERE id='"+OA+"'");
  exec(c,"UPDATE aplicacion_pago SET anulada_en=now(),anulada_por='"+UA+"',motivo_anulacion='Correccion demo' WHERE id='"+id+"'");
  exec(c,"UPDATE pago SET monto=50 WHERE id='"+PA+"'");
  exec(c,"UPDATE orden SET total=200 WHERE id='"+OA+"'");
 }}
 @Test void costClosureAndConfirmedOrdersAreProtected()throws Exception{try(Connection c=runtime()){
  context(c,A,UV,"");denied(c,"UPDATE orden SET costos_reales_completos=true WHERE id='"+OA+"'");
  context(c,A,"",SA);
  assertThat(scalar(c,"WITH t AS (UPDATE orden SET total=1 WHERE id='"+OC+"' RETURNING id) SELECT count(*) FROM t")).isEqualTo("0");
  denied(c,"INSERT INTO orden_item(organizacion_id,orden_id,descripcion,cantidad,precio_unit) VALUES ('"+A+"','"+OC+"','Demo',1,1)");
  exec(c,"INSERT INTO orden_item(organizacion_id,orden_id,descripcion,cantidad,precio_unit) VALUES ('"+A+"','"+OA+"','Demo',1,1)");
 }}
 @Test void readsFollowLeastPrivilege()throws Exception{try(Connection c=runtime()){
  context(c,A,UA,"");assertThat(scalar(c,"SELECT count(*) FROM apertura_caja")).isEqualTo("1");assertThat(scalar(c,"SELECT count(*) FROM v_margen_orden")).isEqualTo("2");
  context(c,A,UV,"");assertThat(scalar(c,"SELECT count(*) FROM apertura_caja")).isEqualTo("0");assertThat(scalar(c,"SELECT count(*) FROM egreso_caja")).isEqualTo("0");
  context(c,A,"",SA);
  for(String t:new String[]{"apertura_caja","egreso_caja","aplicacion_pago","obligacion_cobro","aprobacion_credito"})assertThat(scalar(c,"SELECT count(*) FROM "+t)).as(t).isEqualTo("0");
  assertThat(scalar(c,"SELECT count(*) FROM pago")).isEqualTo("1");
  context(c,A,UJ,"");
  assertThat(scalar(c,"SELECT count(*) FROM orden")).isEqualTo("0");
  assertThat(scalar(c,"SELECT count(*) FROM v_margen_orden")).isEqualTo("0");
  assertThat(scalar(c,"SELECT entidad FROM evento_auditoria")).isEqualTo("orden_etapa");
  assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("0");
 }}
 @Test void concurrentApplicationsCannotOverApply()throws Exception{
  ExecutorService e=Executors.newFixedThreadPool(2);CountDownLatch first=new CountDownLatch(1);
  Future<Boolean> one=e.submit(()->{try(Connection c=runtime()){context(c,A,UA,"");exec(c,application(UUID.randomUUID().toString(),"60"));first.countDown();Thread.sleep(400);c.commit();return true;}});
  Future<Boolean> two=e.submit(()->{first.await(10,TimeUnit.SECONDS);try(Connection c=runtime()){context(c,A,UA,"");exec(c,application(UUID.randomUUID().toString(),"60"));c.commit();return true;}catch(SQLException ex){return false;}});
  try {assertThat(one.get(20,TimeUnit.SECONDS)).isTrue();assertThat(two.get(20,TimeUnit.SECONDS)).isFalse();}
  finally {e.shutdownNow();try(Connection c=owner()){exec(c,"DELETE FROM keptai.aplicacion_pago");}}
 }
}
