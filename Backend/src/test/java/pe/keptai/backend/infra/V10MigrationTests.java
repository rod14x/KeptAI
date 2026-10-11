package pe.keptai.backend.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** V10 sobre una base ya poblada: conserva los datos, no resucita nota_cliente y aborta (sin corregir en silencio) ante órdenes incoherentes. */
class V10MigrationTests {

	private static Flyway flyway(PostgreSQLContainer pg, String target) {
		return Flyway.configure().dataSource(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword()).schemas("keptai").defaultSchema("keptai")
			.locations("filesystem:../BD/migrations").target(target).load();
	}

	private static void sql(Connection c, String sql) throws Exception {
		try (Statement s = c.createStatement()) {
			s.execute(sql);
		}
	}

	private static String one(Connection c, String sql) throws Exception {
		try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
			r.next();
			return r.getString(1);
		}
	}

	private static final String ORG = "10000000-0000-4000-8000-000000000001";

	private static final String CLI = "30000000-0000-4000-8000-000000000001";

	private static final String CLI2 = "30000000-0000-4000-8000-000000000002";

	private static final String CANAL = "40000000-0000-4000-8000-000000000001";

	@Test
	void migratesAPopulatedV9DatabaseKeepsItsDataAndAbortsOnIncoherentOrders() throws Exception {
		try (PostgreSQLContainer pg = new PostgreSQLContainer("postgres:17-alpine")) {
			pg.start();
			try (Connection c = DriverManager.getConnection(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword())) {
				sql(c, "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role");
				flyway(pg, "9").migrate();
				sql(c, "SET search_path=keptai,pg_catalog");
				assertThat(one(c, "SELECT to_regclass('keptai.contacto') IS NULL")).isEqualTo("t"); // V6 la retiró
				sql(c, "INSERT INTO organizacion(id,nombre) VALUES ('" + ORG + "','Demo')");
				sql(c, "INSERT INTO cliente(id,organizacion_id,razon_social,tipo) VALUES ('" + CLI + "','" + ORG + "','Uno','EMPRESA'),('" + CLI2 + "','" + ORG + "','Dos','EMPRESA')");
				sql(c, "INSERT INTO canal_whatsapp(id,organizacion_id,instancia,chat_jid,cliente_id) VALUES ('" + CANAL + "','" + ORG + "','isabel','51900000001@s.whatsapp.net','" + CLI + "')");
				sql(c, "INSERT INTO orden(organizacion_id,ref,cliente_id,canal_id,condicion_pago,total) VALUES ('" + ORG + "','ORD-1','" + CLI + "','" + CANAL + "','CONTADO',10)");
				sql(c, "INSERT INTO pago(organizacion_id,cliente_id,monto,fecha_pago,medio) VALUES ('" + ORG + "','" + CLI + "',5,current_date,'OTRO')");
				// Una orden incoherente (cliente distinto del de su canal) bloquea V10 y nada cambia.
				sql(c, "ALTER TABLE orden DISABLE TRIGGER USER");
				sql(c, "INSERT INTO orden(organizacion_id,ref,cliente_id,canal_id,condicion_pago,total) VALUES ('" + ORG + "','ORD-2','" + CLI2 + "','" + CANAL + "','CONTADO',10)");
				sql(c, "ALTER TABLE orden ENABLE TRIGGER USER");
				assertThatThrownBy(() -> flyway(pg, "10").migrate()).hasStackTraceContaining("V10 bloqueada");
				assertThat(one(c, "SELECT to_regclass('keptai.contacto') IS NULL")).isEqualTo("t");
				sql(c, "DELETE FROM orden WHERE ref = 'ORD-2'");
				flyway(pg, "10").migrate();
				assertThat(one(c, "SELECT count(*) FROM orden")).isEqualTo("1");
				assertThat(one(c, "SELECT count(*) FROM pago WHERE canal_id IS NULL AND orden_contexto_id IS NULL")).isEqualTo("1");
				assertThat(one(c, "SELECT to_regclass('keptai.nota_cliente') IS NULL")).isEqualTo("t");
				assertThat(one(c, "SELECT count(*) FROM keptai.flyway_schema_history WHERE success AND version = '10'")).isEqualTo("1");
				assertThat(one(c, "SELECT count(*) FROM pg_tables WHERE schemaname='keptai' AND tablename<>'flyway_schema_history' AND NOT rowsecurity")).isEqualTo("0");
				// Sin acceso de la Data API y sin DELETE para runtime.
				assertThat(one(c, "SELECT has_table_privilege('anon','keptai.contacto','SELECT') OR has_table_privilege('authenticated','keptai.contacto','SELECT') OR has_table_privilege('service_role','keptai.contacto','SELECT')")).isEqualTo("f");
				assertThat(one(c, "SELECT has_table_privilege('keptai_runtime','keptai.contacto','DELETE')")).isEqualTo("f");
			}
		}
	}

}
