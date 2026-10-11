package pe.keptai.backend.n8n;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.postgresql.PostgreSQLContainer;
import pe.keptai.backend.security.ApiKeyAuthenticationFilter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ingesta (POST /api/v1/ordenes/ingesta) y voucher (POST /api/v1/pagos/voucher) con PostgreSQL 17 desechable (V1–V9),
 * login runtime NOSUPERUSER NOBYPASSRLS no propietario y X-Api-Key reales (hash -> resolver_servicio). El Storage es un
 * FALLO/ÉXITO SIMULADO en memoria: estas pruebas NO acreditan Supabase Storage ni n8n reales. Datos y archivos ficticios.
 */
@SpringBootTest(properties = { "spring.autoconfigure.exclude=", "keptai.n8n.voucher.max-file-bytes=4096" })
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
@Import(N8nIngestaVoucherPersistenceTests.StorageConfig.class)
class N8nIngestaVoucherPersistenceTests {

	@TestConfiguration
	static class StorageConfig {

		@Bean
		@Primary
		FakeVoucherStorage fakeVoucherStorage() {
			return new FakeVoucherStorage();
		}

	}

	static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:17-alpine");

	static final JsonMapper JSON = JsonMapper.builder().build();

	static final UUID ORG_A = UUID.fromString("10000000-0000-4000-8000-0000000000a1");

	static final UUID ORG_B = UUID.fromString("10000000-0000-4000-8000-0000000000b2");

	static final SecureRandom RANDOM = new SecureRandom();

	static final String KEY_ING_A = key();

	static final String KEY_ING_B = key();

	static final String KEY_SCH_A = key();

	static final String SENT_TRANSCRIPT = "TRANSCRIPT_SENTINEL_JAMAS_PERSISTIR";

	static final String SENT_HOJA = "HOJA_ENTRANTE_SENTINEL_JAMAS_PERSISTIR";

	static final String SENT_CRUDO = "CRUDO_SENTINEL_JAMAS_PERSISTIR";

	static String key() {
		byte[] b = new byte[32];
		RANDOM.nextBytes(b);
		return HexFormat.of().formatHex(b);
	}

