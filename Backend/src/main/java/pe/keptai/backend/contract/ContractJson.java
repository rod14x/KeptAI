package pe.keptai.backend.contract;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.cfg.CoercionAction;
import tools.jackson.databind.cfg.CoercionInputShape;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Configuracion JSON del contrato PROPUESTO (MIG-02), expresada en codigo para no depender de propiedades globales.
 * No esta registrada como bean: lo hara el modulo que publique endpoints, cuando existan.
 */
public final class ContractJson {

	private ContractJson() {
	}

	/** Estricto: rechaza campos desconocidos (p. ej. {@code organization_id} enviado por el cliente) y mantiene el desfase de los instantes. */
	public static JsonMapper newMapper() {
		return JsonMapper.builder()
			.enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
			.enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
			.enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
			.disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
			.disable(DateTimeFeature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE)
			// Un importe es un entero JSON: ni "100" (cadena) ni 10.5 (decimal) se aceptan como centavos.
			.disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
			// Una fecha de negocio es solo YYYY-MM-DD: no se tolera un instante donde va una fecha.
			.defaultLeniency(Boolean.FALSE)
			.withCoercionConfigDefaults(cfg -> cfg.setCoercion(CoercionInputShape.Float, CoercionAction.Fail))
			.build();
	}

}
