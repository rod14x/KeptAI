package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.tenancy.TenantContext;
import pe.keptai.backend.tenancy.TenantContextException;
import pe.keptai.backend.tenancy.TenantTransaction;

/**
 * MIG-03-D1 con PostgreSQL 17 desechable (V1-V7) y login runtime NOSUPERUSER NOBYPASSRLS no propietario:
 * X-Api-Key -> SHA-256 -> resolver_servicio -> ServiceAuthentication -> transacción -> GUC -> actor/RLS.
 * Las claves se generan aleatoriamente en cada ejecución (no hay valores reales). Las rutas de negocio siguen
 * cerradas en producción; el probe de src/test solo demuestra el contexto.
 */
@SpringBootTest(properties = "spring.autoconfigure.exclude=")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({ ServiceApiKeyIntegrationTests.Probe.class, ServiceApiKeyIntegrationTests.ProbeRoutes.class })
class ServiceApiKeyIntegrationTests {

	static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:17-alpine");

	static final UUID ORG_A = UUID.fromString("10000000-0000-4000-8000-0000000000a1");

	static final UUID ORG_B = UUID.fromString("10000000-0000-4000-8000-0000000000b2");

	static final UUID USER_A = UUID.fromString("c0000000-0000-4000-8000-0000000000a1");

	static final UUID SUB_A = UUID.fromString("a0000000-0000-4000-8000-0000000000a1");

	static final UUID USER_B = UUID.fromString("c0000000-0000-4000-8000-0000000000b1");

	static final UUID SUB_B = UUID.fromString("a0000000-0000-4000-8000-0000000000b1");

	static final UUID SVC_ING_A = UUID.fromString("d0000000-0000-4000-8000-0000000000a1");

	static final UUID SVC_SCH_A = UUID.fromString("d0000000-0000-4000-8000-0000000000a2");

	static final UUID SVC_ING_B = UUID.fromString("d0000000-0000-4000-8000-0000000000b1");

	static final UUID SVC_OFF_A = UUID.fromString("d0000000-0000-4000-8000-0000000000a3");

	static final UUID PAGO_A = UUID.fromString("e0000000-0000-4000-8000-0000000000a1");

	static final SecureRandom RANDOM = new SecureRandom();

	static final String KEY_ING_A = randomKey();

	static final String KEY_SCH_A = randomKey();

	static final String KEY_ING_B = randomKey();

	static final String KEY_OFF_A = randomKey();

	static final String KEY_UNKNOWN = randomKey();

	static String randomKey() {
		byte[] b = new byte[32];
		RANDOM.nextBytes(b);
		return HexFormat.of().formatHex(b);
	}

