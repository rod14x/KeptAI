package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosFinancieros.*;
import static org.assertj.core.api.Assertions.*;

// C-02/C-05/C-06/C-07 sobre V1-V9 + semilla con login runtime real: cifras del roadmap §6 y de openapi.yaml.
class MotorResultadosCajaTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final UUID A=u("10000000-0000-4000-8000-000000000001");
 static final UUID VENDEDOR=u("70000000-0000-4000-8000-000000000001"), ADMIN=u("70000000-0000-4000-8000-000000000002"),
  GERENTE=u("70000000-0000-4000-8000-000000000003"), JEFE=u("70000000-0000-4000-8000-000000000004");
 static final UUID P001=u("a0000000-0000-4000-8000-000000000001"), CLIENTE_DOS=u("22222222-2222-4222-8222-222222222222");
 static final UUID OBL_P002=u("b0000000-0000-4000-8000-000000000002"), COSTO_P002=u("19000000-0000-4000-8000-000000000004");
 static final ContextoFinanciero GERENCIA=ContextoFinanciero.usuario(A,GERENTE);
 static final LocalDate CORTE=LocalDate.parse("2026-10-10");
 static String semilla;
 static MotorResultados resultados;
 static MotorCaja caja;

 static UUID u(String s){return UUID.fromString(s);}
 static BigDecimal s(String v){return new BigDecimal(v);}

 @BeforeAll static void setup() throws Exception {
  PG.start();
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  semilla=Files.readString(Path.of("../BD/semilla/semilla_demo.sql"));
  try(Connection c=owner()){exec(c,"CREATE ROLE resultados_app LOGIN PASSWORD 'resultados' NOSUPERUSER NOBYPASSRLS IN ROLE keptai_runtime");}
  DriverManagerDataSource ds=new DriverManagerDataSource(PG.getJdbcUrl(),"resultados_app","resultados");
  resultados=new MotorResultados(new JdbcTemplate(ds),new DataSourceTransactionManager(ds));
  caja=new MotorCaja(new JdbcTemplate(ds),new DataSourceTransactionManager(ds));
 }
 @AfterAll static void stop(){PG.stop();}
 @BeforeEach void reiniciar()throws SQLException{try(Connection c=owner()){exec(c,"SET keptai.permitir_semilla='demo'");exec(c,semilla);}}

 static Connection owner() throws SQLException{Connection c=DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());exec(c,"SET search_path=keptai");return c;}
 static void exec(Connection c,String sql)throws SQLException{try(Statement st=c.createStatement()){st.execute(sql);}}
 static void exec(String sql)throws SQLException{try(Connection c=owner()){exec(c,sql);}}
 static void rechaza(Codigo codigo,org.assertj.core.api.ThrowableAssert.ThrowingCallable accion){
  assertThatThrownBy(accion).isInstanceOf(MotorFinancieroException.class).extracting(e->((MotorFinancieroException)e).codigo()).isEqualTo(codigo);
 }
 static String fila(FilaMargen f){return f.clave()+"|"+f.ingreso()+"|"+f.costoTotal()+"|"+f.margen()+"|"+f.completo()+"|"+f.ordenes();}

 @Test void qa08MargenPorPedidoMarcaYLinea(){
  ReporteMargen orden=resultados.margen(GERENCIA,Agrupacion.ORDEN,null,CORTE);
  assertThat(orden.filas()).extracting(MotorResultadosCajaTests::fila).containsExactly("P-001|300.00|340.00|-40.00|true|1","P-002|500.00|350.00|150.00|true|1");
  assertThat(fila(orden.totales())).isEqualTo("TOTAL|800.00|690.00|110.00|true|2");
  assertThat(resultados.margen(GERENCIA,Agrupacion.MARCA,null,CORTE).filas()).extracting(MotorResultadosCajaTests::fila)
   .containsExactly("Corpotex|300.00|340.00|-40.00|true|1","Unicrack|500.00|350.00|150.00|true|1");
  assertThat(resultados.margen(GERENCIA,Agrupacion.LINEA,null,CORTE).filas()).extracting(MotorResultadosCajaTests::fila)
   .containsExactly("Sport|500.00|350.00|150.00|true|1","Uniformes|300.00|340.00|-40.00|true|1");
  assertThat(resultados.margen(GERENCIA,Agrupacion.ORDEN,"INTERNA",CORTE).filas()).extracting(FilaMargen::clave).containsExactly("P-001");
 }

 @Test void costosIncompletosNuncaDanMargenCero()throws Exception{
  UUID p3=UUID.randomUUID();
  exec("INSERT INTO orden(id,organizacion_id,ref,cliente_id,estado,condicion_pago,total,tipo_produccion) VALUES ('"+p3+"','"+A+"','P-003','"+CLIENTE_DOS+"','PENDIENTE_APROBACION','CONTADO',200,'INTERNA')");
  exec("INSERT INTO costo_orden(organizacion_id,orden_id,concepto,monto,origen,fuente) VALUES ('"+A+"','"+p3+"','MATERIA_PRIMA',80,'REAL','demo')");
  LocalDate hoyOFuturo=LocalDate.parse("2027-01-31");
  ReporteMargen r=resultados.margen(GERENCIA,Agrupacion.ORDEN,null,hoyOFuturo);
  FilaMargen f3=r.filas().stream().filter(f->f.clave().equals("P-003")).findFirst().orElseThrow();
  assertThat(f3.costoTotal()).isNull();
  assertThat(f3.margen()).isNull();
  assertThat(f3.componentesFaltantes()).containsExactly("CIF","MANO_OBRA");
  assertThat(r.totales().margen()).isNull();
  assertThat(r.totales().completo()).isFalse();
  assertThat(resultados.resumen(GERENCIA,hoyOFuturo).margen()).isNull();
 }

 @Test void lineaRequiereCostosAsignadosAlCien()throws Exception{
  exec("DELETE FROM asignacion_costo_item WHERE costo_id='"+COSTO_P002+"'");
  exec("UPDATE orden SET costos_reales_completos=true WHERE ref='P-002' AND organizacion_id='"+A+"'");
  assertThat(resultados.margen(GERENCIA,Agrupacion.ORDEN,null,CORTE).totales().margen()).isEqualByComparingTo("110");
  FilaMargen sport=resultados.margen(GERENCIA,Agrupacion.LINEA,null,CORTE).filas().get(0);
  assertThat(sport.clave()).isEqualTo("Sport");
  assertThat(sport.completo()).isFalse();
  assertThat(sport.margen()).isNull();
 }

 @Test void qa09CentroProductivoEliminaElCargoInternoAlConsolidar()throws Exception{
  ReporteCentro r=resultados.centroProductivo(GERENCIA,CORTE);
  assertThat(r.filas()).hasSize(1);
  FilaCentro f=r.filas().get(0);
  assertThat(f.ref()+"|"+f.unidad()+"|"+f.cargoInterno()+"|"+f.costoTaller()+"|"+f.resultadoTaller()+"|"+f.resultadoComercial()+"|"+f.margenConsolidado())
   .isEqualTo("P-001|Taller interno (demo)|320.00|340.00|-20.00|-20.00|-40.00");
  assertThat(r.resultadoTalleres()+"|"+r.resultadoComercial()+"|"+r.margenConsolidado()).isEqualTo("-20.00|-20.00|-40.00");
  // El cargo interno no es ingreso de caja: la proyeccion no cambia por su existencia.
  assertThat(caja.proyectar(GERENCIA,CORTE,0).semanas().get(0).realizado()).isEqualByComparingTo("0");
  exec("INSERT INTO costo_orden(organizacion_id,orden_id,concepto,monto,origen,fuente) VALUES ('"+A+"','"+P001+"','LOGISTICA',5,'REAL','demo')");
  exec("UPDATE orden SET costos_reales_completos=true WHERE id='"+P001+"'");
  FilaCentro sinUnidad=resultados.centroProductivo(GERENCIA,CORTE).filas().get(0);
  assertThat(sinUnidad.completo()).as("costo sin etapa: unidad desconocida").isFalse();
  assertThat(sinUnidad.resultadoTaller()).isNull();
 }

 @Test void transferenciaSoloDeTallerInternoEInmutable()throws Exception{
  UUID p2=u("a0000000-0000-4000-8000-000000000002");
  assertThatThrownBy(()->exec("INSERT INTO transferencia_interna(organizacion_id,orden_id,unidad_origen_id,monto,moneda,criterio,fuente,registrado_por) VALUES ('"+A+"','"+p2+"','13000000-0000-4000-8000-000000000002',100,'PEN','x','demo','"+ADMIN+"')"))
   .hasMessageContaining("solo sale de un taller interno");
  assertThatThrownBy(()->exec("UPDATE transferencia_interna SET monto=1")).hasMessageContaining("inmutable");
  assertThatThrownBy(()->exec("INSERT INTO asignacion_costo_item(organizacion_id,costo_id,orden_item_id,monto,moneda,metodo,fuente) VALUES ('"+A+"','"+COSTO_P002+"','15000000-0000-4000-8000-000000000001',1,'PEN','MANUAL','demo')"))
   .hasMessageContaining("misma orden");
  assertThatThrownBy(()->exec("UPDATE costo_orden SET monto=100 WHERE id='"+COSTO_P002+"'")).hasMessageContaining("asignado a items");
  exec("UPDATE transferencia_interna SET anulada_en=now(),anulada_por='"+ADMIN+"',motivo_anulacion='Precio corregido (demo)'");
  assertThat(resultados.centroProductivo(GERENCIA,CORTE).filas()).isEmpty();
 }

 @Test void resumenSeparaVentasCobradoSaldoYMargen(){
  Resumen r=resultados.resumen(GERENCIA,CORTE);
  assertThat(r.ventas()+"|"+r.cobradoAplicado()+"|"+r.saldoPendiente()+"|"+r.costoTotal()+"|"+r.margen()+"|"+r.costosCompletos())
   .isEqualTo("800.00|400.00|400.00|690.00|110.00|true");
 }

 @Test void qa12CsvDePedidosEnCentavosYProtegidoContraFormulas()throws Exception{
  String csv=resultados.csvPedidos(GERENCIA,CORTE);
  assertThat(csv.split("\r\n")).containsExactly(
   "order_id,order_code,brand,production_mode,currency,sale_cents,cost_cents,margin_cents,cost_status,applied_cents,balance_cents,due_date,receivable_status,data_origin",
   P001+",P-001,Corpotex,own,PEN,30000,34000,-4000,complete,30000,0,2026-10-20,paid,demo_fixture",
   "a0000000-0000-4000-8000-000000000002,P-002,Unicrack,outsourced,PEN,50000,35000,15000,complete,10000,40000,2026-10-05,overdue,demo_fixture");
  exec("UPDATE marca SET nombre='=HYPERLINK(\"x\",1), malo' WHERE nombre='Corpotex'");
  assertThat(resultados.csvPedidos(GERENCIA,CORTE)).contains(",\"'=HYPERLINK(\"\"x\"\",1), malo\",");
 }

 @Test void qa10CajaCuatroSemanasComoElContrato(){
  ProyeccionCaja p=caja.proyectar(GERENCIA,CORTE,0);
  assertThat(p.aperturaCargada()).isTrue();
  assertThat(p.saldoInicial()).isEqualByComparingTo("100");
  assertThat(p.semanas()).extracting(w->w.inicio()+"|"+w.esperado()+"|"+w.realizado()+"|"+w.egresos()+"|"+w.neto()+"|"+w.cierre())
   .containsExactly("2026-10-12|400.00|0.00|250.00|150.00|250.00","2026-10-19|0.00|0.00|0.00|0.00|250.00",
    "2026-10-26|0.00|0.00|300.00|-300.00|-50.00","2026-11-02|0.00|0.00|0.00|0.00|-50.00");
  assertThat(caja.proyectar(GERENCIA,CORTE,2500).semanas().get(0).cierre()).isEqualByComparingTo("150");
 }

 @Test void cajaSinAperturaDejaCierresNulos(){
  ProyeccionCaja p=caja.proyectar(GERENCIA,LocalDate.parse("2026-10-09"),0);
  assertThat(p.aperturaCargada()).isFalse();
  assertThat(p.semanas()).allSatisfy(w->assertThat(w.cierre()).isNull());
  assertThat(p.semanas().get(0).egresos()).isEqualByComparingTo("250");
 }

 @Test void pagoRealizadoYLuegoAplicadoNoSeCuentaDosVeces()throws Exception{
  UUID pago=UUID.randomUUID();
  exec("INSERT INTO pago(id,organizacion_id,cliente_id,monto,fecha_pago,medio,codigo_operacion,fase,verificado_por,verificado_en) VALUES ('"+pago+"','"+A+"','"+CLIENTE_DOS+"',100,'2026-10-13','YAPE','DEMO-OP-0013','VERIFICADO_BANCO','"+ADMIN+"',now())");
  ProyeccionCaja antes=caja.proyectar(GERENCIA,CORTE,0);
  // Sin aplicar, el cobro esperado solo baja por lo aplicado (DB-DEF-001 §6); el posible solapamiento se senala.
  assertThat(antes.semanas().get(0).esperado()).isEqualByComparingTo("400");
  assertThat(antes.semanas().get(0).realizado()).isEqualByComparingTo("100");
  assertThat(antes.dineroSinAsignar()).isEqualByComparingTo("100");
  exec("INSERT INTO aplicacion_pago(organizacion_id,pago_id,obligacion_id,monto_aplicado,aplicado_por) VALUES ('"+A+"','"+pago+"','"+OBL_P002+"',100,'"+ADMIN+"')");
  ProyeccionCaja despues=caja.proyectar(GERENCIA,CORTE,0);
  // Aplicado: pasa de esperado a realizado; el ingreso total de la deuda sigue siendo 400, una sola vez.
  assertThat(despues.semanas().get(0).esperado()).isEqualByComparingTo("300");
  assertThat(despues.semanas().get(0).realizado()).isEqualByComparingTo("100");
  assertThat(despues.semanas().get(0).esperado().add(despues.semanas().get(0).realizado())).isEqualByComparingTo("400");
  assertThat(despues.semanas().get(0).cierre()).isEqualByComparingTo(caja.proyectar(GERENCIA,CORTE,0).semanas().get(0).cierre());
  assertThat(despues.semanas().get(0).cierre()).isEqualByComparingTo("250");
  assertThat(despues.dineroSinAsignar()).isEqualByComparingTo("0");
 }

 @Test void rolesDeResultadosYCaja(){
  rechaza(Codigo.FORBIDDEN,()->resultados.margen(ContextoFinanciero.usuario(A,VENDEDOR),Agrupacion.ORDEN,null,CORTE));
  rechaza(Codigo.FORBIDDEN,()->resultados.csvPedidos(ContextoFinanciero.usuario(A,JEFE),CORTE));
  rechaza(Codigo.FORBIDDEN,()->caja.proyectar(ContextoFinanciero.usuario(A,JEFE),CORTE,0));
  rechaza(Codigo.VALIDATION_ERROR,()->caja.proyectar(GERENCIA,CORTE,10001));
  rechaza(Codigo.VALIDATION_ERROR,()->resultados.margen(GERENCIA,Agrupacion.ORDEN,"OTRO",CORTE));
  assertThat(resultados.margen(ContextoFinanciero.usuario(A,ADMIN),Agrupacion.ORDEN,null,CORTE).filas()).hasSize(2);
 }
}
