package pe.keptai.backend.contract;

import java.io.IOException;
import java.lang.reflect.RecordComponent;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import pe.keptai.backend.contract.CommonDtos.ApiErrorDetail;
import pe.keptai.backend.contract.CommonDtos.ApiErrorExtended;
import pe.keptai.backend.contract.CommonDtos.Money;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PageInfo;
import pe.keptai.backend.contract.CommonDtos.PositiveMoney;
import pe.keptai.backend.contract.CommonDtos.UserContext;
import pe.keptai.backend.contract.EvidenceDtos.*;
import pe.keptai.backend.contract.ExtractionDtos.*;
import pe.keptai.backend.contract.OrderDtos.*;
import pe.keptai.backend.contract.PaymentDtos.*;
import pe.keptai.backend.contract.ReceivableDtos.*;
import pe.keptai.backend.contract.ResultsDtos.*;
import pe.keptai.backend.contract.AuditDtos.*;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

/** Coherencia estructural entre openapi.yaml, los DTO Java y la matriz de endpoints (docs/contrato-api.md). */
class OpenApiConsistencyTests {

	private static OpenApiSpec spec;

	@BeforeAll
	static void load() {
		spec = OpenApiSpec.load();
	}

	@Test
	void specIsOpenApi31AndEveryOperationDeclaresItsImplementationStatus() {
		assertThat(spec.root().path("openapi").asString()).startsWith("3.1");
		assertThat(spec.root().path("info").path("version").asString()).contains("proposal");
		forEachOperation((key, op) -> {
			assertThat(op.path("x-keptai-status").asString()).as(key).isIn("proposed", "implemented_local");
			assertThat(op.path("operationId").asString()).as(key).isNotBlank();
			assertThat(op.path("x-keptai-owner").asString()).as(key).isIn("miguel", "miguel_adapter_andres_engine");
			assertThat(op.path("security").toString()).as(key).isEqualTo(key.contains("/ordenes/") || key.contains("/pagos/voucher") || key.contains("/mensajes/") ? "[{\"serviceApiKey\":[]}]" : "[{\"bearerAuth\":[]}]");
		});
		assertThat(spec.root().path("security").toString()).contains("bearerAuth");
	}

	@Test
	void mutatingPostsRequireIdempotencyKeyAndClientsNeverSendOrganizationId() {
		forEachOperation((key, op) -> {
			boolean hasKey = op.path("parameters").valueStream()
				.anyMatch(p -> p.path("$ref").asString("").endsWith("/IdempotencyKey"));
			if (key.startsWith("post ") && !op.has("x-keptai-idempotency")) {
				assertThat(hasKey).as("%s necesita Idempotency-Key", key).isTrue();
			}
			assertThat(op.path("parameters").toString()).as(key).doesNotContain("organization_id");
		});
		spec.root().path("components").path("schemas").properties().forEach(e -> {
			if (e.getKey().endsWith("Request")) {
				assertThat(e.getValue().path("additionalProperties").asBoolean(true)).as(e.getKey() + " cerrado").isFalse();
				assertThat(e.getValue().path("properties").has("organization_id")).as(e.getKey()).isFalse();
			}
		});
	}

	@Test
	void everyListIsPaginated() {
		forEachOperation((key, op) -> {
			String ref = op.path("responses").path("200").path("content").path("application/json").path("schema")
				.path("$ref").asString("");
			if (ref.endsWith("Page")) {
				String params = op.path("parameters").toString();
				assertThat(params).as(key).contains("/Limit").contains("/Cursor");
			}
		});
	}

