package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.tenancy.TenantContext;
import pe.keptai.backend.tenancy.TenantContextException;
import pe.keptai.backend.tenancy.TenantTransaction;

/**
 * MIG-03-C contra PostgreSQL 17 desechable (Testcontainers, V1-V7). Todo lo probado usa un LOGIN
 * NOSUPERUSER NOBYPASSRLS no propietario que hereda keptai_runtime; el owner solo crea fixtures.
 * Pool Hikari de tamaño 1 para demostrar reutilización de la misma conexión física. FIXTURE: sin Supabase.
 */
@SpringBootTest(properties = "spring.autoconfigure.exclude=")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({ TenantContextIntegrationTests.Probe.class, TenantContextIntegrationTests.ProbeRoutes.class })
class TenantContextIntegrationTests {

	static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:17-alpine");

	static final UUID ORG_A = UUID.fromString("10000000-0000-4000-8000-0000000000a1");

	static final UUID ORG_B = UUID.fromString("10000000-0000-4000-8000-0000000000b2");

	// Identidad de PostgreSQL (usuario_id) y sub de Auth son valores distintos a propósito.
	static final UUID USER_A = UUID.fromString("c0000000-0000-4000-8000-0000000000a1");

	static final UUID SUB_A = UUID.fromString("a0000000-0000-4000-8000-0000000000a1");

	static final UUID USER_A_GER = UUID.fromString("c0000000-0000-4000-8000-0000000000a2");

	static final UUID USER_A_INACTIVO = UUID.fromString("c0000000-0000-4000-8000-0000000000a3");

	static final UUID USER_B = UUID.fromString("c0000000-0000-4000-8000-0000000000b1");

	static final UUID SUB_B = UUID.fromString("a0000000-0000-4000-8000-0000000000b1");

	static final UUID SUB_MULTI = UUID.fromString("a0000000-0000-4000-8000-0000000000c1");

	static final UUID SUB_SIN_MEMBRESIA = UUID.fromString("a0000000-0000-4000-8000-0000000000d1");

