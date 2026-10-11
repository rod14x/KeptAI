package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import com.nimbusds.jwt.JWTClaimsSet;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * MIG-03-B con PostgreSQL real (Testcontainers, V1-V7, login runtime no propietario) y JWKS local de
 * prueba. FIXTURE: no usa Supabase Auth real ni la base manual del desarrollador.
 */
@SpringBootTest(properties = "spring.autoconfigure.exclude=")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class JwtMembershipIntegrationTests {

	static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:17-alpine");

	static final String ORG_A = "10000000-0000-4000-8000-0000000000a1";

	static final String ORG_B = "10000000-0000-4000-8000-0000000000b2";

	static final String SUB_SINGLE = "a0000000-0000-4000-8000-000000000001";

	static final String USER_SINGLE = "c0000000-0000-4000-8000-000000000001";

	static final String SUB_MULTI = "a0000000-0000-4000-8000-000000000002";

	static final String SUB_INACTIVE = "a0000000-0000-4000-8000-000000000003";

	static final String SUB_UNKNOWN = "a0000000-0000-4000-8000-000000000004";

	static final String SUB_OTHER = "a0000000-0000-4000-8000-000000000005";

	static final String USER_OTHER = "c0000000-0000-4000-8000-000000000005";

	@BeforeAll
	static void database() throws Exception {
		PG.start();
		try (Connection c = DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword()); Statement s = c.createStatement()) {
			s.execute("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role");
		}
		Flyway.configure().dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword()).schemas("keptai").defaultSchema("keptai")
			.locations("filesystem:../BD/migrations").load().migrate();
		try (Connection c = DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword()); Statement s = c.createStatement()) {
			s.execute("SET search_path=keptai,public");
			s.execute("INSERT INTO organizacion(id,nombre) VALUES ('" + ORG_A + "','Org A'),('" + ORG_B + "','Org B')");
			s.execute("INSERT INTO usuario(id,organizacion_id,auth_user_id,nombre,rol,activo) VALUES "
					+ "('" + USER_SINGLE + "','" + ORG_A + "','" + SUB_SINGLE + "','Single','VENDEDOR',true),"
					+ "('c0000000-0000-4000-8000-000000000002','" + ORG_A + "','" + SUB_MULTI + "','Multi A','ADMIN',true),"
					+ "('c0000000-0000-4000-8000-000000000012','" + ORG_B + "','" + SUB_MULTI + "','Multi B','GERENTE',true),"
					+ "('c0000000-0000-4000-8000-000000000003','" + ORG_A + "','" + SUB_INACTIVE + "','Inactivo','VENDEDOR',false),"
					+ "('" + USER_OTHER + "','" + ORG_B + "','" + SUB_OTHER + "','Otro','JEFE_TALLER',true)");
			// Login runtime como el local: no propietario, hereda keptai_runtime, sin BYPASSRLS.
			s.execute("CREATE ROLE keptai_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'fixture-only'");
			s.execute("GRANT keptai_runtime TO keptai_app");
		}
	}

	@AfterAll
	static void stop() {
		PG.stop();
	}

	@DynamicPropertySource
	static void props(DynamicPropertyRegistry r) {
		r.add("spring.datasource.url", () -> PG.getJdbcUrl() + "&currentSchema=keptai");
		r.add("spring.datasource.username", () -> "keptai_app");
		r.add("spring.datasource.password", () -> "fixture-only");
		r.add("keptai.security.jwt.issuer-uri", () -> JwtTestSupport.ISSUER);
		r.add("keptai.security.jwt.jwk-set-uri", JwtTestSupport::jwksUri);
		r.add("keptai.security.jwt.audiences", () -> JwtTestSupport.AUDIENCE);
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	MembershipResolver resolver;

	private ResultActions me(String token) throws Exception {
		return mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + token));
	}

	private void assertUnauthorized(String token) throws Exception {
		me(token).andExpect(status().isUnauthorized())
			.andExpect(header().exists("X-Request-Id"))
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.request_id").isNotEmpty())
			.andExpect(jsonPath("$.trace").doesNotExist());
	}

	@Test
	void singleMembershipReturnsOnlyItsAuthorizedIdentityWithRs256() throws Exception {
		me(JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).build()))
			.andExpect(status().isOk())
			.andExpect(header().exists("X-Request-Id"))
			.andExpect(jsonPath("$.user_id").value(USER_SINGLE))
			.andExpect(jsonPath("$.organization_id").value(ORG_A))
			.andExpect(jsonPath("$.role").value("VENDEDOR"))
			// INT-FE-API-002: nombre y organización visibles; ningún otro dato (correo, sub, credenciales).
			.andExpect(jsonPath("$.name").isString())
			.andExpect(jsonPath("$.organization_name").isString())
			.andExpect(jsonPath("$.length()").value(5));
	}

	@Test
	void es256IsAcceptedAndOtherSubGetsOnlyItsOwnData() throws Exception {
		me(JwtTestSupport.es256(JwtTestSupport.claims(SUB_OTHER).build()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.user_id").value(USER_OTHER))
			.andExpect(jsonPath("$.organization_id").value(ORG_B))
			.andExpect(jsonPath("$.role").value("JEFE_TALLER"));
	}

	@Test
	void clientSuppliedOrganizationOrRoleIsIgnored() throws Exception {
		JWTClaimsSet claims = JwtTestSupport.claims(SUB_SINGLE).claim("organization_id", ORG_B).claim("role", "ADMIN")
			.claim("user_metadata", java.util.Map.of("rol", "GERENTE")).build();
		mvc.perform(get("/api/v1/me").queryParam("organization_id", ORG_B).header("X-Organization-Id", ORG_B)
				.header("Authorization", "Bearer " + JwtTestSupport.rs256(claims)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.organization_id").value(ORG_A))
			.andExpect(jsonPath("$.role").value("VENDEDOR"));
	}

	@Test
	void multipleMembershipsAreRejectedExplicitlyWithoutPickingOrListing() throws Exception {
		me(JwtTestSupport.rs256(JwtTestSupport.claims(SUB_MULTI).build()))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ORGANIZATION_SELECTION_REQUIRED"))
			.andExpect(jsonPath("$.request_id").isNotEmpty())
			.andExpect(jsonPath("$.organization_id").doesNotExist())
			.andExpect(jsonPath("$.user_id").doesNotExist())
			.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(
					org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(ORG_A))));
	}

	@Test
	void unknownAndInactiveUsersAreAuthenticatedButForbidden() throws Exception {
		for (String sub : new String[] { SUB_UNKNOWN, SUB_INACTIVE }) {
			me(JwtTestSupport.rs256(JwtTestSupport.claims(sub).build()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"))
				.andExpect(jsonPath("$.request_id").isNotEmpty());
		}
	}

	@Test
	void invalidTokensAreRejectedWith401() throws Exception {
		Instant now = Instant.now();
		assertUnauthorized(JwtTestSupport.wrongSignature(JwtTestSupport.claims(SUB_SINGLE).build()));
		assertUnauthorized(JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).issueTime(Date.from(now.minusSeconds(900))).expirationTime(Date.from(now.minusSeconds(300))).build()));
		assertUnauthorized(JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).notBeforeTime(Date.from(now.plusSeconds(300))).build()));
		assertUnauthorized(JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).issuer("http://localhost/otro").build()));
		assertUnauthorized(JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).audience("otra-audiencia").build()));
		assertUnauthorized(JwtTestSupport.rs256(JwtTestSupport.claims(null).build()));
		assertUnauthorized(JwtTestSupport.rs256(JwtTestSupport.claims("no-es-uuid").build()));
		assertUnauthorized(JwtTestSupport.rs256(new JWTClaimsSet.Builder().issuer(JwtTestSupport.ISSUER).audience(JwtTestSupport.AUDIENCE).subject(SUB_SINGLE).build()));
		assertUnauthorized(JwtTestSupport.hs256(JwtTestSupport.claims(SUB_SINGLE).build()));
		assertUnauthorized(JwtTestSupport.none(JwtTestSupport.claims(SUB_SINGLE).build()));
		assertUnauthorized("no.es.un.jwt");
	}

	@Test
	void slightlyExpiredTokenWithinConfiguredSkewIsAccepted() throws Exception {
		me(JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).issueTime(Date.from(Instant.now().minusSeconds(600))).expirationTime(Date.from(Instant.now().minusSeconds(5))).build()))
			.andExpect(status().isOk());
	}

	@Test
	void missingOrMalformedAuthorizationIs401AndHealthStaysPublic() throws Exception {
		mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
		mvc.perform(get("/api/v1/me").header("Authorization", "Basic abc")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/me").queryParam("access_token", JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).build())))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mvc.perform(get("/actuator/health").header("Authorization", "Bearer basura")).andExpect(status().isOk());
	}

	@Test
	void userJwtNeverAuthenticatesServiceRoutes() throws Exception {
		String token = JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SINGLE).build());
		for (String path : new String[] { "/api/v1/ordenes/ingesta", "/api/v1/ordenes/confirmar", "/api/v1/pagos/voucher", "/api/v1/mensajes/" + UUID.randomUUID() + "/estado" }) {
			mvc.perform(post(path).header("Authorization", "Bearer " + token).contentType("application/json").content("{}"))
				.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
			mvc.perform(post(path).header("X-Api-Key", "cualquiera").contentType("application/json").content("{}"))
				.andExpect(status().isUnauthorized());
		}
		// Un usuario con varias membresías tampoco recibe la señal de selección en rutas de servicio.
		mvc.perform(post("/api/v1/ordenes/ingesta").header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims(SUB_MULTI).build())))
			.andExpect(status().isForbidden());
	}

	@Test
	void resolverReturnsOnlyTheMembershipsOfTheGivenSubUsingRuntimeLogin() {
		assertThat(resolver.resolve(UUID.fromString(SUB_SINGLE))).singleElement()
			.satisfies(m -> {
				assertThat(m.usuarioId()).hasToString(USER_SINGLE);
				assertThat(m.organizacionId()).hasToString(ORG_A);
				assertThat(m.rol()).isEqualTo(AccessRole.VENDEDOR);
			});
		assertThat(resolver.resolve(UUID.fromString(SUB_MULTI))).hasSize(2)
			.extracting(m -> m.organizacionId().toString()).containsExactlyInAnyOrder(ORG_A, ORG_B);
		assertThat(resolver.resolve(UUID.fromString(SUB_INACTIVE))).isEmpty();
		assertThat(resolver.resolve(UUID.fromString(SUB_UNKNOWN))).isEmpty();
	}

	@Test
	void runtimeLoginHasNoGlobalAccessToUsuarioTable() throws Exception {
		try (Connection c = DriverManager.getConnection(PG.getJdbcUrl() + "&currentSchema=keptai", "keptai_app", "fixture-only");
				Statement s = c.createStatement()) {
			try (var rs = s.executeQuery("SELECT count(*) FROM keptai.usuario")) {
				rs.next();
				assertThat(rs.getInt(1)).isZero(); // RLS sin contexto: el resolver no se apoya en SELECT global
			}
			try (var rs = s.executeQuery("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user")) {
				rs.next();
				assertThat(rs.getBoolean(1)).isFalse();
				assertThat(rs.getBoolean(2)).isFalse();
			}
		}
	}

}