	@Test
	void endpointMatrixInTheGuideListsExactlyTheOperationsOfTheSpec() throws IOException {
		Map<String, String> inSpec = new LinkedHashMap<>();
		forEachOperation((key, op) -> inSpec.put(op.path("operationId").asString(), key.replaceFirst(" ", "|")
				+ "|" + op.path("x-keptai-owner").asString() + "|" + op.path("x-keptai-task").asString() + "|"
				+ op.path("x-keptai-proposed-roles").valueStream().map(JsonNode::asString).collect(Collectors.joining(", "))));
		Map<String, String> inGuide = new LinkedHashMap<>();
		for (String line : Files.readAllLines(OpenApiSpec.MATRIX)) {
			if (!line.startsWith("| `") || line.startsWith("| `---")) {
				continue;
			}
			String[] c = line.split("\\|");
			if (c.length < 7) {
				continue;
			}
			String id = c[1].trim().replace("`", "");
			String method = c[2].trim().toLowerCase();
			String path = c[3].trim().replace("`", "");
			String owner = c[4].trim().replace("`", "");
			String task = c[5].trim();
			inGuide.put(id, method + "|" + path + "|" + owner + "|" + task + "|" + c[6].trim());
		}
		assertThat(inGuide).as("matriz de contrato-api.md desalineada con openapi.yaml").isEqualTo(inSpec);
		for (String line : Files.readAllLines(OpenApiSpec.MATRIX)) {
			if (line.startsWith("| `") && line.split("\\|").length >= 7) {
				String id=line.split("\\|")[1].trim().replace("`", "");
                String declared=spec.root().path("paths").valueStream().flatMap(x->x.valueStream()).filter(x->id.equals(x.path("operationId").asString())).findFirst().orElseThrow().path("x-keptai-status").asString();
                assertThat(line).containsIgnoringCase(declared.equals("implemented_local") ? "Implementado localmente" : "Propuesta");
			}
		}
	}

	@Test
	void javaEnumsHaveTheSameWireValuesAsTheYamlEnums() {
		Map<String, Class<?>> enums = new LinkedHashMap<>();
		for (Class<?> c : ContractEnums.class.getDeclaredClasses()) {
			enums.put(c.getSimpleName(), c);
		}
		Set<String> yamlEnums = new TreeSet<>();
		spec.root().path("components").path("schemas").properties().forEach(e -> {
			JsonNode s = e.getValue();
			if ("string".equals(s.path("type").asString("")) && s.has("enum") && !e.getKey().equals("CurrencyCode") && !e.getKey().startsWith("N8n")) {
				yamlEnums.add(e.getKey());
				assertThat(enums).as("enum Java para " + e.getKey()).containsKey(e.getKey());
				List<String> yaml = s.path("enum").valueStream().map(JsonNode::asString).toList();
				List<String> javaValues = Arrays.stream(enums.get(e.getKey()).getEnumConstants()).map(OpenApiConsistencyTests::wire).toList();
				assertThat(javaValues).as(e.getKey()).isEqualTo(yaml);
			}
		});
		assertThat(enums.keySet()).as("enums Java sin esquema en el YAML").isEqualTo(yamlEnums);
	}

