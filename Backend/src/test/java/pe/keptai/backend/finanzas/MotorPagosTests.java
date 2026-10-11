package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosPago.*;
import static org.assertj.core.api.Assertions.*;

/** Motor de pagos sobre V1-V8 + semilla, con login runtime real (sin propiedad ni BYPASSRLS): QA-03..06, VAL-01/03/04/05. */
class MotorPagosTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final UUID A=u("10000000-0000-4000-8000-000000000001"), B=u("10000000-0000-4000-8000-000000000002");
 static final UUID VENDEDOR=u("70000000-0000-4000-8000-000000000001"), ADMIN=u("70000000-0000-4000-8000-000000000002"), ADMIN_B=u("70000000-0000-4000-8000-000000000011");
 static final UUID CLIENTE_UNO=u("11111111-1111-4111-8111-111111111111"), CLIENTE_DOS=u("22222222-2222-4222-8222-222222222222");
 static final UUID OBL_P001=u("b0000000-0000-4000-8000-000000000001"), OBL_P002=u("b0000000-0000-4000-8000-000000000002");
 static final UUID V001=u("c0000000-0000-4000-8000-000000000001"), V002=u("c0000000-0000-4000-8000-000000000002"), V003=u("c0000000-0000-4000-8000-000000000003");
 static final UUID APP_V002=u("90000000-0000-4000-8000-000000000001"), ALERTA_MORA=u("80000000-0000-4000-8000-000000000001");
 static final ContextoFinanciero COBRANZA=ContextoFinanciero.usuario(A,ADMIN), VENTAS=ContextoFinanciero.usuario(A,VENDEDOR);
 static String semilla;
 static MotorPagos motor;

 static UUID u(String s){return UUID.fromString(s);}
 static BigDecimal s(String v){return new BigDecimal(v);}

 @BeforeAll static void setup() throws Exception {
  PG.start();
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  semilla=Files.readString(Path.of("../BD/semilla/semilla_demo.sql"));
  try(Connection c=owner()){exec(c,"CREATE ROLE motor_app LOGIN PASSWORD 'motor' NOSUPERUSER NOBYPASSRLS IN ROLE keptai_runtime");}
  DriverManagerDataSource ds=new DriverManagerDataSource(PG.getJdbcUrl(),"motor_app","motor");
  motor=new MotorPagos(new JdbcTemplate(ds),new DataSourceTransactionManager(ds));
 }
 @AfterAll static void stop(){PG.stop();}
 @BeforeEach void reiniciarSemilla()throws SQLException{try(Connection c=owner()){exec(c,"SET keptai.permitir_semilla='demo'");exec(c,semilla);}}

 static Connection owner() throws SQLException{Connection c=DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());exec(c,"SET search_path=keptai");return c;}
 static void exec(Connection c,String sql)throws SQLException{try(Statement st=c.createStatement()){st.execute(sql);}}
 static String scalar(String sql)throws SQLException{try(Connection c=owner();Statement st=c.createStatement();ResultSet rs=st.executeQuery(sql)){rs.next();return rs.getString(1);}}
 /** Pago recibido (sin fondos verificados) insertado como lo dejaria la captura. */
 static UUID pagoRecibido(UUID cliente,String monto,String codigo,String fecha)throws SQLException{
  UUID id=UUID.randomUUID();
  try(Connection c=owner()){exec(c,"INSERT INTO pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion) VALUES ('"+id+"','"+A+"',"+(cliente==null?"NULL":"'"+cliente+"'")+","+monto+",'"+fecha+"','YAPE','"+codigo+"')");}
  return id;
 }
 static void rechaza(Codigo codigo,ThrowingCallable accion){
  assertThatThrownBy(accion).isInstanceOf(MotorFinancieroException.class).extracting(e->((MotorFinancieroException)e).codigo()).isEqualTo(codigo);
 }
 interface ThrowingCallable extends org.assertj.core.api.ThrowableAssert.ThrowingCallable{}
 static BigDecimal saldoP002(){return motor.saldo(COBRANZA,OBL_P002).saldo();}

 @Test void qa03VoucherRecibidoNoReduceSaldo()throws Exception{
  UUID x=pagoRecibido(CLIENTE_DOS,"100","DEMO-OP-0100","2026-10-09");
  rechaza(Codigo.PAYMENT_NOT_VERIFIED,()->motor.aplicarPago(COBRANZA,x,OBL_P002,s("100")));
  assertThat(saldoP002()).isEqualByComparingTo("400");
  assertThat(motor.estadoPago(COBRANZA,x).sinAplicar()).isEqualByComparingTo("0");
 }

 @Test void verificarYAplicarParcialMantieneObligacionYAlerta()throws Exception{
  UUID x=pagoRecibido(CLIENTE_DOS,"100","DEMO-OP-0100","2026-10-09");
  Verificacion v=motor.verificarPago(COBRANZA,x);
  assertThat(v.simulado()).isTrue();
  assertThat(v.pago().fase()).isEqualTo("VERIFICADO_BANCO");
  assertThat(v.pago().sinAplicar()).isEqualByComparingTo("100");
  Aplicacion a=motor.aplicarPago(COBRANZA,x,OBL_P002,s("100"));
  assertThat(a.obligacion().saldo()).isEqualByComparingTo("300");
  assertThat(a.obligacion().estado()).isEqualTo("MORA");
  assertThat(a.pago().fase()).isEqualTo("APLICADO");
  assertThat(a.pago().estadoConciliacion()).isEqualTo("PARCIAL");
  assertThat(a.pago().sinAplicar()).isEqualByComparingTo("0");
  assertThat(a.alertasResueltas()).isEmpty();
  assertThat(scalar("SELECT estado FROM alerta_cobranza WHERE id='"+ALERTA_MORA+"'")).isEqualTo("ABIERTA");
  assertThat(scalar("SELECT count(*) FROM evento_auditoria WHERE usuario_id='"+ADMIN+"' AND actor='USUARIO' AND operacion IN ('PAGO_VERIFICADO','PAGO_APLICADO')")).isEqualTo("2");
  assertThat(scalar("SELECT aplicado_por FROM aplicacion_pago WHERE id='"+a.aplicacionId()+"'")).isEqualTo(ADMIN.toString());
 }

 @Test void qa04ReintentoYDuplicadoNoCambianSaldo()throws Exception{
  rechaza(Codigo.INSUFFICIENT_BALANCE,()->motor.aplicarPago(COBRANZA,V002,OBL_P002,s("100")));
  rechaza(Codigo.DUPLICATE_PAYMENT,()->motor.aplicarPago(COBRANZA,V003,OBL_P002,s("100")));
  rechaza(Codigo.DUPLICATE_PAYMENT,()->motor.verificarPago(COBRANZA,V003));
  assertThat(saldoP002()).isEqualByComparingTo("400");
  assertThat(scalar("SELECT count(*) FROM aplicacion_pago WHERE organizacion_id='"+A+"'")).isEqualTo("2");
 }

 @Test void duplicadoSeDetectaNoSeVerificaYSeMarcaConAlerta()throws Exception{
  UUID copia=pagoRecibido(CLIENTE_UNO,"300","DEMO-OP-0001","2026-10-02");
  assertThat(motor.detectarDuplicado(COBRANZA,copia)).contains(V001);
  try(Connection c=owner()){exec(c,"INSERT INTO integracion_servicio(id,organizacion_id,instancia,alcance,clave_hash) VALUES ('e0000000-0000-4000-8000-000000000001','"+A+"','demo','INGESTA',repeat('b',64))");}
  assertThat(motor.detectarDuplicado(ContextoFinanciero.servicio(A,u("e0000000-0000-4000-8000-000000000001")),copia)).contains(V001);
  rechaza(Codigo.DUPLICATE_PAYMENT,()->motor.verificarPago(COBRANZA,copia));
  Duplicado d=motor.marcarDuplicado(COBRANZA,copia);
  assertThat(d.originalId()).isEqualTo(V001);
  assertThat(d.pago().estadoConciliacion()).isEqualTo("DUPLICADO");
  assertThat(motor.marcarDuplicado(COBRANZA,copia).alertaId()).isEqualTo(d.alertaId());
  assertThat(scalar("SELECT regla||'|'||estado FROM alerta_cobranza WHERE id='"+d.alertaId()+"'")).isEqualTo("PAGO_EN_REVISION|ABIERTA");
  rechaza(Codigo.DUPLICATE_PAYMENT,()->motor.aplicarPago(COBRANZA,copia,OBL_P001,s("1")));
 }

 @Test void qa06PagoCompletoCierraSaldoResuelveAlertasYCancelaEnvios()throws Exception{
  try(Connection c=owner()){exec(c,"INSERT INTO envio_notificacion(organizacion_id,cliente_id,obligacion_id,instancia,numero_destino,tipo,idempotency_key,programado_para) VALUES ('"+A+"','"+CLIENTE_DOS+"','"+OBL_P002+"','demo','999000000','MORA_TEMPRANA','p002-m3d',now()+interval '1 day')");}
  UUID z=pagoRecibido(CLIENTE_DOS,"400","DEMO-OP-0400","2026-10-10");
  motor.verificarPago(COBRANZA,z);
  Aplicacion a=motor.aplicarPago(COBRANZA,z,OBL_P002,s("400.00"));
  assertThat(a.obligacion().saldo()).isEqualByComparingTo("0");
  assertThat(a.obligacion().estado()).isEqualTo("PAGADA");
  assertThat(a.pago().estadoConciliacion()).isEqualTo("APLICADO");
  assertThat(a.alertasResueltas()).containsExactly(ALERTA_MORA);
  assertThat(a.enviosCancelados()).isEqualTo(1);
  assertThat(scalar("SELECT estado FROM envio_notificacion WHERE idempotency_key='p002-m3d'")).isEqualTo("CANCELADO");
 }

 @Test void anulacionRestauraSaldoConMotivoYNoRestaDosVeces()throws Exception{
  rechaza(Codigo.VALIDATION_ERROR,()->motor.anularAplicacion(COBRANZA,APP_V002,"  "));
  Anulacion an=motor.anularAplicacion(COBRANZA,APP_V002,"Aplicado a la orden equivocada (demo)");
  assertThat(an.obligacion().saldo()).isEqualByComparingTo("500");
  assertThat(an.obligacion().estado()).isEqualTo("MORA");
  assertThat(an.pago().fase()).isEqualTo("VERIFICADO_BANCO");
  assertThat(an.pago().estadoConciliacion()).isEqualTo("PENDIENTE");
  assertThat(an.pago().sinAplicar()).isEqualByComparingTo("100");
  rechaza(Codigo.INVALID_STATE,()->motor.anularAplicacion(COBRANZA,APP_V002,"otra vez"));
  assertThat(saldoP002()).isEqualByComparingTo("500");
  assertThat(scalar("SELECT anulada_por||'|'||motivo_anulacion FROM aplicacion_pago WHERE id='"+APP_V002+"'")).isEqualTo(ADMIN+"|Aplicado a la orden equivocada (demo)");
  // Corregir = registrar una nueva aplicacion; la historia anulada se conserva.
  motor.aplicarPago(COBRANZA,V002,OBL_P002,s("100"));
  assertThat(saldoP002()).isEqualByComparingTo("400");
  assertThat(scalar("SELECT count(*) FROM aplicacion_pago WHERE pago_id='"+V002+"'")).isEqualTo("2");
 }

 @Test void rolesYAislamientoEntreOrganizaciones()throws Exception{
  rechaza(Codigo.FORBIDDEN,()->motor.aplicarPago(VENTAS,V002,OBL_P002,s("1")));
  rechaza(Codigo.FORBIDDEN,()->motor.verificarPago(VENTAS,V003));
  assertThat(motor.saldo(VENTAS,OBL_P002).saldo()).isEqualByComparingTo("400");
  rechaza(Codigo.NOT_FOUND,()->motor.verificarPago(ContextoFinanciero.usuario(B,ADMIN_B),V002));
  rechaza(Codigo.NOT_FOUND,()->motor.saldo(ContextoFinanciero.usuario(B,ADMIN_B),OBL_P002));
  rechaza(Codigo.FORBIDDEN,()->motor.saldo(ContextoFinanciero.usuario(B,ADMIN),OBL_P002));
 }

 @Test void importeInvalidoSeRechazaSinTocarLaBase(){
  rechaza(Codigo.VALIDATION_ERROR,()->motor.aplicarPago(COBRANZA,V002,OBL_P002,s("0.001")));
  rechaza(Codigo.VALIDATION_ERROR,()->motor.aplicarPago(COBRANZA,V002,OBL_P002,s("-1")));
 }

 @Test void falloAntesDelCommitRevierteAplicacionEstadosYAuditoria()throws Exception{
  UUID z=pagoRecibido(CLIENTE_DOS,"400","DEMO-OP-0400","2026-10-10");
  motor.verificarPago(COBRANZA,z);
  try(Connection c=owner()){exec(c,"REVOKE INSERT ON evento_auditoria FROM keptai_runtime");}
  try{
   // El rechazo llega de la base al auditar (despues de insertar la aplicacion y recalcular estados), no del chequeo de rol.
   assertThatThrownBy(()->motor.aplicarPago(COBRANZA,z,OBL_P002,s("400"))).isInstanceOf(MotorFinancieroException.class)
    .hasMessage("Operacion no autorizada por la base").hasRootCauseMessage("ERROR: permission denied for table evento_auditoria");
  }finally{
   try(Connection c=owner()){exec(c,"GRANT INSERT ON evento_auditoria TO keptai_runtime");}
  }
  assertThat(saldoP002()).isEqualByComparingTo("400");
  assertThat(scalar("SELECT count(*) FROM aplicacion_pago WHERE pago_id='"+z+"'")).isEqualTo("0");
  assertThat(scalar("SELECT fase||'|'||estado_conciliacion FROM pago WHERE id='"+z+"'")).isEqualTo("VERIFICADO_BANCO|PENDIENTE");
  assertThat(scalar("SELECT estado FROM obligacion_cobro WHERE id='"+OBL_P002+"'")).isEqualTo("MORA");
  assertThat(scalar("SELECT estado FROM alerta_cobranza WHERE id='"+ALERTA_MORA+"'")).isEqualTo("ABIERTA");
 }

 @Test void val05ConcurrenciaNoSobreaplicaNiPagoNiObligacion()throws Exception{
  // Mismo pago (400) en dos aplicaciones simultaneas de 300.
  UUID z=pagoRecibido(CLIENTE_DOS,"400","DEMO-OP-0400","2026-10-10");
  motor.verificarPago(COBRANZA,z);
  assertThat(carrera(()->motor.aplicarPago(COBRANZA,z,OBL_P002,s("300")),()->motor.aplicarPago(COBRANZA,z,OBL_P002,s("300"))))
   .containsExactlyInAnyOrder("OK",Codigo.INSUFFICIENT_BALANCE.name());
  assertThat(saldoP002()).isEqualByComparingTo("100");
  reiniciarSemilla();
  // Dos pagos distintos (300 y 300) sobre la misma obligacion con saldo 400.
  UUID w1=pagoRecibido(CLIENTE_DOS,"300","DEMO-OP-0301","2026-10-10"), w2=pagoRecibido(CLIENTE_DOS,"300","DEMO-OP-0302","2026-10-10");
  motor.verificarPago(COBRANZA,w1);
  motor.verificarPago(COBRANZA,w2);
  assertThat(carrera(()->motor.aplicarPago(COBRANZA,w1,OBL_P002,s("300")),()->motor.aplicarPago(COBRANZA,w2,OBL_P002,s("300"))))
   .containsExactlyInAnyOrder("OK",Codigo.INSUFFICIENT_BALANCE.name());
  assertThat(saldoP002()).isEqualByComparingTo("100");
  assertThat(scalar("SELECT sum(monto_aplicado) FROM aplicacion_pago WHERE obligacion_id='"+OBL_P002+"' AND anulada_en IS NULL")).isEqualTo("400.00");
 }

 static List<String> carrera(Callable<?> uno,Callable<?> dos)throws Exception{
  ExecutorService e=Executors.newFixedThreadPool(2);
  CountDownLatch salida=new CountDownLatch(1);
  try{
   Callable<String> envolver1=()->{salida.await();try{uno.call();return "OK";}catch(MotorFinancieroException ex){return ex.codigo().name();}};
   Callable<String> envolver2=()->{salida.await();try{dos.call();return "OK";}catch(MotorFinancieroException ex){return ex.codigo().name();}};
   Future<String> f1=e.submit(envolver1), f2=e.submit(envolver2);
   salida.countDown();
   return List.of(f1.get(30,TimeUnit.SECONDS),f2.get(30,TimeUnit.SECONDS));
  }finally{e.shutdownNow();}
 }
}
