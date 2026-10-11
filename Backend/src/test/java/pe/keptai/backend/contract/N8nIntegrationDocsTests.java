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
 * persistente con evidencia privada; confirmación y callback cerrados), nombrar los nodos y cabeceras exactos, y no contener secretos.
 */
class N8nIntegrationDocsTests {

	private static String read(String first, String... more) throws IOException {
		return Files.readString(Path.of(first, more), StandardCharsets.UTF_8);
	}

	@Test
	void openApiDescribesTheTwoImplementedRoutesAndKeepsTheClosedOnesClosed() {
		JsonNode paths = OpenApiSpec.load().root().path("paths");
		String ingest = paths.path("/api/v1/ordenes/ingesta").path("post").path("description").asString();
		assertThat(ingest).contains("IMPLEMENTADO (MIG-05", "BORRADOR", "NO guarda `transcript`", "Idempotencia", "409", "413");
		assertThat(paths.path("/api/v1/ordenes/ingesta").path("post").path("responses").has("200")).as("la recepción sin persistencia ya no existe").isFalse();
		assertThat(paths.path("/api/v1/ordenes/ingesta").path("post").path("responses").has("201")).isTrue();
		String voucher = paths.path("/api/v1/pagos/voucher").path("post").path("description").asString();
		assertThat(voucher).contains("IMPLEMENTADO (MIG-04/05", "imagen_base64", "SHA-256", "bucket privado", "RECIBIDO", "mensajeId", "3.5", "3.50");
		assertThat(paths.path("/api/v1/pagos/voucher").path("post").path("responses").has("413")).isTrue();
		assertThat(paths.path("/api/v1/pagos/voucher").path("post").path("responses").has("503")).isTrue();
		JsonNode req = OpenApiSpec.load().root().path("components").path("schemas").path("N8nPagoVoucherRequest");
		assertThat(req.path("properties").has("imagen_base64")).isTrue();
		assertThat(req.path("properties").path("imagen_base64").path("description").asString()).contains("Base64 PURO", "data:", "13981016");
		assertThat(paths.path("/api/v1/ordenes/confirmar").path("post").path("description").asString()).contains("ESTADO ACTUAL", "CERRADA");
		assertThat(paths.path("/api/v1/mensajes/{id}/estado").path("post").path("description").asString()).contains("ESTADO ACTUAL", "CERRADA");
	}

	@Test
	void theContactAssociationIsDocumentedWithItsErrorCodesAndLimits() throws IOException {
		String doc = read("docs", "integracion-n8n-isabella.md");
		assertThat(doc).contains("Contacto registrado: cómo se identifica al cliente", "CONTACT_NOT_REGISTERED", "CONTACT_JID_MISMATCH", "CHANNEL_CLIENT_CONFLICT",
				"SIN_ORDEN", "ORDEN_AMBIGUA", "último pedido no cancelado", "Cloud Technologies", "Andrés", "El vendedor sigue PENDIENTE", "no revela cuál caso");
		JsonNode paths = OpenApiSpec.load().root().path("paths");
		String ingest = paths.path("/api/v1/ordenes/ingesta").path("post").path("description").asString();
		String voucher = paths.path("/api/v1/pagos/voucher").path("post").path("description").asString();
		assertThat(ingest).contains("CONTACT_NOT_REGISTERED", "CHANNEL_CLIENT_CONFLICT", "VENDEDOR_SIN_RESOLVER");
		assertThat(voucher).contains("CONTACT_NOT_REGISTERED", "CONTACT_JID_MISMATCH", "ORDEN_AMBIGUA", "orden_contexto_id", "SIN_ORDEN", "congelada");
		assertThat(OpenApiSpec.load().root().path("components").path("schemas").path("N8nPagoVoucherResponse").path("properties").has("avisos")).isTrue();
		assertThat(read("docs", "provision-servicios-local.md")).contains("provisionar-contacto-local.sh", "NO APLICADO", "no migra");
		assertThat(read("docs", "despliegue-n8n.md")).contains("La base debe estar en V10", "no migra");
		assertThat(Files.isExecutable(Path.of("scripts", "provisionar-contacto-local.sh"))).isTrue();
		assertThat(Files.readString(Path.of("..", "BD", "migrations", "V10__contacto_whatsapp.sql"))).contains("CREATE TABLE contacto", "ENABLE ROW LEVEL SECURITY", "p_lectura_ingesta");
	}

	@Test
	void theConnectionGuideGivesTheExactNodeInstructionsAndAFullExample() throws IOException {
		String doc = read("docs", "integracion-n8n-isabella.md");
		assertThat(doc).contains("«Enviar pedido al backend»", "«Enviar pago al backend»", "`X-Api-Key`", "`X-Api-Secret`", "`Content-Type: application/json`",
				"POST {apiUrl}/api/v1/ordenes/ingesta", "POST {apiUrl}/api/v1/pagos/voucher", "imagen_base64", "Base64 puro", "sin prefijo `data:`",
				"Evolution → WF0", "WF0 → WF1", "Spring → WF3", "`key.id`", "generadoEn", "Idempotency-Replayed", "getBinaryDataBuffer",
				"https://keptai.ejesxyz.com", "https://n8n.ejesxyz.com", "NO desplegados", "10 485 760", "Supabase Storage real", "Datos que aún necesitamos de Isabella");
		assertThat(doc).doesNotContain("Respuesta actual: 404").doesNotContain("no existe controller de negocio todavía (MIG-05)");
		// El ejemplo de la guía es el archivo reproducible completo (no una muestra truncada).
		String example = read("docs", "ejemplos", "wf2-voucher-ficticio.json").strip();
		assertThat(doc).contains(example).doesNotContain("...\"");
		JsonNode j = new tools.jackson.databind.json.JsonMapper().readTree(example);
		byte[] file = java.util.Base64.getDecoder().decode(j.path("imagen_base64").asString());
		assertThat(file).hasSize(86);
		assertThat(file[0] & 0xFF).isEqualTo(0x89);
		String prov = read("docs", "provision-servicios-local.md");
		assertThat(prov).contains("--apply", "vista previa", "alta", "revocar", "rotar", "listar", "KEPTAI_PSQL_EXEC", "87d1132c-5b6d-4aa3-9c93-e7355dcd99cb",
				"APLICADA SOLO LOCAL", "No se creó otra Corpotex ni SCHEDULER").doesNotContain("etapa D3, no hecha");
		String matrix = read("docs", "matriz-acceso.md");
		assertThat(matrix).contains("MIG-03-D3", "MIG-04/05", "Implementada", "Storage real comprobado con archivo temporal; flujo completo pendiente");
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
		for (String s : new String[] { "servicio-local.sh", "verificar-n8n-local.sh", "generar-clave-servicio.sh", "provisionar-membresia-local.sh", "storage_simulado.py", "generar-ejemplo-voucher.py", "verificar-ingesta-local.py" }) {
			assertThat(Files.isExecutable(Path.of("scripts", s))).as(s).isTrue();
		}
		String svc = read("scripts", "servicio-local.sh");
		assertThat(svc).contains("VISTA PREVIA", "--apply", "rstrip", "permisos 600", "fuera del repositorio");
		assertThat(Files.isRegularFile(Path.of("scripts", "verificar-ingesta-local.py"))).isTrue();
	}

}
