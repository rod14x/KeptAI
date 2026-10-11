package pe.keptai.backend.panel;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.stereotype.Component;
import pe.keptai.backend.contract.ContractJson;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Entrada del panel: cuerpos JSON estrictos del contrato (campos desconocidos como {@code organization_id} se
 * rechazan, igual que en la ingesta n8n), identificadores y fechas de ruta o consulta. Los errores no exponen el cuerpo.
 */
@Component
public class PanelRequests {

	private static final JsonMapper JSON = ContractJson.newMapper();

	private final Validator validator;

	public PanelRequests(Validator validator) {
		this.validator = validator;
	}

	public <T> T body(String body, Class<T> type) {
		return body(body, type, Set.of());
	}

	/**
	 * @param tolerated propiedades de validación que el servicio resuelve con otra regla documentada (no se ignoran
	 * en silencio: el servicio las vuelve a comprobar)
	 */
	public <T> T body(String body, Class<T> type, Set<String> tolerated) {
		if (body == null || body.isBlank()) {
			throw PanelException.badRequest("Falta el cuerpo de la solicitud");
		}
		T value;
		try {
			value = JSON.readValue(body, type);
		}
		catch (JacksonException e) {
			throw PanelException.badRequest("Solicitud no válida");
		}
		if (value == null) {
			throw PanelException.badRequest("Solicitud no válida");
		}
		for (ConstraintViolation<T> v : validator.validate(value)) {
			if (!tolerated.contains(v.getPropertyPath().toString())) {
				throw PanelException.badRequest("Campo no válido: " + v.getPropertyPath());
			}
		}
		return value;
	}

	public static UUID uuid(String value, String name) {
		try {
			return UUID.fromString(value);
		}
		catch (IllegalArgumentException | NullPointerException e) {
			throw PanelException.badRequest("Identificador no válido: " + name);
		}
	}

	public static UUID optionalUuid(String value, String name) {
		return value == null || value.isBlank() ? null : uuid(value, name);
	}

	/** Fecha de corte de negocio; sin valor, hoy en America/Lima. */
	public static LocalDate asOf(String value) {
		if (value == null || value.isBlank()) {
			return PanelMapping.today();
		}
		try {
			return LocalDate.parse(value);
		}
		catch (DateTimeParseException e) {
			throw PanelException.badRequest("Fecha no válida: as_of");
		}
	}

}
