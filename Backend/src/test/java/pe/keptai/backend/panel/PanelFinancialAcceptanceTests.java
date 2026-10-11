package pe.keptai.backend.panel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.oauth2.jwt.Jwt;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.security.*;

/** Semilla ficticia de Andrés, HTTP/motores/PG reales; autenticación de prueba, sin banco ni n8n externos. */
@SpringBootTest(properties="spring.autoconfigure.exclude=") @AutoConfigureMockMvc @ActiveProfiles("test")
class PanelFinancialAcceptanceTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final UUID ORG=UUID.fromString("10000000-0000-4000-8000-000000000001");
 static final UUID ADMIN=UUID.fromString("70000000-0000-4000-8000-000000000002"),SECOND=UUID.fromString("70000000-0000-4000-8000-000000000006"),MANAGER=UUID.fromString("70000000-0000-4000-8000-000000000003");
 static final String OB="b0000000-0000-4000-8000-000000000002",DUP="c0000000-0000-4000-8000-000000000003";
 @Autowired MockMvc mvc;
 static Connection owner()throws SQLException{return DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());}
 static void sql(String query)throws SQLException{try(var c=owner();var st=c.createStatement()){st.execute(query);}}
 static long count(String query)throws SQLException{try(var c=owner();var st=c.createStatement();var rs=st.executeQuery(query)){rs.next();return rs.getLong(1);}}
 @BeforeAll static void init()throws Exception {
  PG.start();sql("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role");
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  sql("CREATE ROLE acceptance_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'fixture';GRANT keptai_runtime TO acceptance_app");
 }
 @AfterAll static void stop(){PG.stop();}
 @DynamicPropertySource static void props(DynamicPropertyRegistry r){r.add("spring.datasource.url",()->PG.getJdbcUrl()+"&currentSchema=keptai");r.add("spring.datasource.username",()->"acceptance_app");r.add("spring.datasource.password",()->"fixture");}
 @BeforeEach void seed()throws Exception {
  sql("SET keptai.permitir_semilla='demo';"+Files.readString(Path.of("../BD/semilla/semilla_demo.sql")));
  sql("INSERT INTO keptai.usuario(id,organizacion_id,auth_user_id,nombre,rol) VALUES('"+SECOND+"','"+ORG+"','"+UUID.randomUUID()+"','Segundo ADMIN ficticio','ADMIN')");
 }
 KeptaiAuthentication auth(UUID id){return new KeptaiAuthentication(Jwt.withTokenValue("fixture").header("alg","none").subject(UUID.randomUUID().toString()).build(),List.of(new Membership(id,ORG,id.equals(MANAGER)?AccessRole.GERENTE:AccessRole.ADMIN)));}
 @Test void financialSummaryMarginCashAndCsvMatchTheRoadmapFixture()throws Exception {
  mvc.perform(get("/api/v1/results/summary?as_of=2026-10-10").with(authentication(auth(MANAGER)))).andExpect(status().isOk())
   .andExpect(jsonPath("sales_total.amount_cents").value(80000)).andExpect(jsonPath("applied_collections_total.amount_cents").value(40000))
   .andExpect(jsonPath("pending_balance_total.amount_cents").value(40000)).andExpect(jsonPath("cost_total.amount_cents").value(69000))
   .andExpect(jsonPath("margin_total.amount_cents").value(11000));
  mvc.perform(get("/api/v1/results/margins?as_of=2026-10-10&group_by=order").with(authentication(auth(MANAGER)))).andExpect(status().isOk()).andExpect(jsonPath("totals.margin.amount_cents").value(11000));
  mvc.perform(get("/api/v1/results/production-center?as_of=2026-10-10").with(authentication(auth(MANAGER)))).andExpect(status().isOk());
  mvc.perform(get("/api/v1/results/cash-forecast?as_of=2026-10-10").with(authentication(auth(MANAGER)))).andExpect(status().isOk());
  var csv=mvc.perform(get("/api/v1/reports/orders.csv?as_of=2026-10-10").with(authentication(auth(MANAGER)))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  assertThat(csv).contains("30000,34000,-4000,complete,30000,0").contains("50000,35000,15000,complete,10000,40000");
 }
 @Test void partialPaymentReplayAndDuplicateRejectionPreserveTheLedger()throws Exception {
  UUID p=UUID.randomUUID();sql("INSERT INTO keptai.pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion) VALUES('"+p+"','"+ORG+"','22222222-2222-4222-8222-222222222222',50,'2026-10-10','YAPE','DEMO-NEW-"+p+"')");
  mvc.perform(post("/api/v1/payments/"+p+"/verifications").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","partial-verification").content("{\"method\":\"simulated_demo\"}")).andExpect(status().isOk());
  String body="{\"receivable_id\":\""+OB+"\",\"amount\":{\"amount_cents\":5000,\"currency\":\"PEN\"}}";
  for(int i=0;i<2;i++)mvc.perform(post("/api/v1/payments/"+p+"/applications").with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","partial-application").content(body)).andExpect(status().isCreated()).andExpect(jsonPath("receivable.balance.amount_cents").value(35000));
  assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago WHERE pago_id='"+p+"'")).isEqualTo(1);
  mvc.perform(post("/api/v1/payments/"+DUP+"/verifications").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","duplicate-verification").content("{\"method\":\"simulated_demo\"}")).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("code").value("DUPLICATE_PAYMENT"));
  assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago WHERE pago_id='"+DUP+"'")).isZero();
 }
 @Test void twoConcurrentPaymentsNeverOverApplyTheSameReceivable()throws Exception {
  var ids=List.of(UUID.randomUUID(),UUID.randomUUID());
  for(UUID p:ids) {
   sql("INSERT INTO keptai.pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion) VALUES('"+p+"','"+ORG+"','22222222-2222-4222-8222-222222222222',250,'2026-10-10','YAPE','DEMO-RACE-"+p+"')");
   mvc.perform(post("/api/v1/payments/"+p+"/verifications").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","verify-"+p).content("{\"method\":\"simulated_demo\"}")).andExpect(status().isOk());
  }
  var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var start=new java.util.concurrent.CountDownLatch(1);
  try {
   var futures=new ArrayList<java.util.concurrent.Future<Integer>>();
   for(UUID p:ids) futures.add(executor.submit(()->{start.await();return mvc.perform(post("/api/v1/payments/"+p+"/applications").with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","apply-"+p).content("{\"receivable_id\":\""+OB+"\",\"amount\":{\"amount_cents\":25000,\"currency\":\"PEN\"}}")).andReturn().getResponse().getStatus();}));
   start.countDown();assertThat(List.of(futures.get(0).get(20,java.util.concurrent.TimeUnit.SECONDS),futures.get(1).get(20,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,422);
   assertThat(count("SELECT sum(monto_aplicado)*100 FROM keptai.aplicacion_pago WHERE obligacion_id='"+OB+"'")).isEqualTo(35000);
  }finally{executor.shutdownNow();}
 }
 @Test void overspendingRollsBackAndSameKeyCanRetryWithValidAmount()throws Exception {
  UUID p=UUID.randomUUID();sql("INSERT INTO keptai.pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion) VALUES('"+p+"','"+ORG+"','22222222-2222-4222-8222-222222222222',500,'2026-10-10','YAPE','DEMO-LIMIT-"+p+"')");
  mvc.perform(post("/api/v1/payments/"+p+"/verifications").with(authentication(auth(ADMIN))).contentType("application/json").header("Idempotency-Key","limit-verification").content("{\"method\":\"simulated_demo\"}")).andExpect(status().isOk());
  String url="/api/v1/payments/"+p+"/applications",prefix="{\"receivable_id\":\""+OB+"\",\"amount\":{\"amount_cents\":";
  mvc.perform(post(url).with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","limit-application").content(prefix+"50000,\"currency\":\"PEN\"}}")).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("code").value("INSUFFICIENT_BALANCE"));
  assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago WHERE pago_id='"+p+"'")).isZero();
  mvc.perform(post(url).with(authentication(auth(SECOND))).contentType("application/json").header("Idempotency-Key","limit-application").content(prefix+"10000,\"currency\":\"PEN\"}}")).andExpect(status().isCreated()).andExpect(jsonPath("receivable.balance.amount_cents").value(30000));
 }
}
