package pe.keptai.backend.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Sin orígenes configurados (dev/test/prod por defecto) el navegador no recibe permisos CORS (sin Access-Control-Allow-*). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NoCorsByDefaultTests {

	@Autowired
	MockMvc mvc;

	@Test
	void noCorsHeadersAreEmittedWithoutConfiguration() throws Exception {
		mvc.perform(options("/api/v1/drafts").header("Origin", "http://localhost:5173")
				.header("Access-Control-Request-Method", "GET"))
			.andExpect(header().doesNotExist("Access-Control-Allow-Origin"))
			.andExpect(header().doesNotExist("Access-Control-Allow-Methods"));
	}

}