	@BeforeAll
	static void database() throws Exception {
		PG.start();
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role");
		}
		Flyway.configure().dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword()).schemas("keptai").defaultSchema("keptai")
			.locations("filesystem:../BD/migrations").load().migrate();
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("SET search_path=keptai,public");
			s.execute("INSERT INTO organizacion(id,nombre) VALUES ('" + ORG_A + "','Org A ficticia'),('" + ORG_B + "','Org B ficticia')");
			s.execute("INSERT INTO integracion_servicio(organizacion_id,instancia,alcance,clave_hash) VALUES "
					+ svc(ORG_A, "isabel", "INGESTA", KEY_ING_A) + "," + svc(ORG_B, "isabel", "INGESTA", KEY_ING_B) + "," + svc(ORG_A, "isabel", "SCHEDULER", KEY_SCH_A));
			// Un vendedor REAL con el mismo JID que envía n8n: aun así la orden no se le asigna (el JID no autentica).
			s.execute("INSERT INTO usuario(organizacion_id,auth_user_id,nombre,rol,whatsapp_jid) VALUES ('" + ORG_A + "','"
					+ UUID.randomUUID() + "','Vendedor ficticio','VENDEDOR','51900000002@s.whatsapp.net')");
			s.execute("CREATE ROLE keptai_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'fixture-only'");
			s.execute("GRANT keptai_runtime TO keptai_app");
		}
	}

	private static String svc(UUID org, String instancia, String alcance, String key) {
		return "('" + org + "','" + instancia + "','" + alcance + "','" + ApiKeyAuthenticationFilter.sha256(key) + "')";
	}

	@AfterAll
	static void stop() {
		PG.stop();
	}

	static Connection owner() throws Exception {
		return DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword());
	}

	@DynamicPropertySource
	static void props(DynamicPropertyRegistry r) {
		r.add("spring.datasource.url", () -> PG.getJdbcUrl() + "&currentSchema=keptai");
		r.add("spring.datasource.username", () -> "keptai_app");
		r.add("spring.datasource.password", () -> "fixture-only");
		r.add("spring.datasource.hikari.maximum-pool-size", () -> "16");
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	FakeVoucherStorage storage;

	@BeforeEach
	void limpiar() throws Exception {
		storage.reset();
		try (Connection c = owner(); Statement s = c.createStatement()) {
			s.execute("DELETE FROM keptai.evento_auditoria; DELETE FROM keptai.comprobante; DELETE FROM keptai.pago; DELETE FROM keptai.orden_item;"
					+ " DELETE FROM keptai.hoja_resumen; DELETE FROM keptai.orden; DELETE FROM keptai.canal_whatsapp; DELETE FROM keptai.solicitud_idempotente");
		}
	}

	// ---------- utilidades ----------

	static long count(String sql) throws Exception {
		try (Connection c = owner(); Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
			r.next();
			return r.getLong(1);
		}
	}

	static String one(String sql) throws Exception {
		try (Connection c = owner(); Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
			return r.next() ? r.getString(1) : null;
		}
	}

	static long businessRows() throws Exception {
		return count("SELECT (SELECT count(*) FROM keptai.orden)+(SELECT count(*) FROM keptai.orden_item)+(SELECT count(*) FROM keptai.hoja_resumen)"
				+ "+(SELECT count(*) FROM keptai.pago)+(SELECT count(*) FROM keptai.comprobante)+(SELECT count(*) FROM keptai.solicitud_idempotente)"
				+ "+(SELECT count(*) FROM keptai.evento_auditoria)+(SELECT count(*) FROM keptai.canal_whatsapp)");
	}

	MvcResult send(String path, String key, String body) throws Exception {
		var req = post(path).contentType("application/json").content(body);
		return mvc.perform(key == null ? req : req.header("X-Api-Key", key)).andReturn();
	}

	@SuppressWarnings("unchecked")
	static Map<String, Object> ordenBody() {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("origen", "whatsapp");
		m.put("instancia", "isabel");
		m.put("chatId", "51900000001@s.whatsapp.net");
		m.put("vendedorJid", "51900000002@s.whatsapp.net");
		m.put("clienteNombreChat", "DEMO");
		Map<String, Object> x = new LinkedHashMap<>();
		x.put("cliente", Map.of("nombre", "Cliente Ficticio SAC", "ruc", "20000000001", "tipo", "EMPRESA"));
		x.put("marca", "CORPOTEX");
		Map<String, Object> item = new LinkedHashMap<>();
		item.put("descripcion", "Polo ficticio");
		item.put("cantidad", 10);
		item.put("unidad", "und");
		item.put("detalle_tallas", "M x10");
		item.put("tela", "algodon");
		item.put("logo_diseno", "logo demo");
		item.put("precio_unitario", 12.5);
		x.put("items", List.of(item));
		x.put("total", 125.0);
		x.put("moneda", "PEN");
		x.put("condicion_pago", Map.of("tipo", "CREDITO", "plazo_dias", 30));
		x.put("fecha_entrega_solicitada", "2026-11-01");
		x.put("pagos_mencionados", List.of());
		x.put("observaciones", "nota ficticia");
		x.put("faltantes", List.of());
		x.put("confianza", 0.9567);
		x.put("crudo", SENT_CRUDO);
		m.put("extraccion", x);
		m.put("hojaResumenMd", SENT_HOJA);
		m.put("transcript", SENT_TRANSCRIPT);
		m.put("mensajesProcesados", 4);
		m.put("generadoEn", "2026-10-11T05:38:18.770Z");
		return m;
	}

	static String json(Object o) {
		return JSON.writeValueAsString(o);
	}

	@SuppressWarnings("unchecked")
	static Map<String, Object> voucherBody() throws Exception {
		Map<String, Object> m = JSON.readValue(Files.readString(Path.of("docs", "ejemplos", "wf2-voucher-ficticio.json"), StandardCharsets.UTF_8), LinkedHashMap.class);
		m.put("imagen_base64", Base64.getEncoder().encodeToString(Fixtures.png(0)));
		return m;
	}

	@SuppressWarnings("unchecked")
	static Map<String, Object> ext(Map<String, Object> body) {
		return (Map<String, Object>) body.get("extraccion");
	}

	static JsonNode tree(MvcResult r) throws Exception {
		return JSON.readTree(r.getResponse().getContentAsString());
	}

	// ---------- ingesta ----------

	@Test
	void completeExtractionCreatesOnlyADraftOrderAndSheetFromStructuredData(CapturedOutput output) throws Exception {
		MvcResult r = send("/api/v1/ordenes/ingesta", KEY_ING_A, json(ordenBody()));
		assertThat(r.getResponse().getStatus()).isEqualTo(201);
		JsonNode resp = tree(r);
		assertThat(resp.get("estado").asString()).isEqualTo("BORRADOR");
		assertThat(resp.get("ref").asString()).isEqualTo("ORD-1");
		assertThat(resp.get("hojaResumenVersion").asInt()).isEqualTo(1);
		assertThat(resp.toString()).doesNotContain(SENT_TRANSCRIPT).doesNotContain(SENT_HOJA).doesNotContain(SENT_CRUDO);
		String o = "SELECT %s FROM keptai.orden WHERE ref = 'ORD-1' AND organizacion_id = '" + ORG_A + "'";
		assertThat(one(o.formatted("estado"))).isEqualTo("BORRADOR");
		assertThat(one(o.formatted("condicion_pago"))).isEqualTo("CREDITO");
		assertThat(one(o.formatted("plazo_dias"))).isEqualTo("30");
		assertThat(one(o.formatted("total"))).isEqualTo("125.00");
		assertThat(one(o.formatted("origen"))).isEqualTo("WHATSAPP");
		// Lo que NO se inventa ni se deduce: cliente, marca y vendedor (aunque exista un usuario con ese JID).
		assertThat(one(o.formatted("cliente_id"))).isNull();
		assertThat(one(o.formatted("marca_id"))).isNull();
		assertThat(one(o.formatted("vendedor_id"))).isNull();
		assertThat(one(o.formatted("canal_id"))).isNotNull();
		assertThat(count("SELECT count(*) FROM keptai.orden WHERE estado <> 'BORRADOR'")).isZero();
		assertThat(count("SELECT count(*) FROM keptai.orden_item WHERE cantidad = 10 AND precio_unit = 12.50 AND talla = 'M x10'")).isEqualTo(1);
		assertThat(one("SELECT estado || ':' || version FROM keptai.hoja_resumen")).isEqualTo("BORRADOR:1");
		assertThat(one("SELECT revisado_por FROM keptai.hoja_resumen")).isNull();
		assertThat(one("SELECT confianza FROM keptai.hoja_resumen")).isEqualTo("0.957");
		assertThat(one("SELECT resumen_md FROM keptai.hoja_resumen")).contains("ORD-1").contains("Polo ficticio").contains("borrador");
		assertThat(one("SELECT actor || ':' || operacion FROM keptai.evento_auditoria")).isEqualTo("N8N:ORDEN_INGESTA_BORRADOR");
		assertThat(count("SELECT count(*) FROM keptai.aprobacion_credito") + count("SELECT count(*) FROM keptai.obligacion_cobro")
				+ count("SELECT count(*) FROM keptai.aplicacion_pago") + count("SELECT count(*) FROM keptai.despacho")).isZero();
		assertNoSensitiveContentPersisted(output, SENT_TRANSCRIPT, SENT_HOJA, SENT_CRUDO);
		// La extracción guardada es la proyección estructurada: sin crudo ni texto de error.
		assertThat(one("SELECT extraccion::text FROM keptai.hoja_resumen")).contains("Cliente Ficticio SAC").doesNotContain("crudo").doesNotContain("error_parseo");
	}

	@Test
	void incompleteExtractionIsStoredWithoutInventingDataAndReportsWhatIsMissing() throws Exception {
		Map<String, Object> b = ordenBody();
		Map<String, Object> x = ext(b);
		x.put("total", null);
		x.put("items", List.of(Map.of("descripcion", "Polo sin precio ni cantidad")));
		x.put("condicion_pago", Map.of("tipo", "CREDITO", "plazo_dias", 45));
		x.put("faltantes", List.of("total", "precio"));
		x.put("confianza", 0.4);
		MvcResult r = send("/api/v1/ordenes/ingesta", KEY_ING_A, json(b));
		assertThat(r.getResponse().getStatus()).isEqualTo(201);
		JsonNode resp = tree(r);
		List<String> avisos = new ArrayList<>();
		resp.get("avisos").forEach(a -> avisos.add(a.get("codigo").asString()));
		assertThat(avisos).contains("ITEMS_INCOMPLETOS", "PLAZO_CREDITO_NO_REGISTRADO", "CLIENTE_SIN_ASOCIAR", "MARCA_SIN_ASIGNAR", "VENDEDOR_SIN_RESOLVER");
		List<String> ausentes = new ArrayList<>();
		resp.get("camposAusentes").forEach(a -> ausentes.add(a.asString()));
		assertThat(ausentes).contains("total", "precio", "items", "condicion_pago");
		assertThat(one("SELECT total FROM keptai.orden")).isNull();
		assertThat(one("SELECT condicion_pago FROM keptai.orden")).isNull();
		assertThat(count("SELECT count(*) FROM keptai.orden_item")).isZero();
		assertThat(one("SELECT estado FROM keptai.orden")).isEqualTo("BORRADOR");
	}

	@Test
	void anAdvanceLargerThanTheTotalIsAnExplicitBusinessErrorAndStoresNothing() throws Exception {
		Map<String, Object> b = ordenBody();
		ext(b).put("condicion_pago", Map.of("tipo", "ANTICIPO", "anticipo_monto", 500));
		MvcResult r = send("/api/v1/ordenes/ingesta", KEY_ING_A, json(b));
		assertThat(r.getResponse().getStatus()).isEqualTo(422);
		assertThat(tree(r).get("code").asString()).isEqualTo("AMOUNT_INCONSISTENT");
		assertThat(businessRows()).isZero();
	}

	@Test
	void sameRequestIsReplayedAndAChangedContentWithTheSameKeyIsAConflict() throws Exception {
		String body = json(ordenBody());
		MvcResult first = send("/api/v1/ordenes/ingesta", KEY_ING_A, body);
		MvcResult again = send("/api/v1/ordenes/ingesta", KEY_ING_A, body);
		assertThat(first.getResponse().getStatus()).isEqualTo(201);
		assertThat(again.getResponse().getStatus()).isEqualTo(201);
		assertThat(again.getResponse().getHeader("Idempotency-Replayed")).isEqualTo("true");
		assertThat(first.getResponse().getHeader("Idempotency-Replayed")).isNull();
		assertThat(tree(again).get("ordenId").asString()).isEqualTo(tree(first).get("ordenId").asString());
		assertThat(count("SELECT count(*) FROM keptai.orden")).isEqualTo(1);
		// El transcript no forma parte de la identidad funcional: cambiarlo en un reintento no es un conflicto.
		Map<String, Object> soloTranscript = ordenBody();
		soloTranscript.put("transcript", "otro texto del chat");
		assertThat(send("/api/v1/ordenes/ingesta", KEY_ING_A, json(soloTranscript)).getResponse().getStatus()).isEqualTo(201);
		assertThat(count("SELECT count(*) FROM keptai.orden")).isEqualTo(1);
		// Un contenido funcional distinto con la misma clave sí lo es.
		Map<String, Object> otro = ordenBody();
		ext(otro).put("total", 999.0);
		MvcResult c = send("/api/v1/ordenes/ingesta", KEY_ING_A, json(otro));
		assertThat(c.getResponse().getStatus()).isEqualTo(409);
		assertThat(tree(c).get("code").asString()).isEqualTo("IDEMPOTENCY_CONFLICT");
		assertThat(count("SELECT count(*) FROM keptai.orden")).isEqualTo(1);
		// Un generadoEn distinto es otra solicitud (otro pedido).
		Map<String, Object> nueva = ordenBody();
		nueva.put("generadoEn", "2026-10-11T06:00:00.000Z");
		assertThat(send("/api/v1/ordenes/ingesta", KEY_ING_A, json(nueva)).getResponse().getStatus()).isEqualTo(201);
		assertThat(one("SELECT string_agg(ref, ',' ORDER BY ref) FROM keptai.orden")).isEqualTo("ORD-1,ORD-2");
	}

	@Test
	void simultaneousIdenticalRequestsCreateOneOrderAndDifferentOnesGetDistinctRefs() throws Exception {
		String body = json(ordenBody());
		List<MvcResult> res = parallel(8, i -> send("/api/v1/ordenes/ingesta", KEY_ING_A, body));
		assertThat(res).allSatisfy(r -> assertThat(r.getResponse().getStatus()).isEqualTo(201));
		assertThat(count("SELECT count(*) FROM keptai.orden")).isEqualTo(1);
		assertThat(res.stream().filter(r -> r.getResponse().getHeader("Idempotency-Replayed") == null).count()).isEqualTo(1);
		assertThat(res.stream().map(r -> { try { return tree(r).get("ordenId").asString(); } catch (Exception e) { throw new IllegalStateException(e); } }).distinct().count()).isEqualTo(1);

		List<MvcResult> distintas = parallel(8, i -> {
			Map<String, Object> b = ordenBody();
			b.put("generadoEn", "2026-10-11T07:00:0" + i + ".000Z");
			return send("/api/v1/ordenes/ingesta", KEY_ING_A, json(b));
		});
		assertThat(distintas).allSatisfy(r -> assertThat(r.getResponse().getStatus()).isEqualTo(201));
		assertThat(count("SELECT count(*) FROM keptai.orden")).isEqualTo(9);
		assertThat(count("SELECT count(DISTINCT ref) FROM keptai.orden")).isEqualTo(9);
	}

	@Test
	void differentConcurrentOrdersShareOneNewChannelWithoutSnapshotRaces() throws Exception {
		List<MvcResult> results = parallel(8, i -> {
			Map<String, Object> b = ordenBody();
			b.put("generadoEn", "2026-10-11T09:00:0" + i + ".000Z");
			return send("/api/v1/ordenes/ingesta", KEY_ING_A, json(b));
		});
		assertThat(results).allSatisfy(result -> assertThat(result.getResponse().getStatus()).isEqualTo(201));
		assertThat(count("SELECT count(*) FROM keptai.canal_whatsapp")).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.orden")).isEqualTo(8);
	}

	@Test
	void differentConcurrentMessagesForOneFinancialReferenceHaveOnlyOneOriginal() throws Exception {
		List<MvcResult> results = parallel(8, i -> {
			Map<String, Object> b = voucherBody();
			b.put("mensajeId", "3EB0C767D0A5C7F2A9D" + i);
			return send("/api/v1/pagos/voucher", KEY_ING_A, json(b));
		});
		assertThat(results).allSatisfy(result -> assertThat(result.getResponse().getStatus()).isEqualTo(201));
		assertThat(count("SELECT count(*) FROM keptai.pago WHERE estado_conciliacion = 'PENDIENTE'")).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.pago WHERE estado_conciliacion = 'DUPLICADO'")).isEqualTo(7);
		assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago")).isZero();
	}

	@Test
	void organizationsAreIsolatedEvenWithTheSameInstanceChatAndTimestamp() throws Exception {
		String body = json(ordenBody());
		assertThat(send("/api/v1/ordenes/ingesta", KEY_ING_A, body).getResponse().getStatus()).isEqualTo(201);
		MvcResult b = send("/api/v1/ordenes/ingesta", KEY_ING_B, body);
		assertThat(b.getResponse().getStatus()).isEqualTo(201);
		assertThat(b.getResponse().getHeader("Idempotency-Replayed")).isNull(); // la clave de A no existe para B
		assertThat(tree(b).get("ref").asString()).isEqualTo("ORD-1"); // numeración propia por organización
		assertThat(count("SELECT count(*) FROM keptai.orden WHERE organizacion_id = '" + ORG_A + "'")).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.orden WHERE organizacion_id = '" + ORG_B + "'")).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.solicitud_idempotente")).isEqualTo(2);
	}

	@Test
	void anOversizedIngestBodyIsRejectedBeforeReadingIt() throws Exception {
		Map<String, Object> b = ordenBody();
		b.put("transcript", "x".repeat(600_000));
		MvcResult r = send("/api/v1/ordenes/ingesta", KEY_ING_A, json(b));
		assertThat(r.getResponse().getStatus()).isEqualTo(413);
		assertThat(businessRows()).isZero();
	}

	// ---------- voucher ----------

	@Test
	void validVoucherRegistersAReceivedPaymentWithAPrivateReceiptAndNoFinancialEffect(CapturedOutput output) throws Exception {
		Map<String, Object> b = voucherBody();
		byte[] png = Fixtures.png(0);
		MvcResult r = send("/api/v1/pagos/voucher", KEY_ING_A, json(b));
		assertThat(r.getResponse().getStatus()).isEqualTo(201);
		JsonNode resp = tree(r);
		assertThat(resp.get("resultado").asString()).isEqualTo("REGISTRADO");
		assertThat(resp.get("fase").asString()).isEqualTo("RECIBIDO");
		assertThat(resp.get("estadoConciliacion").asString()).isEqualTo("PENDIENTE");
		assertThat(resp.get("fondosVerificados").asBoolean()).isFalse();
		assertThat(resp.get("saldoModificado").asBoolean()).isFalse();
		assertThat(resp.get("ordenRef").isNull()).isTrue();
		assertThat(resp.get("alertaId").isNull()).isTrue();
		// Importe exacto: 3.5 -> 3.50 PEN, fase RECIBIDO, sin verificar, sin cliente.
		assertThat(one("SELECT monto FROM keptai.pago")).isEqualTo("3.50");
		assertThat(one("SELECT moneda FROM keptai.pago")).isEqualTo("PEN");
		assertThat(one("SELECT fase || ':' || estado_conciliacion || ':' || medio FROM keptai.pago")).isEqualTo("RECIBIDO:PENDIENTE:YAPE");
		assertThat(one("SELECT verificado_por FROM keptai.pago")).isNull();
		assertThat(one("SELECT cliente_id FROM keptai.pago")).isNull();
		assertThat(one("SELECT idempotency_key FROM keptai.pago")).isEqualTo("3EB0C767D0A5C7F2A9B1");
		assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago") + count("SELECT count(*) FROM keptai.obligacion_cobro")
				+ count("SELECT count(*) FROM keptai.alerta_cobranza")).isZero();
		// Comprobante: ruta generada por el servidor, hash SHA-256 de los bytes decodificados, origen, sin Base64.
		String path = one("SELECT archivo_storage_path FROM keptai.comprobante");
		assertThat(path).matches("^" + ORG_A + "/vouchers/[0-9a-f]{32}-[0-9a-f]{16}\\.png$");
		assertThat(one("SELECT archivo_hash FROM keptai.comprobante")).isEqualTo(CanonicalJson.sha256(png));
		assertThat(one("SELECT instancia_origen || ':' || provider_message_id FROM keptai.comprobante")).isEqualTo("isabel:3EB0C767D0A5C7F2A9B1");
		assertThat(storage.objetos).containsOnlyKeys(path);
		assertThat(storage.objetos.get(path).bytes()).isEqualTo(png);
		assertThat(storage.objetos.get(path).contentType()).isEqualTo("image/png");
		assertNoSensitiveContentPersisted(output, (String) b.get("imagen_base64"), ((String) b.get("imagen_base64")).substring(0, 40), "Cliente ficticio");
	}

	@Test
	void jpegAndPdfAreAcceptedByContentAndOthersAreRejectedWithoutTouchingStorage() throws Exception {
		Map<String, Object> jpg = voucherBody();
		jpg.put("imagen_base64", Base64.getEncoder().encodeToString(Fixtures.jpeg()));
		jpg.put("mensajeId", "MSG-JPG-0001");
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(jpg)).getResponse().getStatus()).isEqualTo(201);
		Map<String, Object> pdf = voucherBody();
		pdf.put("imagen_base64", Base64.getEncoder().encodeToString(Fixtures.pdf()));
		pdf.put("mensajeId", "MSG-PDF-0001");
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(pdf)).getResponse().getStatus()).isEqualTo(201);
		assertThat(storage.objetos.keySet()).anyMatch(k -> k.endsWith(".jpg")).anyMatch(k -> k.endsWith(".pdf"));
		long objetos = storage.objetos.size();
		long filas = businessRows();
		String ok = (String) voucherBody().get("imagen_base64");
		Object[][] casos = {
			{ "data:image/png;base64," + ok, 400, "IMAGE_INVALID_BASE64" },
			{ ok.substring(0, ok.length() - 3), 400, "IMAGE_INVALID_BASE64" },
			{ ok.substring(0, 20) + "..." + ok.substring(23), 400, "IMAGE_INVALID_BASE64" },
			{ ok.substring(0, 20) + "\n" + ok.substring(20), 400, "IMAGE_INVALID_BASE64" },
			{ "", 400, "IMAGE_REQUIRED" },
			{ Base64.getEncoder().encodeToString("esto es texto, no una imagen".getBytes()), 422, "IMAGE_UNSUPPORTED_TYPE" },
			{ Base64.getEncoder().encodeToString(java.util.Arrays.copyOf(Fixtures.png(0), Fixtures.png(0).length - 6)), 422, "IMAGE_UNSUPPORTED_TYPE" },
			{ Base64.getEncoder().encodeToString(Fixtures.pngWithTotalSize(4097)), 413, "PAYLOAD_TOO_LARGE" },
		};
		int n = 0;
		for (Object[] c : casos) {
			Map<String, Object> b = voucherBody();
			b.put("imagen_base64", c[0]);
			b.put("mensajeId", "MSG-BAD-" + (n++) + "-XYZ");
			MvcResult r = send("/api/v1/pagos/voucher", KEY_ING_A, json(b));
			assertThat(r.getResponse().getStatus()).as(String.valueOf(c[2])).isEqualTo(c[1]);
			assertThat(tree(r).get("code").asString()).isEqualTo(c[2]);
		}
		Map<String, Object> sin = voucherBody();
		sin.remove("imagen_base64");
		sin.put("mensajeId", "MSG-NOIMG-1");
		MvcResult r = send("/api/v1/pagos/voucher", KEY_ING_A, json(sin));
		assertThat(r.getResponse().getStatus()).isEqualTo(400);
		assertThat(tree(r).get("code").asString()).isEqualTo("IMAGE_REQUIRED");
		assertThat(storage.objetos).hasSize((int) objetos);
		assertThat(businessRows()).isEqualTo(filas);
	}

	@Test
	void anOversizedHttpBodyIsRejectedBeforeDecodingAndAtTheLimitItPasses() throws Exception {
		Map<String, Object> grande = voucherBody();
		grande.put("imagen_base64", "A".repeat(200_000)); // supera el cuerpo máximo derivado (Base64 de 4096 + holgura)
		MvcResult r = send("/api/v1/pagos/voucher", KEY_ING_A, json(grande));
		assertThat(r.getResponse().getStatus()).isEqualTo(413);
		Map<String, Object> enLimite = voucherBody();
		enLimite.put("imagen_base64", Base64.getEncoder().encodeToString(Fixtures.pngWithTotalSize(4096)));
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(enLimite)).getResponse().getStatus()).isEqualTo(201);
		assertThat(storage.puts.get()).isEqualTo(1);
	}

	@Test
	void identifiersAndRequiredFieldsFollowTheContract() throws Exception {
		long filas = businessRows();
		Object[][] casos = {
			{ "mensajeId", null, 400 }, { "mensajeId", "", 400 }, { "mensajeId", "ab", 400 }, { "mensajeId", "con espacios", 400 },
			{ "chatId", null, 400 }, { "clienteJid", null, 400 }, { "chatId", "no-es-un-jid", 400 }, { "recibidoEn", null, 400 },
		};
		for (Object[] c : casos) {
			Map<String, Object> b = voucherBody();
			b.put((String) c[0], c[1]);
			assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(b)).getResponse().getStatus()).as(c[0] + "=" + c[1]).isEqualTo(c[2]);
		}
		Map<String, Object> sinMensaje = voucherBody();
		sinMensaje.remove("mensajeId");
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(sinMensaje)).getResponse().getStatus()).isEqualTo(400);
		// Campos de extracción que no caben: error explícito, sin inventar.
		for (Object[] c : new Object[][] { { "monto", null, "VOUCHER_INCOMPLETE" }, { "fecha", null, "VOUCHER_INCOMPLETE" }, { "moneda", null, "VOUCHER_INCOMPLETE" }, { "moneda", "USD", "CURRENCY_NOT_SUPPORTED" } }) {
			Map<String, Object> b = voucherBody();
			ext(b).put((String) c[0], c[1]);
			MvcResult r = send("/api/v1/pagos/voucher", KEY_ING_A, json(b));
			assertThat(r.getResponse().getStatus()).as(c[0] + "=" + c[1]).isEqualTo(422);
			assertThat(tree(r).get("code").asString()).isEqualTo(c[2]);
		}
		Map<String, Object> tres = voucherBody();
		ext(tres).put("monto", 3.555);
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(tres)).getResponse().getStatus()).isEqualTo(400); // más de 2 decimales no se redondea
		Map<String, Object> campoExtra = voucherBody();
		campoExtra.put("organizacion_id", UUID.randomUUID().toString());
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(campoExtra)).getResponse().getStatus()).isEqualTo(400);
		Map<String, Object> url = voucherBody();
		url.put("imagen_base64", "https://ejemplo.invalid/voucher.png");
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(url)).getResponse().getStatus()).isEqualTo(400); // las URLs no se descargan
		assertThat(storage.operaciones).isEmpty();
		assertThat(businessRows()).isEqualTo(filas);
	}

	@Test
	void exactAmountsAreRegisteredWithoutFloatErrorsOrTruncation() throws Exception {
		int n = 0;
		for (String monto : new String[] { "0.01", "0.10", "3.5", "1234.56", "99999999.99" }) {
			Map<String, Object> b = voucherBody();
			ext(b).put("monto", new java.math.BigDecimal(monto));
			b.put("mensajeId", "MSG-MONTO-" + (n++) + "-OK");
			ext(b).put("codigo_operacion", "OP-" + n);
			assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(b)).getResponse().getStatus()).isEqualTo(201);
		}
		assertThat(one("SELECT string_agg(monto::text, ',' ORDER BY monto) FROM keptai.pago")).isEqualTo("0.01,0.10,3.50,1234.56,99999999.99");
	}

	@Test
	void voucherReplayConflictAndSimultaneousRequestsNeverDuplicateThePaymentReceiptOrObject() throws Exception {
		String body = json(voucherBody());
		MvcResult first = send("/api/v1/pagos/voucher", KEY_ING_A, body);
		MvcResult again = send("/api/v1/pagos/voucher", KEY_ING_A, body);
		assertThat(first.getResponse().getStatus()).isEqualTo(201);
		assertThat(again.getResponse().getStatus()).isEqualTo(201);
		assertThat(again.getResponse().getHeader("Idempotency-Replayed")).isEqualTo("true");
		assertThat(tree(again).get("pagoId").asString()).isEqualTo(tree(first).get("pagoId").asString());
		assertThat(count("SELECT count(*) FROM keptai.pago")).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.comprobante")).isEqualTo(1);
		assertThat(storage.puts.get()).as("el reintento idempotente no vuelve a subir").isEqualTo(1);
		// pushName y remitente no forman parte de la identidad funcional.
		Map<String, Object> otroNombre = voucherBody();
		otroNombre.put("pushName", "Otro nombre");
		ext(otroNombre).put("remitente", "Otra persona");
		ext(otroNombre).put("confianza", 0.5);
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(otroNombre)).getResponse().getHeader("Idempotency-Replayed")).isEqualTo("true");
		// Mismo mensajeId con otro archivo, otro importe o otro código: conflicto, sin subir nada.
		Map<String, Object> otroArchivo = voucherBody();
		otroArchivo.put("imagen_base64", Base64.getEncoder().encodeToString(Fixtures.png(10)));
		Map<String, Object> otroMonto = voucherBody();
		ext(otroMonto).put("monto", 4.0);
		for (Map<String, Object> distinto : List.of(otroArchivo, otroMonto)) {
			MvcResult c = send("/api/v1/pagos/voucher", KEY_ING_A, json(distinto));
			assertThat(c.getResponse().getStatus()).isEqualTo(409);
			assertThat(tree(c).get("code").asString()).isEqualTo("IDEMPOTENCY_CONFLICT");
		}
		assertThat(storage.puts.get()).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.pago")).isEqualTo(1);

		storage.reset();
		limpiar();
		List<MvcResult> res = parallel(8, i -> send("/api/v1/pagos/voucher", KEY_ING_A, body));
		assertThat(res).allSatisfy(r -> assertThat(r.getResponse().getStatus()).isEqualTo(201));
		assertThat(res.stream().filter(r -> r.getResponse().getHeader("Idempotency-Replayed") == null).count()).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.pago")).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.comprobante")).isEqualTo(1);
		assertThat(storage.puts.get()).isEqualTo(1);
		assertThat(storage.objetos).hasSize(1);
	}

	@Test
	void aDifferentMessageWithTheSameOperationAmountAndDateIsFlaggedAsDuplicateButNeverVerifiedOrApplied() throws Exception {
		MvcResult primero = send("/api/v1/pagos/voucher", KEY_ING_A, json(voucherBody()));
		Map<String, Object> otro = voucherBody();
		otro.put("mensajeId", "3EB0C767D0A5C7F2A9B9");
		MvcResult dup = send("/api/v1/pagos/voucher", KEY_ING_A, json(otro));
		assertThat(dup.getResponse().getStatus()).isEqualTo(201);
		assertThat(dup.getResponse().getHeader("Idempotency-Replayed")).isNull(); // no es un reintento: otro mensaje de origen
		JsonNode d = tree(dup);
		assertThat(d.get("estadoConciliacion").asString()).isEqualTo("DUPLICADO");
		assertThat(d.get("duplicadoDePagoId").asString()).isEqualTo(tree(primero).get("pagoId").asString());
		assertThat(d.get("fase").asString()).isEqualTo("RECIBIDO");
		assertThat(count("SELECT count(*) FROM keptai.pago")).isEqualTo(2);
		assertThat(count("SELECT count(*) FROM keptai.pago WHERE fase <> 'RECIBIDO' OR verificado_por IS NOT NULL")).isZero();
		assertThat(count("SELECT count(*) FROM keptai.aplicacion_pago")).isZero();
		// Misma referencia con otro monto no es duplicado.
		Map<String, Object> distinto = voucherBody();
		distinto.put("mensajeId", "3EB0C767D0A5C7F2A9C0");
		ext(distinto).put("monto", 4.0);
		assertThat(tree(send("/api/v1/pagos/voucher", KEY_ING_A, json(distinto))).get("estadoConciliacion").asString()).isEqualTo("PENDIENTE");
	}

	@Test
	void anImageThatIsNotAVoucherIsIgnoredWithoutStoringAnything() throws Exception {
		Map<String, Object> no = voucherBody();
		ext(no).put("es_voucher", false);
		no.put("imagen_base64", Base64.getEncoder().encodeToString(Fixtures.png(0)));
		MvcResult r = send("/api/v1/pagos/voucher", KEY_ING_A, json(no));
		assertThat(r.getResponse().getStatus()).isEqualTo(200);
		assertThat(tree(r).get("resultado").asString()).isEqualTo("IGNORADO_NO_VOUCHER");
		Map<String, Object> ilegible = voucherBody();
		ext(ilegible).put("error_parseo", "no se pudo leer");
		ilegible.put("mensajeId", "MSG-ILEGIBLE-1");
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(ilegible)).getResponse().getStatus()).isEqualTo(200);
		assertThat(storage.operaciones).isEmpty();
		assertThat(businessRows()).isZero();
	}

	@Test
	void storageAndDatabaseFailuresLeaveNoDanglingReferencesNorSilentOrphans() throws Exception {
		String body = json(voucherBody());
		// (a) Storage no disponible: 503 y nada queda; el reintento posterior funciona.
		storage.failNextPutTemporarily = true;
		MvcResult a = send("/api/v1/pagos/voucher", KEY_ING_A, body);
		assertThat(a.getResponse().getStatus()).isEqualTo(503);
		assertThat(tree(a).get("code").asString()).isEqualTo("STORAGE_UNAVAILABLE");
		assertThat(businessRows()).isZero();
		assertThat(storage.objetos).isEmpty();
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, body).getResponse().getStatus()).isEqualTo(201);
		assertThat(count("SELECT count(*) FROM keptai.comprobante")).isEqualTo(1);
		limpiar();
		// (b) Rechazo permanente: 502 y nada queda.
		storage.failNextPutPermanently = true;
		MvcResult b = send("/api/v1/pagos/voucher", KEY_ING_A, body);
		assertThat(b.getResponse().getStatus()).isEqualTo(502);
		assertThat(tree(b).get("code").asString()).isEqualTo("STORAGE_REJECTED");
		assertThat(businessRows()).isZero();
		// (c) El objeto se guardó pero la respuesta se perdió: se compensa (se elimina) y el reintento deja un único objeto.
		storage.failNextPutAfterStoring = true;
		MvcResult c = send("/api/v1/pagos/voucher", KEY_ING_A, body);
		assertThat(c.getResponse().getStatus()).isEqualTo(503);
		assertThat(storage.objetos).isEmpty();
		assertThat(businessRows()).isZero();
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, body).getResponse().getStatus()).isEqualTo(201);
		assertThat(storage.objetos).hasSize(1);
		limpiar();
		storage.reset();
		// (d) Falla de base DESPUÉS de subir: se fuerza con un pago previo que ya usa el mismo mensajeId (UNIQUE) sin fila idempotente.
		try (Connection cx = owner(); Statement s = cx.createStatement()) {
			s.execute("INSERT INTO keptai.pago(organizacion_id, monto, fecha_pago, medio, idempotency_key) VALUES ('" + ORG_A + "', 1, current_date, 'OTRO', '3EB0C767D0A5C7F2A9B1')");
		}
		MvcResult d = send("/api/v1/pagos/voucher", KEY_ING_A, body);
		assertThat(d.getResponse().getStatus()).isEqualTo(500);
		assertThat(d.getResponse().getContentAsString()).doesNotContain("3EB0C767D0A5C7F2A9B1").doesNotContain("idempotency");
		assertThat(storage.objetos).as("el objeto subido en el intento fallido se compensa").isEmpty();
		assertThat(count("SELECT count(*) FROM keptai.comprobante")).isZero();
		assertThat(count("SELECT count(*) FROM keptai.solicitud_idempotente")).isZero();
		// (e) Un objeto ya referenciado por un comprobante confirmado no se elimina al compensar.
		limpiar();
		storage.reset();
		Map<String, Object> m = voucherBody();
		String mensaje = "3EB0C767D0A5C7F2A9B1";
		String path = ORG_A + "/vouchers/" + CanonicalJson.sha256("isabel:" + mensaje).substring(0, 32) + "-" + CanonicalJson.sha256(Fixtures.png(0)).substring(0, 16) + ".png";
		storage.objetos.put(path, new FakeVoucherStorage.Objeto(Fixtures.png(0), "image/png"));
		try (Connection cx = owner(); Statement s = cx.createStatement()) {
			s.execute("WITH p AS (INSERT INTO keptai.pago(organizacion_id, monto, fecha_pago, medio, idempotency_key) VALUES ('" + ORG_A
					+ "', 1, current_date, 'OTRO', '" + mensaje + "') RETURNING id) INSERT INTO keptai.comprobante(organizacion_id, pago_id, archivo_storage_path, archivo_hash)"
					+ " SELECT '" + ORG_A + "', id, '" + path + "', '" + CanonicalJson.sha256(Fixtures.png(0)) + "' FROM p");
		}
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(m)).getResponse().getStatus()).isEqualTo(500);
		assertThat(storage.objetos).as("el objeto referenciado por un comprobante confirmado se conserva").containsKey(path);
		assertThat(storage.operaciones).noneMatch(o -> o.startsWith("DELETE"));
	}

	@Test
	void aFailedCompensationIsLoggedWithoutSecretsAndTheOriginalErrorIsPreserved(CapturedOutput output) throws Exception {
		storage.failNextPutAfterStoring = true;
		storage.failDeletes = true;
		MvcResult r = send("/api/v1/pagos/voucher", KEY_ING_A, json(voucherBody()));
		assertThat(r.getResponse().getStatus()).isEqualTo(503);
		assertThat(output.getAll()).contains("VOUCHER_COMPENSACION_FALLIDA").doesNotContain((String) voucherBody().get("imagen_base64"));
		assertThat(storage.objetos).as("queda registrado como huérfano posible, no se pierde en silencio").hasSize(1);
	}

	@Test
	void voucherOrganizationsAreIsolatedAndTheObjectPathCarriesTheAuthenticatedOrganization() throws Exception {
		String body = json(voucherBody());
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, body).getResponse().getStatus()).isEqualTo(201);
		MvcResult b = send("/api/v1/pagos/voucher", KEY_ING_B, body);
		assertThat(b.getResponse().getStatus()).isEqualTo(201);
		assertThat(b.getResponse().getHeader("Idempotency-Replayed")).isNull();
		assertThat(storage.objetos.keySet()).hasSize(2).anyMatch(k -> k.startsWith(ORG_A + "/vouchers/")).anyMatch(k -> k.startsWith(ORG_B + "/vouchers/"));
		assertThat(count("SELECT count(*) FROM keptai.pago WHERE organizacion_id = '" + ORG_A + "'")).isEqualTo(1);
		assertThat(count("SELECT count(*) FROM keptai.pago WHERE organizacion_id = '" + ORG_B + "'")).isEqualTo(1);
		// Ni el cuerpo ni la instancia eligen propietario/ruta: otra instancia o el alcance SCHEDULER no escriben.
		Map<String, Object> otra = voucherBody();
		otra.put("instancia", "otra");
		assertThat(send("/api/v1/pagos/voucher", KEY_ING_A, json(otra)).getResponse().getStatus()).isEqualTo(403);
		assertThat(send("/api/v1/pagos/voucher", KEY_SCH_A, body).getResponse().getStatus()).isEqualTo(403);
		assertThat(send("/api/v1/pagos/voucher", null, body).getResponse().getStatus()).isEqualTo(401);
		assertThat(storage.objetos).hasSize(2);
	}

	// ---------- comunes ----------

	private void assertNoSensitiveContentPersisted(CapturedOutput output, String... sensibles) throws Exception {
		String volcado = one("""
				SELECT coalesce((SELECT string_agg(t::text, ' ') FROM keptai.hoja_resumen t), '') || coalesce((SELECT string_agg(t::text, ' ') FROM keptai.orden t), '')
				 || coalesce((SELECT string_agg(t::text, ' ') FROM keptai.orden_item t), '') || coalesce((SELECT string_agg(t::text, ' ') FROM keptai.solicitud_idempotente t), '')
				 || coalesce((SELECT string_agg(t::text, ' ') FROM keptai.evento_auditoria t), '') || coalesce((SELECT string_agg(t::text, ' ') FROM keptai.canal_whatsapp t), '')
				 || coalesce((SELECT string_agg(t::text, ' ') FROM keptai.pago t), '') || coalesce((SELECT string_agg(t::text, ' ') FROM keptai.comprobante t), '')""");
		for (String s : sensibles) {
			assertThat(volcado).as("persistencia").doesNotContain(s);
			assertThat(output.getAll()).as("logs").doesNotContain(s);
		}
	}

	private <T> List<T> parallel(int n, ThrowingFn<T> fn) throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(n);
		try {
			List<Future<T>> fs = new ArrayList<>();
			java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
			for (int i = 0; i < n; i++) {
				final int idx = i;
				Callable<T> c = () -> {
					go.await();
					return fn.apply(idx);
				};
				fs.add(pool.submit(c));
			}
			go.countDown();
			List<T> out = new ArrayList<>();
			for (Future<T> f : fs) {
				out.add(f.get());
			}
			return out;
		}
		finally {
			pool.shutdownNow();
		}
	}

	@FunctionalInterface
	interface ThrowingFn<T> {
		T apply(int i) throws Exception;
	}

}
