package pe.keptai.backend.web;

import org.springframework.http.HttpStatus;

/**
 * Error de negocio explícito con código estable del contrato (p. ej. IMAGE_INVALID_BASE64, IDEMPOTENCY_CONFLICT).
 * El mensaje es fijo y seguro: nunca incluye datos del cuerpo, claves ni causas internas.
 */
public class BusinessException extends RuntimeException {

	private final HttpStatus status;

	private final String code;

	public BusinessException(HttpStatus status, String code, String message) {
		super(message);
		this.status = status;
		this.code = code;
	}

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}

}
