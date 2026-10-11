package pe.keptai.backend.tenancy;

import java.util.UUID;

import pe.keptai.backend.security.Membership;
import pe.keptai.backend.security.ServiceIdentity;

/**
 * Identidad que se fija en PostgreSQL: organización más exactamente un actor, usuario del panel
 * ({@code usuarioId} = fila de {@code keptai.usuario}, no el {@code sub} de Auth) o servicio técnico
 * ({@code servicioId} = fila de {@code integracion_servicio}). Sale de una {@link Membership} o de una
 * {@link ServiceIdentity} resueltas en la base.
 */
public record TenantIdentity(UUID organizacionId, UUID usuarioId, UUID servicioId) {

	public TenantIdentity {
		if ((usuarioId == null) == (servicioId == null)) {
			throw new IllegalArgumentException("Exactamente un actor: usuario o servicio");
		}
	}

	static TenantIdentity of(Membership m) {
		return new TenantIdentity(m.organizacionId(), m.usuarioId(), null);
	}

	static TenantIdentity of(ServiceIdentity s) {
		return new TenantIdentity(s.organizacionId(), null, s.servicioId());
	}

	public boolean isService() {
		return servicioId != null;
	}

}
