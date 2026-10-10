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

	/** Errores estandar de Spring MVC (404, 405, 400, 415...). */
	@ExceptionHandler(org.springframework.web.ErrorResponseException.class)
	ResponseEntity<ApiError> handleMvc(ErrorResponse ex) {
		HttpStatusCode status = ex.getStatusCode();
		return ResponseEntity.status(status).body(ApiError.of(codeFor(status), messageFor(status)));
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError> handleUnexpected(Exception ex) {
		if (ex instanceof ErrorResponse er) {
			return handleMvc(er);
		}
		log.error("Error no controlado", ex);
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
