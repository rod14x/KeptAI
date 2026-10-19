package pe.keptai.backend.panel;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.sql.*;
import java.util.*;
import java.nio.file.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.oauth2.jwt.Jwt;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.security.*;
import pe.keptai.backend.n8n.VoucherStorage;

/** PostgreSQL real desechable, login runtime sin bypass; autenticación de test, Storage simulado. */
@SpringBootTest(properties="spring.autoconfigure.exclude=") @AutoConfigureMockMvc @ActiveProfiles("test")
@Import(BackendCompletionIntegrationTests.Config.class)
class BackendCompletionIntegrationTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final UUID A=UUID.fromString("10000000-0000-4000-8000-000000000001"),B=UUID.fromString("10000000-0000-4000-8000-000000000002");
 static final UUID ADMIN=UUID.fromString("20000000-0000-4000-8000-000000000001"),SECOND=UUID.fromString("20000000-0000-4000-8000-000000000002"),GERENTE=UUID.fromString("20000000-0000-4000-8000-000000000003"),SELLER=UUID.fromString("20000000-0000-4000-8000-000000000004"),OTHER=UUID.fromString("20000000-0000-4000-8000-000000000005");
 static final UUID CUSTOMER=UUID.fromString("30000000-0000-4000-8000-000000000001"),BRAND=UUID.fromString("40000000-0000-4000-8000-000000000001");
 static Fake storage=new Fake();
 static class Fake implements VoucherStorage {
  int calls,puts,deletes;boolean fail,failPut;String last;byte[] saved;
  public void put(String p,byte[] bytes,String type) {puts++;last=p;saved=bytes;if(failPut)throw new StorageException("fixture upload failure",true); }
  public void delete(String p) {deletes++; }
  public String signedUrl(String p,int ttl) {calls++;last=p;if(fail)throw new StorageException("fixture failure",true);return "https://storage.invalid/private?token=fixture";}
 }
 @TestConfiguration static class Config { @Bean @Primary VoucherStorage storage() {return storage;} }
 @Autowired MockMvc mvc;
 static Connection owner()throws Exception {return DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());}
 static void sql(String query)throws Exception {try(var c=owner();var s=c.createStatement()){s.execute(query);}}
 static long count(String query)throws Exception {try(var c=owner();var s=c.createStatement();var rs=s.executeQuery(query)){rs.next();return rs.getLong(1);}}
 @BeforeAll static void init()throws Exception {
  PG.start();sql("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role");
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  sql("CREATE ROLE reader_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'fixture';GRANT keptai_runtime TO reader_app;");
  sql("INSERT INTO keptai.organizacion(id,nombre) VALUES('"+A+"','Empresa A demo'),('"+B+"','Empresa B demo')");
  for(var entry:Map.of(ADMIN,"ADMIN",SECOND,"ADMIN",GERENTE,"GERENTE",SELLER,"VENDEDOR",OTHER,"ADMIN").entrySet())
   sql("INSERT INTO keptai.usuario(id,organizacion_id,auth_user_id,nombre,rol) VALUES('"+entry.getKey()+"','"+(entry.getKey().equals(OTHER)?B:A)+"','"+UUID.randomUUID()+"','Usuario demo','"+entry.getValue()+"')");
  sql("INSERT INTO keptai.cliente(id,organizacion_id,razon_social,tipo) VALUES('"+CUSTOMER+"','"+A+"','Cliente demo','EMPRESA');INSERT INTO keptai.marca(id,organizacion_id,nombre) VALUES('"+BRAND+"','"+A+"','Marca demo')");
 }
 @AfterAll static void stop(){PG.stop();}
 @DynamicPropertySource static void props(DynamicPropertyRegistry r) {
  r.add("spring.datasource.url",()->PG.getJdbcUrl()+"&currentSchema=keptai");r.add("spring.datasource.username",()->"reader_app");r.add("spring.datasource.password",()->"fixture");r.add("spring.datasource.hikari.maximum-pool-size",()->"4");
 }
 @BeforeEach void reset()throws Exception {
  storage.calls=0;storage.puts=0;storage.deletes=0;storage.fail=false;storage.failPut=false;
  sql("DELETE FROM keptai.aprobacion_credito;DELETE FROM keptai.evento_auditoria;DELETE FROM keptai.solicitud_idempotente;DELETE FROM keptai.aplicacion_pago;DELETE FROM keptai.despacho;DELETE FROM keptai.comprobante;DELETE FROM keptai.pago;DELETE FROM keptai.obligacion_cobro;DELETE FROM keptai.hoja_resumen;DELETE FROM keptai.ficha_tecnica;DELETE FROM keptai.orden_etapa;DELETE FROM keptai.orden_item;DELETE FROM keptai.orden");
 }
 KeptaiAuthentication auth(UUID id) {
  AccessRole role=id.equals(GERENTE)?AccessRole.GERENTE:id.equals(SELLER)?AccessRole.VENDEDOR:AccessRole.ADMIN;
  return new KeptaiAuthentication(Jwt.withTokenValue("fixture").header("alg","none").subject(UUID.randomUUID().toString()).build(),List.of(new Membership(id,id.equals(OTHER)?B:A,role)));
 }
 UUID order(String state)throws Exception {
  UUID id=UUID.randomUUID();sql("INSERT INTO keptai.orden(id,organizacion_id,ref,cliente_id,marca_id,estado,condicion_pago,total) VALUES('"+id+"','"+A+"','ORD-"+Math.abs(id.getMostSignificantBits()%1000000)+"','"+CUSTOMER+"','"+BRAND+"','"+state+"','CONTADO',100)");return id;
 }
 UUID draft(boolean incomplete)throws Exception {
  UUID o=order("BORRADOR"),h=UUID.randomUUID();sql("INSERT INTO keptai.hoja_resumen(id,organizacion_id,orden_id,version,extraccion,resumen_md) VALUES('"+h+"','"+A+"','"+o+"',1,'{}','Resumen estructurado')");
  if(incomplete)sql("UPDATE keptai.orden SET total=NULL,condicion_pago=NULL,marca_id=NULL WHERE id='"+o+"'");else sql("INSERT INTO keptai.orden_item(organizacion_id,orden_id,descripcion,cantidad,precio_unit) VALUES('"+A+"','"+o+"','Polos demo',10,10)");return h;
 }
 UUID payment()throws Exception {UUID id=UUID.randomUUID();sql("INSERT INTO keptai.pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion) VALUES('"+id+"','"+A+"','"+CUSTOMER+"',100,'2026-10-10','YAPE','DEMO-"+id+"')");return id;}
 UUID evidence()throws Exception {UUID p=payment(),e=UUID.randomUUID();sql("INSERT INTO keptai.comprobante(id,organizacion_id,pago_id,archivo_storage_path,archivo_hash) VALUES('"+e+"','"+A+"','"+p+"','"+A+"/vouchers/demo.png','"+"a".repeat(64)+"')");return e;}
 byte[] png()throws Exception {var bytes=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",bytes);return bytes.toByteArray();}
 org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder upload(UUID payment,String key,byte[] file)throws Exception {
  return multipart("/api/v1/evidences/files").file(new org.springframework.mock.web.MockMultipartFile("file","misleading.jpg","image/jpeg",file)).param("payment_id",payment.toString()).param("kind","voucher_image").header("Idempotency-Key",key);
 }
 @Test void manualVoucherUsesValidatedBinaryMetadataAndReplaysWithoutSecondUpload()throws Exception {
  UUID p=payment();byte[] file=png();String response=null;
  for(int i=0;i<2;i++){var result=mvc.perform(upload(p,"manual-demo",file).with(authentication(auth(ADMIN)))).andExpect(status().isCreated()).andExpect(jsonPath("content_type").value("image/png")).andExpect(jsonPath("uploaded_by_user_id").value(ADMIN.toString())).andReturn();if(response!=null)assertThat(result.getResponse().getContentAsString()).isEqualTo(response);response=result.getResponse().getContentAsString();}
  assertThat(storage.puts).isEqualTo(1);assertThat(storage.last).startsWith(A+"/vouchers/");assertThat(storage.saved).isEqualTo(file);
  assertThat(count("SELECT count(*) FROM keptai.comprobante WHERE archivo_content_type='image/png' AND subido_por='"+ADMIN+"'")).isEqualTo(1);
  mvc.perform(get("/api/v1/evidences").with(authentication(auth(ADMIN)))).andExpect(status().isOk()).andExpect(jsonPath("items[0].data_origin").value("manual_entry"));
  mvc.perform(upload(p,"manual-demo",file).with(authentication(auth(SECOND)))).andExpect(status().isConflict());assertThat(storage.puts).isEqualTo(1);
 }
 @Test void manualVoucherRejectsInvalidOrCrossTenantUploadsAndRollsBackStorageFailure()throws Exception {
  UUID p=payment();byte[] file=png();mvc.perform(upload(p,"other-tenant",file).with(authentication(auth(OTHER)))).andExpect(status().isNotFound());assertThat(storage.puts).isZero();
  mvc.perform(upload(p,"invalid-image","not an image".getBytes()).with(authentication(auth(ADMIN)))).andExpect(status().isUnprocessableEntity());assertThat(storage.puts).isZero();
  storage.failPut=true;mvc.perform(upload(p,"storage-down",file).with(authentication(auth(ADMIN)))).andExpect(status().isServiceUnavailable());
  assertThat(count("SELECT count(*) FROM keptai.comprobante")).isZero();assertThat(count("SELECT count(*) FROM keptai.solicitud_idempotente")).isZero();assertThat(count("SELECT count(*) FROM keptai.evento_auditoria")).isZero();
 }
 @Test void uploadedObjectIsCompensatedIfDatabaseWriteFails()throws Exception {
  UUID p=payment();sql("CREATE FUNCTION keptai.fail_voucher_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure' USING ERRCODE='23514'; END $$; CREATE TRIGGER fail_voucher_fixture BEFORE INSERT ON keptai.comprobante FOR EACH ROW EXECUTE FUNCTION keptai.fail_voucher_fixture()");
  try {mvc.perform(upload(p,"db-failure",png()).with(authentication(auth(ADMIN)))).andExpect(status().isConflict());assertThat(storage.puts).isEqualTo(1);assertThat(storage.deletes).isEqualTo(1);assertThat(count("SELECT count(*) FROM keptai.comprobante")).isZero();assertThat(count("SELECT count(*) FROM keptai.solicitud_idempotente")).isZero();}
  finally {sql("DROP TRIGGER fail_voucher_fixture ON keptai.comprobante;DROP FUNCTION keptai.fail_voucher_fixture()");}
 }
 @Test void privateLinkIsTenantAuthorizedAuditedAndNotCached()throws Exception {
  UUID e=evidence();mvc.perform(get("/api/v1/evidences/"+e+"/download-link").with(authentication(auth(ADMIN))))
   .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("expires_at").exists());
  assertThat(storage.calls).isEqualTo(1);assertThat(storage.last).startsWith(A+"/");
  assertThat(count("SELECT count(*) FROM keptai.evento_auditoria WHERE operacion='VOUCHER_ENLACE_EMITIDO' AND usuario_id='"+ADMIN+"' AND cambios::text NOT LIKE '%token%'")).isEqualTo(1);
 }
 @Test void otherTenantUnknownObjectAndWrongRoleNeverCallPrivilegedStorage()throws Exception {
  UUID e=evidence();mvc.perform(get("/api/v1/evidences/"+e+"/download-link").with(authentication(auth(OTHER)))).andExpect(status().isNotFound());
  mvc.perform(get("/api/v1/evidences/"+UUID.randomUUID()+"/download-link").with(authentication(auth(ADMIN)))).andExpect(status().isNotFound());
  mvc.perform(get("/api/v1/evidences/"+e+"/download-link").with(authentication(auth(SELLER)))).andExpect(status().isForbidden());assertThat(storage.calls).isZero();
 }
 @Test void failedStorageDoesNotCreateAnAuditOfSuccessfulIssuance()throws Exception {
  UUID e=evidence();storage.fail=true;mvc.perform(get("/api/v1/evidences/"+e+"/download-link").with(authentication(auth(ADMIN)))).andExpect(status().isServiceUnavailable());assertThat(count("SELECT count(*) FROM keptai.evento_auditoria")).isZero();
 }
 @Test void confirmedDraftIsIdempotentAndDoesNotCreateFinancialEffects()throws Exception {
  UUID h=draft(false);String url="/api/v1/drafts/"+h+"/confirmation";
  for(int i=0;i<2;i++)mvc.perform(post(url).with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","confirm-demo").content("{\"expected_revision\":1}"))
    .andExpect(status().isOk()).andExpect(jsonPath("draft.status").value("confirmed")).andExpect(jsonPath("funds_verified").value(false)).andExpect(jsonPath("balance_changed").value(false));
  assertThat(count("SELECT count(*) FROM keptai.evento_auditoria WHERE operacion='BORRADOR_CONFIRMADO'")).isEqualTo(1);assertThat(count("SELECT count(*) FROM keptai.obligacion_cobro")).isZero();
  mvc.perform(post(url).with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","confirm-demo").content("{\"expected_revision\":2}")).andExpect(status().isConflict());
 }
 @Test void adminCanCorrectRegisteredBusinessFieldsButNotForgeClientOrAuthor()throws Exception {
  UUID h=draft(true);String url="/api/v1/drafts/"+h;
  String body="{\"expected_revision\":1,\"order_fields\":{\"brand\":\"Marca demo\"},\"items\":[{\"description\":\"Polos corregidos\",\"quantity\":10,\"unit_price\":{\"amount_cents\":1000,\"currency\":\"PEN\"}}],\"payment_condition\":\"CONTADO\"}";
  mvc.perform(patch(url).with(authentication(auth(ADMIN))).contentType("application/json").content(body)).andExpect(status().isOk()).andExpect(jsonPath("revision").value(2)).andExpect(jsonPath("order_fields.sale_amount.value.amount_cents").value(10000));
  assertThat(count("SELECT count(*) FROM keptai.hoja_resumen WHERE extraccion ? 'revision_humana' AND resumen_md LIKE '# Pedido revisado%'")).isEqualTo(1);
  assertThat(count("SELECT count(*) FROM keptai.evento_auditoria WHERE cambios ? 'before' AND cambios ? 'after'")).isEqualTo(1);
  mvc.perform(patch(url).with(authentication(auth(ADMIN))).contentType("application/json").content(body)).andExpect(status().isConflict());
  mvc.perform(patch(url).with(authentication(auth(ADMIN))).contentType("application/json").content("{\"expected_revision\":2,\"order_fields\":{\"customer_name\":\"Cliente forjado\"}}")).andExpect(status().isUnprocessableEntity());
  mvc.perform(patch(url).with(authentication(auth(ADMIN))).contentType("application/json").content("{\"expected_revision\":2,\"order_fields\":{\"brand\":\"Marca demo\"},\"usuario_id\":\""+SECOND+"\"}")).andExpect(status().isBadRequest());
 }
 @Test void incompleteDraftCannotConfirmAndCanBeDiscardedWithoutInventingData()throws Exception {
  UUID h=draft(true);mvc.perform(post("/api/v1/drafts/"+h+"/confirmation").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","incomplete-demo").content("{\"expected_revision\":1}")).andExpect(status().isUnprocessableEntity());
  for(int i=0;i<2;i++)mvc.perform(post("/api/v1/drafts/"+h+"/discard").with(authentication(auth(ADMIN))).contentType("application/json").content("{}")).andExpect(status().isOk()).andExpect(jsonPath("status").value("discarded"));
  assertThat(count("SELECT count(*) FROM keptai.orden WHERE estado='CANCELADA' AND total IS NULL AND condicion_pago IS NULL")).isEqualTo(1);
  assertThat(count("SELECT count(*) FROM keptai.evento_auditoria WHERE operacion='BORRADOR_DESCARTADO'")).isEqualTo(1);
 }
 @Test void verificationAndApplicationRequireDistinctAdminsAndReplayNeverAppliesTwice()throws Exception {
  UUID p=payment(),o=order("RETENIDA"),ob=UUID.randomUUID();sql("INSERT INTO keptai.obligacion_cobro(id,organizacion_id,orden_id,monto,plazo_dias) VALUES('"+ob+"','"+A+"','"+o+"',100,0)");
  mvc.perform(post("/api/v1/payments/"+p+"/verifications").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","verify-demo").content("{\"method\":\"simulated_demo\"}")).andExpect(status().isOk());
  String body="{\"receivable_id\":\""+ob+"\",\"amount\":{\"amount_cents\":10000,\"currency\":\"PEN\"}}";
  mvc.perform(post("/api/v1/payments/"+p+"/applications").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","apply-rejected").content(body)).andExpect(status().isForbidden());
  for(int i=0;i<2;i++)mvc.perform(post("/api/v1/payments/"+p+"/applications").with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","apply-demo").content(body)).andExpect(status().isCreated());
  assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago")).isEqualTo(1);assertThat(count("SELECT count(*) FROM keptai.orden WHERE estado='LIBERADA'")).isEqualTo(1);
  String today=java.time.LocalDate.now(java.time.ZoneId.of("America/Lima")).toString();
  for(int i=0;i<2;i++)mvc.perform(post("/api/v1/orders/"+o+"/dispatch").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","dispatch-demo").content("{\"dispatch_date\":\""+today+"\"}")).andExpect(status().isOk());
  assertThat(count("SELECT count(*) FROM keptai.despacho")).isEqualTo(1);
 }
 @Test void concurrentConfirmationRetriesCommitOneDecision()throws Exception {
  UUID h=draft(false);var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var start=new java.util.concurrent.CountDownLatch(1);
  try {
   var task=(java.util.concurrent.Callable<Integer>)()->{start.await();return mvc.perform(post("/api/v1/drafts/"+h+"/confirmation").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","concurrent-confirm").content("{\"expected_revision\":1}")).andReturn().getResponse().getStatus();};
   var first=executor.submit(task);var second=executor.submit(task);start.countDown();assertThat(first.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);assertThat(second.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
   assertThat(count("SELECT count(*) FROM keptai.evento_auditoria WHERE operacion='BORRADOR_CONFIRMADO'")).isEqualTo(1);
  }finally{executor.shutdownNow();}
 }
 @Test void downstreamFinancialFailureRollsBackApplicationReleaseAndIdempotency()throws Exception {
  UUID p=payment(),o=order("RETENIDA"),ob=UUID.randomUUID();sql("INSERT INTO keptai.obligacion_cobro(id,organizacion_id,orden_id,monto,plazo_dias) VALUES('"+ob+"','"+A+"','"+o+"',100,0)");
  mvc.perform(post("/api/v1/payments/"+p+"/verifications").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","verify-rollback").content("{\"method\":\"simulated_demo\"}")).andExpect(status().isOk());
  sql("CREATE FUNCTION keptai.fail_release_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operacion='ORDEN_LIBERADA' THEN RAISE EXCEPTION 'fixture failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_release_fixture BEFORE INSERT ON keptai.evento_auditoria FOR EACH ROW EXECUTE FUNCTION keptai.fail_release_fixture()");
  String body="{\"receivable_id\":\""+ob+"\",\"amount\":{\"amount_cents\":10000,\"currency\":\"PEN\"}}";
  try{mvc.perform(post("/api/v1/payments/"+p+"/applications").with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","apply-rollback").content(body)).andExpect(status().isConflict());
   assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago")).isZero();assertThat(count("SELECT count(*) FROM keptai.orden WHERE estado='RETENIDA'")).isEqualTo(1);assertThat(count("SELECT count(*) FROM keptai.solicitud_idempotente WHERE operacion='PANEL_APLICAR'")).isZero();
  }finally{sql("DROP TRIGGER fail_release_fixture ON keptai.evento_auditoria;DROP FUNCTION keptai.fail_release_fixture()");}
  mvc.perform(post("/api/v1/payments/"+p+"/applications").with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","apply-rollback").content(body)).andExpect(status().isCreated());assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago")).isEqualTo(1);
 }
 @Test void queriesAndReportsUseRealMotorAndRejectCrossTenantObjects()throws Exception {
  UUID o=order("RETENIDA");mvc.perform(get("/api/v1/orders/"+o).with(authentication(auth(OTHER)))).andExpect(status().isNotFound());
  mvc.perform(get("/api/v1/orders").with(authentication(auth(ADMIN)))).andExpect(status().isOk()).andExpect(jsonPath("items[0].id").value(o.toString()));
  mvc.perform(get("/api/v1/results/summary?as_of=2026-10-11").with(authentication(auth(GERENTE)))).andExpect(status().isOk());
  mvc.perform(get("/api/v1/results/cash-forecast?as_of=2026-10-11").with(authentication(auth(GERENTE)))).andExpect(status().isOk());
  mvc.perform(get("/api/v1/reports/orders.csv?as_of=2026-10-11").with(authentication(auth(GERENTE)))).andExpect(status().isOk());
 }
 @Test void adminCreditDecisionCreatesOneObligationAndKeepsAssignedSeller()throws Exception {
  UUID o=order("PENDIENTE_APROBACION");sql("UPDATE keptai.orden SET vendedor_id='"+SELLER+"' WHERE id='"+o+"'");
  String path="/api/v1/orders/"+o+"/credit-decision",body="{\"decision\":\"approved\",\"arrears_notice_acknowledged\":true,\"credit_term_days\":30}";
  String first=mvc.perform(post(path).with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","credit-admin-demo").content(body)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  String replay=mvc.perform(post(path).with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","credit-admin-demo").content(body)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  assertThat(pe.keptai.backend.contract.ContractJson.newMapper().readTree(first)).isEqualTo(pe.keptai.backend.contract.ContractJson.newMapper().readTree(replay));
  assertThat(count("SELECT count(*) FROM keptai.aprobacion_credito WHERE aprobado_por='"+ADMIN+"' AND decision='APROBADO'")).isEqualTo(1);
  assertThat(count("SELECT count(*) FROM keptai.obligacion_cobro WHERE orden_id='"+o+"' AND monto=100 AND vence_en IS NULL")).isEqualTo(1);
  assertThat(count("SELECT count(*) FROM keptai.orden WHERE id='"+o+"' AND estado='LIBERADA' AND vendedor_id='"+SELLER+"'")).isEqualTo(1);
  assertThat(count("SELECT count(*) FROM keptai.evento_auditoria WHERE operacion='CREDITO_APROBADO'")).isEqualTo(1);
  mvc.perform(post(path).with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","credit-admin-demo").content(body)).andExpect(status().isConflict());
  mvc.perform(post(path).with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","credit-admin-demo").content(body.replace("30","15"))).andExpect(status().isConflict());
 }
 @Test void creditRejectsOtherTenantOtherRolesAndDoesNotInventASeller()throws Exception {
  UUID o=order("PENDIENTE_APROBACION");String path="/api/v1/orders/"+o+"/credit-decision",body="{\"decision\":\"rejected\",\"arrears_notice_acknowledged\":true,\"reason\":\"Decisión demo\\nRevisada\"}";
  for(UUID user:List.of(SELLER,GERENTE))mvc.perform(post(path).with(authentication(auth(user))).contentType("application/json").header("Idempotency-Key","credit-denied-demo").content(body)).andExpect(status().isForbidden());
  mvc.perform(post(path).with(authentication(auth(OTHER))).contentType("application/json").header("Idempotency-Key","credit-other-demo").content(body)).andExpect(status().isNotFound());
  for(int i=0;i<2;i++)mvc.perform(post(path).with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","credit-rejected-demo").content(body)).andExpect(status().isOk());
  assertThat(count("SELECT count(*) FROM keptai.orden WHERE id='"+o+"' AND estado='CANCELADA' AND vendedor_id IS NULL")).isEqualTo(1);
  assertThat(count("SELECT count(*) FROM keptai.obligacion_cobro")).isZero();assertThat(count("SELECT count(*) FROM keptai.evento_auditoria WHERE operacion='CREDITO_RECHAZADO'")).isEqualTo(1);
 }
 @Test void concurrentCreditRequestsCommitOnlyOneDecision()throws Exception {
  UUID o=order("PENDIENTE_APROBACION");var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var start=new java.util.concurrent.CountDownLatch(1);
  try {
   var task=(java.util.concurrent.Callable<Integer>)()->{start.await();return mvc.perform(post("/api/v1/orders/"+o+"/credit-decision").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","credit-concurrent-demo").content("{\"decision\":\"approved\",\"arrears_notice_acknowledged\":true,\"credit_term_days\":30}")).andReturn().getResponse().getStatus();};
   var first=executor.submit(task);var second=executor.submit(task);start.countDown();assertThat(first.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);assertThat(second.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
   assertThat(count("SELECT count(*) FROM keptai.aprobacion_credito")).isEqualTo(1);assertThat(count("SELECT count(*) FROM keptai.obligacion_cobro")).isEqualTo(1);
  }finally{executor.shutdownNow();}
 }
}
