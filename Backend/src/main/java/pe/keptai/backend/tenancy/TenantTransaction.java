package pe.keptai.backend.tenancy;

import java.util.function.Supplier;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Única frontera para operaciones de negocio con datos del tenant (MIG-03-C). Usa el
 * {@link PlatformTransactionManager} de la aplicación (JpaTransactionManager con JPA, DataSourceTransactionManager
 * sin él; ambos exponen la misma conexión a JdbcTemplate/DataSourceUtils) con propagación REQUIRED: si ya hay una
 * transacción se une a ella; si no, abre una. Fija el contexto como primera acción y solo después ejecuta el trabajo.
 *
 * <p>Uso previsto en servicios futuros: {@code tenant.execute(() -> repo.consulta(...))}; los repositorios llaman a
 * {@link TenantContext#requireApplied()}. No usar conexiones del pool ni REQUIRES_NEW para consultas de negocio.
 */
@Component
public class TenantTransaction {

	private final ObjectProvider<PlatformTransactionManager> transactionManager;

	private final TenantContext context;

	public TenantTransaction(ObjectProvider<PlatformTransactionManager> transactionManager, TenantContext context) {
		this.transactionManager = transactionManager;
		this.context = context;
	}

	public <T> T execute(Supplier<T> work) {
		return run(work, false);
	}

	public <T> T executeReadOnly(Supplier<T> work) {
		return run(work, true);
	}

	private <T> T run(Supplier<T> work, boolean readOnly) {
		PlatformTransactionManager tm = transactionManager.getIfAvailable();
		if (tm == null) {
			throw new TenantContextException("Sin gestor de transacciones: base de datos no configurada");
		}
		TransactionTemplate template = new TransactionTemplate(tm);
		template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
		template.setReadOnly(readOnly);
		return template.execute(status -> {
			context.apply();
			return work.get();
		});
	}

}
