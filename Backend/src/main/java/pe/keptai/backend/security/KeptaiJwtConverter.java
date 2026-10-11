package pe.keptai.backend.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

/** Convierte un JWT ya validado en identidad del panel consultando la base con el sub (UUID verificado). */
public class KeptaiJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

	private final MembershipResolver resolver;

	public KeptaiJwtConverter(MembershipResolver resolver) {
		this.resolver = resolver;
	}

	@Override
	public AbstractAuthenticationToken convert(Jwt jwt) {
		// El validador del decodificador ya garantiza que sub es un UUID; no se leen otros claims de identidad.
		return new KeptaiAuthentication(jwt, resolver.resolve(java.util.UUID.fromString(jwt.getSubject())));
	}

}
