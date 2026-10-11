package pe.keptai.backend.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	/** Body ausente o ilegible: no exponer fragmentos de JSON ni causas de Jackson. */
	@ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
	ResponseEntity<ApiError> handleUnreadableBody(org.springframework.http.converter.HttpMessageNotReadableException ex) {
		return ResponseEntity.badRequest().body(ApiError.of("BAD_REQUEST", "Solicitud no valida"));
	}

	/** Errores estandar de Spring MVC (404, 405, 400, 415...). */
	@ExceptionHandler(org.springframework.web.ErrorResponseException.class)
	ResponseEntity<ApiError> handleMvc(ErrorResponse ex) {
		HttpStatusCode status = ex.getStatusCode();
		return ResponseEntity.status(status).body(ApiError.of(codeFor(status), messageFor(status)));
	}

	/**
	 * Denegaciones lanzadas desde un controlador o servicio protegido (p. ej. method security): respuesta uniforme
	 * con request_id, sin mensaje de la excepción. La excepción AuthenticationServiceException es infraestructura.
	 */
	@ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
	ResponseEntity<ApiError> handleAccessDenied(org.springframework.security.access.AccessDeniedException ex) {
		return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of("FORBIDDEN", "Acceso denegado"));
	}

	@ExceptionHandler(org.springframework.security.authentication.AuthenticationServiceException.class)
	ResponseEntity<ApiError> handleAuthInfrastructure(org.springframework.security.authentication.AuthenticationServiceException ex) {
		log.error("Fallo de infraestructura de autenticación: {}", ex.getClass().getSimpleName());
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(ApiError.of("SERVICE_UNAVAILABLE", "Servicio no disponible"));
	}

	@ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
	ResponseEntity<ApiError> handleAuthentication(org.springframework.security.core.AuthenticationException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).header("WWW-Authenticate", "Bearer")
			.body(ApiError.of("UNAUTHORIZED", "No autenticado"));
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError> handleUnexpected(Exception ex) {
		if (ex instanceof ErrorResponse er) {
			return handleMvc(er);
		}
		log.error("Error no controlado: {}", ex.getClass().getSimpleName());
		HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
		return ResponseEntity.status(status).body(ApiError.of(codeFor(status), messageFor(status)));
	}

	private static String codeFor(HttpStatusCode status) {
		HttpStatus s = HttpStatus.resolve(status.value());
		return s == null ? "ERROR" : s.name();
	}

	private static String messageFor(HttpStatusCode status) {
		return status.is5xxServerError() ? "Error interno" : "Solicitud no valida";
	}

}
