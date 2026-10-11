package pe.keptai.backend.config;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Configuración externa de seguridad (MIG-03-A). Solo valores públicos o referencias: ninguna
 * clave vive en Git. Aún no hay decodificador JWT (MIG-03-B); estas propiedades lo prepararán.
 */
@Validated
@ConfigurationProperties("keptai.security")
public record KeptaiSecurityProperties(
		@Valid @NotNull @DefaultValue Jwt jwt,
		@Valid @NotNull @DefaultValue Cors cors,
		@Valid @NotNull @DefaultValue Webhook webhook) {

	/** JWT del panel emitido por Supabase Auth. Todo vacío = sin configurar (dev/test/local). */
	public record Jwt(
			String issuerUri,
			String jwkSetUri,
			@DefaultValue List<String> audiences,
			@DefaultValue("30s") Duration clockSkew) {

		public boolean isConfigured() {
			return hasText(issuerUri) && hasText(jwkSetUri) && !audiences.isEmpty();
		}

		private boolean isEmpty() {
			return !hasText(issuerUri) && !hasText(jwkSetUri) && audiences.isEmpty();
		}

		@AssertTrue(message = "keptai.security.jwt: issuer-uri, jwk-set-uri y audiences se configuran juntos")
		public boolean isAllOrNothing() {
			return isEmpty() || isConfigured();
		}

		@AssertTrue(message = "keptai.security.jwt: las URI deben ser https (http solo en localhost) y sin credenciales")
		public boolean isUrisSafe() {
			return safeUri(issuerUri) && safeUri(jwkSetUri);
		}

		@AssertTrue(message = "keptai.security.jwt.audiences: sin valores vacios ni comodines")
		public boolean isAudiencesValid() {
			return audiences.stream().allMatch(a -> hasText(a) && !a.contains("*"));
		}

		@AssertTrue(message = "keptai.security.jwt.clock-skew: entre 0 y 2 minutos")
		public boolean isClockSkewValid() {
			return !clockSkew.isNegative() && clockSkew.compareTo(Duration.ofMinutes(2)) <= 0;
		}

	}

	/** CORS del navegador: orígenes exactos; sin comodines, sin cookies, sin credencial de servicio. */
	public record Cors(
			@DefaultValue List<String> allowedOrigins,
			@NotEmpty @DefaultValue({ "GET", "POST", "PATCH", "OPTIONS" }) List<String> allowedMethods,
			@NotEmpty @DefaultValue({ "Authorization", "Content-Type", "Idempotency-Key", "Accept" }) List<String> allowedHeaders,
			@DefaultValue({ "X-Request-Id", "Idempotency-Replayed" }) List<String> exposedHeaders,
			@DefaultValue("1h") Duration maxAge) {

		@AssertTrue(message = "keptai.security.cors.allowed-origins: solo origenes exactos http(s)://host[:puerto], sin '*'")
		public boolean isOriginsExact() {
			return allowedOrigins.stream().allMatch(o -> o != null && o.matches("^https?://[A-Za-z0-9.-]+(:\\d{1,5})?$"));
		}

		@AssertTrue(message = "keptai.security.cors: los origenes no locales deben ser https")
		public boolean isRemoteOriginsHttps() {
			return allowedOrigins.stream().noneMatch(o -> o != null && o.startsWith("http://") && !isLocalHost(URI.create(o).getHost()));
		}

		@AssertTrue(message = "keptai.security.cors.allowed-headers: no se admiten '*' ni X-Api-Key/X-Api-Secret desde el navegador")
		public boolean isHeadersSafe() {
			return allowedHeaders.stream().noneMatch(h -> h.contains("*")
					|| h.equalsIgnoreCase("X-Api-Key") || h.equalsIgnoreCase("X-Api-Secret"));
		}

		@AssertTrue(message = "keptai.security.cors.allowed-methods: solo GET, POST, PATCH, OPTIONS")
		public boolean isMethodsKnown() {
			return allowedMethods.stream().allMatch(m -> List.of("GET", "POST", "PATCH", "OPTIONS").contains(m));
		}

		@AssertTrue(message = "keptai.security.cors.max-age: entre 0 y 24 horas")
		public boolean isMaxAgeValid() {
			return !maxAge.isNegative() && maxAge.compareTo(Duration.ofHours(24)) <= 0;
		}

	}

	/**
	 * Webhook saliente hacia WF3 (X-Api-Secret). Distinto de X-Api-Key (entrante de n8n) y del JWT.
	 * El secreto llega por entorno y no aparece en toString.
	 */
	public record Webhook(String url, String secret) {

		@AssertTrue(message = "keptai.security.webhook: url y secret se configuran juntos")
		public boolean isAllOrNothing() {
			return hasText(url) == hasText(secret);
		}

		@AssertTrue(message = "keptai.security.webhook.secret: minimo 32 caracteres")
		public boolean isSecretStrong() {
			return !hasText(secret) || secret.length() >= 32;
		}

		@AssertTrue(message = "keptai.security.webhook.url: https (http solo en localhost) y sin credenciales")
		public boolean isUrlSafe() {
			return safeUri(url);
		}

		@Override
		public String toString() {
			return "Webhook[url=" + url + ", secret=" + (hasText(secret) ? "****" : "") + "]";
		}

	}

	private static boolean hasText(String s) {
		return s != null && !s.isBlank();
	}

	private static boolean isLocalHost(String host) {
		return "localhost".equals(host) || "127.0.0.1".equals(host);
	}

	private static boolean safeUri(String s) {
		if (!hasText(s)) {
			return true;
		}
		try {
			URI u = URI.create(s);
			if (u.getHost() == null || u.getUserInfo() != null || u.getFragment() != null) {
				return false;
			}
			return "https".equals(u.getScheme()) || ("http".equals(u.getScheme()) && isLocalHost(u.getHost()));
		}
		catch (IllegalArgumentException e) {
			return false;
		}
	}

}
