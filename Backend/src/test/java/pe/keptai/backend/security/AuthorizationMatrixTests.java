/**
 * AuthorizationMatrixTests.java
 * Versión: 2.1 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.InputStream;
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
import org.yaml.snakeyaml.Yaml;

/**
 * Prueba completa de la matriz de autorización (§6.4) con MockMvc y Spring Security activo: cada operación de
 * {@code openapi.yaml} se prueba como anónimo, con cada rol de usuario y con cada alcance de servicio.
 * Actualizado para alineación con las 71 reglas del contrato (Fases 1-3 + Defecto 1 + B-05 + Rol DISENO).
 * Versión: 2.1 | Fecha: 2026-10-19 | Autora: Isabelita
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AuthorizationMatrixTests {

	private static final Set<String> CLOSED = Set.of("createTextEvidence", "startExtraction", "getExtractionJob", "n8nConfirmOrder", "n8nReportMessageStatus");

	private static final Map<String, AccessRole> SERVICE_SCOPE = Map.of(
		"n8nIngestOrder", AccessRole.INGESTA,
		"n8nReceiveVoucher", AccessRole.INGESTA
	);

	@Autowired
	private MockMvc mvc;

	private record Op(String id, String method, String path, Set<String> roles) {
	}

	@SuppressWarnings("unchecked")
	private static List<Op> operations() {
		try (InputStream in = Files.newInputStream(Path.of("docs/openapi.yaml"))) {
			Map<String, Object> spec = new Yaml().load(in);
			List<Op> out = new ArrayList<>();
			((Map<String, Map<String, Object>>) spec.get("paths")).forEach((path, item) -> item.forEach((method, o) -> {
				if (o instanceof Map<?, ?> op && op.containsKey("operationId")) {
					out.add(new Op((String) op.get("operationId"), method.toUpperCase(), path, Set.copyOf((List<String>) op.get("x-keptai-proposed-roles"))));
				}
			}));
			return out;
		}
		catch (Exception e) {
			throw new RuntimeException(e);
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
		assertThat(ops).hasSize(AccessPolicy.RULES.size());
		int checks = 0;
		for (Op op : ops) {
			String path = concrete(op.path());
			boolean serviceOp = op.roles().equals(Set.of("service_n8n"));
			boolean closed = CLOSED.contains(op.id());
			// Sin credencial: siempre 401.
			assertThat(statusOf(op.method(), path, null)).as(op.id() + " anónimo").isEqualTo(401);
			for (AccessRole role : AccessRole.userRoles()) {
				int expected = !serviceOp && !closed && op.roles().contains(role.name()) ? (op.id().equals("getMyContext") ? 200 : (op.method().equals("GET") ? (op.id().equals("getMarginReport") ? 400 : 503) : (op.id().equals("uploadEvidenceFile") ? 415 : (op.id().equals("markPaymentDuplicate") || op.id().equals("approveRequisition")) ? 503 : 400))) : 403;
				assertThat(statusOf(op.method(), path, user(role))).as(op.id() + " como " + role).isEqualTo(expected);
				checks++;
			}
			for (AccessRole scope : List.of(AccessRole.INGESTA, AccessRole.SCHEDULER)) {
				int expected = serviceOp && !closed && SERVICE_SCOPE.get(op.id()) == scope ? 400 : 403; // ingesta y voucher: autorizadas e implementadas (cuerpo vacío = 400)
				assertThat(statusOf(op.method(), path, service(scope))).as(op.id() + " como servicio " + scope).isEqualTo(expected);
				checks++;
			}
		}
		assertThat(checks).isEqualTo(ops.size() * (AccessRole.userRoles().size() + 2));
	}

	@Test
	void userWithoutTenantMembershipIsDeniedEvenWithValidJwt() throws Exception {
		// Simula usuario autenticado en Supabase sin fila en miembro_organizacion:
		// getMyContext responde 403 sin revelar datos.
		assertThat(statusOf("GET", "/api/v1/me", user(List.of()))).isEqualTo(403);
	}

	@Test
	void n8nEndpointsRejectUserJwt() throws Exception {
		// La ingesta solo acepta X-Api-Key; un JWT de usuario (incluso ADMIN) debe ser rechazado.
		assertThat(statusOf("POST", "/api/v1/ordenes/ingesta", user(AccessRole.ADMIN))).isEqualTo(403);
		assertThat(statusOf("POST", "/api/v1/pagos/voucher", user(AccessRole.ADMIN))).isEqualTo(403);
	}

	@Test
	void panelEndpointsRejectServiceApiKey() throws Exception {
		// Una API key de n8n no puede operar el panel administrativo.
		assertThat(statusOf("GET", "/api/v1/drafts", service(AccessRole.INGESTA))).isEqualTo(403);
		assertThat(statusOf("POST", "/api/v1/drafts/" + UUID.randomUUID() + "/confirmation", service(AccessRole.INGESTA))).isEqualTo(403);
	}

	@Test
	void closedEndpointsAreRejectedForAllCallers() throws Exception {
		for (String opId : CLOSED) {
			Op op = operations().stream().filter(o -> o.id().equals(opId)).findFirst().orElseThrow();
			String path = concrete(op.path());
			for (AccessRole role : AccessRole.userRoles()) {
				assertThat(statusOf(op.method(), path, user(role))).as(opId + " cerrado para " + role).isEqualTo(403);
			}
			for (AccessRole scope : List.of(AccessRole.INGESTA, AccessRole.SCHEDULER)) {
				assertThat(statusOf(op.method(), path, service(scope))).as(opId + " cerrado para " + scope).isEqualTo(403);
			}
		}
	}

	@Test
	void forbiddenResponseReturnsStandardStructure() throws Exception {
		mvc.perform(request(HttpMethod.GET, "/api/v1/drafts")
				.contentType("application/json")
				.with(authentication(user(AccessRole.VENDEDOR))))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"))
				.andExpect(jsonPath("$.message").value("Acceso denegado"))
				.andExpect(jsonPath("$.request_id").isNotEmpty());
	}

}
