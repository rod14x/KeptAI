package pe.keptai.backend.panel;

import static pe.keptai.backend.panel.PanelMapping.lima;
import static pe.keptai.backend.panel.PanelMapping.nonNegative;
import static pe.keptai.backend.panel.PanelMapping.nonNegativeOrZero;
import static pe.keptai.backend.panel.PanelMapping.positive;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;
import pe.keptai.backend.contract.AuditDtos.AuditChange;
import pe.keptai.backend.contract.AuditDtos.AuditEvent;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.ContractEnums.AlertResolution;
import pe.keptai.backend.contract.ContractEnums.CreditAuthorizationStatus;
import pe.keptai.backend.contract.ContractEnums.DueBucket;
import pe.keptai.backend.contract.ContractEnums.MatchReason;
import pe.keptai.backend.contract.ContractEnums.PaymentPhase;
import pe.keptai.backend.contract.ContractEnums.ReceivableStatus;
import pe.keptai.backend.contract.ContractEnums.ReconciliationClass;
import pe.keptai.backend.contract.ContractEnums.ReconciliationStatus;
import pe.keptai.backend.contract.ContractEnums.TermStartEvent;
import pe.keptai.backend.contract.ContractEnums.VerificationMethod;
import pe.keptai.backend.contract.ContractJson;
import pe.keptai.backend.contract.OrderDtos.CustomerRef;
import pe.keptai.backend.contract.OrderDtos.Order;
import pe.keptai.backend.contract.PaymentDtos.Payment;
import pe.keptai.backend.contract.PaymentDtos.PaymentVerification;
import pe.keptai.backend.contract.PaymentDtos.ReconciliationCandidate;
import pe.keptai.backend.contract.PaymentDtos.ReconciliationResult;
import pe.keptai.backend.contract.ReceivableDtos.CollectionAlert;
import pe.keptai.backend.contract.ReceivableDtos.CreditAuthorization;
import pe.keptai.backend.contract.ReceivableDtos.CustomerStatement;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;
import pe.keptai.backend.contract.ReceivableDtos.StatementApplication;
import pe.keptai.backend.contract.ReceivableDtos.StatementOrder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lecturas del panel (MIG-06/07, INT-FE-API-001) sobre las tablas y vistas de Andrés, siempre dentro de
 * {@link PanelContext#read}: RLS decide qué filas ve cada rol (JEFE_TALLER no ve clientes ni obligaciones, INGESTA no
 * entra por aquí). Saldo y cobrado salen de {@code v_saldo_obligacion}; la mora del cliente de {@code v_cliente_mora}.
 * Estado de la cuenta por cobrar y tramo de vencimiento se derivan con la misma regla que
 * {@code recalcular_obligaciones} (V8) para no depender de que el job haya corrido.
 */
@Component
public class PanelQueries {

