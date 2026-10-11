package pe.keptai.backend.panel;

import org.springframework.http.HttpStatus;

/**
 * Rechazo de una operación del panel con código del contrato ({@code ApiError.code}). El mensaje es de producto,
 * sin SQL, credenciales ni datos de otra organización.
 */
public class PanelException extends RuntimeException {

	private final HttpStatus status;

	private final String code;

	public PanelException(HttpStatus status, String code, String message) {
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

	public static PanelException notFound(String message) {
		return new PanelException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
	}

	public static PanelException badRequest(String message) {
		return new PanelException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
	}

	public static PanelException conflict(String message) {
		return new PanelException(HttpStatus.CONFLICT, "INVALID_STATE", message);
	}

	public static PanelException forbidden(String message) {
		return new PanelException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
	}

	public static PanelException unprocessable(String code, String message) {
		return new PanelException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
	}

	public static PanelException unavailable() {
		return new PanelException(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "Servicio no disponible");
	}

}
