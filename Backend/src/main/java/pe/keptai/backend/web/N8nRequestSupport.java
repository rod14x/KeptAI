package pe.keptai.backend.web;

import jakarta.validation.Validator;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import pe.keptai.backend.contract.ContractJson;
import pe.keptai.backend.security.AccessRole;
import pe.keptai.backend.security.ServiceAuthentication;
import pe.keptai.backend.security.ServiceIdentity;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** Pasos comunes de las rutas de n8n: servicio INGESTA autenticado, un objeto JSON estricto y validado. */
final class N8nRequestSupport {

	private static final JsonMapper JSON = ContractJson.newMapper();

	private N8nRequestSupport() {
	}

	/** Solo un servicio INGESTA autenticado por X-Api-Key; cualquier otra identidad es 403 (la regla de ruta ya lo exige). */
	static ServiceIdentity ingesta(Authentication authentication) {
		if (!(authentication instanceof ServiceAuthentication service) || service.identity().alcance() != AccessRole.INGESTA) {
			throw new AccessDeniedException("Servicio no autorizado");
		}
		return service.identity();
	}

	/** Un objeto por solicitud (nunca el array de items de n8n); sin campos desconocidos, sin contenido final; 400 sin eco del cuerpo. */
	static <T> T parse(String body, Class<T> type, Validator validator) {
		T data;
		try {
			data = JSON.readValue(body, type);
		}
		catch (JacksonException ex) {
			// No conservar la causa: puede contener fragmentos del transcript, del Base64 o credenciales.
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
		}
		if (data == null || !validator.validate(data).isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
		}
		return data;
	}

	/** La instancia del JSON es una afirmación: debe ser la registrada en PostgreSQL para la clave. */
	static void instancia(ServiceIdentity servicio, String instancia) {
		if (!servicio.instancia().equals(instancia)) {
			throw new AccessDeniedException("Instancia no autorizada");
		}
	}

}
