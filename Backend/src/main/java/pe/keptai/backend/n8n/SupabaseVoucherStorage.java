package pe.keptai.backend.n8n;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Adaptador de Supabase Storage (API REST {@code /storage/v1/object}). La clave secreta solo existe aquí, en
 * memoria, y se envía únicamente en la cabecera {@code apikey} (y como Bearer solo si es un JWT heredado); nunca
 * se registra ni aparece en excepciones. Rutas aceptadas: {@code <uuid organización>/vouchers/<nombre seguro>}.
 * Probado solo contra un servidor HTTP simulado: NO acredita Supabase Storage real.
 */
final class SupabaseVoucherStorage implements VoucherStorage {

	private static final Pattern PATH = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/vouchers/[A-Za-z0-9._-]{1,200}$");

	private final HttpClient client;

	private final String base;

	private final String bucket;

	private final String secretKey;

	private final java.time.Duration timeout;

	SupabaseVoucherStorage(N8nProperties.Storage cfg) {
		this.base = cfg.url().trim().replaceAll("/+$", "") + "/storage/v1/object/";
		this.bucket = cfg.bucket().trim();
		this.secretKey = cfg.secretKey().trim();
		this.timeout = cfg.timeout();
		this.client = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
	}

	@Override
	public void put(String path, byte[] bytes, String contentType) {
		HttpRequest.Builder b = request(path).header("Content-Type", contentType).header("x-upsert", "false")
			.POST(HttpRequest.BodyPublishers.ofByteArray(bytes));
		HttpResponse<String> r = send(b);
		int s = r.statusCode();
		if (s >= 200 && s < 300) {
			return;
		}
		// Objeto ya presente en esa ruta (la ruta incluye el hash del archivo): reintento idempotente.
		if (s == 409 || (s == 400 && r.body() != null && r.body().contains("Duplicate"))) {
			return;
		}
		throw new StorageException("Storage respondió " + s, s >= 500 || s == 429 || s == 408);
	}

	@Override
	public void delete(String path) {
		HttpResponse<String> r = send(request(path).DELETE());
		int s = r.statusCode();
		if ((s >= 200 && s < 300) || s == 404) {
			return;
		}
		throw new StorageException("Storage respondió " + s, s >= 500 || s == 429);
	}

	private HttpRequest.Builder request(String path) {
		if (!PATH.matcher(path).matches()) {
			throw new StorageException("Ruta de objeto no permitida", false);
		}
		String encoded = URLEncoder.encode(bucket, StandardCharsets.UTF_8) + "/" + path;
		HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + encoded)).timeout(timeout).header("apikey", secretKey);
		if (secretKey.startsWith("eyJ")) { // clave heredada (JWT): también Bearer; las claves nuevas no son JWT
			b.header("Authorization", "Bearer " + secretKey);
		}
		return b;
	}

	private HttpResponse<String> send(HttpRequest.Builder b) {
		try {
			return client.send(b.build(), HttpResponse.BodyHandlers.ofString());
		}
		catch (IOException e) {
			throw new StorageException("Storage no disponible", true); // sin la causa: puede contener la URL o cabeceras
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new StorageException("Storage interrumpido", true);
		}
	}

}
