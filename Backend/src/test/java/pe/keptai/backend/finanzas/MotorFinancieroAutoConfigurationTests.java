package pe.keptai.backend.finanzas;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import static org.assertj.core.api.Assertions.assertThat;

/** El motor existe solo con base (local/prod); dev/test sin DataSource siguen arrancando. */
class MotorFinancieroAutoConfigurationTests {
	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withConfiguration(AutoConfigurations.of(MotorFinancieroAutoConfiguration.class));

	@Test
	void conJdbcYTransaccionesRegistraElMotor() {
		DataSource ds = new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:1/no-se-conecta");
		runner.withBean(JdbcTemplate.class, () -> new JdbcTemplate(ds))
				.withBean(PlatformTransactionManager.class, () -> new DataSourceTransactionManager(ds))
				.run(ctx -> assertThat(ctx).hasSingleBean(MotorPagos.class));
	}

	@Test
	void sinBaseNoRegistraNadaNiFalla() {
		runner.run(ctx -> assertThat(ctx).hasNotFailed().doesNotHaveBean(MotorPagos.class));
	}
}
