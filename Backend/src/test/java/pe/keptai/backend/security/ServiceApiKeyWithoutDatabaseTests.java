package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** MIG-03-D1 sin base: clave bien formada => 503 sin identidad; clave mal formada => 401 sin consultar nada. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ServiceApiKeyWithoutDatabaseTests {

	@Autowired
	MockMvc mvc;

	@Test
	void wellFormedKeyWithoutDatabaseIs503NotAnIdentity() throws Exception {
		mvc.perform(post("/api/v1/ordenes/ingesta").header("X-Api-Key", "a".repeat(64)).contentType("application/json").content("{}"))
			.andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"))
			.andExpect(jsonPath("$.request_id").isNotEmpty());
	}

	@Test
	void accessTokenParameterAndApiKeyAreRejectedAsAmbiguous() throws Exception {
		mvc.perform(post("/api/v1/ordenes/ingesta").header("X-Api-Key", "a".repeat(64))
				.param("access_token", "fixture-only").contentType("application/json").content("{}"))
			.andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
	}

	@Test
	void malformedKeyIs401WithoutTouchingTheDatabase() throws Exception {
		mvc.perform(post("/api/v1/ordenes/ingesta").header("X-Api-Key", "corta").contentType("application/json").content("{}"))
			.andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
	}

	@Test
	void hashIsSha256HexOfTheExactKey() {
		assertThat(ApiKeyAuthenticationFilter.sha256("abc")).isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
		assertThat(ApiKeyAuthenticationFilter.sha256("a".repeat(64))).hasSize(64).matches("[0-9a-f]{64}");
		assertThat(ApiKeyAuthenticationFilter.sha256("clave ")).isNotEqualTo(ApiKeyAuthenticationFilter.sha256("clave"));
	}

	@Test
	void keyFormatRejectsShortLongAndNonVisibleCharacters() {
		assertThat(ApiKeyAuthenticationFilter.wellFormed("a".repeat(31))).isFalse();
		assertThat(ApiKeyAuthenticationFilter.wellFormed("a".repeat(32))).isTrue();
		assertThat(ApiKeyAuthenticationFilter.wellFormed("a".repeat(128))).isTrue();
		assertThat(ApiKeyAuthenticationFilter.wellFormed("a".repeat(129))).isFalse();
		assertThat(ApiKeyAuthenticationFilter.wellFormed("a".repeat(31) + " ")).isFalse();
		assertThat(ApiKeyAuthenticationFilter.wellFormed("a".repeat(31) + "ñ")).isFalse();
	}

	@Test
	void principalsNeverExposeKeyHashOrIdentifiers() {
		ServiceIdentity id = new ServiceIdentity(java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), "n8n-secreta", AccessRole.INGESTA);
		ServiceAuthentication auth = new ServiceAuthentication(id);
		assertThat(auth.toString()).doesNotContain(id.servicioId().toString()).doesNotContain("n8n-secreta");
		assertThat(id.toString()).doesNotContain(id.organizacionId().toString()).doesNotContain("n8n-secreta");
		assertThat(auth.getCredentials()).isEqualTo("");
		assertThat(auth).isNotInstanceOf(KeptaiAuthentication.class);
	}

}
