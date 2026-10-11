package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import pe.keptai.backend.config.KeptaiSecurityProperties;

/** MIG-03-A: la configuración externa se valida al arrancar; sin valores reales ni secretos. */
class SecurityPropertiesTests {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
		.withUserConfiguration(Cfg.class);

	@EnableConfigurationProperties(KeptaiSecurityProperties.class)
	static class Cfg {
	}

	private static final String SECRET = "x".repeat(32);

	@Test
	void emptyConfigurationIsValidAndUnconfigured() {
		runner.run(ctx -> {
			assertThat(ctx).hasNotFailed();
			KeptaiSecurityProperties p = ctx.getBean(KeptaiSecurityProperties.class);
			assertThat(p.jwt().isConfigured()).isFalse();
			assertThat(p.cors().allowedOrigins()).isEmpty();
			assertThat(p.cors().allowedHeaders()).contains("Authorization", "Idempotency-Key").doesNotContain("X-Api-Key");
		});
	}

	@Test
	void fullJwtConfigurationBinds() {
		runner.withPropertyValues(
				"keptai.security.jwt.issuer-uri=https://proyecto.example.invalid/auth/v1",
				"keptai.security.jwt.jwk-set-uri=https://proyecto.example.invalid/auth/v1/.well-known/jwks.json",
				"keptai.security.jwt.audiences=authenticated")
			.run(ctx -> assertThat(ctx.getBean(KeptaiSecurityProperties.class).jwt().isConfigured()).isTrue());
	}

	@Test
	void partialJwtConfigurationFails() {
		runner.withPropertyValues("keptai.security.jwt.issuer-uri=https://proyecto.example.invalid/auth/v1")
			.run(ctx -> assertThat(ctx).hasFailed());
	}

	@Test
	void insecureOrCredentialedJwtUrisFail() {
		for (String uri : new String[] { "http://proyecto.example.invalid/auth/v1", "https://u:p@proyecto.example.invalid/x", "no-es-uri" }) {
			runner.withPropertyValues("keptai.security.jwt.issuer-uri=" + uri,
					"keptai.security.jwt.jwk-set-uri=https://proyecto.example.invalid/jwks",
					"keptai.security.jwt.audiences=authenticated")
				.run(ctx -> assertThat(ctx).as(uri).hasFailed());
		}
	}

	@Test
	void localhostHttpIsAllowedForTestJwks() {
		runner.withPropertyValues("keptai.security.jwt.issuer-uri=http://localhost:9999/issuer",
				"keptai.security.jwt.jwk-set-uri=http://127.0.0.1:9999/jwks",
				"keptai.security.jwt.audiences=authenticated")
			.run(ctx -> assertThat(ctx).hasNotFailed());
	}

	@Test
	void wildcardAudienceFails() {
		runner.withPropertyValues("keptai.security.jwt.issuer-uri=https://p.example.invalid/auth",
				"keptai.security.jwt.jwk-set-uri=https://p.example.invalid/jwks",
				"keptai.security.jwt.audiences=*")
			.run(ctx -> assertThat(ctx).hasFailed());
	}

	@Test
	void corsRejectsWildcardsPathsAndRemoteHttp() {
		for (String origin : new String[] { "*", "https://*.example.invalid", "https://app.example.invalid/ruta", "http://app.example.invalid" }) {
			runner.withPropertyValues("keptai.security.cors.allowed-origins=" + origin)
				.run(ctx -> assertThat(ctx).as(origin).hasFailed());
		}
		runner.withPropertyValues("keptai.security.cors.allowed-origins=http://localhost:5173,https://app.example.invalid")
			.run(ctx -> assertThat(ctx).hasNotFailed());
	}

	@Test
	void corsNeverAllowsServiceCredentialHeadersOrWildcardHeaders() {
		runner.withPropertyValues("keptai.security.cors.allowed-headers=Authorization,X-Api-Key")
			.run(ctx -> assertThat(ctx).hasFailed());
		runner.withPropertyValues("keptai.security.cors.allowed-headers=*")
			.run(ctx -> assertThat(ctx).hasFailed());
		runner.withPropertyValues("keptai.security.cors.allowed-methods=DELETE")
			.run(ctx -> assertThat(ctx).hasFailed());
	}

	@Test
	void webhookNeedsUrlAndStrongSecretTogetherAndNeverPrintsIt() {
		runner.withPropertyValues("keptai.security.webhook.url=https://n8n.example.invalid/webhook/enviar-mensaje")
			.run(ctx -> assertThat(ctx).hasFailed());
		runner.withPropertyValues("keptai.security.webhook.url=https://n8n.example.invalid/webhook/enviar-mensaje",
				"keptai.security.webhook.secret=corto")
			.run(ctx -> assertThat(ctx).hasFailed());
		runner.withPropertyValues("keptai.security.webhook.url=https://n8n.example.invalid/webhook/enviar-mensaje",
				"keptai.security.webhook.secret=" + SECRET)
			.run(ctx -> {
				assertThat(ctx).hasNotFailed();
				assertThat(ctx.getBean(KeptaiSecurityProperties.class).toString()).doesNotContain(SECRET);
			});
	}

	@Test
	void rolesMatchSqlActorsAndSeparateServicesFromUsers() {
		assertThat(AccessRole.userRoles()).containsExactlyInAnyOrder(
				AccessRole.VENDEDOR, AccessRole.ADMIN, AccessRole.GERENTE, AccessRole.JEFE_TALLER);
		assertThat(AccessRole.INGESTA.isService()).isTrue();
		assertThat(AccessRole.SCHEDULER.isService()).isTrue();
	}

}
