package pe.keptai.backend.infra;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Comprueba el cableado Spring (DataSource, JdbcTemplate, JPA/Hibernate con ddl-auto validate) contra
 * PostgreSQL real. Levanta las autoconfiguraciones que dev/test excluyen. Sin entidades ni tablas de negocio.
 */
@SpringBootTest(properties = "spring.autoconfigure.exclude=")
@ActiveProfiles("test")
@Testcontainers
class SpringDataSourceInfraTests {

	@Container
	@ServiceConnection
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

	@Autowired
	DataSource dataSource;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	EntityManager em;

	@Test
	void dataSourceAndJdbcTemplateTalkToPostgres() {
		assertThat(dataSource).isNotNull();
		assertThat(jdbc.queryForObject("SELECT 1", Integer.class)).isEqualTo(1);
	}

	@Test
	void hibernateEntityManagerRunsNativeSelect() {
		assertThat(((Number) em.createNativeQuery("SELECT 1").getSingleResult()).intValue()).isEqualTo(1);
	}

}
