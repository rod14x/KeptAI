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
		// Un cuerpo cortado por el límite configurado de las rutas de n8n es 413, no 400.
		for (Throwable t = ex; t != null; t = t.getCause()) {
			if (t instanceof pe.keptai.backend.n8n.PayloadTooLargeException) {
				return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiError.of("PAYLOAD_TOO_LARGE", "Cuerpo demasiado grande"));
			}
		}
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

	/** Reglas del panel (INT-FE-API-001): código y mensaje de producto, sin SQL ni datos de otra organización. */
	@ExceptionHandler(pe.keptai.backend.panel.PanelException.class)
	ResponseEntity<ApiError> handlePanel(pe.keptai.backend.panel.PanelException ex) {
		return ResponseEntity.status(ex.status()).body(ApiError.of(ex.code(), ex.getMessage()));
	}

	/** Rechazos del motor financiero: el código ya es el del contrato (MotorFinancieroException.Codigo). */
	@ExceptionHandler(pe.keptai.backend.finanzas.MotorFinancieroException.class)
	ResponseEntity<ApiError> handleMotor(pe.keptai.backend.finanzas.MotorFinancieroException ex) {
		HttpStatus status = pe.keptai.backend.panel.PanelErrors.status(ex.codigo());
		String message = status == HttpStatus.FORBIDDEN ? "Operación no autorizada para tu rol" : ex.getMessage();
		return ResponseEntity.status(status).body(ApiError.of(ex.codigo().name(), message));
	}

	@ExceptionHandler(pe.keptai.backend.tenancy.TenantContextException.class)
	ResponseEntity<ApiError> handleTenant(pe.keptai.backend.tenancy.TenantContextException ex) {
		log.error("Contexto de organización no aplicable: {}", ex.getClass().getSimpleName());
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(ApiError.of("SERVICE_UNAVAILABLE", "Servicio no disponible"));
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

	/** Error de negocio explícito: código estable y mensaje fijo, sin datos del cuerpo ni causas internas. */
	@ExceptionHandler(BusinessException.class)
	ResponseEntity<ApiError> handleBusiness(BusinessException ex) {
		return ResponseEntity.status(ex.status()).body(ApiError.of(ex.code(), ex.getMessage()));
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
