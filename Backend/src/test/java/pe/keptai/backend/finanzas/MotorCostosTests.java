package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosCostos.*;
import static org.assertj.core.api.Assertions.*;

// Registro de costeo sobre V1-V9 + semilla con login runtime real: reparto exacto en centavos, cargo interno y cierre.
class MotorCostosTests {
 static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:17-alpine");
 static final UUID A=u("10000000-0000-4000-8000-000000000001");
 static final UUID VENDEDOR=u("70000000-0000-4000-8000-000000000001"), ADMIN=u("70000000-0000-4000-8000-000000000002"),
  GERENTE=u("70000000-0000-4000-8000-000000000003"), JEFE=u("70000000-0000-4000-8000-000000000004");
 static final UUID CLIENTE_UNO=u("11111111-1111-4111-8111-111111111111");
 static final UUID TALLER_INTERNO=u("13000000-0000-4000-8000-000000000001"), TALLER_TERCERO=u("13000000-0000-4000-8000-000000000002");
 static final ContextoFinanciero TALLER=ContextoFinanciero.usuario(A,JEFE), COBRANZA=ContextoFinanciero.usuario(A,ADMIN);
 static String semilla;
 static MotorCostos motor;
 UUID orden;
 List<UUID> items;

 static UUID u(String s){return UUID.fromString(s);}
 static BigDecimal s(String v){return new BigDecimal(v);}

 @BeforeAll static void setup() throws Exception {
  PG.start();
  Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").load().migrate();
  semilla=Files.readString(Path.of("../BD/semilla/semilla_demo.sql"));
  try(Connection c=owner()){exec(c,"CREATE ROLE costos_app LOGIN PASSWORD 'costos' NOSUPERUSER NOBYPASSRLS IN ROLE keptai_runtime");}
  DriverManagerDataSource ds=new DriverManagerDataSource(PG.getJdbcUrl(),"costos_app","costos");
  motor=new MotorCostos(new JdbcTemplate(ds),new DataSourceTransactionManager(ds));
 }
 @AfterAll static void stop(){PG.stop();}

 // Orden propia liberada con tres items (1 x 10, 1 x 20, 1 x 30) para el taller.
 @BeforeEach void preparar()throws SQLException{
  orden=UUID.randomUUID();
  try(Connection c=owner()){
   exec(c,"SET keptai.permitir_semilla='demo'");exec(c,semilla);
   exec(c,"INSERT INTO orden(id,organizacion_id,ref,cliente_id,vendedor_id,estado,condicion_pago,plazo_dias,total,tipo_produccion) VALUES ('"+orden+"','"+A+"','P-030','"+CLIENTE_UNO+"','"+VENDEDOR+"','PENDIENTE_APROBACION','CREDITO',30,60,'INTERNA')");
   exec(c,"INSERT INTO aprobacion_credito(organizacion_id,orden_id,aprobado_por,decision,plazo_dias,decidido_en) VALUES ('"+A+"','"+orden+"','"+VENDEDOR+"','APROBADO',30,now())");
   exec(c,"UPDATE orden SET estado='LIBERADA' WHERE id='"+orden+"'");
   for(String precio:new String[]{"10","20","30"})exec(c,"INSERT INTO orden_item(organizacion_id,orden_id,descripcion,cantidad,precio_unit) VALUES ('"+A+"','"+orden+"','Item demo',1,"+precio+")");
  }
  items=lista("SELECT id FROM orden_item WHERE orden_id='"+orden+"' ORDER BY id");
 }