	static final UUID SERVICIO_A = UUID.fromString("d0000000-0000-4000-8000-0000000000a1");

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
					+ "('" + USER_A_GER + "','" + ORG_A + "','" + UUID.randomUUID() + "','Gerente A','GERENTE',true),"
					+ "('" + USER_A_INACTIVO + "','" + ORG_A + "','" + UUID.randomUUID() + "','Inactivo A','VENDEDOR',false),"
					+ "('" + USER_B + "','" + ORG_B + "','" + SUB_B + "','Vendedor B','VENDEDOR',true),"
					+ "('c0000000-0000-4000-8000-0000000000c1','" + ORG_A + "','" + SUB_MULTI + "','Multi A','ADMIN',true),"
					+ "('c0000000-0000-4000-8000-0000000000c2','" + ORG_B + "','" + SUB_MULTI + "','Multi B','ADMIN',true)");
			s.execute("INSERT INTO integracion_servicio(id,organizacion_id,instancia,alcance,clave_hash) VALUES ('" + SERVICIO_A + "','" + ORG_A
					+ "','n8n-test','INGESTA','" + "0".repeat(64) + "')");
			s.execute("INSERT INTO cliente(organizacion_id,razon_social,tipo) VALUES "
					+ "('" + ORG_A + "','Cliente A1','EMPRESA'),('" + ORG_A + "','Cliente A2','COLEGIO'),('" + ORG_B + "','Cliente B1','EMPRESA')");
			s.execute("CREATE ROLE keptai_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'fixture-only'");
			s.execute("GRANT keptai_runtime TO keptai_app");
		}
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

	/** Solo src/test: autoriza al usuario SINGLE exclusivamente en la ruta del probe (en producción todo no listado se deniega). */
	@org.springframework.boot.test.context.TestConfiguration
	static class ProbeRoutes {

		@org.springframework.context.annotation.Bean
		@org.springframework.context.annotation.Primary
		pe.keptai.backend.config.PanelFallbackAuthorization probeOnlyPanelRoutes() {
			return (auth, ctx) -> new org.springframework.security.authorization.AuthorizationDecision(auth.get() instanceof KeptaiAuthentication k
					&& k.access() == KeptaiAuthentication.Access.SINGLE && ctx.getRequest().getRequestURI().equals("/api/v1/test-tenant/clientes"));
		}

	}

	/** Servicio de prueba solo en src/test: lee clientes bajo contexto; /me no consulta datos del tenant. */
	@RestController
	static class Probe {

		private final TenantTransaction tenant;

		private final JdbcTemplate jdbc;

		Probe(TenantTransaction tenant, JdbcTemplate jdbc) {
			this.tenant = tenant;
			this.jdbc = jdbc;
		}

		@GetMapping("/api/v1/test-tenant/clientes")
		List<String> clientes() {
			return tenant.executeReadOnly(() -> jdbc.queryForList("SELECT razon_social FROM cliente ORDER BY 1", String.class));
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

	@Autowired
	EntityManager em;

	@AfterEach
	void clearSecurity() {
		SecurityContextHolder.clearContext();
	}

	private static void as(UUID userId, UUID orgId, AccessRole rol) {
		SecurityContextHolder.getContext().setAuthentication(auth(new Membership(userId, orgId, rol)));
	}

	private static KeptaiAuthentication auth(Membership... memberships) {
		Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject(SUB_A.toString()).build();
		return new KeptaiAuthentication(jwt, List.of(memberships));
	}

	private List<String> clientes() {
		return jdbc.queryForList("SELECT razon_social FROM cliente ORDER BY 1", String.class);
	}

	private long pid() {
		return jdbc.queryForObject("SELECT pg_backend_pid()", Long.class);
	}

	/** Estado de los tres GUC en la conexión que atiende esta llamada (nulo/'' = sin contexto). */
	private List<String> guc() {
		return jdbc.queryForObject("SELECT ARRAY[coalesce(current_setting('app.organizacion_id', true), ''), coalesce(current_setting('app.usuario_id', true), ''), "
				+ "coalesce(current_setting('app.servicio_id', true), '')]::text[]", (rs, i) -> List.of((String[]) rs.getArray(1).getArray()));
	}

	@Test
	void theApplicationLoginIsARealNonOwnerRuntimeRole() {
		assertThat(jdbc.queryForObject("SELECT current_user", String.class)).isEqualTo("keptai_app");
		assertThat(jdbc.queryForMap("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"))
			.containsEntry("rolsuper", false).containsEntry("rolbypassrls", false);
		assertThat(jdbc.queryForObject("SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'keptai.cliente'::regclass", String.class))
			.isNotEqualTo("keptai_app");
		assertThat(jdbc.queryForObject("SELECT pg_has_role('keptai_runtime', 'MEMBER')", Boolean.class)).isTrue();
	}

	@Test
	void withoutContextTheRuntimeSeesNoBusinessRows() {
		assertThat(clientes()).isEmpty();
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		// Auth presente pero sin transacción/contexto aplicado: la base no concede nada.
		assertThat(clientes()).isEmpty();
	}

	@Test
	void eachUserSeesOnlyItsOrganizationAndTheGucIsThePostgresUserNotTheAuthSub() {
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		assertThat(tenant.executeReadOnly(this::clientes)).contains("Cliente A1", "Cliente A2").allMatch(n -> n.startsWith("Cliente A"));
		assertThat(tenant.executeReadOnly(this::guc)).containsExactly(ORG_A.toString(), USER_A.toString(), "");
		assertThat(tenant.executeReadOnly(this::guc).get(1)).isNotEqualTo(SUB_A.toString());
		as(USER_B, ORG_B, AccessRole.VENDEDOR);
		assertThat(tenant.executeReadOnly(this::clientes)).containsExactly("Cliente B1");
	}

	@Test
	void legitimateWritesWorkAndCrossOrganizationWritesAreRejectedByRls() {
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		tenant.execute(() -> jdbc.update("INSERT INTO cliente(organizacion_id,razon_social,tipo) VALUES (?::uuid,'Cliente A3','PERSONA')", ORG_A.toString()));
		assertThat(tenant.executeReadOnly(this::clientes)).contains("Cliente A3");
		// A no puede escribir como organización B aunque conozca su UUID.
		assertThatThrownBy(() -> tenant.execute(() -> jdbc.update("INSERT INTO cliente(organizacion_id,razon_social,tipo) VALUES (?::uuid,'Intruso','EMPRESA')", ORG_B.toString())))
			.isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("row-level security");
		as(USER_B, ORG_B, AccessRole.VENDEDOR);
		assertThat(tenant.execute(() -> jdbc.update("UPDATE cliente SET razon_social = 'Hackeado' WHERE razon_social LIKE 'Cliente A%'"))).isZero();
		assertThat(tenant.executeReadOnly(this::clientes)).containsExactly("Cliente B1");
		// El rol lo decide PostgreSQL por la fila de usuario: un GERENTE lee pero no escribe clientes.
		as(USER_A_GER, ORG_A, AccessRole.GERENTE);
		assertThat(tenant.executeReadOnly(this::clientes)).contains("Cliente A1");
		assertThatThrownBy(() -> tenant.execute(() -> jdbc.update("INSERT INTO cliente(organizacion_id,razon_social,tipo) VALUES (?::uuid,'Gerente','EMPRESA')", ORG_A.toString())))
			.isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("row-level security");
		// Aun diciendo VENDEDOR en la membresía en memoria, la base consulta su fila real (GERENTE).
		as(USER_A_GER, ORG_A, AccessRole.VENDEDOR);
		assertThatThrownBy(() -> tenant.execute(() -> jdbc.update("INSERT INTO cliente(organizacion_id,razon_social,tipo) VALUES (?::uuid,'Gerente2','EMPRESA')", ORG_A.toString())))
			.isInstanceOf(DataAccessException.class);
	}

	@Test
	void commitAndRollbackLeaveNoContextOnTheReusedPhysicalConnection() {
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		long pid = tenant.executeReadOnly(this::pid);
		assertThat(guc()).containsExactly("", "", "");
		assertThat(pid()).isEqualTo(pid);

		// Commit.
		tenant.execute(() -> jdbc.update("UPDATE cliente SET limite_credito = 10 WHERE razon_social = 'Cliente A1'"));
		assertThat(guc()).containsExactly("", "", "");
		assertThat(clientes()).isEmpty();
		assertThat(pid()).isEqualTo(pid);

		// Rollback.
		assertThatThrownBy(() -> tenant.execute(() -> {
			jdbc.update("UPDATE cliente SET limite_credito = 20 WHERE razon_social = 'Cliente A1'");
			throw new IllegalStateException("forzar rollback");
		})).isInstanceOf(IllegalStateException.class);
		assertThat(guc()).containsExactly("", "", "");
		assertThat(pid()).isEqualTo(pid);
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		assertThat(tenant.executeReadOnly(() -> jdbc.queryForObject("SELECT limite_credito FROM cliente WHERE razon_social = 'Cliente A1'", Integer.class))).isEqualTo(10);

		// A -> sin contexto -> B sobre la misma conexión: B no hereda nada de A.
		as(USER_B, ORG_B, AccessRole.VENDEDOR);
		assertThat(tenant.executeReadOnly(() -> pid())).isEqualTo(pid);
		assertThat(tenant.executeReadOnly(this::clientes)).containsExactly("Cliente B1");
		assertThat(guc()).containsExactly("", "", "");
		// B tras rollback, luego A.
		assertThatThrownBy(() -> tenant.execute(() -> {
			assertThat(clientes()).containsExactly("Cliente B1");
			throw new IllegalStateException("rollback B");
		})).isInstanceOf(IllegalStateException.class);
		assertThat(guc()).containsExactly("", "", "");
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		assertThat(tenant.executeReadOnly(this::clientes)).doesNotContain("Cliente B1");
		assertThat(tenant.executeReadOnly(this::pid)).isEqualTo(pid);
	}

	@Test
	void anExistingTransactionIsJoinedOnTheSameConnectionAndRejectsAnotherIdentity() {
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		TransactionTemplate outer = new TransactionTemplate(tm);
		outer.executeWithoutResult(s -> {
			long outerPid = pid();
			tenant.execute(() -> {
				assertThat(pid()).isEqualTo(outerPid);
				assertThat(clientes()).contains("Cliente A1", "Cliente A2").allMatch(n -> n.startsWith("Cliente A"));
				return null;
			});
			// Reaplicar la misma identidad es idempotente en la misma transacción.
			assertThat(context.apply().usuarioId()).isEqualTo(USER_A);
			assertThat(context.requireApplied().organizacionId()).isEqualTo(ORG_A);
		});
		// Otra identidad en una transacción ya vinculada se rechaza; la transacción queda rollback-only
		// (REQUIRED unida) y no se confirma nada con identidades mezcladas.
		assertThatThrownBy(() -> outer.executeWithoutResult(s -> {
			tenant.execute(() -> clientes());
			as(USER_B, ORG_B, AccessRole.VENDEDOR);
			assertThatThrownBy(() -> tenant.execute(() -> clientes())).isInstanceOf(TenantContextException.class);
			assertThatThrownBy(() -> context.apply()).isInstanceOf(TenantContextException.class);
		})).isInstanceOf(org.springframework.transaction.UnexpectedRollbackException.class);
		assertThat(guc()).containsExactly("", "", "");
	}

	@Test
	void jpaEntityManagerSharesTheTransactionConnectionAndTheContext() {
		as(USER_B, ORG_B, AccessRole.VENDEDOR);
		tenant.executeReadOnly(() -> {
			long jdbcPid = pid();
			assertThat(((Number) em.createNativeQuery("SELECT pg_backend_pid()").getSingleResult()).longValue()).isEqualTo(jdbcPid);
			assertThat(em.createNativeQuery("SELECT razon_social FROM cliente").getResultList()).containsExactly("Cliente B1");
			return null;
		});
	}

	@Test
	void withoutARealTransactionOrAnAuthenticatedPanelUserItFailsClosed() {
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		assertThatThrownBy(() -> context.apply()).isInstanceOf(TenantContextException.class).hasMessageContaining("transacción");
		assertThatThrownBy(() -> context.requireApplied()).isInstanceOf(TenantContextException.class);
		assertThat(guc()).containsExactly("", "", "");

		SecurityContextHolder.clearContext();
		assertThatThrownBy(() -> tenant.execute(() -> clientes())).isInstanceOf(TenantContextException.class);
		SecurityContextHolder.getContext().setAuthentication(auth()); // NONE
		assertThatThrownBy(() -> tenant.execute(() -> clientes())).isInstanceOf(TenantContextException.class);
		SecurityContextHolder.getContext().setAuthentication(auth(new Membership(USER_A, ORG_A, AccessRole.VENDEDOR), new Membership(USER_B, ORG_B, AccessRole.VENDEDOR))); // MULTIPLE
		assertThatThrownBy(() -> tenant.execute(() -> clientes())).isInstanceOf(TenantContextException.class);
		as(USER_A, ORG_A, AccessRole.INGESTA); // un servicio no es identidad de panel
		assertThatThrownBy(() -> tenant.execute(() -> clientes())).isInstanceOf(TenantContextException.class);
		assertThatThrownBy(() -> tenant.execute(() -> clientes())).isInstanceOf(TenantContextException.class);
		assertThat(guc()).containsExactly("", "", "");
	}

	@Test
	void unknownInactiveCrossOrganizationOrMixedActorsGetNoRows() {
		as(UUID.randomUUID(), ORG_A, AccessRole.VENDEDOR); // usuario inexistente
		assertThat(tenant.executeReadOnly(this::clientes)).isEmpty();
		as(USER_A_INACTIVO, ORG_A, AccessRole.VENDEDOR); // inactivo
		assertThat(tenant.executeReadOnly(this::clientes)).isEmpty();
		as(USER_B, ORG_A, AccessRole.VENDEDOR); // usuario de B con organización A
		assertThat(tenant.executeReadOnly(this::clientes)).isEmpty();

		// Contexto mixto: tras aplicar el usuario, alguien fija también un servicio => actor nulo, sin acceso.
		as(USER_A, ORG_A, AccessRole.VENDEDOR);
		tenant.executeReadOnly(() -> {
			assertThat(clientes()).isNotEmpty();
			jdbc.queryForObject("SELECT set_config('app.servicio_id', ?, true)", String.class, SERVICIO_A.toString());
			assertThat(clientes()).isEmpty();
			return null;
		});
		// Un servicio_id residual puesto antes de aplicar se limpia: el usuario sigue siendo el actor.
		tenant.execute(() -> {
			assertThat(guc().get(2)).isEmpty();
			return jdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class);
		});
		TransactionTemplate outer = new TransactionTemplate(tm);
		String actor = outer.execute(s -> {
			jdbc.queryForObject("SELECT set_config('app.servicio_id', ?, true)", String.class, SERVICIO_A.toString());
			return tenant.execute(() -> jdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class));
		});
		assertThat(actor).isEqualTo("VENDEDOR");
	}

	@Test
	void jwtToMembershipToTransactionalServiceToRls() throws Exception {
		mvc.perform(get("/api/v1/test-tenant/clientes").header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims(SUB_A.toString()).build())))
			.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
			.andExpect(jsonPath("$", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("Cliente B1"))));
		// Organización, rol y usuario enviados por el cliente (cabecera, query, claims) no cambian el actor.
		String forged = JwtTestSupport.rs256(JwtTestSupport.claims(SUB_A.toString())
			.claim("organization_id", ORG_B.toString()).claim("role", "ADMIN").claim("usuario_id", USER_B.toString()).build());
		mvc.perform(get("/api/v1/test-tenant/clientes").param("organizacion_id", ORG_B.toString()).param("usuario_id", USER_B.toString())
				.header("X-Organization-Id", ORG_B.toString()).header("Authorization", "Bearer " + forged))
			.andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("Cliente B1"))));
		mvc.perform(get("/api/v1/test-tenant/clientes").header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims(SUB_B.toString()).build())))
			.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0]").value("Cliente B1"));
		// Sin membresía 403; con varias 409 y sin ninguna consulta de negocio; sin token 401.
		mvc.perform(get("/api/v1/test-tenant/clientes").header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims(SUB_SIN_MEMBRESIA.toString()).build())))
			.andExpect(status().isForbidden());
		mvc.perform(get("/api/v1/test-tenant/clientes").header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims(SUB_MULTI.toString()).build())))
			.andExpect(status().isConflict());
		mvc.perform(get("/api/v1/test-tenant/clientes")).andExpect(status().isUnauthorized());
		// La conexión del pool de tamaño 1 queda limpia tras las peticiones.
		assertThat(guc()).containsExactly("", "", "");
	}

}
