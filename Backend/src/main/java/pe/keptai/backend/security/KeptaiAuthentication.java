package pe.keptai.backend.security;

import java.util.List;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Identidad del panel tras validar el JWT y resolver membresías en PostgreSQL.
 * Los datos de organización y rol salen solo de la base; el token aporta únicamente el sub.
 */
public final class KeptaiAuthentication extends AbstractAuthenticationToken {

	public enum Access {
		/** Una membresía activa: identidad completa. */
		SINGLE,
		/** Sin membresía activa: autenticado pero sin acceso. */
		NONE,
		/** Varias membresías: selección no definida; no se elige ninguna. */
		MULTIPLE
	}

	private final Jwt jwt;

	private final transient List<Membership> memberships;

	public KeptaiAuthentication(Jwt jwt, List<Membership> memberships) {
		super(memberships.size() == 1 ? List.of(new SimpleGrantedAuthority("ROLE_" + memberships.get(0).rol().name())) : List.of());
		this.jwt = jwt;
		this.memberships = List.copyOf(memberships);
		setAuthenticated(true);
	}

	public Access access() {
		return memberships.isEmpty() ? Access.NONE : memberships.size() == 1 ? Access.SINGLE : Access.MULTIPLE;
	}

	/** Solo con acceso SINGLE; con otros estados no hay identidad que exponer. */
	public Membership membership() {
		if (access() != Access.SINGLE) {
			throw new IllegalStateException("Sin una única membresía resuelta");
		}
		return memberships.get(0);
	}

	@Override
	public Object getCredentials() {
		return "";
	}

	@Override
	public Object getPrincipal() {
		return jwt.getSubject();
	}

	@Override
	public String toString() {
		return "KeptaiAuthentication[access=" + access() + "]";
	}

}
