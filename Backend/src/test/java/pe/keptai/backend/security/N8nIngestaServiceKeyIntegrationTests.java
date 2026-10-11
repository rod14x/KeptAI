package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * MIG-03-D3 (lado Spring): X-Api-Key real -> SHA-256 -> resolver_servicio (login runtime NOSUPERUSER NOBYPASSRLS no
 * propietario, PostgreSQL desechable V1–V9) -> política por ruta -> ingesta BORRADOR de /api/v1/ordenes/ingesta.
 * Claves aleatorias por ejecución, datos ficticios. Es un FIXTURE: no prueba n8n real. Desde MIG-05 la ingesta SÍ persiste el BORRADOR.
 */
@SpringBootTest(properties = "spring.autoconfigure.exclude=")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class N8nIngestaServiceKeyIntegrationTests {

	static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:17-alpine");

	static final UUID ORG_A = UUID.fromString("10000000-0000-4000-8000-0000000000a1");

	static final UUID ORG_B = UUID.fromString("10000000-0000-4000-8000-0000000000b2");

	static final String SENTINEL = "TRANSCRIPT_PRIVADO_D3_JAMAS_EN_LOGS";

	static final SecureRandom RANDOM = new SecureRandom();

	static final String KEY_ING_A = key(); // INGESTA, org A, instancia "isabel"

	static final String KEY_SCH_A = key(); // SCHEDULER, org A, instancia "isabel"

	static final String KEY_ING_OTRA = key(); // INGESTA, org A, instancia "otra"

	static final String KEY_ING_B = key(); // INGESTA, org B, instancia "isabel" (mismo nombre, otra empresa)

	static final String BODY = """
		{"origen":"whatsapp","instancia":"isabel","chatId":"51900000001@s.whatsapp.net",
		"vendedorJid":"51900000002@s.whatsapp.net","clienteNombreChat":"DEMO",
		"extraccion":{"faltantes":["datos_pedido"],"confianza":0},
		"hojaResumenMd":"Faltan datos del pedido","transcript":"%s",
		"mensajesProcesados":4,"generadoEn":"2026-10-11T05:38:18.770Z"}
		""".formatted(SENTINEL);

	static String key() {
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
			s.execute("INSERT INTO integracion_servicio(organizacion_id,instancia,alcance,clave_hash) VALUES "
					+ svc(ORG_A, "isabel", "INGESTA", KEY_ING_A) + "," + svc(ORG_A, "isabel", "SCHEDULER", KEY_SCH_A) + ","
					+ svc(ORG_A, "otra", "INGESTA", KEY_ING_OTRA) + "," + svc(ORG_B, "isabel", "INGESTA", KEY_ING_B));
			s.execute("CREATE ROLE keptai_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'fixture-only'");
			s.execute("GRANT keptai_runtime TO keptai_app");
		}
	}

	private static String svc(UUID org, String instancia, String alcance, String key) {
		return "('" + org + "','" + instancia + "','" + alcance + "','" + ApiKeyAuthenticationFilter.sha256(key) + "')";
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
	}

	@Autowired
	MockMvc mvc;

	private ResultActions send(String key, String body) throws Exception {
		var req = post("/api/v1/ordenes/ingesta").contentType("application/json").content(body);
		return mvc.perform(key == null ? req : req.header("X-Api-Key", key));
	}

	@Test
	void realKeyResolvedFromPostgresCreatesADraftOnlyForItsOwnOrganization(CapturedOutput output) throws Exception {
		long before = businessRows();
		for (String k : new String[] { KEY_ING_A, KEY_ING_B }) { // dos empresas con el mismo nombre de instancia
			String bodyText = send(k, BODY).andExpect(status().isCreated()).andExpect(header().exists("X-Request-Id"))
				.andExpect(jsonPath("$.estado").value("BORRADOR")).andExpect(jsonPath("$.ref").isNotEmpty())
				.andExpect(jsonPath("$.hojaResumenVersion").value(1)).andExpect(jsonPath("$.camposAusentes").isArray())
				.andReturn().getResponse().getContentAsString();
			assertThat(bodyText).doesNotContain(SENTINEL).doesNotContain(k);
		}
		assertThat(output.getAll()).doesNotContain(SENTINEL).doesNotContain(KEY_ING_A).doesNotContain(KEY_ING_B);
		assertThat(businessRows()).as("cada empresa obtiene su propio BORRADOR (pedido, hoja, canal, clave idempotente y auditoría)").isGreaterThan(before);
		try (Connection c = owner(); Statement s = c.createStatement(); ResultSet r = s.executeQuery(
				"SELECT count(DISTINCT organizacion_id), count(*) FILTER (WHERE estado <> 'BORRADOR') FROM keptai.orden")) {
			r.next();
			assertThat(r.getLong(1)).isGreaterThanOrEqualTo(2);
			assertThat(r.getLong(2)).isZero();
		}
	}

	@Test
	void invalidAbsentWrongScopeAndWrongInstanceAreRejectedWithTheDocumentedStatus() throws Exception {
		send(null, BODY).andExpect(status().isUnauthorized());
		send(key(), BODY).andExpect(status().isUnauthorized()); // bien formada pero inexistente
		send("corta", BODY).andExpect(status().isUnauthorized());
		send(KEY_SCH_A, BODY).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN")); // alcance equivocado
		send(KEY_ING_OTRA, BODY).andExpect(status().isForbidden()); // instancia registrada "otra" != "isabel" del JSON
		send(KEY_ING_A, BODY.replace("\"isabel\"", "\"otra\"")).andExpect(status().isForbidden()); // el JSON no elige la instancia
	}

	@Test
	void simultaneousOrRepeatedCredentialsAreRejectedNotResolved() throws Exception {
		mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json").content(BODY).header("X-Api-Key", KEY_ING_A)
				.header("Authorization", "Bearer " + key())).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json").content(BODY).header("X-Api-Key", KEY_ING_A, KEY_ING_A))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/ordenes/ingesta").header("X-Api-Key", KEY_ING_A)).andExpect(status().isForbidden());
	}

	@Test
	void invalidJsonArraysAndForgedFieldsAreBadRequestsThatDoNotLeakTheBody(CapturedOutput output) throws Exception {
		long before = businessRows();
		send(KEY_ING_A, BODY.substring(0, BODY.length() - 8)).andExpect(status().isBadRequest());
		send(KEY_ING_A, "[" + BODY + "]").andExpect(status().isBadRequest()); // la vista de items de n8n no es el body
		send(KEY_ING_A, BODY.replace("{\"faltantes\":[\"datos_pedido\"],\"confianza\":0}", "{}")).andExpect(status().isBadRequest());
		send(KEY_ING_A, BODY.replace("{\"origen\":", "{\"organizacion_id\":\"" + ORG_B + "\",\"origen\":")).andExpect(status().isBadRequest());
		send(KEY_ING_A, "").andExpect(status().isBadRequest());
		mvc.perform(post("/api/v1/ordenes/ingesta").contentType("text/plain").content(BODY).header("X-Api-Key", KEY_ING_A))
			.andExpect(status().isUnsupportedMediaType());
		assertThat(output.getAll()).doesNotContain(SENTINEL);
		assertThat(businessRows()).as("ninguna solicitud inválida deja filas").isEqualTo(before);
	}

	@Test
	void revokingTheRowInPostgresTakesEffectOnTheNextRequest() throws Exception {
		String revocable = key();
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("INSERT INTO keptai.integracion_servicio(organizacion_id,instancia,alcance,clave_hash) VALUES "
					+ svc(ORG_A, "temporal", "INGESTA", revocable));
		}
		send(revocable, BODY.replace("\"isabel\"", "\"temporal\"")).andExpect(status().isCreated());
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("UPDATE keptai.integracion_servicio SET activo=false WHERE instancia='temporal'");
		}
		send(revocable, BODY.replace("\"isabel\"", "\"temporal\"")).andExpect(status().isUnauthorized());
		// Rotación = reemplazo del hash: la clave anterior deja de valer, la nueva sí.
		String nueva = key();
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("UPDATE keptai.integracion_servicio SET activo=true, clave_hash='" + ApiKeyAuthenticationFilter.sha256(nueva) + "' WHERE instancia='temporal'");
		}
		send(revocable, BODY.replace("\"isabel\"", "\"temporal\"")).andExpect(status().isUnauthorized());
		send(nueva, BODY.replace("\"isabel\"", "\"temporal\"")).andExpect(status().isCreated()).andExpect(header().string("Idempotency-Replayed", "true"));
	}

	private long businessRows() throws Exception {
		try (Connection c = owner(); Statement s = c.createStatement(); ResultSet r = s.executeQuery("""
				SELECT (SELECT count(*) FROM keptai.orden)+(SELECT count(*) FROM keptai.orden_item)+(SELECT count(*) FROM keptai.hoja_resumen)
				+(SELECT count(*) FROM keptai.pago)+(SELECT count(*) FROM keptai.comprobante)+(SELECT count(*) FROM keptai.solicitud_idempotente)
				+(SELECT count(*) FROM keptai.evento_auditoria)+(SELECT count(*) FROM keptai.envio_notificacion)+(SELECT count(*) FROM keptai.canal_whatsapp)""")) {
			r.next();
			return r.getLong(1);
		}
	}

}
