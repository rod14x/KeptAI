package pe.keptai.backend.security;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import pe.keptai.backend.config.KeptaiSecurityProperties;

/** Decodificador del JWT del panel: firma por JWKS, issuer, audiencia, exp, nbf y sub UUID. */
public final class JwtDecoders {

	/** Solo algoritmos asimétricos; HS256 (secreto compartido), none y el resto se rechazan. */
	static final List<SignatureAlgorithm> ALLOWED = List.of(SignatureAlgorithm.RS256, SignatureAlgorithm.ES256);

	private JwtDecoders() {
	}

	public static JwtDecoder from(KeptaiSecurityProperties.Jwt jwt) {
		if (!jwt.isConfigured()) {
			// Sin configuración nada se autentica: mismo 401 que antes de MIG-03-B.
			return token -> {
				throw new BadJwtException("Autenticación JWT no configurada");
			};
		}
		NimbusJwtDecoder.JwkSetUriJwtDecoderBuilder b = NimbusJwtDecoder.withJwkSetUri(jwt.jwkSetUri());
		ALLOWED.forEach(b::jwsAlgorithm);
		NimbusJwtDecoder decoder = b.build();
		decoder.setJwtValidator(validator(jwt.issuerUri(), jwt.audiences(), jwt.clockSkew()));
		return decoder;
	}

	static OAuth2TokenValidator<Jwt> validator(String issuer, List<String> audiences, Duration clockSkew) {
		return new DelegatingOAuth2TokenValidator<>(
				new JwtTimestampValidator(clockSkew),
				new JwtIssuerValidator(issuer),
				audience(audiences),
				requiredClaims());
	}

	private static OAuth2TokenValidator<Jwt> audience(List<String> expected) {
		return jwt -> {
			List<String> aud = jwt.getAudience();
			if (aud != null && aud.stream().anyMatch(expected::contains)) {
				return OAuth2TokenValidatorResult.success();
			}
			return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Audiencia no válida", null));
		};
	}

	/** exp obligatorio (el validador de tiempo lo ignora si falta) y sub debe ser un UUID. */
	private static OAuth2TokenValidator<Jwt> requiredClaims() {
		return jwt -> {
			if (jwt.getExpiresAt() == null) {
				return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Falta exp", null));
			}
			try {
				UUID.fromString(String.valueOf(jwt.getSubject()));
			}
			catch (IllegalArgumentException e) {
				return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "sub no válido", null));
			}
			return OAuth2TokenValidatorResult.success();
		};
	}

}
