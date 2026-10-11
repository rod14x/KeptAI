package pe.keptai.backend.n8n;

/**
 * Puerto del bucket PRIVADO {@code keptai-vouchers}. Lo usa solo el backend, después de autenticar al servicio y de
 * construir la ruta con la organización de la credencial; n8n nunca elige propietario, hash ni ruta ni recibe la clave.
 */
public interface VoucherStorage {

	/** Sube el objeto. Idempotente: si ya existe en esa ruta (mismos bytes por construcción de la ruta) no es un error. */
	void put(String path, byte[] bytes, String contentType);

	/** Elimina el objeto creado en este intento (compensación). */
	void delete(String path);

	/** Enlace privado de corta duración; el llamador debe autorizar el objeto antes de invocarlo. */
	default String signedUrl(String path, int expiresInSeconds) {
		throw new StorageException("Lectura privada no configurada", true);
	}

	/** Fallo del almacenamiento. {@code retryable}: indisponibilidad temporal (el llamador puede reintentar). */
	class StorageException extends RuntimeException {

		private final boolean retryable;

		public StorageException(String message, boolean retryable) {
			super(message);
			this.retryable = retryable;
		}

		public boolean retryable() {
			return retryable;
		}

	}

}
