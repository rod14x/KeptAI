package pe.keptai.backend.security;

import java.util.List;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Principal de un servicio técnico autenticado por {@code X-Api-Key}. Distinto de {@link KeptaiAuthentication}:
 * nunca es un usuario del panel ni firma como persona. No retiene la clave ni su hash.
 */
public final class ServiceAuthentication extends AbstractAuthenticationToken {

	private final transient ServiceIdentity identity;

	public ServiceAuthentication(ServiceIdentity identity) {
		super(List.of(new SimpleGrantedAuthority("SERVICE_" + identity.alcance().name())));
		this.identity = identity;
		setAuthenticated(true);
	}

	public ServiceIdentity identity() {
		return identity;
	}

	@Override
	public Object getCredentials() {
		return "";
	}

	@Override
	public Object getPrincipal() {
		return identity;
	}

	@Override
	public String toString() {
		return "ServiceAuthentication[alcance=" + identity.alcance() + "]";
	}

}
