package pe.keptai.backend.n8n;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import pe.keptai.backend.contract.ContractJson;
import pe.keptai.backend.contract.MoneyBridge;
import pe.keptai.backend.contract.N8nDtos.N8nAviso;
import pe.keptai.backend.contract.N8nDtos.N8nPagoVoucherRequest;
import pe.keptai.backend.contract.N8nDtos.N8nPagoVoucherResponse;
import pe.keptai.backend.contract.N8nDtos.N8nVoucherExtraccion;
import pe.keptai.backend.finanzas.ContextoFinanciero;
import pe.keptai.backend.finanzas.MotorPagos;
import pe.keptai.backend.security.ServiceIdentity;
import pe.keptai.backend.tenancy.TenantTransaction;
import pe.keptai.backend.web.BusinessException;
import pe.keptai.backend.web.RequestIdFilter;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Voucher de WF2 (MIG-04/05, alcance de esta entrega): registra un pago en fase RECIBIDO con su comprobante PRIVADO.
 * El cliente sale del contacto registrado por JID y el pago se asocia por CONTEXTO al último pedido no cancelado de ese contacto (no es una aplicación).
 * La lectura de la IA no verifica fondos, no aplica el pago, no modifica saldos y no asocia cliente ni orden. El archivo
 * (Base64 puro del JSON) se valida, se hashea en el backend y se sube al bucket privado con una ruta generada por el
 * servidor; el Base64 jamás se persiste ni se registra. Idempotencia por mensajeId; duplicado financiero solo se CLASIFICA
 * (estado_conciliacion DUPLICADO), nunca se verifica ni se aplica.
 */
@Component
public class N8nVoucherService {

	static final String OPERACION = "PAGO_VOUCHER";

	private static final Logger LOG = LoggerFactory.getLogger(N8nVoucherService.class);

	private static final JsonMapper JSON = ContractJson.newMapper();

	public record Resultado(N8nPagoVoucherResponse respuesta, HttpStatus estado, boolean repetida) {
	}

	private final ObjectProvider<JdbcTemplate> jdbc;

	private final ObjectProvider<MotorPagos> motor;

	private final TenantTransaction tenant;

	private final VoucherStorage storage;

	private final N8nProperties props;

	public N8nVoucherService(ObjectProvider<JdbcTemplate> jdbc, ObjectProvider<MotorPagos> motor, TenantTransaction tenant, VoucherStorage storage,
			N8nProperties props) {
		this.jdbc = jdbc;
		this.motor = motor;
		this.tenant = tenant;
		this.storage = storage;
		this.props = props;
	}

