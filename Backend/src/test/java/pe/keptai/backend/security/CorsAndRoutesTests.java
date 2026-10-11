package pe.keptai.backend.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** MIG-03-A: CORS acotado al frontend local sin abrir rutas ni aceptar credenciales de servicio. */
@SpringBootTest(properties = "keptai.security.cors.allowed-origins=http://localhost:5173")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CorsAndRoutesTests {

	@Autowired
	MockMvc mvc;

	@Test
	void preflightFromConfiguredOriginIsAllowedWithBearerAndIdempotencyHeaders() throws Exception {
		mvc.perform(options("/api/v1/drafts").header("Origin", "http://localhost:5173")
				.header("Access-Control-Request-Method", "POST")
				.header("Access-Control-Request-Headers", "authorization,idempotency-key,content-type"))
			.andExpect(status().isOk())
			.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
			.andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
	}

	@Test
	void preflightFromOtherOriginOrWithServiceKeyHeaderIsRejected() throws Exception {
		mvc.perform(options("/api/v1/drafts").header("Origin", "https://otro.example.invalid")
				.header("Access-Control-Request-Method", "POST"))
			.andExpect(status().isForbidden());
		mvc.perform(options("/api/v1/drafts").header("Origin", "http://localhost:5173")
				.header("Access-Control-Request-Method", "POST")
				.header("Access-Control-Request-Headers", "x-api-key"))
			.andExpect(status().isForbidden());
	}

	@Test
	void corsDoesNotOpenProtectedRoutes() throws Exception {
		mvc.perform(get("/api/v1/drafts").header("Origin", "http://localhost:5173"))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/ordenes/ingesta").header("X-Api-Key", "cualquiera"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void healthStaysPublicAndUnknownActuatorEndpointsAreNot() throws Exception {
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
	}

}
