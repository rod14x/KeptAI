package pe.keptai.backend.finanzas;

import java.util.Objects;
import java.util.UUID;

/**
 * Identidad ya autenticada por Spring (JWT o clave de servicio, MIG-03) con la que el motor abre cada transaccion.
 * Exactamente uno de usuario o servicio; el motor la fija como contexto RLS local (app.*) y nunca la toma del cliente.
 */
public record ContextoFinanciero(UUID organizacionId, UUID usuarioId, UUID servicioId) {

	public ContextoFinanciero {
		Objects.requireNonNull(organizacionId, "organizacionId");
		if ((usuarioId == null) == (servicioId == null)) {
			throw new IllegalArgumentException("Contexto requiere exactamente un usuario o un servicio");
		}
	}

	public static ContextoFinanciero usuario(UUID organizacionId, UUID usuarioId) {
		return new ContextoFinanciero(organizacionId, usuarioId, null);
	}

	public static ContextoFinanciero servicio(UUID organizacionId, UUID servicioId) {
		return new ContextoFinanciero(organizacionId, null, servicioId);
	}
}
