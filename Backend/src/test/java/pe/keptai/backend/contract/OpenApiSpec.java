package pe.keptai.backend.contract;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Carga {@code Backend/docs/openapi.yaml} (Maven ejecuta las pruebas con Backend/ como directorio de trabajo). */
final class OpenApiSpec {

	static final Path SPEC = Path.of("docs", "openapi.yaml");

	static final Path MATRIX = Path.of("docs", "contrato-api.md");

	private static final JsonMapper MAPPER = ContractJson.newMapper();

	private final JsonNode root;

	private OpenApiSpec(JsonNode root) {
		this.root = root;
	}

	@SuppressWarnings("unchecked")
	static OpenApiSpec load() {
		try (Reader reader = Files.newBufferedReader(SPEC, StandardCharsets.UTF_8)) {
			Map<String, Object> map = new Yaml(new SafeConstructor(new LoaderOptions())).load(reader);
			return new OpenApiSpec(MAPPER.readTree(MAPPER.writeValueAsString(map)));
		}
		catch (IOException ex) {
			throw new IllegalStateException("No se pudo leer " + SPEC.toAbsolutePath(), ex);
		}
	}

	JsonNode root() {
		return root;
	}

	JsonNode schema(String name) {
		JsonNode node = root.path("components").path("schemas").path(name);
		if (node.isMissingNode()) {
			throw new IllegalArgumentException("Esquema inexistente: " + name);
		}
		return node;
	}

	JsonNode example(String name) {
		JsonNode node = root.path("components").path("examples").path(name).path("value");
		if (node.isMissingNode()) {
			throw new IllegalArgumentException("Ejemplo inexistente: " + name);
		}
		return node;
	}

}