 static Connection owner() throws SQLException{Connection c=DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());exec(c,"SET search_path=keptai");return c;}
 static void exec(Connection c,String sql)throws SQLException{try(Statement st=c.createStatement()){st.execute(sql);}}
 static void exec(String sql)throws SQLException{try(Connection c=owner()){exec(c,sql);}}
 static String scalar(String sql)throws SQLException{try(Connection c=owner();Statement st=c.createStatement();ResultSet rs=st.executeQuery(sql)){rs.next();return rs.getString(1);}}
 static List<UUID> lista(String sql)throws SQLException{
  try(Connection c=owner();Statement st=c.createStatement();ResultSet rs=st.executeQuery(sql)){java.util.ArrayList<UUID> r=new java.util.ArrayList<>();while(rs.next())r.add(rs.getObject(1,UUID.class));return r;}
 }
 static void rechaza(Codigo codigo,org.assertj.core.api.ThrowableAssert.ThrowingCallable accion){
  assertThatThrownBy(accion).isInstanceOf(MotorFinancieroException.class).extracting(e->((MotorFinancieroException)e).codigo()).isEqualTo(codigo);
 }
 static String montos(Reparto r){
  return r.asignaciones().stream().sorted(Comparator.comparing(Asignacion::ordenItemId)).map(a->a.monto().toPlainString()).reduce((x,y)->x+","+y).orElse("");
 }

 @Test void repartoExactoEnCentavosPorUnidadesYPorValor()throws Exception{
  Costo costo=motor.registrarCosto(TALLER,orden,null,"MATERIA_PRIMA",s("100"),"REAL","Factura de tela (demo)");
  assertThat(costo.moneda()).isEqualTo("PEN");
  Reparto unidades=motor.repartirCostos(TALLER,orden,"UNIDADES");
  // 100 / 3: el centavo sobrante va al primer item por desempate deterministico.
  assertThat(montos(unidades)).isEqualTo("33.34,33.33,33.33");
  Reparto valor=motor.repartirCostos(COBRANZA,orden,"VALOR_VENTA");
  // 10/60, 20/60, 30/60 de 100: 16.666 -> 16.67 por mayor residuo (en orden de precio del item).
  List<UUID> porPrecio=lista("SELECT id FROM orden_item WHERE orden_id='"+orden+"' ORDER BY precio_unit");
  assertThat(porPrecio.stream().map(id->valor.asignaciones().stream().filter(a->a.ordenItemId().equals(id)).findFirst().orElseThrow().monto().toPlainString()).toList())
   .containsExactly("16.67","33.33","50.00");
  assertThat(scalar("SELECT sum(monto) FROM asignacion_costo_item WHERE costo_id='"+costo.costoId()+"'")).isEqualTo("100.00");
  assertThat(scalar("SELECT count(*) FROM asignacion_costo_item WHERE costo_id='"+costo.costoId()+"'")).isEqualTo("3");
  assertThat(scalar("SELECT DISTINCT registrado_por FROM asignacion_costo_item WHERE costo_id='"+costo.costoId()+"'")).isEqualTo(ADMIN.toString());
 }

 @Test void asignacionManualNoSuperaElCosto()throws Exception{
  Costo costo=motor.registrarCosto(COBRANZA,orden,null,"CIF",s("100.00"),"REAL","Prorrateo de luz (demo)");
  motor.asignarCosto(TALLER,costo.costoId(),items.get(0),s("60"),"Jefe de taller");
  assertThatThrownBy(()->motor.asignarCosto(TALLER,costo.costoId(),items.get(1),s("50"),"Jefe de taller"))
   .isInstanceOf(MotorFinancieroException.class).hasMessageContaining("supera el costo");
  motor.asignarCosto(TALLER,costo.costoId(),items.get(0),s("40"),"Correccion");
  motor.asignarCosto(TALLER,costo.costoId(),items.get(1),s("50"),"Jefe de taller");
  assertThat(scalar("SELECT sum(monto) FROM asignacion_costo_item WHERE costo_id='"+costo.costoId()+"'")).isEqualTo("90.00");
  UUID itemAjeno=u("15000000-0000-4000-8000-000000000002");
  assertThatThrownBy(()->motor.asignarCosto(TALLER,costo.costoId(),itemAjeno,s("1"),"x")).hasMessageContaining("misma orden");
 }

 @Test void cargoInternoUnoActivoPorTallerYCorreccionPorAnulacion()throws Exception{
  Transferencia t=motor.registrarTransferencia(COBRANZA,orden,TALLER_INTERNO,s("90"),"Tarifa interna por prenda (demo)","Gerencia");
  rechaza(Codigo.INVALID_STATE,()->motor.registrarTransferencia(COBRANZA,orden,TALLER_INTERNO,s("95"),"Otra","Gerencia"));
  assertThatThrownBy(()->motor.registrarTransferencia(COBRANZA,orden,TALLER_TERCERO,s("10"),"x","y")).hasMessageContaining("taller interno");
  Transferencia anulada=motor.anularTransferencia(COBRANZA,t.transferenciaId(),"Tarifa corregida (demo)");
  assertThat(anulada.anulada()).isTrue();
  rechaza(Codigo.INVALID_STATE,()->motor.anularTransferencia(COBRANZA,t.transferenciaId(),"otra vez"));
  rechaza(Codigo.NOT_FOUND,()->motor.anularTransferencia(COBRANZA,UUID.randomUUID(),"x"));
  motor.registrarTransferencia(COBRANZA,orden,TALLER_INTERNO,s("95"),"Tarifa corregida (demo)","Gerencia");
  assertThat(scalar("SELECT count(*)||'|'||count(*) FILTER (WHERE anulada_en IS NULL) FROM transferencia_interna WHERE orden_id='"+orden+"'")).isEqualTo("2|1");
  assertThat(scalar("SELECT count(*) FROM evento_auditoria WHERE entidad='transferencia_interna' AND usuario_id='"+ADMIN+"'")).isEqualTo("3");
 }

 @Test void cierreExplicitoConAvisosYReaperturaAnteCambios()throws Exception{
  rechaza(Codigo.INVALID_STATE,()->motor.cerrarCosteo(COBRANZA,orden,"REAL"));
  motor.registrarCosto(TALLER,orden,null,"MATERIA_PRIMA",s("100"),"REAL","Factura de tela (demo)");
  CierreCosteo sinReparto=motor.cerrarCosteo(COBRANZA,orden,"REAL");
  assertThat(sinReparto.costoTotal()).isEqualByComparingTo("100");
  assertThat(sinReparto.componentesFaltantes()).containsExactly("MANO_OBRA","CIF");
  assertThat(sinReparto.asignacionCompleta()).isFalse();
  assertThat(scalar("SELECT costos_reales_completos FROM orden WHERE id='"+orden+"'")).isEqualTo("t");
  motor.repartirCostos(TALLER,orden,"UNIDADES");
  assertThat(scalar("SELECT costos_reales_completos FROM orden WHERE id='"+orden+"'")).as("repartir reabre el cierre").isEqualTo("f");
  assertThat(motor.cerrarCosteo(COBRANZA,orden,"REAL").asignacionCompleta()).isTrue();
  motor.registrarCosto(TALLER,orden,null,"MANO_OBRA",s("40"),"REAL","Planilla (demo)");
  assertThat(scalar("SELECT costos_reales_completos FROM orden WHERE id='"+orden+"'")).as("un costo nuevo reabre el cierre").isEqualTo("f");
  rechaza(Codigo.INVALID_STATE,()->motor.cerrarCosteo(COBRANZA,orden,"TEORICO"));
  assertThat(scalar("SELECT count(*) FROM evento_auditoria WHERE operacion='COSTEO_CERRADO' AND usuario_id='"+ADMIN+"'")).isEqualTo("2");
 }

 @Test void rolesValidacionesYAlcance()throws Exception{
  ContextoFinanciero ventas=ContextoFinanciero.usuario(A,VENDEDOR), gerencia=ContextoFinanciero.usuario(A,GERENTE);
  rechaza(Codigo.FORBIDDEN,()->motor.registrarCosto(ventas,orden,null,"CIF",s("1"),"REAL","x"));
  rechaza(Codigo.FORBIDDEN,()->motor.registrarTransferencia(TALLER,orden,TALLER_INTERNO,s("1"),"x","y"));
  rechaza(Codigo.FORBIDDEN,()->motor.cerrarCosteo(TALLER,orden,"REAL"));
  rechaza(Codigo.FORBIDDEN,()->motor.repartirCostos(gerencia,orden,"UNIDADES"));
  rechaza(Codigo.VALIDATION_ERROR,()->motor.registrarCosto(TALLER,orden,null,"OTRO",s("1"),"REAL","x"));
  rechaza(Codigo.VALIDATION_ERROR,()->motor.registrarCosto(TALLER,orden,null,"CIF",s("0.001"),"REAL","x"));
  rechaza(Codigo.VALIDATION_ERROR,()->motor.repartirCostos(TALLER,orden,"PESO"));
  UUID pendiente=UUID.randomUUID();
  exec("INSERT INTO orden(id,organizacion_id,ref,cliente_id,estado,condicion_pago,total) VALUES ('"+pendiente+"','"+A+"','P-031','"+CLIENTE_UNO+"','PENDIENTE_APROBACION','CONTADO',10)");
  rechaza(Codigo.NOT_FOUND,()->motor.registrarCosto(TALLER,pendiente,null,"CIF",s("1"),"REAL","x"));
 }
}
