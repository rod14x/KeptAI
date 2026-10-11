package pe.keptai.backend.tenancy;

import java.util.UUID;

import pe.keptai.backend.security.Membership;

/**
 * Identidad que se fija en PostgreSQL. {@code usuarioId} es la fila de {@code keptai.usuario}
 * (no el {@code sub} de Auth). Sale únicamente de una {@link Membership} resuelta en la base.
 */
public record TenantIdentity(UUID organizacionId, UUID usuarioId) {

	static TenantIdentity of(Membership m) {
		return new TenantIdentity(m.organizacionId(), m.usuarioId());
	}

}
