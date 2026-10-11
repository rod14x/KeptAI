package pe.keptai.backend.finanzas;

import java.sql.SQLException;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.MDC;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.web.RequestIdFilter;
import pe.keptai.backend.tenancy.TenantContext;
import pe.keptai.backend.tenancy.TenantIdentity;
import pe.keptai.backend.tenancy.TenantContextException;

abstract class TransaccionFinanciera {

	protected final JdbcTemplate jdbc;
	private final TransactionTemplate tx;

	protected TransaccionFinanciera(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		this.jdbc = jdbc;
		this.tx = new TransactionTemplate(transactionManager);
	}

	protected <T> T enTransaccion(ContextoFinanciero ctx, Set<String> roles, Supplier<T> trabajo) {
		try {
			return tx.execute(estado -> {
				TenantContext.applyIdentity(
						new TenantIdentity(ctx.organizacionId(), ctx.usuarioId(), ctx.servicioId()), jdbc.getDataSource());
				String actor = jdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class);
				if (actor == null) {
					throw new MotorFinancieroException(Codigo.FORBIDDEN,
							"Sin usuario o servicio activo en la organizacion");
				}
				if (!roles.contains(actor)) {
					throw new MotorFinancieroException(Codigo.FORBIDDEN, "El rol " + actor + " no puede ejecutar esta operacion");
				}
				return trabajo.get();
			});
		} catch (TenantContextException e) {
			throw new MotorFinancieroException(Codigo.FORBIDDEN, "Contexto transaccional incompatible", e);
		} catch (MotorFinancieroException e) {
			throw e;
		} catch (DataAccessException e) {
			throw traducir(e);
		}
	}

	protected void auditar(ContextoFinanciero ctx, String operacion, String entidad, UUID entidadId, String cambiosSql,
			Object... parametros) {
		Object[] args = new Object[5 + parametros.length];
		args[0] = ctx.usuarioId();
		args[1] = operacion;
		args[2] = entidad;
		args[3] = entidadId;
		System.arraycopy(parametros, 0, args, 4, parametros.length);
		args[args.length - 1] = MDC.get(RequestIdFilter.MDC_KEY);
		jdbc.update("INSERT INTO keptai.evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id) "
				+ "VALUES (keptai.app_organizacion_actual(), ?::uuid, "
				+ "CASE keptai_private.actor_actual() WHEN 'INGESTA' THEN 'N8N' WHEN 'SCHEDULER' THEN 'SCHEDULER' ELSE 'USUARIO' END, "
				+ "?, ?, ?, " + cambiosSql + ", ?)", args);
	}

	static RuntimeException traducir(DataAccessException e) {
		Throwable t = e;
		while (t != null && !(t instanceof SQLException)) {
			t = t.getCause();
		}
		if (t == null || ((SQLException) t).getSQLState() == null) {
			return e;
		}
		String detalle = t.getMessage() == null ? "" : t.getMessage();
		return switch (((SQLException) t).getSQLState()) {
			case "42501" -> new MotorFinancieroException(Codigo.FORBIDDEN, "Operacion no autorizada por la base", e);
			case "23514" -> detalle.contains("Sobreaplicacion")
					? new MotorFinancieroException(Codigo.INSUFFICIENT_BALANCE, "Sobreaplicacion rechazada por la base", e)
					: new MotorFinancieroException(Codigo.INVALID_STATE, primeraLinea(detalle), e);
			case "23505" -> new MotorFinancieroException(Codigo.INVALID_STATE, "El registro ya existe", e);
			case "23503" -> new MotorFinancieroException(Codigo.NOT_FOUND, "Referencia inexistente en la organizacion", e);
			case "40P01", "40001", "55P03" ->
					new MotorFinancieroException(Codigo.CONCURRENCY_CONFLICT, "Conflicto de concurrencia; reintentar", e);
			default -> e;
		};
	}

	private static String primeraLinea(String mensaje) {
		String linea = mensaje.lines().findFirst().orElse(mensaje);
		return linea.startsWith("ERROR: ") ? linea.substring(7) : linea;
	}
}
