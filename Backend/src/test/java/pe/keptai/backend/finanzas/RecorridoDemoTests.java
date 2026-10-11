package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosCostos.*;
import pe.keptai.backend.finanzas.ResultadosFinancieros.*;
import pe.keptai.backend.finanzas.ResultadosPago.*;
import static org.assertj.core.api.Assertions.*;

// Roadmap B7 a nivel de motores: un pedido nuevo recorre costeo, despacho, cobro, cobranza, resultados y caja en la misma
// base (V1-V9 + semilla) con un login runtime real. La captura y la decision de credito van por SQL: son del adapter MIG.
class RecorridoDemoTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final UUID A=u("10000000-0000-4000-8000-000000000001"), B=u("10000000-0000-4000-8000-000000000002");
 static final UUID VENDEDOR=u("70000000-0000-4000-8000-000000000001"), ADMIN=u("70000000-0000-4000-8000-000000000002"),
  GERENTE=u("70000000-0000-4000-8000-000000000003"), JEFE=u("70000000-0000-4000-8000-000000000004"), ADMIN_B=u("70000000-0000-4000-8000-000000000011");
 static final UUID CLIENTE_DOS=u("22222222-2222-4222-8222-222222222222"), TALLER_INTERNO=u("13000000-0000-4000-8000-000000000001");
 static final UUID UNIFORMES=u("14000000-0000-4000-8000-000000000001"), SPORT=u("14000000-0000-4000-8000-000000000002"), SCHEDULER_ID=u("e0000000-0000-4000-8000-000000000009");
 static final ContextoFinanciero TALLER=ContextoFinanciero.usuario(A,JEFE), COBRANZA=ContextoFinanciero.usuario(A,ADMIN),
  GERENCIA=ContextoFinanciero.usuario(A,GERENTE), JOB=ContextoFinanciero.servicio(A,SCHEDULER_ID);
 static MotorPagos pagos; static MotorCobranza cobranza; static MotorCostos costos; static MotorResultados resultados; static MotorCaja caja;

 static UUID u(String s){return UUID.fromString(s);}
 static BigDecimal s(String v){return new BigDecimal(v);}

 @BeforeAll static void setup() throws Exception {
  PG.start();
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  try(Connection c=owner()){
   exec(c,"CREATE ROLE recorrido_app LOGIN PASSWORD 'recorrido' NOSUPERUSER NOBYPASSRLS IN ROLE keptai_runtime");
   exec(c,"SET keptai.permitir_semilla='demo'");exec(c,Files.readString(Path.of("../BD/semilla/semilla_demo.sql")));
  }
  DriverManagerDataSource ds=new DriverManagerDataSource(PG.getJdbcUrl(),"recorrido_app","recorrido");
  JdbcTemplate jdbc=new JdbcTemplate(ds); DataSourceTransactionManager tm=new DataSourceTransactionManager(ds);
  pagos=new MotorPagos(jdbc,tm); cobranza=new MotorCobranza(jdbc,tm); costos=new MotorCostos(jdbc,tm);
  resultados=new MotorResultados(jdbc,tm); caja=new MotorCaja(jdbc,tm);
 }
 @AfterAll static void stop(){PG.stop();}
 static Connection owner() throws SQLException{Connection c=DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());exec(c,"SET search_path=keptai");return c;}
 static void exec(Connection c,String sql)throws SQLException{try(Statement st=c.createStatement()){st.execute(sql);}}
 static void exec(String sql)throws SQLException{try(Connection c=owner()){exec(c,sql);}}
 static String scalar(String sql)throws SQLException{try(Connection c=owner();Statement st=c.createStatement();ResultSet rs=st.executeQuery(sql)){rs.next();return rs.getString(1);}}

 @Test void pedidoCompletoDeCapturaACajaEnLaMismaBase()throws Exception{
  UUID orden=UUID.randomUUID(), obligacion=UUID.randomUUID(), corte=UUID.randomUUID(), confeccion=UUID.randomUUID();
  // 1. Captura confirmada y credito del vendedor (adapter MIG): P-040 a credito 30 dias, dos lineas, taller propio.
  try(Connection c=owner()){
   exec(c,"INSERT INTO orden(id,organizacion_id,ref,cliente_id,marca_id,vendedor_id,estado,condicion_pago,plazo_dias,total,tipo_produccion,fecha_inicio_produccion) VALUES ('"+orden+"','"+A+"','P-040','"+CLIENTE_DOS+"','12000000-0000-4000-8000-000000000001','"+VENDEDOR+"','PENDIENTE_APROBACION','CREDITO',30,600,'INTERNA','2026-09-25')");
   exec(c,"INSERT INTO orden_item(organizacion_id,orden_id,linea_id,descripcion,cantidad,precio_unit) VALUES ('"+A+"','"+orden+"','"+UNIFORMES+"','Uniforme (demo)',10,40),('"+A+"','"+orden+"','"+SPORT+"','Polo (demo)',10,20)");
   exec(c,"INSERT INTO aprobacion_credito(organizacion_id,orden_id,aprobado_por,decision,plazo_dias,decidido_en) VALUES ('"+A+"','"+orden+"','"+VENDEDOR+"','APROBADO',30,now())");
   exec(c,"UPDATE orden SET estado='EN_PRODUCCION' WHERE id='"+orden+"'");
   exec(c,"INSERT INTO obligacion_cobro(id,organizacion_id,orden_id,monto,plazo_dias) VALUES ('"+obligacion+"','"+A+"','"+orden+"',600,30)");
   exec(c,"INSERT INTO orden_etapa(id,organizacion_id,orden_id,unidad_id,etapa,estado) VALUES ('"+corte+"','"+A+"','"+orden+"','"+TALLER_INTERNO+"','CORTE','TERMINADA'),('"+confeccion+"','"+A+"','"+orden+"','"+TALLER_INTERNO+"','CONFECCION','TERMINADA')");
   exec(c,"INSERT INTO canal_whatsapp(organizacion_id,cliente_id,instancia,chat_jid) VALUES ('"+A+"','"+CLIENTE_DOS+"','demo','51900000002@s.whatsapp.net')");
   exec(c,"INSERT INTO integracion_servicio(id,organizacion_id,instancia,alcance,clave_hash) VALUES ('"+SCHEDULER_ID+"','"+A+"','demo','SCHEDULER',repeat('d',64))");
  }
  // 2. Taller: costos reales por etapa (200 + 150 + 50 = 400) y despacho que fija el vencimiento.
  costos.registrarCosto(TALLER,orden,corte,"MATERIA_PRIMA",s("200"),"REAL","Factura de tela (demo)");
  costos.registrarCosto(TALLER,orden,confeccion,"MANO_OBRA",s("150"),"REAL","Planilla (demo)");
  costos.registrarCosto(TALLER,orden,confeccion,"CIF",s("50"),"REAL","Luz y local (demo)");
  assertThat(cobranza.registrarDespacho(TALLER,orden,LocalDate.parse("2026-10-01"),null).estadoOrden()).isEqualTo("DESPACHADA");
  assertThat(scalar("SELECT vence_en FROM obligacion_cobro WHERE id='"+obligacion+"'")).isEqualTo("2026-10-31");
  // 3. Reparto por valor de venta (400/600 y 200/600), cargo interno y cierre del costeo.
  costos.repartirCostos(TALLER,orden,"VALOR_VENTA");
  costos.registrarTransferencia(COBRANZA,orden,TALLER_INTERNO,s("380"),"Tarifa interna (demo)","Gerencia");
  CierreCosteo cierre=costos.cerrarCosteo(COBRANZA,orden,"REAL");
  assertThat(cierre.costoTotal()).isEqualByComparingTo("400");
  assertThat(cierre.componentesFaltantes()).isEmpty();
  assertThat(cierre.asignacionCompleta()).isTrue();
  // 4. Voucher (WF2 deja el pago RECIBIDO), verificacion y aplicacion parcial; la copia se marca duplicada.
  UUID voucher=UUID.randomUUID(), copia=UUID.randomUUID();
  exec("INSERT INTO pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion,creado_en) VALUES ('"+voucher+"','"+A+"','"+CLIENTE_DOS+"',250,'2026-10-09','YAPE','DEMO-OP-0040',now()-interval '1 minute')");
  exec("INSERT INTO pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion) VALUES ('"+copia+"','"+A+"','"+CLIENTE_DOS+"',250,'2026-10-09','YAPE','DEMO-OP-0040')");
  assertThatThrownBy(()->pagos.aplicarPago(COBRANZA,voucher,obligacion,s("250"))).isInstanceOf(MotorFinancieroException.class)
   .extracting(e->((MotorFinancieroException)e).codigo()).isEqualTo(Codigo.PAYMENT_NOT_VERIFIED);
  pagos.verificarPago(COBRANZA,voucher);
  Aplicacion aplicada=pagos.aplicarPago(COBRANZA,voucher,obligacion,s("250"));
  assertThat(aplicada.obligacion().saldo()).isEqualByComparingTo("350");
  assertThat(pagos.marcarDuplicado(COBRANZA,copia).originalId()).isEqualTo(voucher);
  // 5. Job de cobranza: recordatorios futuros de P-040 una sola vez.
  LocalDate hoy=LocalDate.now(ZoneId.of("America/Lima"));
  int programados=cobranza.evaluarCobranza(JOB,hoy).enviosProgramados();
  assertThat(cobranza.evaluarCobranza(JOB,hoy).enviosProgramados()).isZero();
  assertThat(scalar("SELECT count(*) FROM envio_notificacion WHERE obligacion_id='"+obligacion+"'")).isEqualTo(String.valueOf(programados));
  // 6. Resultados: pedido, linea, centro productivo, resumen y CSV coherentes entre si.
  FilaMargen p040=resultados.margen(GERENCIA,Agrupacion.ORDEN,null,hoy).filas().stream().filter(f->f.clave().equals("P-040")).findFirst().orElseThrow();
  assertThat(p040.margen()).isEqualByComparingTo("200");
  ReporteMargen lineas=resultados.margen(GERENCIA,Agrupacion.LINEA,null,hoy);
  assertThat(lineas.filas()).extracting(f->f.clave()+"|"+f.ingreso()+"|"+f.costoTotal()+"|"+f.margen())
   .containsExactly("Sport|700.00|483.34|216.66","Uniformes|700.00|606.66|93.34");
  assertThat(lineas.totales().margen()).isEqualByComparingTo(resultados.margen(GERENCIA,Agrupacion.ORDEN,null,hoy).totales().margen());
  FilaCentro centro=resultados.centroProductivo(GERENCIA,hoy).filas().stream().filter(f->f.ref().equals("P-040")).findFirst().orElseThrow();
  assertThat(centro.resultadoTaller()+"|"+centro.resultadoComercial()+"|"+centro.margenConsolidado()).isEqualTo("-20.00|220.00|200.00");
  Resumen resumen=resultados.resumen(GERENCIA,hoy);
  assertThat(resumen.ventas()+"|"+resumen.cobradoAplicado()+"|"+resumen.saldoPendiente()+"|"+resumen.costoTotal()+"|"+resumen.margen())
   .isEqualTo("1400.00|650.00|750.00|1090.00|310.00");
  assertThat(resultados.csvPedidos(GERENCIA,hoy)).contains(",P-040,Corpotex,own,PEN,60000,40000,20000,complete,25000,35000,2026-10-31,partially_paid,demo_fixture");
  // 7. Caja: todo lo pendiente (400 de P-002 + 350 de P-040) aparece una sola vez; el duplicado no entra.
  ProyeccionCaja proyeccion=caja.proyectar(GERENCIA,hoy,0);
  BigDecimal esperado=proyeccion.semanas().stream().map(SemanaCaja::esperado).reduce(BigDecimal.ZERO,BigDecimal::add);
  assertThat(esperado.add(proyeccion.cobrosFueraHorizonte()).add(proyeccion.cobrosSinFecha())).isEqualByComparingTo("750");
  assertThat(proyeccion.dineroSinAsignar()).isEqualByComparingTo("0");
  // 8. Correccion trazable: anular y volver a aplicar deja el mismo saldo y conserva la historia.
  pagos.anularAplicacion(COBRANZA,aplicada.aplicacionId(),"Aplicada a la orden equivocada (demo)");
  assertThat(pagos.saldo(COBRANZA,obligacion).saldo()).isEqualByComparingTo("600");
  pagos.aplicarPago(COBRANZA,voucher,obligacion,s("250"));
  assertThat(pagos.saldo(COBRANZA,obligacion).saldo()).isEqualByComparingTo("350");
  assertThat(scalar("SELECT count(*) FROM aplicacion_pago WHERE pago_id='"+voucher+"'")).isEqualTo("2");
  // 9. Aislamiento: la otra organizacion no ve nada de esto.
  ContextoFinanciero otra=ContextoFinanciero.usuario(B,ADMIN_B);
  assertThat(resultados.margen(otra,Agrupacion.ORDEN,null,hoy).filas()).isEmpty();
  assertThat(resultados.centroProductivo(otra,hoy).filas()).isEmpty();
  assertThatThrownBy(()->pagos.saldo(otra,obligacion)).isInstanceOf(MotorFinancieroException.class)
   .extracting(e->((MotorFinancieroException)e).codigo()).isEqualTo(Codigo.NOT_FOUND);
  // Auditoria: cada paso quedo registrado con su actor.
  assertThat(scalar("SELECT string_agg(DISTINCT operacion, ',' ORDER BY operacion) FROM evento_auditoria WHERE organizacion_id='"+A+"'"))
   .isEqualTo("APLICACION_ANULADA,CARGO_INTERNO_REGISTRADO,COBRANZA_EVALUADA,COSTEO_CERRADO,COSTOS_REPARTIDOS,COSTO_REGISTRADO,"
    +"DESPACHO_REGISTRADO,PAGO_APLICADO,PAGO_DUPLICADO,PAGO_VERIFICADO");
 }
}
