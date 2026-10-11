package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import pe.keptai.backend.config.KeptaiSecurityProperties;

/** Cada rechazo ocurre por su causa (no por un fixture mal formado). JWKS local de prueba, no Auth real. */
class JwtDecoderTests {

	private static final String SUB = "a0000000-0000-4000-8000-000000000001";

	private final JwtDecoder decoder = JwtDecoders.from(new KeptaiSecurityProperties.Jwt(
			JwtTestSupport.ISSUER, JwtTestSupport.jwksUri(), List.of(JwtTestSupport.AUDIENCE), Duration.ofSeconds(30)));

	private void rejects(String token, String reason) {
		assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class)
			.hasMessageContaining(reason);
	}

	@Test
	void acceptsValidRs256AndEs256() {
		assertThat(decoder.decode(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).build())).getSubject()).isEqualTo(SUB);
		assertThat(decoder.decode(JwtTestSupport.es256(JwtTestSupport.claims(SUB).build())).getSubject()).isEqualTo(SUB);
	}

	@Test
	void rejectsEachInvalidCaseForItsOwnReason() {
		Instant now = Instant.now();
		rejects(JwtTestSupport.wrongSignature(JwtTestSupport.claims(SUB).build()), "Signed JWT rejected");
		rejects(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).issueTime(Date.from(now.minusSeconds(900))).expirationTime(Date.from(now.minusSeconds(300))).build()), "expired");
		rejects(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).notBeforeTime(Date.from(now.plusSeconds(300))).build()), "before");
		rejects(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).issuer("http://localhost/otro").build()), "iss");
		rejects(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).audience("otra").build()), "Audiencia");
		rejects(JwtTestSupport.rs256(JwtTestSupport.claims(null).build()), "sub");
		rejects(JwtTestSupport.rs256(JwtTestSupport.claims("no-es-uuid").build()), "sub");
		rejects(JwtTestSupport.rs256(new JWTClaimsSet.Builder().issuer(JwtTestSupport.ISSUER).audience(JwtTestSupport.AUDIENCE).subject(SUB).build()), "exp");
		rejects(JwtTestSupport.hs256(JwtTestSupport.claims(SUB).build()), "");
		rejects(JwtTestSupport.none(JwtTestSupport.claims(SUB).build()), "");
	}

	@Test
	void notBeforeWithinSkewIsAcceptedAndOutsideRejected() {
		Instant now = Instant.now();
		decoder.decode(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).notBeforeTime(Date.from(now.plusSeconds(10))).build()));
		rejects(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).notBeforeTime(Date.from(now.plusSeconds(60))).build()), "before");
	}

	@Test
	void unconfiguredDecoderRejectsEveryToken() {
		JwtDecoder none = JwtDecoders.from(new KeptaiSecurityProperties.Jwt(null, null, List.of(), Duration.ofSeconds(30)));
		assertThatThrownBy(() -> none.decode(JwtTestSupport.rs256(JwtTestSupport.claims(SUB).build()))).isInstanceOf(JwtException.class);
	}

}
