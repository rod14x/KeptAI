package pe.keptai.backend.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * MIG-03-D3: la documentación de conexión con n8n debe coincidir con lo implementado (recepción de ingesta; voucher
 * autorizado pero ausente; confirmación y callback cerrados), nombrar los nodos y cabeceras exactos, y no contener secretos.
 */
class N8nIntegrationDocsTests {

	private static String read(String first, String... more) throws IOException {
		return Files.readString(Path.of(first, more), StandardCharsets.UTF_8);
	}

	@Test
	void openApiStatesWhatIsImplementedAndWhatIsOnlyPlanned() {
		JsonNode paths = OpenApiSpec.load().root().path("paths");
		String ingest = paths.path("/api/v1/ordenes/ingesta").path("post").path("description").asString();
		assertThat(ingest).contains("IMPLEMENTADO SOLO COMO RECEPCION", "VALIDADO_SIN_PERSISTIR", "PREVISTOS (MIG-05)").contains("NO se verifican");
		assertThat(paths.path("/api/v1/ordenes/ingesta").path("post").path("responses").path("201").path("description").asString()).startsWith("PREVISTO (MIG-05)");
		assertThat(paths.path("/api/v1/pagos/voucher").path("post").path("description").asString()).contains("ESTADO ACTUAL", "NO existe controlador", "404");
		assertThat(paths.path("/api/v1/ordenes/confirmar").path("post").path("description").asString()).contains("ESTADO ACTUAL", "CERRADA");
		assertThat(paths.path("/api/v1/mensajes/{id}/estado").path("post").path("description").asString()).contains("ESTADO ACTUAL", "CERRADA");
	}

	@Test
	void theConnectionGuideNamesTheNodesHeadersAndTheFourSeparateAuthentications() throws IOException {
		String doc = read("docs", "integracion-n8n-isabella.md");
		assertThat(doc).contains("«Enviar pedido al backend»", "«Enviar pago al backend»", "`X-Api-Key`", "`X-Api-Secret`", "`Content-Type: application/json`",
				"POST {apiUrl}/api/v1/ordenes/ingesta", "POST {apiUrl}/api/v1/pagos/voucher", "VALIDADO_SIN_PERSISTIR", "persistido:false",
				"Evolution → WF0", "WF0 → WF1", "Spring → WF3", "Respuesta actual: 404", "MIG-05", "Retención", "Datos exactos que necesitamos de Isabella");
		assertThat(doc).doesNotContain("no existe controller de negocio todavía (MIG-05)");
		String prov = read("docs", "provision-servicios-local.md");
		assertThat(prov).contains("--apply", "vista previa", "alta", "revocar", "rotar", "listar", "KEPTAI_PSQL_EXEC").doesNotContain("etapa D3, no hecha");
		String matrix = read("docs", "matriz-acceso.md");
		assertThat(matrix).contains("MIG-03-D3", "Autorizada pero ausente", "Implementada solo como recepción");
	}

	@Test
	void docsAndScriptsContainNoSecretsOrHashesOfRealKeys() throws IOException {
		Pattern hex64 = Pattern.compile("(?<![0-9a-fA-F])[0-9a-f]{64}(?![0-9a-fA-F])");
		Pattern jwt = Pattern.compile("eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.");
		try (Stream<Path> files = Stream.concat(Files.list(Path.of("docs")), Files.list(Path.of("scripts")))) {
			for (Path f : files.filter(Files::isRegularFile).filter(p -> p.toString().matches(".*\\.(md|sh|py)$")).toList()) {
				String text = Files.readString(f, StandardCharsets.UTF_8);
				assertThat(hex64.matcher(text).find()).as(f + " no debe contener una clave o hash completo").isFalse();
				assertThat(jwt.matcher(text).find()).as(f + " no debe contener un token").isFalse();
			}
		}
	}

	@Test
	void theLocalScriptsExistAreExecutableAndPreviewByDefault() throws IOException {
		for (String s : new String[] { "servicio-local.sh", "verificar-n8n-local.sh", "generar-clave-servicio.sh", "provisionar-membresia-local.sh" }) {
			assertThat(Files.isExecutable(Path.of("scripts", s))).as(s).isTrue();
		}
		String svc = read("scripts", "servicio-local.sh");
		assertThat(svc).contains("VISTA PREVIA", "--apply", "rstrip", "permisos 600", "fuera del repositorio");
		assertThat(Files.isRegularFile(Path.of("scripts", "verificar-ingesta-local.py"))).isTrue();
	}

}
