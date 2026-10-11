package pe.keptai.backend.infra;

import java.sql.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

/** V6 preserva datos opcionales y solo retira tablas vacias, en transaccion. */
class Mvp25MigrationTests {
  @Test void migrationStopsForExistingContactsOrNotesAndKeepsHistory() throws Exception {
    try (var pg = new PostgreSQLContainer("postgres:17-alpine")) {
      pg.start();
      var config = Flyway.configure().dataSource(pg.getJdbcUrl(),pg.getUsername(),pg.getPassword())
          .schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations");
      config.target("5").load().migrate();
      var latest = Flyway.configure().dataSource(pg.getJdbcUrl(),pg.getUsername(),pg.getPassword())
          .schemas("keptai").defaultSchema("keptai").locations("filesystem:../BD/migrations").target("6").load(); // V7+ agregan tablas (V9)
      try (var c = DriverManager.getConnection(pg.getJdbcUrl(),pg.getUsername(),pg.getPassword())) {
        sql(c,"SET search_path=keptai,pg_catalog");
        sql(c,"INSERT INTO organizacion(id,nombre) VALUES ('10000000-0000-4000-8000-000000000001','Demo')");
        sql(c,"INSERT INTO cliente(id,organizacion_id,razon_social,tipo) VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Demo','EMPRESA')");
        sql(c,"INSERT INTO usuario(id,organizacion_id,auth_user_id,nombre,rol) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Demo','ADMIN')");
        sql(c,"INSERT INTO contacto(organizacion_id,cliente_id,nombre) VALUES ('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Demo')");
        assertThatThrownBy(latest::migrate).hasStackTraceContaining("V6 bloqueada");
        assertThat(count(c,"contacto")).isEqualTo(1);
        assertThat(count(c,"flyway_schema_history")).isEqualTo(6); // schema marker + V1-V5.
        sql(c,"DELETE FROM contacto"); // solo fixture de este contenedor efimero.
        sql(c,"INSERT INTO nota_cliente(organizacion_id,cliente_id,autor_id,contenido) VALUES ('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Nota demo')");
        assertThatThrownBy(latest::migrate).hasStackTraceContaining("V6 bloqueada");
        assertThat(count(c,"nota_cliente")).isEqualTo(1);
        sql(c,"DELETE FROM nota_cliente");
        latest.migrate();
        try(var st=c.createStatement();var rs=st.executeQuery("SELECT count(*) FROM pg_tables WHERE schemaname='keptai' AND tablename<>'flyway_schema_history'")) {
          rs.next(); assertThat(rs.getInt(1)).isEqualTo(25);
        }
        assertThat(count(c,"cliente")).isEqualTo(1);
      }
    }
  }
  private static void sql(Connection c,String sql)throws SQLException {try(var st=c.createStatement()){st.execute(sql);}}
  private static int count(Connection c,String table)throws SQLException {try(var st=c.createStatement();var rs=st.executeQuery("SELECT count(*) FROM "+table)){rs.next();return rs.getInt(1);}}
}
