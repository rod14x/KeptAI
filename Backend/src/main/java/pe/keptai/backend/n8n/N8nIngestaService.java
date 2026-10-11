package pe.keptai.backend.n8n;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import pe.keptai.backend.contract.ContractJson;
import pe.keptai.backend.contract.N8nDtos.N8nAviso;
import pe.keptai.backend.contract.N8nDtos.N8nExtraccionItem;
import pe.keptai.backend.contract.N8nDtos.N8nExtraccionOrden;
import pe.keptai.backend.contract.N8nDtos.N8nIngestaOrdenRequest;
import pe.keptai.backend.contract.N8nDtos.N8nIngestaOrdenResponse;
import pe.keptai.backend.security.ServiceIdentity;
import pe.keptai.backend.tenancy.TenantTransaction;
import pe.keptai.backend.web.BusinessException;
import pe.keptai.backend.web.RequestIdFilter;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Ingesta de WF1 (MIG-05, alcance de esta entrega): crea, en UNA transacción con contexto de servicio INGESTA, el canal
 * (metadatos de enrutamiento), una orden BORRADOR y su hoja de resumen BORRADOR v1 a partir de la proyección
 * ESTRUCTURADA de la extracción. No guarda el transcript, el resumen entrante ni el crudo del modelo; no asocia cliente,
 * marca ni vendedor (queda para la revisión humana); no confirma, no aprueba crédito ni habilita producción.
 */
@Component
public class N8nIngestaService {

	static final String OPERACION = "ORDEN_INGESTA";

	private static final JsonMapper JSON = ContractJson.newMapper();

	public record Resultado(N8nIngestaOrdenResponse respuesta, boolean repetida) {
	}

	private final ObjectProvider<JdbcTemplate> jdbc;

	private final TenantTransaction tenant;

	public N8nIngestaService(ObjectProvider<JdbcTemplate> jdbc, TenantTransaction tenant) {
		this.jdbc = jdbc;
		this.tenant = tenant;
	}

	public Resultado registrar(ServiceIdentity servicio, N8nIngestaOrdenRequest req) {
		JdbcTemplate db = jdbc.getIfAvailable();
		if (db == null) {
			throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "Base de datos no disponible");
		}
		N8nExtraccionOrden x = req.extraccion();
		validarCoherencia(x);
		ObjectNode estructurada = estructurada(x);
		String clave = req.instancia() + ":" + req.chatId() + ":" + req.generadoEn().toInstant();
		ObjectNode identidad = JSON.createObjectNode();
		identidad.put("v", 1);
		identidad.put("instancia", req.instancia());
		identidad.put("chatId", req.chatId());
		identidad.put("vendedorJid", req.vendedorJid());
		identidad.put("generadoEn", req.generadoEn().toInstant().toString());
		identidad.set("extraccion", estructurada);
		String hash = CanonicalJson.sha256(CanonicalJson.of(identidad));
		IdempotencyStore idem = new IdempotencyStore(db);