	public Resultado registrar(ServiceIdentity servicio, N8nPagoVoucherRequest req) {
		N8nVoucherExtraccion x = req.extraccion();
		boolean ilegible = x.error_parseo() != null && !x.error_parseo().isBlank();
		if (!Boolean.TRUE.equals(x.es_voucher()) || ilegible) {
			// Imagen que no es un voucher legible: nada se guarda (ni archivo, ni pago, ni clave de idempotencia).
			return new Resultado(new N8nPagoVoucherResponse("IGNORADO_NO_VOUCHER", null, null, null, null, null, null, false, false, null), HttpStatus.OK, false);
		}
		if (x.moneda() == null || x.monto() == null || x.monto().signum() <= 0 || x.fecha() == null) {
			throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "VOUCHER_INCOMPLETE", "Faltan moneda, monto o fecha del voucher: no se inventan");
		}
		if (!"PEN".equals(x.moneda())) {
			throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "CURRENCY_NOT_SUPPORTED", "Solo se registran vouchers en PEN");
		}
		VoucherFile archivo = VoucherFile.decode(req.imagen_base64(), props.voucher().maxFileBytes());
		JdbcTemplate db = jdbc.getIfAvailable();
		if (db == null) {
			throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "Base de datos no disponible");
		}
		BigDecimal monto = MoneyBridge.centsToSoles(MoneyBridge.solesToCents(x.monto())); // exacto: 3.5 -> 3.50, sin float ni truncar

		ObjectNode identidad = JSON.createObjectNode();
		identidad.put("v", 1);
		identidad.put("instancia", req.instancia());
		identidad.put("chatId", req.chatId());
		identidad.put("clienteJid", req.clienteJid());
		identidad.put("mensajeId", req.mensajeId());
		identidad.put("recibidoEn", req.recibidoEn().toInstant().toString());
		identidad.put("tipo", x.tipo());
		identidad.put("banco", x.banco());
		identidad.put("monto", monto);
		identidad.put("moneda", x.moneda());
		identidad.put("fecha", x.fecha().toString());
		identidad.put("hora", x.hora());
		identidad.put("codigo_operacion", x.codigo_operacion());
		identidad.put("archivo_sha256", archivo.sha256());
		String hash = CanonicalJson.sha256(CanonicalJson.of(identidad));
		String path = servicio.organizacionId() + "/vouchers/" + CanonicalJson.sha256(req.instancia() + ":" + req.mensajeId()).substring(0, 32) + "-"
				+ archivo.sha256().substring(0, 16) + "." + archivo.extension();
		IdempotencyStore idem = new IdempotencyStore(db);
		ContextoFinanciero ctx = ContextoFinanciero.servicio(servicio.organizacionId(), servicio.servicioId());

		String[] subida = new String[1];
		boolean[] confirmado = new boolean[1];
		try {
			Resultado r = tenant.execute(() -> {
				// El cliente sale del contacto REGISTRADO (JID canónico), nunca de pushName ni de la IA. Si no existe: 422 antes de
				// reservar la clave, subir el archivo o crear el pago.
				ContactoCanal.Contacto contacto = ContactoCanal.resolver(db, req.clienteJid());
				if (ContactoCanal.JID_CANONICO.matcher(req.chatId()).matches() && !req.chatId().equals(req.clienteJid())) {
					throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "CONTACT_JID_MISMATCH", "El chat y el contacto del voucher no coinciden");
				}
				IdempotencyStore.Reserva reserva = idem.reservar(OPERACION, req.mensajeId(), hash);
				switch (reserva.resultado()) {
					case REPETIDA -> {
						return new Resultado(leer(reserva.respuestaJson()), HttpStatus.CREATED, true);
					}
					case CONFLICTO -> throw new BusinessException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
							"El mismo mensajeId llegó con un contenido funcional o un archivo distinto");
					default -> {
					}
				}
				// Canal vinculado al contacto y su cerrojo: «el último pedido» se elige de forma consistente frente a una ingesta concurrente.
				UUID canal = ContactoCanal.vincular(db, req.instancia(), contacto);
				// Dos mensajes distintos pueden describir la misma operación financiera. Serializar
				// su lectura/alta para que solo uno nazca PENDIENTE y los demás DUPLICADO.
				if (x.codigo_operacion() != null && !x.codigo_operacion().isBlank()) {
					String referencia = servicio.organizacionId() + ":" + x.codigo_operacion() + ":" + monto + ":" + x.fecha();
					db.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))::text", String.class, "VOUCHER_REF:" + referencia);
				}
				// Punto de guarda: tras un error SQL la transacción queda abortada y no admitiría ni la consulta de la compensación.
				java.sql.Savepoint guarda = db.execute((org.springframework.jdbc.core.ConnectionCallback<java.sql.Savepoint>) java.sql.Connection::setSavepoint);
				try {
					subida[0] = path; // desde aquí puede existir el objeto, aunque la respuesta de Storage se pierda
					subir(path, archivo);
					N8nPagoVoucherResponse resp = crear(db, ctx, req, x, monto, archivo, path, contacto, canal);
					idem.completar(OPERACION, req.mensajeId(), N8nIngestaService.escribir(resp));
					return new Resultado(resp, HttpStatus.CREATED, false);
				}
				catch (RuntimeException e) {
					// Compensación DENTRO de la transacción (el cerrojo de la clave sigue tomado): ninguna otra solicitud
					// con la misma clave puede haber subido ya este objeto.
					try {
						db.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) c -> {
							c.rollback(guarda);
							return null;
						});
						compensar(db, path);
					}
					catch (RuntimeException sinGuarda) {
						LOG.warn("VOUCHER_COMPENSACION_OMITIDA no se pudo restablecer la transacción; conciliar la ruta {}", path);
					}
					throw e;
				}
			});
			confirmado[0] = true;
			return r;
		}
		catch (RuntimeException e) {
			if (!confirmado[0] && subida[0] != null && !(e instanceof BusinessException)) {
				LOG.warn("VOUCHER_OBJETO_POSIBLEMENTE_HUERFANO tras un fallo al confirmar la transacción; conciliar la ruta {}", subida[0]);
			}
			throw e;
		}
	}

	private void subir(String path, VoucherFile archivo) {
		try {
			storage.put(path, archivo.bytes(), archivo.contentType());
		}
		catch (VoucherStorage.StorageException e) {
			if (e.retryable()) {
				throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Almacenamiento de vouchers no disponible: reintentar");
			}
			throw new BusinessException(HttpStatus.BAD_GATEWAY, "STORAGE_REJECTED", "El almacenamiento rechazó el archivo");
		}
	}

	private void compensar(JdbcTemplate db, String path) {
		try {
			Integer referencias = db.queryForObject("SELECT count(*) FROM keptai.comprobante WHERE organizacion_id = keptai.app_organizacion_actual() AND archivo_storage_path = ?",
					Integer.class, path);
			if (referencias != null && referencias > 0) {
				return; // un comprobante ya confirmado usa este objeto: no se toca
			}
			storage.delete(path);
		}
		catch (RuntimeException e) {
			LOG.warn("VOUCHER_COMPENSACION_FALLIDA ruta {} ({})", path, e.getClass().getSimpleName());
		}
	}

	private N8nPagoVoucherResponse crear(JdbcTemplate db, ContextoFinanciero ctx, N8nPagoVoucherRequest req, N8nVoucherExtraccion x, BigDecimal monto,
			VoucherFile archivo, String path, ContactoCanal.Contacto contacto, UUID canal) {
		// Asociación CONTEXTUAL (no verificación ni aplicación): el último pedido no cancelado del mismo cliente y canal.
		// Se ignoran ordenRef/fecha/nombres enviados por el cliente. Un empate exacto de creado_en no se resuelve al azar.
		List<Object[]> candidatas = db.query("""
				SELECT id, ref, creado_en FROM keptai.orden
				 WHERE organizacion_id = keptai.app_organizacion_actual() AND canal_id = ? AND cliente_id = ? AND estado <> 'CANCELADA'
				 ORDER BY creado_en DESC, id DESC LIMIT 2""", (rs, i) -> new Object[] { rs.getObject(1, UUID.class), rs.getString(2), rs.getObject(3, java.time.OffsetDateTime.class) },
				canal, contacto.clienteId());
		boolean ambigua = candidatas.size() == 2 && candidatas.get(0)[2].equals(candidatas.get(1)[2]);
		UUID ordenId = candidatas.isEmpty() || ambigua ? null : (UUID) candidatas.get(0)[0];
		String ordenRef = ordenId == null ? null : (String) candidatas.get(0)[1];
		List<N8nAviso> avisos = new ArrayList<>();
		if (ordenId == null) {
			avisos.add(ambigua ? new N8nAviso("ORDEN_AMBIGUA", "Hay dos pedidos igual de recientes: no se eligió ninguno; Administración lo asocia")
					: new N8nAviso("SIN_ORDEN", "El contacto no tiene un pedido elegible: el voucher queda sin orden asociada"));
		}
		Optional<UUID> original = x.codigo_operacion() == null || x.codigo_operacion().isBlank() ? Optional.empty()
				: motor.getObject().buscarOriginalPorReferencia(ctx, x.codigo_operacion(), monto, x.fecha());
		String estado = original.isPresent() ? "DUPLICADO" : ordenId == null ? "SIN_ORDEN" : "PENDIENTE"; // DUPLICADO prevalece sobre SIN_ORDEN
		String medio = x.tipo() == null ? "OTRO" : x.tipo();
		UUID pagoId = db.queryForObject("""
				INSERT INTO keptai.pago (organizacion_id, cliente_id, canal_id, orden_contexto_id, monto, moneda, fecha_pago, medio, banco, codigo_operacion,
				       fase, estado_conciliacion, duplicado_de_pago_id, idempotency_key)
				VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?, 'PEN', ?, ?, ?, ?, 'RECIBIDO', ?, ?, ?) RETURNING id""",
				UUID.class, contacto.clienteId(), canal, ordenId, monto, x.fecha(), medio, vacioANulo(x.banco()), vacioANulo(x.codigo_operacion()), estado, original.orElse(null), req.mensajeId());

		ObjectNode ocr = JSON.createObjectNode();
		ocr.put("tipo", x.tipo());
		ocr.put("banco", x.banco());
		ocr.put("monto", monto);
		ocr.put("moneda", x.moneda());
		ocr.put("fecha", x.fecha().toString());
		ocr.put("hora", x.hora());
		ocr.put("codigo_operacion", x.codigo_operacion());
		ocr.put("remitente", x.remitente());
		ocr.put("destinatario", x.destinatario());
		db.update("""
				INSERT INTO keptai.comprobante (organizacion_id, pago_id, banco, archivo_storage_path, archivo_hash, ocr_extraccion, confianza,
				       instancia_origen, provider_message_id)
				VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?, ?::jsonb, ?, ?, ?)""", pagoId, vacioANulo(x.banco()), path, archivo.sha256(),
				ocr.toString(), x.confianza().setScale(3, java.math.RoundingMode.HALF_UP), req.instancia(), req.mensajeId());
		db.update("""
				INSERT INTO keptai.evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id)
				VALUES (keptai.app_organizacion_actual(), NULL, 'N8N', 'VOUCHER_RECIBIDO', 'pago', ?, ?::jsonb, ?)""",
				pagoId, "{\"fase\":\"RECIBIDO\",\"estadoConciliacion\":\"" + estado + "\",\"archivoBytes\":" + archivo.bytes().length + ",\"clienteId\":\"" + contacto.clienteId()
						+ "\",\"contactoId\":\"" + contacto.id() + "\",\"ordenId\":" + (ordenId == null ? "null" : "\"" + ordenId + "\"") + ",\"ordenRef\":" + (ordenRef == null ? "null" : "\"" + ordenRef + "\"")
						+ ",\"criterio\":\"ultimo_pedido_no_cancelado_del_canal\"}", MDC.get(RequestIdFilter.MDC_KEY));
		return new N8nPagoVoucherResponse("REGISTRADO", pagoId, "RECIBIDO", estado, original.orElse(null), ordenRef, null, false, false, avisos);
	}

	private static String vacioANulo(String s) {
		return s == null || s.isBlank() ? null : s;
	}

	private static N8nPagoVoucherResponse leer(String json) {
		try {
			return JSON.readValue(json, N8nPagoVoucherResponse.class);
		}
		catch (JacksonException e) {
			throw new IllegalStateException("Respuesta idempotente ilegible", e);
		}
	}

}
