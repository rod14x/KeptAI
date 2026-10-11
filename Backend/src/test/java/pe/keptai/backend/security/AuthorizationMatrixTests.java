package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

/**
 * MIG-03-D2: matriz completa operación x actor contra la cadena de seguridad real (sin base de datos: la
 * autenticación se inyecta ya resuelta). El oráculo se lee del OpenAPI, no de {@link AccessPolicy}.
 * Autorizar una ruta sin controlador responde 404: el permiso no implementa la funcionalidad.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthorizationMatrixTests {

	/** Operaciones cuya regla está cerrada por decisiones pendientes (matriz 5.3/5.4/5.5 y D-007). */
	static final Set<String> CLOSED = Set.of("createTextEvidence", "startExtraction", "getExtractionJob", "n8nConfirmOrder", "n8nReportMessageStatus");

	/** Servicios que el contrato permite en cada operación abierta de n8n. */
	static final Map<String, AccessRole> SERVICE_SCOPE = Map.of("n8nIngestOrder", AccessRole.INGESTA, "n8nReceiveVoucher", AccessRole.INGESTA);

	record Op(String id, String method, String path, Set<String> roles) {
	}

	@Autowired
	MockMvc mvc;

	@SuppressWarnings("unchecked")
	static List<Op> operations() throws IOException {
		try (Reader reader = Files.newBufferedReader(Path.of("docs", "openapi.yaml"), StandardCharsets.UTF_8)) {
			Map<String, Object> spec = new Yaml(new SafeConstructor(new LoaderOptions())).load(reader);
			List<Op> out = new ArrayList<>();
			((Map<String, Map<String, Object>>) spec.get("paths")).forEach((path, item) -> item.forEach((method, o) -> {
				if (o instanceof Map<?, ?> op && op.containsKey("operationId")) {
					out.add(new Op((String) op.get("operationId"), method.toUpperCase(), path, Set.copyOf((List<String>) op.get("x-keptai-proposed-roles"))));
				}
			}));
			return out;
		}
	}

	static String concrete(String template) {
		return template.replaceAll("\\{[^}]+}", UUID.randomUUID().toString());
	}

	static Authentication user(AccessRole role) {
		return user(List.of(new Membership(UUID.randomUUID(), UUID.randomUUID(), role)));
	}

	static Authentication user(List<Membership> memberships) {
		Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject(UUID.randomUUID().toString()).build();
		return new KeptaiAuthentication(jwt, memberships);
	}

	static Authentication service(AccessRole scope) {
		return new ServiceAuthentication(new ServiceIdentity(UUID.randomUUID(), UUID.randomUUID(), "n8n-test", scope));
	}

	private int statusOf(String method, String path, Authentication auth) throws Exception {
		var req = request(HttpMethod.valueOf(method), path).contentType("application/json");
		if (auth != null) {
			req = req.with(authentication(auth));
		}
		MvcResult r = mvc.perform(req).andReturn();
		return r.getResponse().getStatus();
	}

	@Test
	void everyOperationIsAuthorizedOnlyForItsDeclaredActors() throws Exception {
		List<Op> ops = operations();
		// 37 de MIG-02 + 3 de INT-FE-API-002 (resolución de alertas, duplicado y bitácora de envíos).
		assertThat(ops).hasSize(40);
		int checks = 0;
		for (Op op : ops) {
			String path = concrete(op.path());
			boolean serviceOp = op.roles().equals(Set.of("service_n8n"));
			boolean closed = CLOSED.contains(op.id());
			// Sin credencial: siempre 401.
			assertThat(statusOf(op.method(), path, null)).as(op.id() + " anónimo").isEqualTo(401);
			for (AccessRole role : AccessRole.userRoles()) {
				int expected = !serviceOp && !closed && op.roles().contains(role.name()) ? (op.id().equals("getMyContext") ? 200 : (op.method().equals("GET") ? (op.id().equals("getMarginReport") ? 400 : 503) : (op.id().equals("uploadEvidenceFile") ? 415 : op.id().equals("markPaymentDuplicate") ? 503 : 400))) : 403;
				assertThat(statusOf(op.method(), path, user(role))).as(op.id() + " como " + role).isEqualTo(expected);
				checks++;
			}
			for (AccessRole scope : List.of(AccessRole.INGESTA, AccessRole.SCHEDULER)) {
				int expected = serviceOp && !closed && SERVICE_SCOPE.get(op.id()) == scope ? 400 : 403; // ingesta y voucher: autorizadas e implementadas (cuerpo vacío = 400)
				assertThat(statusOf(op.method(), path, service(scope))).as(op.id() + " como servicio " + scope).isEqualTo(expected);
				checks++;
			}
		}
		assertThat(checks).isEqualTo(40 * 6);
	}

	@Test
	void authorizedRoutesWithoutDatabaseFailClosedAndDoNotReturnMockSuccess() throws Exception {
		MvcResult denied = mvc.perform(request(HttpMethod.GET, "/api/v1/results/summary").with(authentication(user(AccessRole.VENDEDOR)))).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN")).andExpect(jsonPath("$.request_id").isNotEmpty()).andReturn();
		assertThat(denied.getResponse().getHeader("X-Request-Id")).isNotBlank();
		mvc.perform(request(HttpMethod.GET, "/api/v1/results/summary").with(authentication(user(AccessRole.GERENTE)))).andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE")).andExpect(jsonPath("$.request_id").isNotEmpty());
	}

	@Test
	void meIsOnlyForPanelUsersWithASingleMembershipAndReturnsTheResolvedIdentity() throws Exception {
		for (AccessRole role : AccessRole.userRoles()) {
			Membership m = new Membership(UUID.randomUUID(), UUID.randomUUID(), role);
			mvc.perform(request(HttpMethod.GET, "/api/v1/me").with(authentication(user(List.of(m))))).andExpect(status().isOk())
				.andExpect(jsonPath("$.user_id").value(m.usuarioId().toString())).andExpect(jsonPath("$.organization_id").value(m.organizacionId().toString()))
				.andExpect(jsonPath("$.role").value(role.name()));
		}
		for (AccessRole scope : List.of(AccessRole.INGESTA, AccessRole.SCHEDULER)) {
			mvc.perform(request(HttpMethod.GET, "/api/v1/me").with(authentication(service(scope)))).andExpect(status().isForbidden());
		}
		// Sin membresía 403; varias membresías 409 sin elegir ninguna; anónimo 401.
		mvc.perform(request(HttpMethod.GET, "/api/v1/me").with(authentication(user(List.of())))).andExpect(status().isForbidden());
		mvc.perform(request(HttpMethod.GET, "/api/v1/me").with(authentication(user(List.of(new Membership(UUID.randomUUID(), UUID.randomUUID(), AccessRole.ADMIN),
				new Membership(UUID.randomUUID(), UUID.randomUUID(), AccessRole.GERENTE)))))).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ORGANIZATION_SELECTION_REQUIRED"));
		mvc.perform(request(HttpMethod.GET, "/api/v1/me")).andExpect(status().isUnauthorized());
		mvc.perform(request(HttpMethod.GET, "/actuator/health")).andExpect(status().isOk());
	}

	@Test
	void multipleMembershipsGetTheSelectionSignalOnPanelRoutesAndForbiddenOnServiceRoutes() throws Exception {
		Authentication multi = user(List.of(new Membership(UUID.randomUUID(), UUID.randomUUID(), AccessRole.ADMIN),
				new Membership(UUID.randomUUID(), UUID.randomUUID(), AccessRole.GERENTE)));
		mvc.perform(request(HttpMethod.GET, "/api/v1/orders").with(authentication(multi))).andExpect(status().isConflict());
		mvc.perform(request(HttpMethod.POST, "/api/v1/ordenes/ingesta").with(authentication(multi))).andExpect(status().isForbidden());
	}

	@Test
	void wrongMethodsAndUnknownRoutesAreDeniedByDefault() throws Exception {
		List<Op> ops = operations();
		List<String> methods = List.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");
		int checked = 0;
		for (Op op : ops) {
			String path = concrete(op.path());
			for (String method : methods) {
				// Se omiten métodos que el contrato declara para una ruta cuyo patrón también encaja con el valor concreto
				// (p. ej. GET /evidences/text encaja con GET /evidences/{evidence_id}).
				boolean declared = ops.stream().anyMatch(o -> o.method().equals(method) && path.matches(o.path().replaceAll("\\{[^}]+}", "[^/]+")));
				if (declared) {
					continue;
				}
				assertThat(statusOf(method, path, null)).as(method + " " + op.path() + " anónimo").isEqualTo(401);
				assertThat(statusOf(method, path, user(AccessRole.ADMIN))).as(method + " " + op.path() + " ADMIN").isEqualTo(403);
				assertThat(statusOf(method, path, user(AccessRole.GERENTE))).as(method + " " + op.path() + " GERENTE").isEqualTo(403);
				assertThat(statusOf(method, path, service(AccessRole.INGESTA))).as(method + " " + op.path() + " INGESTA").isEqualTo(403);
				checked++;
			}
		}
		assertThat(checked).isGreaterThan(150);
		String id = UUID.randomUUID().toString();
		for (String unknown : new String[] { "/api/v1/me/", "/api/v1/ME", "/api/v1/me/extra", "/api/v1/orders/" + id + "/otra", "/api/v1/otra", "/api/v1", "/api/v1/",
				"/api/v2/me", "/api/v1/payments/" + id + "/applications/" + id, "/api/v1/ordenes", "/api/v1/ordenes/ingesta/", "/api/v1/ordenes/otra", "/api/v1/pagos/otra",
				"/api/v1/mensajes/" + id, "/", "/error", "/actuator", "/actuator/info", "/actuator/env", "/actuator/healthz", "/v3/api-docs", "/swagger-ui.html", "/internal/x" }) {
			assertThat(statusOf("GET", unknown, null)).as(unknown + " anónimo").isEqualTo(401);
			for (Authentication a : List.of(user(AccessRole.ADMIN), user(AccessRole.GERENTE), service(AccessRole.INGESTA), service(AccessRole.SCHEDULER))) {
				assertThat(statusOf("GET", unknown, a)).as(unknown + " autenticado").isEqualTo(403);
			}
		}
	}

	@Test
	void panelAndServiceCredentialsDoNotCrossAtTheAuthorizationLayer() throws Exception {
		// Defensa en profundidad: aunque llegue una autenticación del otro tipo, la regla la rechaza.
		for (AccessRole role : AccessRole.userRoles()) {
			assertThat(statusOf("POST", "/api/v1/ordenes/ingesta", user(role))).isEqualTo(403);
			assertThat(statusOf("POST", "/api/v1/pagos/voucher", user(role))).isEqualTo(403);
		}
		for (AccessRole scope : List.of(AccessRole.INGESTA, AccessRole.SCHEDULER)) {
			assertThat(statusOf("GET", "/api/v1/orders", service(scope))).isEqualTo(403);
			assertThat(statusOf("GET", "/api/v1/payments", service(scope))).isEqualTo(403);
			assertThat(statusOf("POST", "/api/v1/orders/" + UUID.randomUUID() + "/credit-decision", service(scope))).isEqualTo(403);
			assertThat(statusOf("GET", "/api/v1/me", service(scope))).isEqualTo(403);
		}
		// INGESTA y SCHEDULER no son intercambiables; crédito exige ADMIN (D-014).
		assertThat(statusOf("POST", "/api/v1/ordenes/ingesta", service(AccessRole.SCHEDULER))).isEqualTo(403);
		assertThat(statusOf("POST", "/api/v1/orders/" + UUID.randomUUID() + "/credit-decision", user(AccessRole.ADMIN))).isEqualTo(400);
		assertThat(statusOf("POST", "/api/v1/orders/" + UUID.randomUUID() + "/credit-decision", user(AccessRole.VENDEDOR))).isEqualTo(403);
		// El webhook saliente de n8n no es una ruta de Spring.
		assertThat(statusOf("POST", "/webhook/enviar-mensaje", user(AccessRole.ADMIN))).isEqualTo(403);
	}

}