	@Test
	void javaRecordsExposeExactlyTheSchemaProperties() {
		Map<String, Class<?>> records = new LinkedHashMap<>();
        for (Class<?> group : List.of(CommonDtos.class,EvidenceDtos.class,ExtractionDtos.class,OrderDtos.class,PaymentDtos.class,ReceivableDtos.class,ResultsDtos.class,AuditDtos.class)) {
            for(Class<?> c:group.getDeclaredClasses()) if(c.isRecord() && spec.root().path("components").path("schemas").has(c.getSimpleName())) records.put(c.getSimpleName(),c);
        }
		records.forEach((name, type) -> {
			Set<String> javaProps = Arrays.stream(type.getRecordComponents())
				.map(OpenApiConsistencyTests::jsonName).collect(Collectors.toCollection(TreeSet::new));
			Set<String> yaml = new TreeSet<>();
			spec.schema(name).path("properties").propertyNames().forEach(yaml::add);
			if (name.equals("ApiErrorExtended")) { // allOf: ApiError + campos opcionales nuevos
				spec.schema("ApiError").path("properties").propertyNames().forEach(yaml::add);
				spec.schema(name).path("allOf").get(1).path("properties").propertyNames().forEach(yaml::add);
			}
			assertThat(javaProps).as("propiedades de " + name).isEqualTo(yaml);
		});
		// esquemas con DTO propio (los genericos ExtractedX se cubren con ExtractedField)
		Set<String> noDto = new LinkedHashSet<>(List.of("Uuid", "OptionalMoney", "ApiError", "ApiErrorExtended", "UploadEvidenceFileRequest",
				"ExtractedString", "ExtractedInteger", "ExtractedMoney", "ExtractedDateTime", "EvidencePage", "ExtractionDraftPage",
				"OrderPage", "PaymentPage", "ReceivablePage", "CollectionAlertPage", "AuditEventPage"));
		spec.root().path("components").path("schemas").properties().forEach(e -> {
			if (e.getValue().has("properties") && !noDto.contains(e.getKey()) && !e.getKey().endsWith("Page") && !e.getKey().startsWith("N8n")) {
				assertThat(records).as("falta DTO Java para el esquema " + e.getKey()).containsKey(e.getKey());
			}
		});
		records.forEach((name, type) -> {
			if (name.equals("ApiErrorExtended")) {
				return;
			}
			JsonNode schema = spec.schema(name);
			Set<String> required = new TreeSet<>();
			schema.path("required").forEach(r -> required.add(r.asString()));
			for (RecordComponent c : type.getRecordComponents()) {
				String json = jsonName(c);
				boolean notNull = c.getAccessor().isAnnotationPresent(jakarta.validation.constraints.NotNull.class)
						|| c.getAccessor().isAnnotationPresent(jakarta.validation.constraints.NotBlank.class);
				JsonNode prop = schema.path("properties").path(json);
				boolean nullable = prop.path("type").toString().contains("null") || prop.path("oneOf").toString().contains("\"null\"") || prop.path("anyOf").toString().contains("\"null\"");
				if (notNull) {
					assertThat(required).as("%s.%s es @NotNull y debe ser requerido en el YAML", name, json).contains(json);
				}
				if (required.contains(json) && !nullable) {
					assertThat(notNull).as("%s.%s es requerido y no nulable en el YAML: falta @NotNull", name, json).isTrue();
				}
			}
			assertThat(required).as("requeridos de %s inexistentes en el record", name)
				.allMatch(r -> Arrays.stream(type.getRecordComponents()).anyMatch(c -> jsonName(c).equals(r)));
		});
		Set<String> extracted = Arrays.stream(ExtractedField.class.getRecordComponents())
			.map(OpenApiConsistencyTests::jsonName).collect(Collectors.toCollection(TreeSet::new));
		for (String s : List.of("ExtractedString", "ExtractedInteger", "ExtractedMoney", "ExtractedDateTime")) {
			Set<String> yaml = new TreeSet<>();
			spec.schema(s).path("properties").propertyNames().forEach(yaml::add);
			assertThat(extracted).as(s).isEqualTo(yaml);
		}
	}

	@Test
	void moneyLimitsInYamlMatchTheJavaScriptSafeIntegerAndTheDtoConstant() {
		JsonNode amount = spec.schema("Money").path("properties").path("amount_cents");
		assertThat(amount.path("maximum").asLong()).isEqualTo(CommonDtos.MAX_SAFE_CENTS).isEqualTo((1L << 53) - 1);
		assertThat(amount.path("minimum").asLong()).isEqualTo(-CommonDtos.MAX_SAFE_CENTS);
		assertThat(spec.schema("PositiveMoney").path("properties").path("amount_cents").path("minimum").asLong()).isEqualTo(1);
		assertThat(spec.schema("NonNegativeMoney").path("properties").path("amount_cents").path("minimum").asLong()).isZero();
		assertThat(spec.schema("CurrencyCode").path("enum").toString()).isEqualTo("[\"PEN\"]");
	}

	private interface OperationVisitor {

		void visit(String key, JsonNode op);

	}

	private static void forEachOperation(OperationVisitor visitor) {
		spec.root().path("paths").properties().forEach(path -> path.getValue().properties().forEach(m -> {
			if (List.of("get", "post", "put", "patch", "delete").contains(m.getKey())) {
				visitor.visit(m.getKey() + " " + path.getKey(), m.getValue());
			}
		}));
	}

	private static String wire(Object constant) {
		try {
			return ((Enum<?>) constant).getDeclaringClass().getField(((Enum<?>) constant).name())
				.getAnnotation(JsonProperty.class).value();
		}
		catch (ReflectiveOperationException ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static String jsonName(RecordComponent c) {
		JsonProperty p = c.getAccessor().getAnnotation(JsonProperty.class);
		if (p == null) {
			p = c.getAnnotation(JsonProperty.class);
		}
		assertThat(p).as("%s.%s debe declarar @JsonProperty explicito", c.getDeclaringRecord().getSimpleName(), c.getName()).isNotNull();
		return p.value();
	}

}
