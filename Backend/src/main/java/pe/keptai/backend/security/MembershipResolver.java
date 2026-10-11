package pe.keptai.backend.security;

import java.util.List;
import java.util.UUID;

/** Resuelve membresías activas de un {@code sub} ya validado. Nunca recibe organización ni rol del cliente. */
public interface MembershipResolver {

	/** Membresías activas de ese sub, en orden estable. Lista vacía = sin acceso. */
	List<Membership> resolve(UUID authUserId);

}
