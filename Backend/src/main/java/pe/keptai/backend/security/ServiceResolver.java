package pe.keptai.backend.security;

import java.util.Optional;

/** Resuelve un servicio por el hash SHA-256 (hex minúsculas) de su clave técnica. */
public interface ServiceResolver {

	/** Vacío si la clave no existe, está revocada o la fila no es válida; excepción si la base no responde. */
	Optional<ServiceIdentity> resolve(String sha256Hex);

}
