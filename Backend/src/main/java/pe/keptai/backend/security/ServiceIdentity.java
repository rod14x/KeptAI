package pe.keptai.backend.security;

import java.util.UUID;

/**
 * Servicio técnico resuelto en PostgreSQL por {@code keptai_private.resolver_servicio(hash)}: fila activa de
 * {@code integracion_servicio}. Organización, instancia y alcance salen de la base, nunca del cliente.
 * {@code alcance} es INGESTA o SCHEDULER (servicios, no roles de usuario).
 */
public record ServiceIdentity(UUID servicioId, UUID organizacionId, String instancia, AccessRole alcance) {

	/** Sin la instancia ni identificadores: nada sensible en trazas. */
	@Override
	public String toString() {
		return "ServiceIdentity[alcance=" + alcance + "]";
	}

}
