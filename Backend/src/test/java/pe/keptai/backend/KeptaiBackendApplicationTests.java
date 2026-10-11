package pe.keptai.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class KeptaiBackendApplicationTests {

	@Autowired
	MockMvc mvc;

	@Test
	void contextLoads() {
	}

	@Test
	void healthIsUpWithoutDetails() throws Exception {
		mvc.perform(get("/actuator/health"))
			.andExpect(status().isOk())
			.andExpect(header().exists("X-Request-Id"))
			.andExpect(jsonPath("$.status").value("UP"))
			.andExpect(jsonPath("$.components").doesNotExist())
			.andExpect(jsonPath("$.details").doesNotExist());
	}

	@Test
	void protectedRouteReturnsUniformJson401() throws Exception {
		mvc.perform(get("/api/v1/x"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().exists("X-Request-Id"))
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.message").isString())
			.andExpect(jsonPath("$.request_id").isNotEmpty())
			.andExpect(jsonPath("$.trace").doesNotExist());
	}

}
