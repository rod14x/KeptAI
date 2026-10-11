package pe.keptai.backend.panel;

import java.util.function.Supplier;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import pe.keptai.backend.finanzas.ContextoFinanciero;
import pe.keptai.backend.tenancy.TenantContext;
import pe.keptai.backend.tenancy.TenantContextException;
import pe.keptai.backend.tenancy.TenantIdentity;
import pe.keptai.backend.tenancy.TenantTransaction;

/**
 * Frontera de datos de los controladores del panel: cada lectura o escritura corre en {@link TenantTransaction}
 * (contexto org + usuario aplicado antes del trabajo, RLS del rol runtime) y la identidad del motor sale del principal
 * autenticado, nunca del cuerpo. Sin base configurada (perfil dev) responde 503 en lugar de impedir el arranque.
 */
@Component
public class PanelContext {

	private final ObjectProvider<JdbcTemplate> jdbc;

	private final TenantTransaction tenant;

	private final TenantContext context;

	public PanelContext(ObjectProvider<JdbcTemplate> jdbc, TenantTransaction tenant, TenantContext context) {
		this.jdbc = jdbc;
		this.tenant = tenant;
		this.context = context;
	}

	public JdbcTemplate jdbc() {
		JdbcTemplate j = jdbc.getIfAvailable();
		if (j == null) {
			throw PanelException.unavailable();
		}
		return j;
	}

	/** Identidad del motor financiero a partir del usuario autenticado del panel. */
	public ContextoFinanciero financiero() {
		TenantIdentity i = identity();
		return new ContextoFinanciero(i.organizacionId(), i.usuarioId(), i.servicioId());
	}

	public TenantIdentity identity() {
		try {
			return context.currentIdentity();
		}
		catch (TenantContextException e) {
			throw PanelException.forbidden("Acceso denegado");
		}
	}

	public <T> T read(Supplier<T> work) {
		return run(work, true);
	}

	public <T> T write(Supplier<T> work) {
		return run(work, false);
	}

	private <T> T run(Supplier<T> work, boolean readOnly) {
		jdbc();
		try {
			return readOnly ? tenant.executeReadOnly(work) : tenant.execute(work);
		}
		catch (TenantContextException e) {
			throw PanelException.unavailable();
		}
		catch (DataAccessException e) {
			throw PanelErrors.translate(e);
		}
	}

}
