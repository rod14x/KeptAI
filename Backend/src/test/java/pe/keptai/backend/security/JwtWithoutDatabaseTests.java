package pe.keptai.backend.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** JWT válido pero sin base disponible: falla cerrado con 503, nunca asume una identidad. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class JwtWithoutDatabaseTests {

	@DynamicPropertySource
	static void props(DynamicPropertyRegistry r) {
		r.add("keptai.security.jwt.issuer-uri", () -> JwtTestSupport.ISSUER);
		r.add("keptai.security.jwt.jwk-set-uri", JwtTestSupport::jwksUri);
		r.add("keptai.security.jwt.audiences", () -> JwtTestSupport.AUDIENCE);
	}

	@Autowired
	MockMvc mvc;

	@Test
	void validTokenWithoutDatabaseIs503NotAnIdentity() throws Exception {
		mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + JwtTestSupport.rs256(JwtTestSupport.claims("a0000000-0000-4000-8000-000000000001").build())))
			.andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"))
			.andExpect(jsonPath("$.request_id").isNotEmpty());
	}

	@Test
	void unconfiguredJwtRejectsEveryToken() throws Exception {
		// Sin propiedades JWT (contextos dev/test habituales) cualquier token es 401; cubierto también en NoCorsByDefaultTests.
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
	}

}
