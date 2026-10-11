package pe.keptai.backend.finanzas;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.time.LocalDate;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosCobranza.*;
import static org.assertj.core.api.Assertions.*;

/** Despacho -> vencimiento (V8) y job de cobranza sobre V1-V8 + semilla, con login runtime real. */
class MotorCobranzaTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final UUID A=u("10000000-0000-4000-8000-000000000001");
 static final UUID VENDEDOR=u("70000000-0000-4000-8000-000000000001"), ADMIN=u("70000000-0000-4000-8000-000000000002"), JEFE=u("70000000-0000-4000-8000-000000000004");
 static final UUID CLIENTE_DOS=u("22222222-2222-4222-8222-222222222222"), OBL_P002=u("b0000000-0000-4000-8000-000000000002");
 static final UUID ALERTA_MORA_P002=u("80000000-0000-4000-8000-000000000001"), SCHEDULER_ID=u("e0000000-0000-4000-8000-000000000002");
 static final ContextoFinanciero TALLER=ContextoFinanciero.usuario(A,JEFE), COBRANZA=ContextoFinanciero.usuario(A,ADMIN),
  VENTAS=ContextoFinanciero.usuario(A,VENDEDOR), JOB=ContextoFinanciero.servicio(A,SCHEDULER_ID);
 static String semilla;
 static MotorCobranza motor;

 static UUID u(String s){return UUID.fromString(s);}
 static LocalDate d(String s){return LocalDate.parse(s);}

 @BeforeAll static void setup() throws Exception {
  PG.start();
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  semilla=Files.readString(Path.of("../BD/semilla/semilla_demo.sql"));
  try(Connection c=owner()){exec(c,"CREATE ROLE cobranza_app LOGIN PASSWORD 'cobranza' NOSUPERUSER NOBYPASSRLS IN ROLE keptai_runtime");}
  DriverManagerDataSource ds=new DriverManagerDataSource(PG.getJdbcUrl(),"cobranza_app","cobranza");
  motor=new MotorCobranza(new JdbcTemplate(ds),new DataSourceTransactionManager(ds));
 }
 @AfterAll static void stop(){PG.stop();}
 @BeforeEach void reiniciar()throws SQLException{try(Connection c=owner()){
  exec(c,"SET keptai.permitir_semilla='demo'");exec(c,semilla);
  exec(c,"INSERT INTO integracion_servicio(id,organizacion_id,instancia,alcance,clave_hash) VALUES ('"+SCHEDULER_ID+"','"+A+"','demo','SCHEDULER',repeat('c',64))");
 }}

 static Connection owner() throws SQLException{Connection c=DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());exec(c,"SET search_path=keptai");return c;}
 static void exec(Connection c,String sql)throws SQLException{try(Statement st=c.createStatement()){st.execute(sql);}}
 static void exec(String sql)throws SQLException{try(Connection c=owner()){exec(c,sql);}}
 static String scalar(String sql)throws SQLException{try(Connection c=owner();Statement st=c.createStatement();ResultSet rs=st.executeQuery(sql)){rs.next();return rs.getString(1);}}
 static void rechaza(Codigo codigo,org.assertj.core.api.ThrowableAssert.ThrowingCallable accion){
  assertThatThrownBy(accion).isInstanceOf(MotorFinancieroException.class).extracting(e->((MotorFinancieroException)e).codigo()).isEqualTo(codigo);
 }

 /** Orden a credito 30 dias, aprobada por el vendedor y liberada, con su obligacion sin vencimiento. Devuelve [orden, obligacion]. */
 static UUID[] ordenLiberada(String ref,String inicioProduccion)throws SQLException{
  UUID orden=UUID.randomUUID(), obligacion=UUID.randomUUID();
  try(Connection c=owner()){
   exec(c,"INSERT INTO orden(id,organizacion_id,ref,cliente_id,vendedor_id,estado,condicion_pago,plazo_dias,total,fecha_inicio_produccion) VALUES ('"+orden+"','"+A+"','"+ref+"','"+CLIENTE_DOS+"','"+VENDEDOR+"','PENDIENTE_APROBACION','CREDITO',30,200,'"+inicioProduccion+"')");
   exec(c,"INSERT INTO aprobacion_credito(organizacion_id,orden_id,aprobado_por,decision,plazo_dias,decidido_en) VALUES ('"+A+"','"+orden+"','"+VENDEDOR+"','APROBADO',30,now())");
   exec(c,"UPDATE orden SET estado='LIBERADA' WHERE id='"+orden+"'");
   exec(c,"INSERT INTO obligacion_cobro(id,organizacion_id,orden_id,monto,plazo_dias) VALUES ('"+obligacion+"','"+A+"','"+orden+"',200,30)");
  }
  return new UUID[]{orden,obligacion};
 }

 @Test void despachoDelTallerFijaVencimientoYDespachaLaOrden()throws Exception{
  UUID[] p=ordenLiberada("P-010","2026-09-25");
  Despacho r=motor.registrarDespacho(TALLER,p[0],d("2026-10-01"),A+"/actas/p-010.pdf");
  assertThat(r.estadoOrden()).isEqualTo("DESPACHADA");
  assertThat(r.venceEn()).as("el taller no lee obligaciones").isNull();
  assertThat(scalar("SELECT vence_en||'|'||estado FROM obligacion_cobro WHERE id='"+p[1]+"'")).isEqualTo("2026-10-31|PENDIENTE");
  assertThat(scalar("SELECT registrado_por FROM despacho WHERE id='"+r.despachoId()+"'")).isEqualTo(JEFE.toString());
  assertThat(scalar("SELECT count(*) FROM evento_auditoria WHERE operacion='DESPACHO_REGISTRADO' AND usuario_id='"+JEFE+"'")).isEqualTo("1");
 }

 @Test void despachoAntiguoDejaLaObligacionEnMora()throws Exception{
  UUID[] p=ordenLiberada("P-011","2026-08-01");
  Despacho r=motor.registrarDespacho(COBRANZA,p[0],d("2026-08-10"),null);
  assertThat(r.venceEn()).isEqualTo(d("2026-09-09"));
  assertThat(scalar("SELECT estado FROM obligacion_cobro WHERE id='"+p[1]+"'")).isEqualTo("MORA");
 }

 @Test void reglasDelDespacho()throws Exception{
  UUID[] p=ordenLiberada("P-012","2026-09-25");
  rechaza(Codigo.FORBIDDEN,()->motor.registrarDespacho(VENTAS,p[0],d("2026-10-01"),null));
  rechaza(Codigo.VALIDATION_ERROR,()->motor.registrarDespacho(TALLER,p[0],d("2026-10-01"),"https://evil/x.pdf"));
  rechaza(Codigo.VALIDATION_ERROR,()->motor.registrarDespacho(TALLER,p[0],d("2026-10-01"),A+"/../otra/x.pdf"));
  assertThatThrownBy(()->motor.registrarDespacho(TALLER,p[0],d("2026-09-01"),null)).isInstanceOf(MotorFinancieroException.class)
   .hasMessageContaining("anterior al inicio de produccion");
  rechaza(Codigo.NOT_FOUND,()->motor.registrarDespacho(TALLER,UUID.randomUUID(),d("2026-10-01"),null));
  motor.registrarDespacho(TALLER,p[0],d("2026-10-01"),null);
  rechaza(Codigo.INVALID_STATE,()->motor.registrarDespacho(TALLER,p[0],d("2026-10-02"),null));
  UUID borrador=UUID.randomUUID();
  exec("INSERT INTO orden(id,organizacion_id,ref,estado) VALUES ('"+borrador+"','"+A+"','P-013','BORRADOR')");
  assertThatThrownBy(()->motor.registrarDespacho(TALLER,borrador,d("2026-10-01"),null)).isInstanceOf(MotorFinancieroException.class)
   .hasMessageContaining("liberada o en produccion");
  // El acta registrada no cambia de fecha: desincronizaria el vencimiento.
  assertThatThrownBy(()->exec("UPDATE despacho SET fecha_despacho='2026-10-05' WHERE orden_id='"+p[0]+"'")).hasMessageContaining("no cambia de orden ni de fecha");
 }

 @Test void jobProgramaRecordatoriosFuturosUnaSolaVez()throws Exception{
  UUID[] p=ordenLiberada("P-014","2026-09-25");
  motor.registrarDespacho(TALLER,p[0],d("2026-10-01"),null);
  exec("INSERT INTO canal_whatsapp(organizacion_id,cliente_id,instancia,chat_jid) VALUES ('"+A+"','"+CLIENTE_DOS+"','demo','51900000002@s.whatsapp.net')");
  Cobranza primera=motor.evaluarCobranza(JOB,d("2026-10-10"));
  // P-014 vence 31/10: hitos 28/10, 31/10 y 03/11. P-002 (vencida el 05/10) no recibe recordatorios retroactivos.
  assertThat(primera.enviosProgramados()).isEqualTo(3);
  assertThat(primera.alertasCreadas()).as("P-002 ya tiene una alerta de mora abierta").isEmpty();
  assertThat(scalar("SELECT string_agg(tipo||'@'||to_char(programado_para AT TIME ZONE 'America/Lima','YYYY-MM-DD HH24:MI'),',' ORDER BY programado_para) FROM envio_notificacion WHERE obligacion_id='"+p[1]+"'"))
   .isEqualTo("COBRANZA_PREVENTIVA@2026-10-28 09:00,COBRANZA_VENCIMIENTO@2026-10-31 09:00,MORA_TEMPRANA@2026-11-03 09:00");
  assertThat(scalar("SELECT DISTINCT numero_destino FROM envio_notificacion WHERE obligacion_id='"+p[1]+"'")).isEqualTo("51900000002");
  Cobranza segunda=motor.evaluarCobranza(JOB,d("2026-10-10"));
  assertThat(segunda.enviosProgramados()).isZero();
  assertThat(segunda.alertasCreadas()).isEmpty();
  assertThat(scalar("SELECT count(*) FROM envio_notificacion WHERE obligacion_id='"+p[1]+"'")).isEqualTo("3");
  assertThat(scalar("SELECT count(*) FROM evento_auditoria WHERE operacion='COBRANZA_EVALUADA' AND actor='SCHEDULER' AND usuario_id IS NULL")).isEqualTo("2");
 }

 @Test void moraTempranaAbreUnaAlertaPorObligacion()throws Exception{
  exec("UPDATE alerta_cobranza SET estado='RESUELTA', cerrada_en=now(), resolucion='Promesa de pago (demo)' WHERE id='"+ALERTA_MORA_P002+"'");
  Cobranza r=motor.evaluarCobranza(JOB,d("2026-10-10"));
  assertThat(r.alertasCreadas()).hasSize(1);
  assertThat(scalar("SELECT obligacion_id||'|'||regla||'|'||estado FROM alerta_cobranza WHERE id='"+r.alertasCreadas().get(0)+"'"))
   .isEqualTo(OBL_P002+"|MORA_TEMPRANA|ABIERTA");
  UUID[] p=ordenLiberada("P-015","2026-09-25");
  motor.registrarDespacho(TALLER,p[0],d("2026-10-01"),null);
  assertThat(motor.evaluarCobranza(JOB,d("2026-11-02")).alertasCreadas()).as("+3 aun no llega (03/11)").isEmpty();
  assertThat(motor.evaluarCobranza(JOB,d("2026-11-03")).alertasCreadas()).hasSize(1);
 }

 @Test void jobCorrigeEstadosYCancelaRecordatoriosDeDeudasSaldadas()throws Exception{
  exec("UPDATE obligacion_cobro SET estado='PARCIAL' WHERE id='"+OBL_P002+"'");
  UUID[] p=ordenLiberada("P-016","2026-09-25");
  motor.registrarDespacho(TALLER,p[0],d("2026-10-01"),null);
  exec("INSERT INTO canal_whatsapp(organizacion_id,cliente_id,instancia,chat_jid) VALUES ('"+A+"','"+CLIENTE_DOS+"','demo','51900000002@s.whatsapp.net')");
  Cobranza r=motor.evaluarCobranza(COBRANZA,d("2026-10-10"));
  assertThat(r.estadosActualizados()).isEqualTo(1);
  assertThat(scalar("SELECT estado FROM obligacion_cobro WHERE id='"+OBL_P002+"'")).isEqualTo("MORA");
  // Pago completo de P-016 registrado fuera del motor: el job igual cancela sus recordatorios pendientes.
  UUID pago=UUID.randomUUID();
  exec("INSERT INTO pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion,fase,verificado_por,verificado_en) VALUES ('"+pago+"','"+A+"','"+CLIENTE_DOS+"',200,'2026-10-09','YAPE','DEMO-OP-0016','VERIFICADO_BANCO','"+ADMIN+"',now())");
  exec("INSERT INTO aplicacion_pago(organizacion_id,pago_id,obligacion_id,monto_aplicado,aplicado_por) VALUES ('"+A+"','"+pago+"','"+p[1]+"',200,'"+ADMIN+"')");
  Cobranza despues=motor.evaluarCobranza(COBRANZA,d("2026-10-10"));
  assertThat(despues.enviosCancelados()).isEqualTo(3);
  assertThat(despues.estadosActualizados()).isEqualTo(1);
  assertThat(scalar("SELECT estado FROM obligacion_cobro WHERE id='"+p[1]+"'")).isEqualTo("PAGADA");
  assertThat(scalar("SELECT count(*) FROM evento_auditoria WHERE operacion='COBRANZA_EVALUADA' AND actor='USUARIO' AND usuario_id='"+ADMIN+"'")).isEqualTo("2");
 }

 @Test void soloAdministracionYSchedulerEjecutanElJob(){
  rechaza(Codigo.FORBIDDEN,()->motor.evaluarCobranza(TALLER,d("2026-10-10")));
  rechaza(Codigo.FORBIDDEN,()->motor.evaluarCobranza(VENTAS,d("2026-10-10")));
  rechaza(Codigo.VALIDATION_ERROR,()->motor.evaluarCobranza(JOB,null));
 }
}