		return tenant.execute(() -> {
			IdempotencyStore.Reserva reserva = idem.reservar(OPERACION, clave, hash);
			switch (reserva.resultado()) {
				case REPETIDA -> {
					return new Resultado(leer(reserva.respuestaJson()), true);
				}
				case CONFLICTO -> throw new BusinessException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
						"La misma solicitud (instancia, chat y generadoEn) llegó con un contenido funcional distinto");
				default -> {
				}
			}
			N8nIngestaOrdenResponse resp = crear(db, servicio, req, x, estructurada, clave);
			idem.completar(OPERACION, clave, escribir(resp));
			return new Resultado(resp, false);
		});
	}

	private N8nIngestaOrdenResponse crear(JdbcTemplate db, ServiceIdentity servicio, N8nIngestaOrdenRequest req, N8nExtraccionOrden x,
			ObjectNode estructurada, String clave) {
		List<N8nAviso> avisos = new ArrayList<>();
		Set<String> ausentes = new LinkedHashSet<>(x.faltantes());

		// Serializar también la creación del canal: ON CONFLICT + SELECT comparte snapshot.
		long numero = siguienteNumero(db);
		UUID canal = db.queryForObject("""
				WITH nuevo AS (
				  INSERT INTO keptai.canal_whatsapp (organizacion_id, instancia, chat_jid)
				  VALUES (keptai.app_organizacion_actual(), ?, ?) ON CONFLICT (organizacion_id, instancia, chat_jid) DO NOTHING RETURNING id)
				SELECT id FROM nuevo UNION ALL
				SELECT id FROM keptai.canal_whatsapp WHERE organizacion_id = keptai.app_organizacion_actual() AND instancia = ? AND chat_jid = ?
				LIMIT 1""", UUID.class, req.instancia(), req.chatId(), req.instancia(), req.chatId());

		// Condición de pago: solo lo que cabe en el modelo sin inventar. El resto queda en la extracción estructurada.
		String condicion = null;
		Integer plazo = null;
		BigDecimal anticipo = BigDecimal.ZERO;
		var cp = x.condicion_pago();
		if (cp != null && cp.tipo() != null) {
			switch (cp.tipo()) {
				case "CONTADO" -> condicion = "CONTADO";
				case "CREDITO" -> {
					if (cp.plazo_dias() != null && cp.plazo_dias() >= 15 && cp.plazo_dias() <= 30) {
						condicion = "CREDITO";
						plazo = cp.plazo_dias();
					}
					else {
						avisos.add(aviso("PLAZO_CREDITO_NO_REGISTRADO", "Crédito sin plazo de 15 a 30 días: la condición queda por definir en la revisión"));
					}
				}
				case "ANTICIPO" -> {
					if (cp.anticipo_monto() != null) {
						condicion = "ANTICIPO";
						anticipo = cp.anticipo_monto().setScale(2, RoundingMode.UNNECESSARY);
					}
					else {
						avisos.add(aviso("ANTICIPO_NO_REGISTRADO", "Anticipo sin monto exacto: la condición queda por definir en la revisión"));
					}
				}
				default -> {
				}
			}
			if (condicion == null && !"NO_DEFINIDA".equals(cp.tipo())) {
				ausentes.add("condicion_pago");
			}
		}
		BigDecimal total = x.total() == null ? null : x.total().setScale(2, RoundingMode.UNNECESSARY);
		if (total == null) {
			ausentes.add("total");
		}

		String ref = "ORD-" + numero;
		UUID ordenId = db.queryForObject("""
				INSERT INTO keptai.orden (organizacion_id, ref, cliente_id, marca_id, vendedor_id, canal_id, estado, condicion_pago, plazo_dias,
				       anticipo_requerido, total, moneda, fecha_entrega_solicitada, origen, idempotency_key)
				VALUES (keptai.app_organizacion_actual(), ?, NULL, NULL, NULL, ?, 'BORRADOR', ?, ?, ?, ?, 'PEN', ?, 'WHATSAPP', ?) RETURNING id""",
				UUID.class, ref, canal, condicion, plazo, anticipo, total, x.fecha_entrega_solicitada(), clave);

		// Ítems: solo si TODOS están completos (cantidad y precio); nunca se completan ni se descartan en silencio algunos.
		List<N8nExtraccionItem> items = x.items() == null ? List.of() : x.items();
		int guardados = 0;
		if (!items.isEmpty()) {
			if (items.stream().allMatch(i -> i.cantidad() != null && i.precio_unitario() != null)) {
				for (N8nExtraccionItem i : items) {
					db.update("""
							INSERT INTO keptai.orden_item (organizacion_id, orden_id, descripcion, tela, talla, logo, cantidad, precio_unit)
							VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?)""", ordenId, i.descripcion(), vacioANulo(i.tela()),
							vacioANulo(i.detalle_tallas()), vacioANulo(i.logo_diseno()), i.cantidad(), i.precio_unitario().setScale(2, RoundingMode.UNNECESSARY));
					guardados++;
				}
			}
			else {
				ausentes.add("items");
				avisos.add(aviso("ITEMS_INCOMPLETOS", "Hay ítems sin cantidad o precio: no se crearon líneas; el detalle queda en la hoja para revisar"));
			}
		}
		if (guardados > 0 && total != null) {
			BigDecimal suma = items.stream().map(i -> i.precio_unitario().multiply(BigDecimal.valueOf(i.cantidad()))).reduce(BigDecimal.ZERO, BigDecimal::add);
			if (suma.compareTo(total) != 0) {
				avisos.add(aviso("TOTAL_NO_COINCIDE_CON_ITEMS", "El total declarado no coincide con la suma de los ítems; se conserva lo declarado"));
			}
		}
		avisos.add(aviso("CLIENTE_SIN_ASOCIAR", "El cliente no se crea ni se asocia automáticamente: lo confirma la revisión"));
		avisos.add(aviso("MARCA_SIN_ASIGNAR", "La marca declarada queda en la hoja; no se asigna sola"));
		avisos.add(aviso("VENDEDOR_SIN_RESOLVER", "vendedorJid no identifica al autor: la autoría la fija la confirmación autenticada"));

		List<String> listaAusentes = ausentes.stream().limit(50).toList();
		BigDecimal confianza = x.confianza().setScale(3, RoundingMode.HALF_UP);
		db.update("""
				INSERT INTO keptai.hoja_resumen (organizacion_id, orden_id, canal_id, version, extraccion, campos_ausentes, resumen_md, confianza,
				       mensajes_procesados, estado)
				VALUES (keptai.app_organizacion_actual(), ?, ?, 1, ?::jsonb, ?::jsonb, ?, ?, ?, 'BORRADOR')""",
				ordenId, canal, estructurada.toString(), escribirLista(listaAusentes), resumen(ref, x, listaAusentes), confianza, req.mensajesProcesados());

		db.update("""
				INSERT INTO keptai.evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id)
				VALUES (keptai.app_organizacion_actual(), NULL, 'N8N', 'ORDEN_INGESTA_BORRADOR', 'orden', ?, ?::jsonb, ?)""",
				ordenId, "{\"ref\":\"" + ref + "\",\"hojaVersion\":1,\"items\":" + guardados + "}", MDC.get(RequestIdFilter.MDC_KEY));
		return new N8nIngestaOrdenResponse(ordenId, ref, "BORRADOR", 1, listaAusentes, avisos);
	}

	/** Referencia legible ORD-n por organización; el cerrojo transaccional serializa la asignación (UNIQUE organización+ref). */
	private long siguienteNumero(JdbcTemplate db) {
		db.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended('ORD:' || keptai.app_organizacion_actual()::text, 0))::text", String.class);
		return db.queryForObject("""
				SELECT coalesce(max(substring(ref from 5)::bigint), 0) + 1 FROM keptai.orden
				 WHERE organizacion_id = keptai.app_organizacion_actual() AND ref ~ '^ORD-[0-9]{1,9}$'""", Long.class);
	}

	private static void validarCoherencia(N8nExtraccionOrden x) {
		var cp = x.condicion_pago();
		if (cp != null && "ANTICIPO".equals(cp.tipo()) && cp.anticipo_monto() != null && x.total() != null && cp.anticipo_monto().compareTo(x.total()) > 0) {
			throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "AMOUNT_INCONSISTENT", "El anticipo declarado supera el total");
		}
	}

	/** Proyección permitida de la extracción: sin el crudo del modelo y sin texto libre de error (puede eco del chat). */
	static ObjectNode estructurada(N8nExtraccionOrden x) {
		ObjectNode n = JSON.valueToTree(x);
		n.remove("crudo");
		boolean fallo = n.has("error_parseo") && !n.get("error_parseo").isNull() && !n.get("error_parseo").asString().isEmpty();
		n.remove("error_parseo");
		if (fallo) {
			n.put("parseo_fallido", true);
		}
		return n;
	}

	/** Resumen construido SOLO con los datos estructurados; el hojaResumenMd entrante se valida pero no se guarda. */
	private static String resumen(String ref, N8nExtraccionOrden x, List<String> ausentes) {
		StringBuilder sb = new StringBuilder("# Pedido propuesto ").append(ref).append(" (borrador, pendiente de revisión)\n");
		if (x.cliente() != null && x.cliente().nombre() != null && !x.cliente().nombre().isBlank()) {
			sb.append("- Cliente declarado: ").append(x.cliente().nombre());
			if (x.cliente().ruc() != null && !x.cliente().ruc().isBlank()) {
				sb.append(" (").append(x.cliente().ruc()).append(')');
			}
			sb.append('\n');
		}
		if (x.marca() != null) {
			sb.append("- Marca declarada: ").append(x.marca()).append('\n');
		}
		if (x.items() != null) {
			for (N8nExtraccionItem i : x.items()) {
				sb.append("- ").append(i.cantidad() == null ? "?" : i.cantidad()).append(" × ").append(i.descripcion());
				sb.append(i.precio_unitario() == null ? " — precio por definir" : " — S/ " + i.precio_unitario().setScale(2, RoundingMode.UNNECESSARY)).append('\n');
			}
		}
		sb.append("- Total declarado: ").append(x.total() == null ? "por definir" : "S/ " + x.total().setScale(2, RoundingMode.UNNECESSARY)).append('\n');
		if (x.condicion_pago() != null && x.condicion_pago().tipo() != null) {
			sb.append("- Condición declarada: ").append(x.condicion_pago().tipo()).append('\n');
		}
		if (!ausentes.isEmpty()) {
			sb.append("- Datos faltantes: ").append(String.join(", ", ausentes)).append('\n');
		}
		return sb.toString();
	}

	private static N8nAviso aviso(String codigo, String mensaje) {
		return new N8nAviso(codigo, mensaje);
	}

	private static String vacioANulo(String s) {
		return s == null || s.isBlank() ? null : s;
	}

	private static String escribirLista(List<String> l) {
		try {
			return JSON.writeValueAsString(l);
		}
		catch (JacksonException e) {
			throw new IllegalStateException(e);
		}
	}

	static String escribir(Object o) {
		try {
			return JSON.writeValueAsString(o);
		}
		catch (JacksonException e) {
			throw new IllegalStateException("No se pudo serializar la respuesta", e);
		}
	}

	private static N8nIngestaOrdenResponse leer(String json) {
		try {
			return JSON.readValue(json, N8nIngestaOrdenResponse.class);
		}
		catch (JacksonException e) {
			throw new IllegalStateException("Respuesta idempotente ilegible", e);
		}
	}

	/** Solo para pruebas del contrato de canonicalización. */
	static JsonNode canonicalInput(N8nExtraccionOrden x) {
		return estructurada(x);
	}

}
