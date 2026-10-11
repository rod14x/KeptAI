package pe.keptai.backend.contract;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import pe.keptai.backend.contract.CommonDtos.ApiErrorDetail;
import pe.keptai.backend.contract.CommonDtos.ApiErrorExtended;
import pe.keptai.backend.web.ApiError;
import pe.keptai.backend.web.RequestIdFilter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/** La extension propuesta de errores es compatible con el {@link ApiError} vigente (MIG-01), que no se modifica. */
class ApiErrorContractTests {

	private static final JsonMapper MAPPER = ContractJson.newMapper();

	private static final OpenApiSpec SPEC = OpenApiSpec.load();

	@Test
	void currentApiErrorJsonIsReadableAsTheExtensionAndAsTheContractSchema() {
		MDC.put(RequestIdFilter.MDC_KEY, "5d1c3a4e-0000-4000-8000-000000000003");
		try {
			ApiError current = ApiError.of("UNAUTHORIZED", "No autenticado");
			JsonNode manual = MAPPER.readTree(current.toJson());
			JsonNode viaMapper = MAPPER.readTree(MAPPER.writeValueAsString(current));
			assertThat(manual).isEqualTo(viaMapper);
			assertThat(manual.propertyNames()).containsExactlyInAnyOrder("code", "message", "request_id");
			ApiErrorExtended ext = MAPPER.readValue(current.toJson(), ApiErrorExtended.class);
			assertThat(ext.code()).isEqualTo(current.code());
			assertThat(ext.requestId()).isEqualTo(current.requestId());
			assertThat(ext.details()).isNull();
			// el JSON vigente tiene exactamente los campos requeridos del esquema ApiError
			List<String> required = SPEC.schema("ApiError").path("required").valueStream().map(JsonNode::asString).toList();
			assertThat(manual.propertyNames()).containsExactlyInAnyOrderElementsOf(required);
		}
		finally {
			MDC.remove(RequestIdFilter.MDC_KEY);
		}
	}

	@Test
	void extensionOmitsOptionalFieldsAndKeepsRequestIdEvenWhenNull() {
		ApiErrorExtended plain = ApiErrorExtended.from(new ApiError("NOT_FOUND", "No encontrado", null), null, null);
		assertThat(MAPPER.writeValueAsString(plain)).isEqualTo("{\"code\":\"NOT_FOUND\",\"message\":\"No encontrado\",\"request_id\":null}");
		var detailed = ApiErrorExtended.from(new ApiError("VALIDATION_ERROR", "Solicitud no valida", "rid"),
				List.of(new ApiErrorDetail("amount.amount_cents", "POSITIVE_REQUIRED", "El importe debe ser positivo")), false);
		JsonNode json = MAPPER.readTree(MAPPER.writeValueAsString(detailed));
		assertThat(json.path("details").get(0).path("field").asString()).isEqualTo("amount.amount_cents");
		assertThat(json.path("retryable").asBoolean(true)).isFalse();
	}

}
