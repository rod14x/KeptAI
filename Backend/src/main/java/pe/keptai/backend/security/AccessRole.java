/**
 * AccessRole.java
 * Versión: 2.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.security;

import java.util.EnumSet;
import java.util.Set;

/**
 * Actores de la base (V4/V7): roles de usuario y servicios.
 * B-06: Incorporación de DISENO.
 */
public enum AccessRole {

	VENDEDOR(false),
	ADMIN(false),
	GERENTE(false),
	JEFE_TALLER(false),
	DISENO(false),
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
