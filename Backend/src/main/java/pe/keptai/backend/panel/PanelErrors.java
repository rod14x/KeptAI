package pe.keptai.backend.panel;

import java.sql.SQLException;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import pe.keptai.backend.finanzas.MotorFinancieroException;

/**
 * Errores de la base y del motor → respuesta del contrato. Los RAISE de V5–V10 son mensajes de negocio y se exponen;
 * cualquier otro error SQL queda como 500 genérico (sin texto de PostgreSQL).
 */
public final class PanelErrors {

	private PanelErrors() {
	}

	public static RuntimeException translate(DataAccessException e) {
		Throwable t = e;
		while (t != null && !(t instanceof SQLException)) {
			t = t.getCause();
		}
		String state = t == null ? null : ((SQLException) t).getSQLState();
		if (state == null) {
			return e;
		}
		return switch (state) {
			case "42501" -> PanelException.forbidden("Operación no autorizada para tu rol");
			case "23514" -> PanelException.conflict("Operación rechazada por una regla de integridad");
			case "23505" -> PanelException.conflict("El registro ya existe");
			case "23503" -> PanelException.notFound("Referencia inexistente en la organización");
			case "40P01", "40001", "55P03" ->
					new PanelException(HttpStatus.CONFLICT, "CONCURRENCY_CONFLICT", "Conflicto de concurrencia; reintentar");
			default -> e;
		};
	}

	public static HttpStatus status(MotorFinancieroException.Codigo codigo) {
		return switch (codigo) {
			case NOT_FOUND -> HttpStatus.NOT_FOUND;
			case FORBIDDEN -> HttpStatus.FORBIDDEN;
			case VALIDATION_ERROR -> HttpStatus.BAD_REQUEST;
			case PAYMENT_NOT_VERIFIED, DUPLICATE_PAYMENT, ORPHAN_PAYMENT, INSUFFICIENT_BALANCE, CURRENCY_MISMATCH ->
					HttpStatus.UNPROCESSABLE_ENTITY;
			case INVALID_STATE, CONCURRENCY_CONFLICT -> HttpStatus.CONFLICT;
		};
	}

	private static String firstLine(String message) {
		if (message == null) {
			return "Operación rechazada por una regla de negocio";
		}
		String line = message.lines().findFirst().orElse(message);
		line = line.startsWith("ERROR: ") ? line.substring(7) : line;
		return line.length() > 300 ? line.substring(0, 300) : line;
	}

}
