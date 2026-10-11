package pe.keptai.backend.n8n;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Storage SIMULADO en memoria con inyección de fallos. No acredita Supabase Storage real. */
public class FakeVoucherStorage implements VoucherStorage {

	public record Objeto(byte[] bytes, String contentType) {
	}

	public final Map<String, Objeto> objetos = new ConcurrentHashMap<>();

	public final List<String> operaciones = java.util.Collections.synchronizedList(new ArrayList<>());

	public final AtomicInteger puts = new AtomicInteger();

	/** Próxima subida: fallo temporal antes de guardar. */
	public volatile boolean failNextPutTemporarily;

	/** Próxima subida: rechazo permanente. */
	public volatile boolean failNextPutPermanently;

	/** Próxima subida: guarda el objeto y luego falla (respuesta perdida). */
	public volatile boolean failNextPutAfterStoring;

	public volatile boolean failDeletes;

	@Override
	public void put(String path, byte[] bytes, String contentType) {
		puts.incrementAndGet();
		operaciones.add("PUT " + path);
		if (failNextPutTemporarily) {
			failNextPutTemporarily = false;
			throw new StorageException("simulado: no disponible", true);
		}
		if (failNextPutPermanently) {
			failNextPutPermanently = false;
			throw new StorageException("simulado: rechazado", false);
		}
		objetos.putIfAbsent(path, new Objeto(bytes.clone(), contentType));
		if (failNextPutAfterStoring) {
			failNextPutAfterStoring = false;
			throw new StorageException("simulado: respuesta perdida", true);
		}
	}

	@Override
	public void delete(String path) {
		operaciones.add("DELETE " + path);
		if (failDeletes) {
			throw new StorageException("simulado: no se pudo eliminar", true);
		}
		objetos.remove(path);
	}

	public void reset() {
		objetos.clear();
		operaciones.clear();
		puts.set(0);
		failNextPutTemporarily = failNextPutPermanently = failNextPutAfterStoring = failDeletes = false;
	}

}