	@BeforeAll
	static void database() throws Exception {
		PG.start();
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role");
		}
		Flyway.configure().dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword()).schemas("keptai").defaultSchema("keptai")
			.locations("filesystem:../BD/migrations").load().migrate();
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("SET search_path=keptai,public");
			s.execute("INSERT INTO organizacion(id,nombre) VALUES ('" + ORG_A + "','Org A'),('" + ORG_B + "','Org B')");
			s.execute("INSERT INTO usuario(id,organizacion_id,auth_user_id,nombre,rol,activo) VALUES "
					+ "('" + USER_A + "','" + ORG_A + "','" + SUB_A + "','Vendedor A','VENDEDOR',true),"
					+ "('" + USER_B + "','" + ORG_B + "','" + SUB_B + "','Vendedor B','VENDEDOR',true)");
			s.execute("INSERT INTO integracion_servicio(id,organizacion_id,instancia,alcance,clave_hash,activo) VALUES "
					+ svc(SVC_ING_A, ORG_A, "n8n-a", "INGESTA", KEY_ING_A, true) + ","
					+ svc(SVC_SCH_A, ORG_A, "n8n-a", "SCHEDULER", KEY_SCH_A, true) + ","
					+ svc(SVC_ING_B, ORG_B, "n8n-b", "INGESTA", KEY_ING_B, true) + ","
					+ svc(SVC_OFF_A, ORG_A, "n8n-off", "INGESTA", KEY_OFF_A, false));
			s.execute("INSERT INTO cliente(organizacion_id,razon_social,tipo) VALUES "
					+ "('" + ORG_A + "','Cliente A1','EMPRESA'),('" + ORG_B + "','Cliente B1','EMPRESA')");
			s.execute("INSERT INTO pago(id,organizacion_id,monto,fecha_pago,medio,idempotency_key) VALUES ('" + PAGO_A + "','" + ORG_A + "',10,current_date,'YAPE','fixture-pago-a')");
			s.execute("CREATE ROLE keptai_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'fixture-only'");
			s.execute("GRANT keptai_runtime TO keptai_app");
		}
	}

	private static String svc(UUID id, UUID org, String instancia, String alcance, String key, boolean activo) {
		return "('" + id + "','" + org + "','" + instancia + "','" + alcance + "','" + ApiKeyAuthenticationFilter.sha256(key) + "'," + activo + ")";
	}

	@AfterAll
	static void stop() {
		PG.stop();
	}

	private static Connection owner() throws Exception {
		return DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword());
	}

	@DynamicPropertySource
	static void props(DynamicPropertyRegistry r) {
		r.add("spring.datasource.url", () -> PG.getJdbcUrl() + "&currentSchema=keptai");
		r.add("spring.datasource.username", () -> "keptai_app");
		r.add("spring.datasource.password", () -> "fixture-only");
		r.add("spring.datasource.hikari.maximum-pool-size", () -> "1");
		r.add("spring.datasource.hikari.minimum-idle", () -> "1");
		r.add("keptai.security.jwt.issuer-uri", () -> JwtTestSupport.ISSUER);
		r.add("keptai.security.jwt.jwk-set-uri", JwtTestSupport::jwksUri);
		r.add("keptai.security.jwt.audiences", () -> JwtTestSupport.AUDIENCE);
	}

	/** Solo src/test: permite a un servicio autenticado exclusivamente las rutas /test-probe/. */
	@TestConfiguration
	static class ProbeRoutes {

		@Bean
		@Primary
		AuthorizationManager<RequestAuthorizationContext> probeOnlyServiceRoutes() {
			return (auth, ctx) -> new AuthorizationDecision(auth.get() instanceof ServiceAuthentication
					&& ctx.getRequest().getRequestURI().contains("/test-probe/"));
		}

	}

	/** Servicio de prueba: estado del contexto en la transacción; con fail=1 lanza para forzar rollback. */
	@RestController
	static class Probe {

		private final TenantTransaction tenant;

		private final JdbcTemplate jdbc;

		Probe(TenantTransaction tenant, JdbcTemplate jdbc) {
			this.tenant = tenant;
			this.jdbc = jdbc;
		}

		@GetMapping({ "/api/v1/test-probe/estado", "/api/v1/ordenes/test-probe/estado", "/api/v1/pagos/test-probe/estado" })
		Map<String, Object> estado(@RequestParam(defaultValue = "0") String fail) {
			return tenant.execute(() -> {
				Map<String, Object> out = new LinkedHashMap<>();
				out.put("actor", jdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class));
				out.put("pid", jdbc.queryForObject("SELECT pg_backend_pid()", Long.class));
				out.put("organizacion", jdbc.queryForObject("SELECT coalesce(current_setting('app.organizacion_id', true), '')", String.class));
				out.put("usuario", jdbc.queryForObject("SELECT coalesce(current_setting('app.usuario_id', true), '')", String.class));
				out.put("servicio", jdbc.queryForObject("SELECT coalesce(current_setting('app.servicio_id', true), '')", String.class));
				out.put("clientes", jdbc.queryForList("SELECT razon_social FROM cliente ORDER BY 1", String.class));
				if ("1".equals(fail)) {
					throw new IllegalStateException("forzar rollback");
				}
				return out;
			});
		}

	}

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	TenantTransaction tenant;

	@Autowired
	TenantContext context;

	@Autowired
	PlatformTransactionManager tm;

	@AfterEach
	void clearSecurity() {
		SecurityContextHolder.clearContext();
	}

	private static final String SERVICE_PROBE = "/api/v1/ordenes/test-probe/estado";

	private static final String PANEL_PROBE = "/api/v1/test-probe/estado";

	private ResultActions service(String key) throws Exception {
		return mvc.perform(get(SERVICE_PROBE).header("X-Api-Key", key));
	}

	private ResultActions user(UUID sub) throws Exception {
		return mvc.perform(get(PANEL_PROBE).header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims(sub.toString()).build())));
	}

	private List<String> idleGuc() {
		return jdbc.queryForObject("SELECT ARRAY[coalesce(current_setting('app.organizacion_id', true), ''), coalesce(current_setting('app.usuario_id', true), ''), "
				+ "coalesce(current_setting('app.servicio_id', true), '')]::text[]", (rs, i) -> List.of((String[]) rs.getArray(1).getArray()));
	}

	private long idlePid() {
		return jdbc.queryForObject("SELECT pg_backend_pid()", Long.class);
	}

	private static void asService(UUID servicio, UUID org, AccessRole alcance) {
		SecurityContextHolder.getContext().setAuthentication(new ServiceAuthentication(new ServiceIdentity(servicio, org, "n8n", alcance)));
	}

	private static void asUser(UUID usuario, UUID org) {
		Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject(SUB_A.toString()).build();
		SecurityContextHolder.getContext().setAuthentication(new KeptaiAuthentication(jwt, List.of(new Membership(usuario, org, AccessRole.VENDEDOR))));
	}

	@Test
	void theApplicationLoginIsARealNonOwnerRuntimeRole() {
		assertThat(jdbc.queryForMap("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"))
			.containsEntry("rolsuper", false).containsEntry("rolbypassrls", false);
		assertThat(jdbc.queryForObject("SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'keptai.integracion_servicio'::regclass", String.class))
			.isNotEqualTo("keptai_app");
		// El runtime no tiene ni SELECT sobre la tabla de servicios: solo resolver_servicio por hash.
		assertThatThrownBy(() -> jdbc.queryForObject("SELECT count(*) FROM integracion_servicio", Integer.class))
			.isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("permission denied");
	}

	@Test
	void validKeyResolvesOrganizationAndScopeFromPostgresIgnoringForgedValues() throws Exception {
		service(KEY_ING_A).andExpect(status().isOk())
			.andExpect(jsonPath("$.actor").value("INGESTA"))
			.andExpect(jsonPath("$.organizacion").value(ORG_A.toString()))
			.andExpect(jsonPath("$.servicio").value(SVC_ING_A.toString()))
			.andExpect(jsonPath("$.usuario").value(""))
			.andExpect(jsonPath("$.clientes[0]").value("Cliente A1")).andExpect(jsonPath("$.clientes.length()").value(1));
		// Organización, alcance, instancia y servicio forjados por el cliente no cambian nada.
		mvc.perform(get(SERVICE_PROBE).param("organizacion_id", ORG_B.toString()).param("alcance", "SCHEDULER").param("servicio_id", SVC_SCH_A.toString())
				.header("X-Organization-Id", ORG_B.toString()).header("X-Service-Scope", "SCHEDULER").header("X-Instance", "n8n-b").header("X-Api-Key", KEY_ING_A))
			.andExpect(status().isOk()).andExpect(jsonPath("$.actor").value("INGESTA")).andExpect(jsonPath("$.organizacion").value(ORG_A.toString()))
			.andExpect(jsonPath("$.servicio").value(SVC_ING_A.toString()));
		// Alcance SCHEDULER distinto de INGESTA: es otro actor, no una extensión de permisos.
		service(KEY_SCH_A).andExpect(status().isOk()).andExpect(jsonPath("$.actor").value("SCHEDULER")).andExpect(jsonPath("$.servicio").value(SVC_SCH_A.toString()));
		// Segunda empresa.
		service(KEY_ING_B).andExpect(status().isOk()).andExpect(jsonPath("$.organizacion").value(ORG_B.toString()))
			.andExpect(jsonPath("$.clientes.length()").value(1)).andExpect(jsonPath("$.clientes[0]").value("Cliente B1"));
	}

	@Test
	void invalidUnknownInactiveAbsentAndMalformedKeysGetTheSameUniform401() throws Exception {
		String body = service(KEY_UNKNOWN).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.request_id").isNotEmpty()).andReturn().getResponse().getContentAsString();
		for (String bad : new String[] { KEY_OFF_A, "corta", "x".repeat(200), "con espacios en el medio de la clave tecnica larga", KEY_ING_A + "ñ" }) {
			String other = service(bad).andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
			assertThat(other.replaceAll("\"request_id\":\"[^\"]*\"", "")).isEqualTo(body.replaceAll("\"request_id\":\"[^\"]*\"", ""));
		}
		mvc.perform(get(SERVICE_PROBE)).andExpect(status().isUnauthorized());
		// La clave mayúscula/minúscula distinta es otra clave: el hash es de la clave exacta.
		service(KEY_ING_A.toUpperCase()).andExpect(status().isUnauthorized());
		assertThat(idleGuc()).containsExactly("", "", "");
	}

	@Test
	void jwtAndApiKeyAreSeparatedAndSimultaneousCredentialsAreRejected() throws Exception {
		String jwt = JwtTestSupport.rs256(JwtTestSupport.claims(SUB_A.toString()).build());
		// JWT de usuario nunca autentica una ruta de servicio.
		mvc.perform(get(SERVICE_PROBE).header("Authorization", "Bearer " + jwt)).andExpect(status().isForbidden());
		// La clave de servicio nunca autentica rutas del panel, ni con ni sin JWT.
		mvc.perform(get(PANEL_PROBE).header("X-Api-Key", KEY_ING_A)).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/me").header("X-Api-Key", KEY_ING_A)).andExpect(status().isUnauthorized());
		// Credenciales simultáneas: rechazo explícito, sin escoger una (ni en rutas de servicio ni del panel).
		mvc.perform(get(SERVICE_PROBE).header("X-Api-Key", KEY_ING_A).header("Authorization", "Bearer " + jwt)).andExpect(status().isUnauthorized());
		mvc.perform(get(PANEL_PROBE).header("X-Api-Key", KEY_ING_A).header("Authorization", "Bearer " + jwt)).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/me").header("X-Api-Key", KEY_ING_A).header("Authorization", "Bearer " + jwt)).andExpect(status().isUnauthorized());
		mvc.perform(get(SERVICE_PROBE).queryParam("access_token", jwt).header("X-Api-Key", KEY_ING_A)).andExpect(status().isUnauthorized());
		// Clave duplicada en la cabecera: ambigua.
		mvc.perform(get(SERVICE_PROBE).header("X-Api-Key", KEY_ING_A, KEY_ING_A)).andExpect(status().isUnauthorized());
		mvc.perform(get(SERVICE_PROBE).header("X-Api-Key", KEY_ING_A, KEY_ING_B)).andExpect(status().isUnauthorized());
		// El JWT solo sigue sirviendo en el panel y /me no es una ruta de servicio.
		user(SUB_A).andExpect(status().isOk()).andExpect(jsonPath("$.actor").value("VENDEDOR"));
		// El health público no se altera por una clave sobrante.
		mvc.perform(get("/actuator/health").header("X-Api-Key", "x")).andExpect(status().isOk());
	}

	@Test
	void anAuthenticatedServiceStillGetsForbiddenOnClosedBusinessRoutes() throws Exception {
		for (String path : new String[] { "/api/v1/ordenes/ingesta", "/api/v1/pagos/voucher", "/api/v1/ordenes/confirmar" }) {
			mvc.perform(post(path).header("X-Api-Key", KEY_ING_A).contentType("application/json").content("{}"))
				.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
		}
		// Un servicio no puede usar rutas fuera de las suyas (ni siquiera con clave válida: la clave se rechaza).
		mvc.perform(get("/api/v1/orders").header("X-Api-Key", KEY_ING_A)).andExpect(status().isUnauthorized());
	}

	@Test
	void sameConnectionIsReusedAcrossUserServiceAndOrganizationsWithoutLeaks() throws Exception {
		long pid = idlePid();
		// usuario A -> servicio A -> sin contexto -> servicio B -> usuario B
		user(SUB_A).andExpect(status().isOk()).andExpect(jsonPath("$.pid").value(pid)).andExpect(jsonPath("$.usuario").value(USER_A.toString()))
			.andExpect(jsonPath("$.servicio").value("")).andExpect(jsonPath("$.actor").value("VENDEDOR"));
		service(KEY_ING_A).andExpect(status().isOk()).andExpect(jsonPath("$.pid").value(pid)).andExpect(jsonPath("$.usuario").value(""))
			.andExpect(jsonPath("$.servicio").value(SVC_ING_A.toString())).andExpect(jsonPath("$.actor").value("INGESTA"));
		assertThat(idleGuc()).containsExactly("", "", "");
		assertThat(idlePid()).isEqualTo(pid);
		service(KEY_ING_B).andExpect(status().isOk()).andExpect(jsonPath("$.pid").value(pid)).andExpect(jsonPath("$.organizacion").value(ORG_B.toString()))
			.andExpect(jsonPath("$.clientes[0]").value("Cliente B1"));
		user(SUB_B).andExpect(status().isOk()).andExpect(jsonPath("$.pid").value(pid)).andExpect(jsonPath("$.organizacion").value(ORG_B.toString()))
			.andExpect(jsonPath("$.servicio").value("")).andExpect(jsonPath("$.usuario").value(USER_B.toString()));
		assertThat(idleGuc()).containsExactly("", "", "");

		// Rollback: cada actor falla dentro de la transacción y la misma conexión queda limpia para el siguiente.
		mvc.perform(get(SERVICE_PROBE).param("fail", "1").header("X-Api-Key", KEY_SCH_A)).andExpect(status().isInternalServerError());
		assertThat(idleGuc()).containsExactly("", "", "");
		assertThat(idlePid()).isEqualTo(pid);
		mvc.perform(get(PANEL_PROBE).param("fail", "1").header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims(SUB_A.toString()).build())))
			.andExpect(status().isInternalServerError());
		assertThat(idleGuc()).containsExactly("", "", "");
		mvc.perform(get(SERVICE_PROBE).param("fail", "1").header("X-Api-Key", KEY_ING_B)).andExpect(status().isInternalServerError());
		service(KEY_ING_A).andExpect(status().isOk()).andExpect(jsonPath("$.pid").value(pid)).andExpect(jsonPath("$.organizacion").value(ORG_A.toString()))
			.andExpect(jsonPath("$.usuario").value(""));
		assertThat(idleGuc()).containsExactly("", "", "");
	}

	@Test
	void identityCannotSwitchBetweenUserAndServiceInsideOneTransaction() {
		TransactionTemplate outer = new TransactionTemplate(tm);
		assertThatThrownBy(() -> outer.executeWithoutResult(s -> {
			asUser(USER_A, ORG_A);
			context.apply();
			asService(SVC_ING_A, ORG_A, AccessRole.INGESTA);
			assertThatThrownBy(() -> context.apply()).isInstanceOf(TenantContextException.class);
			assertThatThrownBy(() -> tenant.execute(() -> 1)).isInstanceOf(TenantContextException.class);
		})).isInstanceOf(org.springframework.transaction.UnexpectedRollbackException.class);
		outer.executeWithoutResult(s -> {
			asService(SVC_ING_A, ORG_A, AccessRole.INGESTA);
			context.apply();
			asUser(USER_A, ORG_A);
			assertThatThrownBy(() -> context.apply()).isInstanceOf(TenantContextException.class);
			// Otro servicio de otra empresa tampoco.
			asService(SVC_ING_B, ORG_B, AccessRole.INGESTA);
			assertThatThrownBy(() -> context.apply()).isInstanceOf(TenantContextException.class);
			asService(SVC_ING_A, ORG_A, AccessRole.INGESTA);
			assertThat(context.requireApplied().servicioId()).isEqualTo(SVC_ING_A);
		});
		assertThat(idleGuc()).containsExactly("", "", "");
	}

	@Test
	void mixedOrInvalidServiceContextGetsNoRows() {
		// Servicio inexistente, de otra empresa o inactivo => actor nulo => nada visible.
		asService(UUID.randomUUID(), ORG_A, AccessRole.INGESTA);
		assertThat(tenant.executeReadOnly(() -> jdbc.queryForList("SELECT razon_social FROM cliente", String.class))).isEmpty();
		asService(SVC_ING_B, ORG_A, AccessRole.INGESTA);
		assertThat(tenant.executeReadOnly(() -> jdbc.queryForList("SELECT razon_social FROM cliente", String.class))).isEmpty();
		asService(SVC_OFF_A, ORG_A, AccessRole.INGESTA);
		assertThat(tenant.executeReadOnly(() -> jdbc.queryForList("SELECT razon_social FROM cliente", String.class))).isEmpty();
		// Un usuario puesto a mano además del servicio en la misma transacción anula al actor.
		asService(SVC_ING_A, ORG_A, AccessRole.INGESTA);
		tenant.executeReadOnly(() -> {
			assertThat(jdbc.queryForList("SELECT razon_social FROM cliente", String.class)).isNotEmpty();
			jdbc.queryForObject("SELECT set_config('app.usuario_id', ?, true)", String.class, USER_A.toString());
			assertThat(jdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class)).isNull();
			return null;
		});
		// Un usuario_id residual puesto antes de aplicar el servicio se limpia.
		String actor = new TransactionTemplate(tm).execute(s -> {
			jdbc.queryForObject("SELECT set_config('app.usuario_id', ?, true)", String.class, USER_A.toString());
			return tenant.execute(() -> jdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class));
		});
		assertThat(actor).isEqualTo("INGESTA");
		assertThat(idleGuc()).containsExactly("", "", "");
	}

	@Test
	void ingestaOnlyRegistersReceivedPaymentsAndNeverBecomesSchedulerOrAdmin() {
		asService(SVC_ING_A, ORG_A, AccessRole.INGESTA);
		int inserted = tenant.execute(() -> jdbc.update("INSERT INTO pago(organizacion_id,monto,fecha_pago,medio,idempotency_key) VALUES (?::uuid,50,current_date,'YAPE',?)",
				ORG_A.toString(), "ing-" + UUID.randomUUID()));
		assertThat(inserted).isEqualTo(1);
		// No puede fingir fondos verificados ni aplicar.
		assertThatThrownBy(() -> tenant.execute(() -> jdbc.update(
				"INSERT INTO pago(organizacion_id,monto,fecha_pago,medio,fase,verificado_por,verificado_en,idempotency_key) VALUES (?::uuid,60,current_date,'YAPE','VERIFICADO_BANCO',?::uuid,now(),?)",
				ORG_A.toString(), USER_A.toString(), "ing-" + UUID.randomUUID()))).isInstanceOf(DataAccessException.class)
			// La autoría de verificación (trigger V7) o RLS lo rechazan: un servicio no firma como persona.
			.rootCause().hasMessageMatching("(?s).*(row-level security|autoria).*");
		assertThat(tenant.execute(() -> jdbc.update("UPDATE pago SET banco = 'x' WHERE id = ?::uuid", PAGO_A.toString()))).isZero();
		// No escribe alertas ni en la empresa B.
		assertThatThrownBy(() -> tenant.execute(() -> jdbc.update("INSERT INTO alerta_cobranza(organizacion_id,pago_id,regla) VALUES (?::uuid,?::uuid,'PAGO_EN_REVISION')",
				ORG_A.toString(), PAGO_A.toString()))).isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("row-level security");
		assertThatThrownBy(() -> tenant.execute(() -> jdbc.update("INSERT INTO pago(organizacion_id,monto,fecha_pago,medio,idempotency_key) VALUES (?::uuid,5,current_date,'YAPE',?)",
				ORG_B.toString(), "ing-" + UUID.randomUUID()))).isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("row-level security");
		// SCHEDULER es otro actor: escribe alertas pero no registra pagos.
		asService(SVC_SCH_A, ORG_A, AccessRole.SCHEDULER);
		assertThat(tenant.execute(() -> jdbc.update("INSERT INTO alerta_cobranza(organizacion_id,pago_id,regla) VALUES (?::uuid,?::uuid,'PAGO_EN_REVISION')",
				ORG_A.toString(), PAGO_A.toString()))).isEqualTo(1);
		assertThatThrownBy(() -> tenant.execute(() -> jdbc.update("INSERT INTO pago(organizacion_id,monto,fecha_pago,medio,idempotency_key) VALUES (?::uuid,7,current_date,'YAPE',?)",
				ORG_A.toString(), "sch-" + UUID.randomUUID()))).isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("row-level security");
		assertThat(idleGuc()).containsExactly("", "", "");
	}

}
