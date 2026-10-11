package pe.keptai.backend.tenancy;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pe.keptai.backend.security.KeptaiAuthentication;
import pe.keptai.backend.security.Membership;

/**
 * Aplica el contexto V4 ({@code app.organizacion_id}, {@code app.usuario_id}, {@code app.servicio_id})
 * con {@code set_config(..., true)} (equivalente a SET LOCAL) sobre la conexión vinculada a la transacción
 * Spring en curso. No abre conexiones propias ni transacciones: se usa desde {@link TenantTransaction}.
 *
 * <p>La identidad procede solo de {@link KeptaiAuthentication} con acceso SINGLE; nunca del cliente. El rol no
 * se fija: PostgreSQL lo consulta en {@code keptai.usuario} (actor_actual). {@code app.servicio_id} se limpia
 * siempre para impedir un contexto mixto. El bootstrap {@code resolver_usuario(sub)} es anterior a este
 * contexto y no pasa por aquí.
 */
@Component
public class TenantContext {

	private static final Object APPLIED = new Object();

	private static final String SQL = "SELECT set_config('app.organizacion_id', ?, true), set_config('app.usuario_id', ?, true), set_config('app.servicio_id', '', true)";

	private final ObjectProvider<DataSource> dataSource;

	public TenantContext(ObjectProvider<DataSource> dataSource) {
		this.dataSource = dataSource;
	}

	/** Identidad de la petición actual; falla cerrado si no hay un usuario del panel con membresía única. */
	public TenantIdentity currentIdentity() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (!(auth instanceof KeptaiAuthentication k) || !k.isAuthenticated() || k.access() != KeptaiAuthentication.Access.SINGLE) {
			throw new TenantContextException("Sin usuario del panel con una única membresía");
		}
		Membership m = k.membership();
		if (m.usuarioId() == null || m.organizacionId() == null || m.rol() == null || m.rol().isService()) {
			throw new TenantContextException("Membresía no válida para un usuario del panel");
		}
		return TenantIdentity.of(m);
	}

	/**
	 * Fija el contexto en la transacción real en curso. Idempotente para la misma identidad; una identidad
	 * distinta en la misma transacción se rechaza. Sin transacción real falla: nunca fija contexto de sesión.
	 */
	public TenantIdentity apply() {
		if (!TransactionSynchronizationManager.isActualTransactionActive()) {
			throw new TenantContextException("El contexto exige una transacción real en curso");
		}
		TenantIdentity wanted = currentIdentity();
		Object bound = TransactionSynchronizationManager.getResource(APPLIED);
		if (bound != null) {
			if (!wanted.equals(bound)) {
				throw new TenantContextException("La transacción ya tiene otra identidad aplicada");
			}
			return wanted;
		}
		DataSource ds = dataSource.getIfAvailable();
		if (ds == null) {
			throw new TenantContextException("Sin base de datos configurada");
		}
		Connection c = DataSourceUtils.getConnection(ds);
		try {
			if (!DataSourceUtils.isConnectionTransactional(c, ds)) {
				throw new TenantContextException("La conexión no está vinculada a la transacción en curso");
			}
			try (PreparedStatement ps = c.prepareStatement(SQL)) {
				ps.setString(1, wanted.organizacionId().toString());
				ps.setString(2, wanted.usuarioId().toString());
				ps.execute();
			}
		}
		catch (SQLException e) {
			throw new TenantContextException("No se pudo fijar el contexto transaccional", e);
		}
		finally {
			DataSourceUtils.releaseConnection(c, ds);
		}
		TransactionSynchronizationManager.bindResource(APPLIED, wanted);
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCompletion(int status) {
				TransactionSynchronizationManager.unbindResourceIfPossible(APPLIED);
			}
		});
		return wanted;
	}

	/** Guardia para repositorios: la transacción actual debe tener el contexto aplicado por {@link #apply()}. */
	public TenantIdentity requireApplied() {
		Object bound = TransactionSynchronizationManager.isActualTransactionActive()
				? TransactionSynchronizationManager.getResource(APPLIED) : null;
		if (!(bound instanceof TenantIdentity id)) {
			throw new TenantContextException("Consulta de negocio sin contexto de organización aplicado");
		}
		return id;
	}

}
