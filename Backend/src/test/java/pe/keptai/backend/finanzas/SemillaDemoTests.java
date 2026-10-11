package pe.keptai.backend.finanzas;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

/** Semilla ficticia BD/semilla/semilla_demo.sql sobre V1-V7 reales: cifras del roadmap §6, reinicio, guarda y aislamiento. */
class SemillaDemoTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final String A="10000000-0000-4000-8000-000000000001", B="10000000-0000-4000-8000-000000000002";
 static final String GERENTE="70000000-0000-4000-8000-000000000003", JEFE="70000000-0000-4000-8000-000000000004";
 static String semilla;
 @BeforeAll static void setup() throws Exception {
  PG.start();
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  semilla=Files.readString(Path.of("../BD/semilla/semilla_demo.sql"));
  cargar();
 }
 @AfterAll static void stop(){PG.stop();}
 static Connection owner() throws SQLException{Connection c=DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());exec(c,"SET search_path=keptai");return c;}
 static void exec(Connection c,String sql)throws SQLException{try(Statement s=c.createStatement()){s.execute(sql);}}
 static String scalar(Connection c,String sql)throws SQLException{try(Statement s=c.createStatement();ResultSet rs=s.executeQuery(sql)){rs.next();return rs.getString(1);}}
 static void cargar()throws SQLException{try(Connection c=owner()){exec(c,"SET keptai.permitir_semilla='demo'");exec(c,semilla);}}
 static Connection runtime(String org,String user)throws SQLException{
  Connection c=owner();c.setAutoCommit(false);exec(c,"SET LOCAL ROLE keptai_runtime");
  try(PreparedStatement p=c.prepareStatement("SELECT set_config('app.organizacion_id',?,true),set_config('app.usuario_id',?,true)")){p.setString(1,org);p.setString(2,user);p.execute();}
  return c;
 }

 @Test void saldosYCobrosCuadranConElRoadmap()throws Exception{try(Connection c=owner()){
  assertThat(scalar(c,"SELECT saldo FROM v_saldo_obligacion WHERE obligacion_id='b0000000-0000-4000-8000-000000000001'")).isEqualTo("0.00");
  assertThat(scalar(c,"SELECT saldo FROM v_saldo_obligacion WHERE obligacion_id='b0000000-0000-4000-8000-000000000002'")).isEqualTo("400.00");
  assertThat(scalar(c,"SELECT sum(cobrado)||'|'||sum(saldo) FROM v_saldo_obligacion WHERE organizacion_id='"+A+"'")).isEqualTo("400.00|400.00");
  assertThat(scalar(c,"SELECT saldo_vencido FROM v_cliente_mora WHERE organizacion_id='"+A+"'")).isEqualTo("400.00");
 }}
 @Test void duplicadoNoAplicaNiReduceSaldo()throws Exception{try(Connection c=owner()){
  assertThat(scalar(c,"SELECT fase||'|'||estado_conciliacion||'|'||duplicado_de_pago_id FROM pago WHERE id='c0000000-0000-4000-8000-000000000003'"))
   .isEqualTo("RECIBIDO|DUPLICADO|c0000000-0000-4000-8000-000000000002");
  assertThat(scalar(c,"SELECT count(*) FROM aplicacion_pago WHERE pago_id='c0000000-0000-4000-8000-000000000003'")).isEqualTo("0");
 }}
 @Test void margenPorPedidoYConjuntoVistoPorGerencia()throws Exception{try(Connection c=runtime(A,GERENTE)){
  assertThat(scalar(c,"SELECT margen_venta_real FROM v_margen_orden WHERE ref='P-001'")).isEqualTo("-40.00");
  assertThat(scalar(c,"SELECT margen_venta_real FROM v_margen_orden WHERE ref='P-002'")).isEqualTo("150.00");
  assertThat(scalar(c,"SELECT sum(margen_venta_real) FROM v_margen_orden")).isEqualTo("110.00");
 }}
 @Test void aislamientoYAlcanceDelTaller()throws Exception{
  try(Connection c=runtime(A,GERENTE)){
   assertThat(scalar(c,"SELECT count(*) FROM cliente")).isEqualTo("2");
   assertThat(scalar(c,"SELECT count(*) FROM orden WHERE organizacion_id='"+B+"'")).isEqualTo("0");
  }
  try(Connection c=runtime(A,JEFE)){
   // Taller ve solo ordenes liberadas o posteriores (V7): P-001 CERRADA y P-002 DESPACHADA, nunca la orden de B.
   assertThat(scalar(c,"SELECT string_agg(ref,',' ORDER BY ref) FROM orden")).isEqualTo("P-001,P-002");
   assertThat(scalar(c,"SELECT count(*) FROM pago")).isEqualTo("0");
  }
 }
 @Test void reinicioRestauraLaSemillaYConservaOtrasOrganizaciones()throws Exception{
  String otra="10000000-0000-4000-8000-0000000000ff";
  try(Connection c=owner()){
   exec(c,"INSERT INTO organizacion(id,nombre) VALUES ('"+otra+"','Organizacion real ajena')");
   exec(c,"UPDATE egreso_caja SET monto=999 WHERE id='1b000000-0000-4000-8000-000000000001'");
   exec(c,"INSERT INTO marca(organizacion_id,nombre) VALUES ('"+A+"','Marca ajena a la semilla')");
  }
  cargar();
  try(Connection c=owner()){
   assertThat(scalar(c,"SELECT monto FROM egreso_caja WHERE id='1b000000-0000-4000-8000-000000000001'")).isEqualTo("250.00");
   assertThat(scalar(c,"SELECT count(*) FROM marca WHERE organizacion_id='"+A+"'")).isEqualTo("2");
   assertThat(scalar(c,"SELECT count(*) FROM organizacion WHERE id='"+otra+"'")).isEqualTo("1");
   exec(c,"DELETE FROM organizacion WHERE id='"+otra+"'");
  }
 }
 @Test void guardasImpidenEjecucionAccidental()throws Exception{
  try(Connection c=owner()){
   assertThatThrownBy(()->exec(c,semilla)).hasMessageContaining("Semilla bloqueada");
  }
  try(Connection c=owner()){
   exec(c,"UPDATE organizacion SET nombre='Empresa real' WHERE id='"+B+"'");
   exec(c,"SET keptai.permitir_semilla='demo'");
   assertThatThrownBy(()->exec(c,semilla)).hasMessageContaining("no DEMO");
   exec(c,"ROLLBACK");
   exec(c,"UPDATE organizacion SET nombre='DEMO Organizacion de aislamiento' WHERE id='"+B+"'");
  }
 }
}