	/** Importes de evento_auditoria.cambios con su escala exacta (240.00, no 240.0). */
	private static final JsonMapper JSON = ContractJson.newMapper().rebuild()
		.enable(tools.jackson.databind.DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
		.build();

	private static final String HOY = "timezone(org.zona_horaria, now())::date";

	private final PanelContext panel;

	public PanelQueries(PanelContext panel) {
		this.panel = panel;
	}

	/* ------------------------------------------------------------------ Órdenes */

	private static final String ORDERS = """
			WITH base AS (
			  SELECT o.id, o.ref, o.cliente_id, c.razon_social AS cliente, m.nombre AS marca,
			         (SELECT string_agg(DISTINCT l.nombre, ', ' ORDER BY l.nombre)
			            FROM keptai.orden_item i
			            JOIN keptai.linea_producto l ON l.organizacion_id = i.organizacion_id AND l.id = i.linea_id
			           WHERE i.organizacion_id = o.organizacion_id AND i.orden_id = o.id) AS linea,
			         o.tipo_produccion, o.total, o.estado, o.origen, o.condicion_pago, o.plazo_dias, o.anticipo_requerido,
			         o.fecha_entrega_solicitada, o.fecha_inicio_produccion, d.fecha_despacho, ob.vence_en,
			         CASE WHEN ob.id IS NULL THEN NULL
			              WHEN ob.estado = 'ANULADA' THEN 'voided'
			              WHEN coalesce(s.saldo, ob.monto) = 0 THEN 'paid'
			              WHEN ob.vence_en < %1$s THEN 'overdue'
			              WHEN coalesce(s.cobrado, 0) > 0 THEN 'partially_paid'
			              ELSE 'pending' END AS cxc,
			         org.nombre LIKE 'DEMO %%' AS demo, o.creado_en
			    FROM keptai.orden o
			    JOIN keptai.organizacion org ON org.id = o.organizacion_id
			    LEFT JOIN keptai.cliente c ON c.organizacion_id = o.organizacion_id AND c.id = o.cliente_id
			    LEFT JOIN keptai.marca m ON m.organizacion_id = o.organizacion_id AND m.id = o.marca_id
			    LEFT JOIN keptai.despacho d ON d.organizacion_id = o.organizacion_id AND d.orden_id = o.id
			    LEFT JOIN keptai.obligacion_cobro ob ON ob.organizacion_id = o.organizacion_id AND ob.orden_id = o.id
			    LEFT JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = ob.id
			)
			SELECT * FROM base
			 WHERE (CAST(? AS uuid) IS NULL OR id = CAST(? AS uuid))
			   AND (CAST(? AS uuid) IS NULL OR cliente_id = CAST(? AS uuid))
			   AND (CAST(? AS text) IS NULL OR estado = CAST(? AS text))
			   AND (CAST(? AS text) IS NULL OR cxc = CAST(? AS text))
			 ORDER BY creado_en DESC, id
			 LIMIT ? OFFSET ?""".formatted(HOY);

	public PageResponse<Order> orders(PageRequest page, UUID customerId, String status, String receivableStatus) {
		String estado = PanelMapping.orNull(PanelMapping.ORDER_STATUS_SQL, status, "status");
		if (receivableStatus != null && !receivableStatus.isBlank()
				&& !List.of("pending", "partially_paid", "paid", "overdue", "voided").contains(receivableStatus)) {
			throw PanelException.badRequest("Valor no válido para receivable_status");
		}
		String cxc = receivableStatus == null || receivableStatus.isBlank() ? null : receivableStatus;
		return panel.read(() -> page.page(panel.jdbc().query(ORDERS, (rs, i) -> order(rs), null, null, customerId,
				customerId, estado, estado, cxc, cxc, page.fetch(), page.offset())));
	}

	public Order order(UUID id) {
		return panel.read(() -> orderInTx(id));
	}

	/** Para servicios que ya están dentro de una transacción del panel. */
	Order orderInTx(UUID id) {
		List<Order> rows = panel.jdbc().query(ORDERS, (rs, i) -> order(rs), id, id, null, null, null, null, null, null,
				1, 0);
		if (rows.isEmpty()) {
			throw PanelException.notFound("Pedido no encontrado");
		}
		return rows.get(0);
	}

	private static Order order(ResultSet rs) throws SQLException {
		UUID cliente = rs.getObject("cliente_id", UUID.class);
		String nombre = rs.getString("cliente");
		String cxc = rs.getString("cxc");
		LocalDate despacho = rs.getObject("fecha_despacho", LocalDate.class);
		String condicion = rs.getString("condicion_pago");
		return new Order(rs.getObject("id", UUID.class), rs.getString("ref"),
				cliente != null && nombre != null ? new CustomerRef(cliente, nombre) : null, rs.getString("marca"),
				rs.getString("linea"), PanelMapping.productionMode(rs.getString("tipo_produccion")),
				positive(rs.getBigDecimal("total")), PanelMapping.ORDER_STATUS.get(rs.getString("estado")),
				PanelMapping.SOURCE.get(rs.getString("origen")),
				condicion == null ? null : PanelMapping.CONDITION.get(condicion), (Integer) rs.getObject("plazo_dias"),
				nonNegativeOrZero(rs.getBigDecimal("anticipo_requerido")),
				rs.getObject("fecha_entrega_solicitada", LocalDate.class),
				rs.getObject("fecha_inicio_produccion", LocalDate.class), despacho,
				cxc == null ? null : receivableStatus(cxc), despacho == null ? null : rs.getObject("vence_en", LocalDate.class),
				null, PanelMapping.dataOrigin(rs.getBoolean("demo"), rs.getString("origen")),
				lima(rs.getObject("creado_en", OffsetDateTime.class)));
	}

	private static ReceivableStatus receivableStatus(String v) {
		return switch (v) {
			case "voided" -> ReceivableStatus.VOIDED;
			case "paid" -> ReceivableStatus.PAID;
			case "overdue" -> ReceivableStatus.OVERDUE;
			case "partially_paid" -> ReceivableStatus.PARTIALLY_PAID;
			default -> ReceivableStatus.PENDING;
		};
	}

	/* ------------------------------------------------------------------ Cuentas por cobrar */

	private static final String RECEIVABLES = """
			WITH base AS (
			  SELECT ob.id, ob.orden_id, o.ref, o.cliente_id, c.razon_social AS cliente, ob.monto,
			         coalesce(s.cobrado, 0) AS cobrado, coalesce(s.saldo, ob.monto) AS saldo, ob.plazo_dias, ob.vence_en,
			         %1$s AS hoy,
			         CASE WHEN ob.estado = 'ANULADA' THEN 'voided'
			              WHEN coalesce(s.saldo, ob.monto) = 0 THEN 'paid'
			              WHEN ob.vence_en < %1$s THEN 'overdue'
			              WHEN coalesce(s.cobrado, 0) > 0 THEN 'partially_paid'
			              ELSE 'pending' END AS estado,
			         CASE WHEN ob.vence_en IS NULL THEN 'awaiting_dispatch'
			              WHEN coalesce(s.saldo, ob.monto) = 0 OR ob.estado = 'ANULADA' THEN 'not_due'
			              WHEN ob.vence_en < %1$s THEN 'overdue'
			              WHEN ob.vence_en = %1$s THEN 'due_today'
			              ELSE 'not_due' END AS tramo,
			         ob.creado_en
			    FROM keptai.obligacion_cobro ob
			    JOIN keptai.organizacion org ON org.id = ob.organizacion_id
			    JOIN keptai.orden o ON o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
			    JOIN keptai.cliente c ON c.organizacion_id = o.organizacion_id AND c.id = o.cliente_id
			    LEFT JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = ob.id
			)
			SELECT * FROM base
			 WHERE (CAST(? AS uuid) IS NULL OR id = CAST(? AS uuid))
			   AND (CAST(? AS uuid) IS NULL OR cliente_id = CAST(? AS uuid))
			   AND (CAST(? AS text) IS NULL OR tramo = CAST(? AS text))
			 ORDER BY vence_en NULLS LAST, creado_en, id
			 LIMIT ? OFFSET ?""".formatted(HOY);

	public PageResponse<Receivable> receivables(PageRequest page, UUID customerId, String dueBucket) {
		if (dueBucket != null && !dueBucket.isBlank()
				&& !List.of("awaiting_dispatch", "not_due", "due_today", "overdue").contains(dueBucket)) {
			throw PanelException.badRequest("Valor no válido para due_bucket");
		}
		String tramo = dueBucket == null || dueBucket.isBlank() ? null : dueBucket;
		return panel.read(() -> page.page(panel.jdbc().query(RECEIVABLES, (rs, i) -> receivable(rs), null, null,
				customerId, customerId, tramo, tramo, page.fetch(), page.offset())));
	}

	public Receivable receivable(UUID id) {
		return panel.read(() -> receivableInTx(id));
	}

	Receivable receivableInTx(UUID id) {
		List<Receivable> rows = panel.jdbc().query(RECEIVABLES, (rs, i) -> receivable(rs), id, id, null, null, null,
				null, 1, 0);
		if (rows.isEmpty()) {
			throw PanelException.notFound("Cuenta por cobrar no encontrada");
		}
		return rows.get(0);
	}

	private static Receivable receivable(ResultSet rs) throws SQLException {
		LocalDate vence = rs.getObject("vence_en", LocalDate.class);
		LocalDate hoy = rs.getObject("hoy", LocalDate.class);
		String tramo = rs.getString("tramo");
		DueBucket bucket = switch (tramo) {
			case "awaiting_dispatch" -> DueBucket.AWAITING_DISPATCH;
			case "overdue" -> DueBucket.OVERDUE;
			case "due_today" -> DueBucket.DUE_TODAY;
			default -> DueBucket.NOT_DUE;
		};
		int atraso = bucket == DueBucket.OVERDUE ? (int) Math.min(36_500, ChronoUnit.DAYS.between(vence, hoy)) : 0;
		return new Receivable(rs.getObject("id", UUID.class), rs.getObject("orden_id", UUID.class), rs.getString("ref"),
				new CustomerRef(rs.getObject("cliente_id", UUID.class), rs.getString("cliente")),
				positive(rs.getBigDecimal("monto")), nonNegativeOrZero(rs.getBigDecimal("cobrado")),
				nonNegativeOrZero(rs.getBigDecimal("saldo")), Math.min(365, rs.getInt("plazo_dias")),
				TermStartEvent.DISPATCH, vence, bucket, atraso, receivableStatus(rs.getString("estado")));
	}

	/* ------------------------------------------------------------------ Alertas */

	public PageResponse<CollectionAlert> alerts(PageRequest page, String status) {
		String estado = PanelMapping.orNull(PanelMapping.ALERT_STATUS_SQL, status, "status");
		return panel.read(() -> page.page(panel.jdbc().query("""
				SELECT id, obligacion_id, pago_id, regla, estado, responsable_id, resolucion, creado_en, cerrada_en
				  FROM keptai.alerta_cobranza
				 WHERE (CAST(? AS text) IS NULL OR estado = CAST(? AS text))
				 ORDER BY creado_en DESC, id LIMIT ? OFFSET ?""", (rs, i) -> {
			String est = rs.getString("estado");
			String resolucion = rs.getString("resolucion");
			boolean abierta = "ABIERTA".equals(est);
			OffsetDateTime cierre = rs.getObject("cerrada_en", OffsetDateTime.class);
			return new CollectionAlert(rs.getObject("id", UUID.class), rs.getObject("obligacion_id", UUID.class),
					rs.getObject("pago_id", UUID.class), PanelMapping.ALERT_RULE.get(rs.getString("regla")),
					PanelMapping.ALERT_STATUS.get(est), rs.getObject("responsable_id", UUID.class),
					abierta || resolucion == null ? null
							: resolucion.toLowerCase().contains("pago") ? AlertResolution.PAYMENT_APPLIED
									: AlertResolution.MANUAL,
					lima(rs.getObject("creado_en", OffsetDateTime.class)), abierta ? null : lima(cierre));
		}, estado, estado, page.fetch(), page.offset())));
	}

	/* ------------------------------------------------------------------ Pagos */

	private static final String PAYMENTS = """
			WITH numerados AS (
			  SELECT p.*, row_number() OVER (ORDER BY p.creado_en, p.id) AS n FROM keptai.pago p
			)
			SELECT p.id, p.n, p.fase, p.estado_conciliacion, p.medio, p.codigo_operacion, p.cliente_id, c.razon_social,
			       p.fecha_pago, p.monto, p.verificado_por, p.verificado_en, p.duplicado_de_pago_id, p.creado_en,
			       coalesce((SELECT sum(a.monto_aplicado) FROM keptai.aplicacion_pago a
			                  WHERE a.organizacion_id = p.organizacion_id AND a.pago_id = p.id AND a.anulada_en IS NULL), 0)
			         AS aplicado,
			       ARRAY(SELECT cp.id FROM keptai.comprobante cp
			              WHERE cp.organizacion_id = p.organizacion_id AND cp.pago_id = p.id ORDER BY cp.id) AS evidencias,
			       (SELECT max(cp.confianza) FROM keptai.comprobante cp
			         WHERE cp.organizacion_id = p.organizacion_id AND cp.pago_id = p.id) AS confianza,
			       org.nombre LIKE 'DEMO %' AS demo
			  FROM numerados p
			  JOIN keptai.organizacion org ON org.id = p.organizacion_id
			  LEFT JOIN keptai.cliente c ON c.organizacion_id = p.organizacion_id AND c.id = p.cliente_id
			 WHERE (CAST(? AS uuid) IS NULL OR p.id = CAST(? AS uuid))
			   AND (CAST(? AS text) IS NULL OR p.fase = CAST(? AS text))
			   AND (CAST(? AS text) IS NULL OR p.estado_conciliacion = CAST(? AS text))
			 ORDER BY p.creado_en DESC, p.id
			 LIMIT ? OFFSET ?""";

	public PageResponse<Payment> payments(PageRequest page, String phase, String reconciliationStatus) {
		String fase = PanelMapping.orNull(PanelMapping.PHASE_SQL, phase, "phase");
		String conc = PanelMapping.orNull(PanelMapping.RECONCILIATION_SQL, reconciliationStatus, "reconciliation_status");
		return panel.read(() -> page.page(panel.jdbc().query(PAYMENTS, (rs, i) -> payment(rs).payment(), null, null,
				fase, fase, conc, conc, page.fetch(), page.offset())));
	}

	public Payment payment(UUID id) {
		return panel.read(() -> paymentRowInTx(id).payment());
	}

	Payment paymentInTx(UUID id) {
		return paymentRowInTx(id).payment();
	}

	private PaymentRow paymentRowInTx(UUID id) {
		List<PaymentRow> rows = panel.jdbc().query(PAYMENTS, (rs, i) -> payment(rs), id, id, null, null, null, null, 1, 0);
		if (rows.isEmpty()) {
			throw PanelException.notFound("Pago no encontrado");
		}
		return rows.get(0);
	}

	private record PaymentRow(Payment payment, UUID clienteId, String cliente) {
	}

	private static PaymentRow payment(ResultSet rs) throws SQLException {
		String fase = rs.getString("fase");
		String conc = rs.getString("estado_conciliacion");
		BigDecimal monto = rs.getBigDecimal("monto");
		BigDecimal aplicado = rs.getBigDecimal("aplicado");
		UUID verificador = rs.getObject("verificado_por", UUID.class);
		boolean verificado = !"RECIBIDO".equals(fase) && !"DUPLICADO".equals(conc) && verificador != null;
		// El motor registra toda verificacion de la demo como simulada (sin banco); se rotula igual (D-009, MotorPagos).
		PaymentVerification verificacion = verificado ? new PaymentVerification(VerificationMethod.SIMULATED_DEMO, true,
				verificador, lima(rs.getObject("verificado_en", OffsetDateTime.class)), null) : null;
		PaymentPhase phase = PanelMapping.PHASE.get(fase);
		if (!verificado) {
			phase = PaymentPhase.RECEIVED;
		}
		BigDecimal confianza = rs.getBigDecimal("confianza");
		UUID cliente = rs.getObject("cliente_id", UUID.class);
		Payment p = new Payment(rs.getObject("id", UUID.class), "V-%03d".formatted(rs.getLong("n")), phase,
				PanelMapping.RECONCILIATION.get(conc), PanelMapping.CHANNEL.get(rs.getString("medio")),
				rs.getString("codigo_operacion"), rs.getString("razon_social"),
				PanelMapping.startOfDay(rs.getObject("fecha_pago", LocalDate.class)), positive(monto),
				verificado ? nonNegative(monto) : null, nonNegativeOrZero(verificado ? aplicado : BigDecimal.ZERO),
				nonNegativeOrZero(verificado ? monto.subtract(aplicado) : BigDecimal.ZERO),
				"DUPLICADO".equals(conc) ? rs.getObject("duplicado_de_pago_id", UUID.class) : null, uuids(rs, "evidencias"),
				verificacion,
				confianza == null ? null : confianza.movePointRight(3).setScale(0, java.math.RoundingMode.HALF_UP).intValue(),
				PanelMapping.dataOrigin(rs.getBoolean("demo"), null), lima(rs.getObject("creado_en", OffsetDateTime.class)));
		return new PaymentRow(p, cliente, rs.getString("razon_social"));
	}

	private static List<UUID> uuids(ResultSet rs, String column) throws SQLException {
		Array a = rs.getArray(column);
		if (a == null) {
			return List.of();
		}
		Object[] values = (Object[]) a.getArray();
		List<UUID> out = new ArrayList<>(values.length);
		for (Object v : values) {
			out.add(v instanceof UUID u ? u : UUID.fromString(String.valueOf(v)));
		}
		return List.copyOf(out);
	}

	/**
	 * Candidatos de conciliación: obligaciones abiertas del mismo cliente, por cercanía del importe y vencimiento.
	 * {@code match_score} queda nulo: la escala del motor no está definida (contrato). No altera ninguna deuda.
	 */
	public ReconciliationResult reconciliation(UUID paymentId) {
		return panel.read(() -> {
			PaymentRow row = paymentRowInTx(paymentId);
			Payment p = row.payment();
			if (p.reconciliationStatus() == ReconciliationStatus.DUPLICATE) {
				return new ReconciliationResult(paymentId, ReconciliationClass.DUPLICATE, List.of());
			}
			if (row.clienteId() == null) {
				return new ReconciliationResult(paymentId, ReconciliationClass.ORPHAN, List.of());
			}
			long importe = p.verifiedAmount() != null ? p.unappliedAmount().amountCents() : p.receivedAmount().amountCents();
			record Abierta(UUID id, UUID orden, String ref, long saldo, LocalDate vence) {
			}
			List<Abierta> abiertas = panel.jdbc().query("""
					SELECT ob.id, ob.orden_id, o.ref, s.saldo, ob.vence_en
					  FROM keptai.obligacion_cobro ob
					  JOIN keptai.orden o ON o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
					  JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = ob.id
					 WHERE o.cliente_id = ? AND ob.estado <> 'ANULADA' AND s.saldo > 0
					 ORDER BY ob.vence_en NULLS LAST, ob.creado_en, ob.id LIMIT 20""",
					(rs, i) -> new Abierta(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
							PanelMapping.cents(rs.getBigDecimal(4)), rs.getObject(5, LocalDate.class)),
					row.clienteId());
			// Obligaciones a las que este pago ya se aplicó (vigentes) van primero, sin motivo de cercanía: así el panel
			// muestra el pedido de un pago ya descontado. Después, las abiertas del cliente por cercanía del importe.
			List<ReconciliationCandidate> aplicadas = panel.jdbc().query("""
					SELECT DISTINCT ob.id, ob.orden_id, o.ref, coalesce(s.saldo, 0)
					  FROM keptai.aplicacion_pago a
					  JOIN keptai.obligacion_cobro ob ON ob.organizacion_id = a.organizacion_id AND ob.id = a.obligacion_id
					  JOIN keptai.orden o ON o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
					  LEFT JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = ob.id
					 WHERE a.pago_id = ? AND a.anulada_en IS NULL""",
					(rs, i) -> new ReconciliationCandidate(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
							rs.getString(3), row.cliente(), nonNegativeOrZero(rs.getBigDecimal(4)), null, List.of()),
					paymentId);
			List<UUID> yaAplicadas = aplicadas.stream().map(ReconciliationCandidate::receivableId).toList();
			List<ReconciliationCandidate> abiertasOrdenadas = abiertas.stream()
				.filter(a -> !yaAplicadas.contains(a.id()))
				.sorted(Comparator.comparing((Abierta a) -> a.saldo() == importe ? 0 : 1))
				.map(a -> new ReconciliationCandidate(a.id(), a.orden(), a.ref(), row.cliente(),
						pe.keptai.backend.contract.CommonDtos.NonNegativeMoney.pen(a.saldo()), null,
						List.of(a.saldo() == importe ? MatchReason.AMOUNT_EQUAL
								: importe < a.saldo() ? MatchReason.AMOUNT_BELOW_BALANCE : MatchReason.AMOUNT_ABOVE_BALANCE)))
				.toList();
			List<ReconciliationCandidate> candidatos = new ArrayList<>(aplicadas);
			candidatos.addAll(abiertasOrdenadas);
			if (candidatos.size() > 20) {
				candidatos = List.copyOf(candidatos.subList(0, 20));
			}
			MatchReason cercania = abiertasOrdenadas.isEmpty() ? null : abiertasOrdenadas.get(0).reasons().get(0);
			ReconciliationClass clase = switch (p.reconciliationStatus()) {
				case APPLIED -> ReconciliationClass.MATCHES;
				case PARTIAL -> ReconciliationClass.PARTIAL;
				case AMOUNT_MISMATCH -> ReconciliationClass.AMOUNT_MISMATCH;
				case ORPHAN -> candidatos.isEmpty() ? ReconciliationClass.ORPHAN : ReconciliationClass.AMOUNT_MISMATCH;
				default -> cercania == null ? ReconciliationClass.ORPHAN
						: cercania == MatchReason.AMOUNT_EQUAL ? ReconciliationClass.MATCHES
								: cercania == MatchReason.AMOUNT_BELOW_BALANCE ? ReconciliationClass.PARTIAL
										: ReconciliationClass.AMOUNT_MISMATCH;
			};
			return new ReconciliationResult(paymentId, clase, clase == ReconciliationClass.ORPHAN ? List.of() : candidatos);
		});
	}

	/* ------------------------------------------------------------------ Crédito */

	public CreditAuthorization creditDecision(UUID orderId) {
		return panel.read(() -> creditDecisionInTx(orderId));
	}

	CreditAuthorization creditDecisionInTx(UUID orderId) {
		List<CreditAuthorization> rows = panel.jdbc().query("""
				SELECT o.estado, a.decision, a.aprobado_por, a.aviso_mora_mostrado, a.saldo_referencia, a.plazo_dias,
				       a.anticipo_pct, a.motivo, a.decidido_en,
				       (SELECT coalesce(sum(m.saldo_vencido), 0) FROM keptai.v_cliente_mora m
				         WHERE m.organizacion_id = o.organizacion_id AND m.cliente_id = o.cliente_id) AS vencido
				  FROM keptai.orden o
				  LEFT JOIN keptai.aprobacion_credito a ON a.organizacion_id = o.organizacion_id AND a.orden_id = o.id
				 WHERE o.id = ?""", (rs, i) -> credit(rs, rs.getString("estado")), orderId);
		if (rows.isEmpty()) {
			throw PanelException.notFound("Pedido no encontrado");
		}
		return rows.get(0);
	}

	private static CreditAuthorization credit(ResultSet rs, String estadoOrden) throws SQLException {
		String decision = rs.getString("decision");
		BigDecimal vencido = rs.getBigDecimal("vencido");
		if (decision == null || "PENDIENTE".equals(decision)) {
			boolean pendiente = decision != null || estadoOrden == null
					|| List.of("BORRADOR", "PENDIENTE_APROBACION").contains(estadoOrden);
			return new CreditAuthorization(pendiente ? CreditAuthorizationStatus.PENDING : CreditAuthorizationStatus.NOT_REQUIRED,
					null, false, nonNegativeOrZero(vencido), null, null, null, null);
		}
		BigDecimal pct = rs.getBigDecimal("anticipo_pct");
		return new CreditAuthorization(
				"APROBADO".equals(decision) ? CreditAuthorizationStatus.APPROVED : CreditAuthorizationStatus.REJECTED,
				rs.getObject("aprobado_por", UUID.class), rs.getBoolean("aviso_mora_mostrado"),
				nonNegativeOrZero(rs.getBigDecimal("saldo_referencia")), (Integer) rs.getObject("plazo_dias"),
				pct == null ? null : pct.movePointRight(2).intValueExact(), rs.getString("motivo"),
				lima(rs.getObject("decidido_en", OffsetDateTime.class)));
	}

	/* ------------------------------------------------------------------ Estado de cuenta */

	public CustomerStatement statement(UUID customerId) {
		return panel.read(() -> {
			List<Map<String, Object>> cliente = panel.jdbc().queryForList("""
					SELECT c.razon_social, org.nombre LIKE 'DEMO %' AS demo
					  FROM keptai.cliente c JOIN keptai.organizacion org ON org.id = c.organizacion_id WHERE c.id = ?""",
					customerId);
			if (cliente.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado");
			}
			CustomerRef ref = new CustomerRef(customerId, (String) cliente.get(0).get("razon_social"));
			boolean demo = Boolean.TRUE.equals(cliente.get(0).get("demo"));
			List<StatementOrder> orders = panel.jdbc().query("""
					SELECT o.id, o.ref, o.total, coalesce(s.cobrado, 0), coalesce(s.saldo, ob.monto), ob.vence_en
					  FROM keptai.obligacion_cobro ob
					  JOIN keptai.orden o ON o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
					  LEFT JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = ob.id
					 WHERE o.cliente_id = ? AND ob.estado <> 'ANULADA' AND o.total > 0
					 ORDER BY o.creado_en, o.id LIMIT 200""",
					(rs, i) -> new StatementOrder(rs.getObject(1, UUID.class), rs.getString(2), positive(rs.getBigDecimal(3)),
							nonNegativeOrZero(rs.getBigDecimal(4)), nonNegativeOrZero(rs.getBigDecimal(5)),
							rs.getObject(6, LocalDate.class)),
					customerId);
			List<StatementApplication> applications = panel.jdbc().query("""
					WITH numerados AS (SELECT p.id, row_number() OVER (ORDER BY p.creado_en, p.id) AS n FROM keptai.pago p)
					SELECT n.n, o.ref, a.monto_aplicado, a.aplicado_en
					  FROM keptai.aplicacion_pago a
					  JOIN numerados n ON n.id = a.pago_id
					  JOIN keptai.obligacion_cobro ob ON ob.organizacion_id = a.organizacion_id AND ob.id = a.obligacion_id
					  JOIN keptai.orden o ON o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
					 WHERE o.cliente_id = ? AND a.anulada_en IS NULL
					 ORDER BY a.aplicado_en, a.id LIMIT 500""",
					(rs, i) -> new StatementApplication("V-%03d".formatted(rs.getLong(1)), rs.getString(2),
							positive(rs.getBigDecimal(3)), lima(rs.getObject(4, OffsetDateTime.class))),
					customerId);
			List<CreditAuthorization> credito = panel.jdbc().query("""
					SELECT o.estado, a.decision, a.aprobado_por, a.aviso_mora_mostrado, a.saldo_referencia, a.plazo_dias,
					       a.anticipo_pct, a.motivo, a.decidido_en,
					       (SELECT coalesce(sum(m.saldo_vencido), 0) FROM keptai.v_cliente_mora m
					         WHERE m.organizacion_id = o.organizacion_id AND m.cliente_id = o.cliente_id) AS vencido
					  FROM keptai.aprobacion_credito a
					  JOIN keptai.orden o ON o.organizacion_id = a.organizacion_id AND o.id = a.orden_id
					 WHERE o.cliente_id = ?
					 ORDER BY a.decidido_en DESC NULLS LAST, a.creado_en DESC LIMIT 1""",
					(rs, i) -> credit(rs, rs.getString("estado")), customerId);
			BigDecimal vencido = panel.jdbc().queryForObject("""
					SELECT coalesce(sum(saldo_vencido), 0) FROM keptai.v_cliente_mora WHERE cliente_id = ?""",
					BigDecimal.class, customerId);
			long total = orders.stream().mapToLong(o -> o.balance().amountCents()).sum();
			LocalDate next = orders.stream().filter(o -> o.dueDate() != null && o.balance().amountCents() > 0)
				.map(StatementOrder::dueDate).min(LocalDate::compareTo).orElse(null);
			CreditAuthorization ca = credito.isEmpty() ? new CreditAuthorization(CreditAuthorizationStatus.NOT_REQUIRED,
					null, false, nonNegativeOrZero(vencido), null, null, null, null) : credito.get(0);
			return new CustomerStatement(ref, lima(OffsetDateTime.now()),
					pe.keptai.backend.contract.CommonDtos.NonNegativeMoney.pen(total), next, orders, applications, ca,
					PanelMapping.dataOrigin(demo, null));
		});
	}

	/* ------------------------------------------------------------------ Auditoría */

	public PageResponse<AuditEvent> audit(PageRequest page, UUID entityId) {
		return panel.read(() -> page.page(panel.jdbc().query("""
				SELECT id, ocurrido_en, actor, usuario_id, operacion, entidad, entidad_id, request_id, cambios::text AS cambios
				  FROM keptai.evento_auditoria
				 WHERE (CAST(? AS uuid) IS NULL OR entidad_id = CAST(? AS uuid))
				 ORDER BY ocurrido_en DESC, id LIMIT ? OFFSET ?""", (rs, i) -> {
			var actor = PanelMapping.AUDIT_ACTOR.get(rs.getString("actor"));
			UUID usuario = rs.getObject("usuario_id", UUID.class);
			return new AuditEvent(rs.getObject("id", UUID.class), lima(rs.getObject("ocurrido_en", OffsetDateTime.class)),
					actor, actor == pe.keptai.backend.contract.ContractEnums.AuditActor.USER ? usuario : null,
					rs.getString("operacion"), rs.getString("entidad"), rs.getObject("entidad_id", UUID.class),
					rs.getString("request_id"), changes(rs.getString("cambios")));
		}, entityId, entityId, page.fetch(), page.offset())));
	}

	private static List<AuditChange> changes(String json) {
		if (json == null) {
			return List.of();
		}
		List<AuditChange> out = new ArrayList<>();
		JsonNode node = JSON.readTree(json);
		node.properties().forEach(e -> {
			if (out.size() < 50) {
				JsonNode v = e.getValue();
				String text = v == null || v.isNull() ? null : v.isValueNode() ? v.asString() : v.toString();
				out.add(new AuditChange(e.getKey(), null, text != null && text.length() > 1000 ? text.substring(0, 1000) : text));
			}
		});
		return List.copyOf(out);
	}

}
