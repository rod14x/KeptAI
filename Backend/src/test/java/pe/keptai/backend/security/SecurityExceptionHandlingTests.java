package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.authorization.AuthorizationResult;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * MIG-03-D2: excepciones de seguridad lanzadas desde un controlador/servicio protegido. Controladores de prueba
 * (solo src/test) sobre rutas ya autorizadas por la política; el resultado debe ser uniforme y sin fugas.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(SecurityExceptionHandlingTests.Probe.class)
@ExtendWith(OutputCaptureExtension.class)
class SecurityExceptionHandlingTests {

	static final String SECRET = "password=hunter2 SELECT * FROM keptai.usuario";

	@RestController
	static class Probe {

		@GetMapping("/api/v1/drafts/{draft_id}")
		String order(@PathVariable("draft_id") String id, @RequestParam String mode) {
			return throwFor(mode);
		}

		@PostMapping("/api/v1/pagos/voucher")
		String ingest(@RequestParam String mode) {
			return throwFor(mode);
		}

		private static String throwFor(String mode) {
			switch (mode) {
				case "denied":
					throw new AccessDeniedException(SECRET);
				case "authz-denied":
					throw new AuthorizationDeniedException(SECRET, (AuthorizationResult) () -> false);
				case "unauthenticated":
					throw new BadCredentialsException(SECRET);
				case "infra":
					throw new AuthenticationServiceException(SECRET, new IllegalStateException(SECRET));
				case "sql":
					throw new DataIntegrityViolationException(SECRET, new IllegalStateException(SECRET));
				case "unexpected":
					throw new IllegalStateException(SECRET);
				default:
					return "ok";
			}
		}

	}

	@Autowired
	MockMvc mvc;

	private static Authentication vendedor() {
		Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject(UUID.randomUUID().toString()).build();
		return new KeptaiAuthentication(jwt, List.of(new Membership(UUID.randomUUID(), UUID.randomUUID(), AccessRole.VENDEDOR)));
	}

	private static Authentication ingesta() {
		return new ServiceAuthentication(new ServiceIdentity(UUID.randomUUID(), UUID.randomUUID(), "n8n", AccessRole.INGESTA));
	}

	private MvcResult panel(String mode, int expected, String code) throws Exception {
		MvcResult r = mvc.perform(get("/api/v1/drafts/" + UUID.randomUUID()).param("mode", mode).with(authentication(vendedor())))
			.andExpect(status().is(expected)).andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.request_id").isNotEmpty())
			.andExpect(header().exists("X-Request-Id")).andReturn();
		String body = r.getResponse().getContentAsString();
		assertThat(body).doesNotContain("hunter2").doesNotContain("SELECT").doesNotContain("keptai.usuario").doesNotContain("Exception").doesNotContain("trace");
		assertThat(body).contains(r.getResponse().getHeader("X-Request-Id"));
		return r;
	}

	@Test
	void theProbeAnswersNormallyWhenNothingIsThrown() throws Exception {
		mvc.perform(get("/api/v1/drafts/" + UUID.randomUUID()).param("mode", "ok").with(authentication(vendedor()))).andExpect(status().isOk());
	}

	@Test
	void accessDeniedFromTheControllerIs403() throws Exception {
		panel("denied", 403, "FORBIDDEN");
		panel("authz-denied", 403, "FORBIDDEN");
	}

	@Test
	void authenticationFailureFromTheControllerIs401WithChallenge() throws Exception {
		MvcResult r = panel("unauthenticated", 401, "UNAUTHORIZED");
		assertThat(r.getResponse().getHeader("WWW-Authenticate")).isEqualTo("Bearer");
	}

	@Test
	void infrastructureFailureFromTheControllerIs503NotAnAuthenticationError() throws Exception {
		panel("infra", 503, "SERVICE_UNAVAILABLE");
	}

	@Test
	void genericAndDatabaseErrorsAre500WithoutLeakingMessagesOrSql() throws Exception {
		panel("unexpected", 500, "INTERNAL_SERVER_ERROR");
		panel("sql", 500, "INTERNAL_SERVER_ERROR");
	}

	@Test
	void unexpectedFailuresDoNotWriteExceptionMessagesOrCausesToLogs(CapturedOutput output) throws Exception {
		panel("unexpected", 500, "INTERNAL_SERVER_ERROR");
		panel("sql", 500, "INTERNAL_SERVER_ERROR");
		panel("infra", 503, "SERVICE_UNAVAILABLE");
		assertThat(output.getAll()).contains("Error no controlado: IllegalStateException")
			.contains("Error no controlado: DataIntegrityViolationException")
			.doesNotContain(SECRET).doesNotContain("hunter2").doesNotContain("SELECT *");
	}

	@Test
	void sameUniformErrorsApplyToAnAuthenticatedServiceOnItsOwnRoute() throws Exception {
		for (Object[] c : new Object[][] { { "denied", 403, "FORBIDDEN" }, { "unauthenticated", 401, "UNAUTHORIZED" }, { "infra", 503, "SERVICE_UNAVAILABLE" } }) {
			MvcResult r = mvc.perform(post("/api/v1/pagos/voucher").param("mode", (String) c[0]).with(authentication(ingesta())))
				.andExpect(status().is((Integer) c[1])).andExpect(jsonPath("$.code").value((String) c[2])).andExpect(jsonPath("$.request_id").isNotEmpty()).andReturn();
			assertThat(r.getResponse().getContentAsString()).doesNotContain("hunter2").doesNotContain("SELECT");
		}
	}

	@Test
	void theRouteGateStillRunsBeforeTheControllerSoItNeverThrowsForUnauthorizedActors() throws Exception {
		// JEFE_TALLER ve órdenes; GERENTE de pagos no ve esta ruta; un servicio no entra al panel: 403 sin ejecutar el probe.
		mvc.perform(get("/api/v1/drafts/" + UUID.randomUUID()).param("mode", "unexpected").with(authentication(ingesta()))).andExpect(status().isForbidden());
		mvc.perform(post("/api/v1/pagos/voucher").param("mode", "unexpected").with(authentication(vendedor()))).andExpect(status().isForbidden());
		mvc.perform(get("/api/v1/drafts/" + UUID.randomUUID()).param("mode", "unexpected")).andExpect(status().isUnauthorized());
	}

}
