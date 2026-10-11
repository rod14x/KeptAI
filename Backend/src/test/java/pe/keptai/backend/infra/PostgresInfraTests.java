package pe.keptai.backend.infra;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Infraestructura únicamente: PostgreSQL real vía Docker, driver JDBC y módulo Flyway-PostgreSQL.
 * No usa tablas ni esquema de negocio y no prueba el motor financiero.
 */
@Testcontainers
class PostgresInfraTests {

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

	@Test
	void jdbcSelectAgainstRealPostgres() throws Exception {
		try (Connection c = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
				Statement st = c.createStatement();
				ResultSet rs = st.executeQuery("SELECT 1 AS one, version() AS v")) {
			assertThat(rs.next()).isTrue();
			assertThat(rs.getInt("one")).isEqualTo(1);
			assertThat(rs.getString("v")).startsWith("PostgreSQL 17");
		}
	}

	@Test
	void flywayPostgresModuleResolvesDatabaseWithoutMigrations() {
		Flyway flyway = Flyway.configure()
			.dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
			.locations("classpath:db/no-existe-infra")
			.failOnMissingLocations(false)
			.load();
		// info() lee el estado sin crear la tabla de historial ni aplicar nada.
		assertThat(flyway.info().all()).isEmpty();
	}

}
