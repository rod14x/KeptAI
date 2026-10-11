package pe.keptai.backend.n8n;

/** Sin URL/bucket/clave configurados: ninguna subida se simula ni se omite; la ruta responde 503. */
final class UnconfiguredVoucherStorage implements VoucherStorage {

	@Override
	public void put(String path, byte[] bytes, String contentType) {
		throw new StorageException("Almacenamiento de vouchers no configurado", true);
	}

	@Override
	public void delete(String path) {
		throw new StorageException("Almacenamiento de vouchers no configurado", true);
	}

}
