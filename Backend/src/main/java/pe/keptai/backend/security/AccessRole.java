package pe.keptai.backend.security;

import java.util.EnumSet;
import java.util.Set;

/**
 * Actores de la base (V4/V7): cuatro roles de usuario y dos servicios. Los servicios no son
 * roles de usuario: se autentican con credencial técnica y nunca firman como personas.
 */
public enum AccessRole {

	VENDEDOR(false),
	ADMIN(false),
	GERENTE(false),
	JEFE_TALLER(false),
	INGESTA(true),
	SCHEDULER(true);

	private final boolean service;

	AccessRole(boolean service) {
		this.service = service;
	}

	public boolean isService() {
		return service;
	}

	public static Set<AccessRole> userRoles() {
		Set<AccessRole> r = EnumSet.noneOf(AccessRole.class);
		for (AccessRole a : values()) {
			if (!a.service) {
				r.add(a);
			}
		}
		return r;
	}

}
