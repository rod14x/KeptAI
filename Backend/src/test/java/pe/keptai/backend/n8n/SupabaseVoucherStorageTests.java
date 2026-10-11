package pe.keptai.backend.n8n;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** El adaptador contra un servidor HTTP LOCAL simulado: forma de las peticiones, errores y que la clave no se filtra. No es Supabase real. */
class SupabaseVoucherStorageTests {

	static final String ORG = "10000000-0000-4000-8000-0000000000a1";

	static final String PATH = ORG + "/vouchers/0123456789abcdef0123456789abcdef-0123456789abcdef.png";

	HttpServer server;

	record Visto(String metodo, String uri, java.util.Map<String, String> cabeceras, int bytes) {
	}

	final List<Visto> vistos = new CopyOnWriteArrayList<>();

	final AtomicInteger respuesta = new AtomicInteger(200);

	volatile String cuerpoRespuesta = "{}";

	@AfterEach
	void stop() {
		if (server != null) {
			server.stop(0);
		}
	}

	private SupabaseVoucherStorage storage(String secret) throws IOException {
		server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
		server.createContext("/", ex -> {
			byte[] body = ex.getRequestBody().readAllBytes();
			java.util.Map<String, String> h = new java.util.TreeMap<>();
			ex.getRequestHeaders().forEach((k, v) -> h.put(k.toLowerCase(), String.join(",", v)));
			vistos.add(new Visto(ex.getRequestMethod(), ex.getRequestURI().toString(), h, body.length));
			byte[] resp = cuerpoRespuesta.getBytes();
			ex.sendResponseHeaders(respuesta.get(), resp.length);
			ex.getResponseBody().write(resp);
			ex.close();
		});
		server.start();
		String url = "http://127.0.0.1:" + server.getAddress().getPort();
		return new SupabaseVoucherStorage(new N8nProperties.Storage(url, "keptai-vouchers", secret, Duration.ofSeconds(5)));
	}

	@Test
	void uploadsToThePrivateBucketWithTheSecretOnlyInTheApikeyHeader() throws Exception {
		String secret = "sb_secret_FIXTURE_NOT_REAL_0123456789";
		storage(secret).put(PATH, new byte[] { 1, 2, 3 }, "image/png");
		Visto v = vistos.get(0);
		assertThat(v.metodo()).isEqualTo("POST");
		assertThat(v.uri()).isEqualTo("/storage/v1/object/keptai-vouchers/" + PATH).doesNotContain("public");
		assertThat(v.cabeceras()).containsEntry("apikey", secret).containsEntry("content-type", "image/png").containsEntry("x-upsert", "false");
		assertThat(v.cabeceras()).doesNotContainKey("authorization"); // las claves nuevas no son JWT
		assertThat(v.bytes()).isEqualTo(3);
	}

	@Test
	void aLegacyJwtShapedKeyIsAlsoSentAsBearer() throws Exception {
		storage("eyJhbGciOiJIUzI1NiJ9.fixture.fixture").put(PATH, new byte[] { 1 }, "application/pdf");
		assertThat(vistos.get(0).cabeceras()).containsEntry("authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.fixture.fixture");
	}

	@Test
	void anExistingObjectAtTheSamePathIsAnIdempotentSuccess() throws Exception {
		respuesta.set(409);
		storage("k".repeat(40)).put(PATH, new byte[] { 1 }, "image/png");
		respuesta.set(400);
		cuerpoRespuesta = "{\"statusCode\":\"409\",\"error\":\"Duplicate\"}";
		storage("k".repeat(40)).put(PATH, new byte[] { 1 }, "image/png");
	}

	@Test
	void errorsAreClassifiedAndNeverLeakTheSecretOrTheBody() throws Exception {
		String secret = "sb_secret_FIXTURE_LEAK_CHECK_0123456789";
		VoucherStorage s = storage(secret);
		cuerpoRespuesta = "{\"detalle\":\"" + secret + "\"}";
		for (int status : new int[] { 500, 502, 503, 429 }) {
			respuesta.set(status);
			assertThatThrownBy(() -> s.put(PATH, new byte[] { 1 }, "image/png")).isInstanceOfSatisfying(VoucherStorage.StorageException.class,
					e -> {
						assertThat(e.retryable()).isTrue();
						assertThat(e.getMessage()).doesNotContain(secret).doesNotContain("detalle");
					});
		}
		for (int status : new int[] { 400, 401, 403, 413 }) {
			respuesta.set(status);
			assertThatThrownBy(() -> s.put(PATH, new byte[] { 1 }, "image/png")).isInstanceOfSatisfying(VoucherStorage.StorageException.class,
					e -> {
						assertThat(e.retryable()).isFalse();
						assertThat(e.getMessage()).doesNotContain(secret);
					});
		}
		respuesta.set(404);
		s.delete(PATH); // eliminar algo inexistente es éxito (compensación idempotente)
		respuesta.set(200);
		s.delete(PATH);
		assertThat(vistos.stream().anyMatch(v -> v.metodo().equals("DELETE"))).isTrue();
	}

	@Test
	void anUnreachableStorageIsATemporaryFailureWithoutTheUrlOrKey() {
		String secret = "sb_secret_FIXTURE_UNREACHABLE_0123456789";
		SupabaseVoucherStorage s = new SupabaseVoucherStorage(new N8nProperties.Storage("http://127.0.0.1:1", "keptai-vouchers", secret, Duration.ofSeconds(2)));
		assertThatThrownBy(() -> s.put(PATH, new byte[] { 1 }, "image/png")).isInstanceOfSatisfying(VoucherStorage.StorageException.class, e -> {
			assertThat(e.retryable()).isTrue();
			assertThat(e.getMessage()).doesNotContain(secret).doesNotContain("127.0.0.1");
		});
	}

	@Test
	void pathsOutsideTheOrganizationVoucherFolderAreRefusedBeforeAnyNetworkCall() throws Exception {
		VoucherStorage s = storage("k".repeat(40));
		for (String bad : new String[] { "../x.png", ORG + "/otro/x.png", ORG + "/vouchers/../../x.png", "http://evil/x.png", ORG + "/vouchers/a b.png", "x/vouchers/y.png" }) {
			assertThatThrownBy(() -> s.put(bad, new byte[] { 1 }, "image/png")).isInstanceOf(VoucherStorage.StorageException.class);
			assertThatThrownBy(() -> s.delete(bad)).isInstanceOf(VoucherStorage.StorageException.class);
		}
		assertThat(vistos).isEmpty();
	}

	@Test
	void theStoragePropertiesNeverPrintTheKeyAndRejectUnsafeUrls() {
		var cfg = new N8nProperties.Storage("https://example.invalid", "keptai-vouchers", "sb_secret_FIXTURE_TOSTRING_0123456789", Duration.ofSeconds(5));
		assertThat(cfg.toString()).doesNotContain("sb_secret").contains("configured=true");
		assertThatThrownBy(() -> new N8nProperties.Storage("http://example.invalid", "b", "k", Duration.ofSeconds(5))).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new N8nProperties.Storage("https://user:pw@example.invalid", "b", "k", Duration.ofSeconds(5))).isInstanceOf(IllegalArgumentException.class);
		assertThat(new N8nProperties.Storage(null, "b", null, Duration.ofSeconds(5)).isConfigured()).isFalse();
	}

}
