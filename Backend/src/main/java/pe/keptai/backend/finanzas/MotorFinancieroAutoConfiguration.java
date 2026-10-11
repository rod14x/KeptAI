package pe.keptai.backend.finanzas;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Registra el motor solo cuando hay base: los perfiles dev/test excluyen el DataSource y deben seguir arrancando.
 * Autoconfiguracion (no @Service) para que @ConditionalOnBean se evalue despues de JDBC/JPA.
 */
@AutoConfiguration(afterName = {
		"org.springframework.boot.jdbc.autoconfigure.JdbcTemplateAutoConfiguration",
		"org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration",
		"org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration" })
public class MotorFinancieroAutoConfiguration {

	@Bean
	@ConditionalOnMissingBean
	@ConditionalOnBean({ JdbcTemplate.class, PlatformTransactionManager.class })
	MotorPagos motorPagos(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		return new MotorPagos(jdbc, transactionManager);
	}

	@Bean
	@ConditionalOnMissingBean
	@ConditionalOnBean({ JdbcTemplate.class, PlatformTransactionManager.class })
	MotorCobranza motorCobranza(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		return new MotorCobranza(jdbc, transactionManager);
	}

	@Bean
	@ConditionalOnMissingBean
	@ConditionalOnBean({ JdbcTemplate.class, PlatformTransactionManager.class })
	MotorResultados motorResultados(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		return new MotorResultados(jdbc, transactionManager);
	}

	@Bean
	@ConditionalOnMissingBean
	@ConditionalOnBean({ JdbcTemplate.class, PlatformTransactionManager.class })
	MotorCaja motorCaja(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		return new MotorCaja(jdbc, transactionManager);
	}

	@Bean
	@ConditionalOnMissingBean
	@ConditionalOnBean({ JdbcTemplate.class, PlatformTransactionManager.class })
	MotorCostos motorCostos(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		return new MotorCostos(jdbc, transactionManager);
	}
}
