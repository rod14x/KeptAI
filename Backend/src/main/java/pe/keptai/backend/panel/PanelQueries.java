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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import pe.keptai.backend.contract.AuditDtos.AuditChange;
import pe.keptai.backend.contract.AuditDtos.AuditEvent;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.CommonDtos.PersonRef;
import pe.keptai.backend.contract.ContractEnums.AuditActor;
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
import pe.keptai.backend.contract.OrderDtos.OrderItem;
import pe.keptai.backend.contract.PaymentDtos.Payment;
import pe.keptai.backend.contract.PaymentDtos.PaymentAllocation;
import pe.keptai.backend.contract.PaymentDtos.PaymentVerification;
import pe.keptai.backend.contract.PaymentDtos.ReconciliationCandidate;
import pe.keptai.backend.contract.PaymentDtos.ReconciliationResult;
import pe.keptai.backend.contract.ReceivableDtos.CollectionAlert;
import pe.keptai.backend.contract.ReceivableDtos.CreditAuthorization;
import pe.keptai.backend.contract.ReceivableDtos.CustomerStatement;
import pe.keptai.backend.contract.ReceivableDtos.Notification;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;
import pe.keptai.backend.contract.ReceivableDtos.ReceivableApplication;
import pe.keptai.backend.contract.ReceivableDtos.StatementApplication;
import pe.keptai.backend.contract.ReceivableDtos.StatementOrder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lecturas del panel (MIG-06/07, INT-FE-API-001/002) sobre las tablas y vistas de Andrés, siempre dentro de
 * {@link PanelContext#read}: RLS decide qué filas ve cada rol (JEFE_TALLER no ve clientes ni obligaciones, INGESTA no
 * entra por aquí). Saldo y cobrado salen de {@code v_saldo_obligacion}; la mora del cliente de {@code v_cliente_mora}.
 * Estado de la cuenta por cobrar y tramo de vencimiento se derivan con la misma regla que
 * {@code recalcular_obligaciones} (V8) para no depender de que el job haya corrido. Los detalles (ítems, aplicaciones)
 * se cargan por lote para la página completa, no fila por fila.
 */
@Component
public class PanelQueries {

	/** Importes de evento_auditoria.cambios con su escala exacta (240.00, no 240.0). */
	private static final JsonMapper JSON = ContractJson.newMapper().rebuild()
		.enable(tools.jackson.databind.DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
		.build();

	private static final String HOY = "timezone(org.zona_horaria, now())::date";

	/** Código legible de los pagos: V-NNN por orden de llegada en la organización (la tabla pago no tiene etiqueta). */
	private static final String NUMERADOS = "numerados AS (SELECT p.id, row_number() OVER (ORDER BY p.creado_en, p.id) AS n FROM keptai.pago p)";

	private final PanelContext panel;

	public PanelQueries(PanelContext panel) {
		this.panel = panel;
	}

	/* ------------------------------------------------------------------ Identidad */

	/** Nombre del usuario y de su organización; nulos si la base no está disponible (perfil sin datos). */
	public record IdentityNames(String name, String organizationName) {
	}

	public IdentityNames identityNames() {
		return panel.readOwnIdentity(() -> panel.jdbc().query("""
				SELECT u.nombre, org.nombre
				  FROM keptai.usuario u JOIN keptai.organizacion org ON org.id = u.organizacion_id
				 WHERE u.id = nullif(current_setting('app.usuario_id', true), '')::uuid""",
				(rs, i) -> new IdentityNames(rs.getString(1), rs.getString(2))).stream().findFirst()
			.orElse(new IdentityNames(null, null)));
	}

	/* ------------------------------------------------------------------ Órdenes */

	private static final String ORDERS = """
			WITH base AS (
			  SELECT o.id, o.ref, o.cliente_id, c.razon_social AS cliente, c.tipo AS cliente_tipo, c.ruc_dni,
			         c.limite_credito, m.nombre AS marca,
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
			         v.id AS vendedor_id, v.nombre AS vendedor, ud.id AS despachador_id, ud.nombre AS despachador,
			         org.nombre LIKE 'DEMO %%' AS demo, o.creado_en
			    FROM keptai.orden o
			    JOIN keptai.organizacion org ON org.id = o.organizacion_id
			    LEFT JOIN keptai.cliente c ON c.organizacion_id = o.organizacion_id AND c.id = o.cliente_id
			    LEFT JOIN keptai.marca m ON m.organizacion_id = o.organizacion_id AND m.id = o.marca_id
			    LEFT JOIN keptai.usuario v ON v.organizacion_id = o.organizacion_id AND v.id = o.vendedor_id
			    LEFT JOIN keptai.despacho d ON d.organizacion_id = o.organizacion_id AND d.orden_id = o.id
			    LEFT JOIN keptai.usuario ud ON ud.organizacion_id = d.organizacion_id AND ud.id = d.registrado_por
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
		return panel.read(() -> page.page(withItems(panel.jdbc().query(ORDERS, (rs, i) -> order(rs), null, null,
				customerId, customerId, estado, estado, cxc, cxc, page.fetch(), page.offset()))));
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
		return withItems(rows).get(0);
	}

	private static Order order(ResultSet rs) throws SQLException {
		UUID cliente = rs.getObject("cliente_id", UUID.class);
		String nombre = rs.getString("cliente");
		String cxc = rs.getString("cxc");
		LocalDate despacho = rs.getObject("fecha_despacho", LocalDate.class);
		String condicion = rs.getString("condicion_pago");
		return new Order(rs.getObject("id", UUID.class), rs.getString("ref"),
				cliente != null && nombre != null ? customer(cliente, nombre, rs.getString("cliente_tipo"),
						rs.getString("ruc_dni"), rs.getBigDecimal("limite_credito")) : null,
				rs.getString("marca"), rs.getString("linea"), PanelMapping.productionMode(rs.getString("tipo_produccion")),
				positive(rs.getBigDecimal("total")), PanelMapping.ORDER_STATUS.get(rs.getString("estado")),
				PanelMapping.SOURCE.get(rs.getString("origen")),
				condicion == null ? null : PanelMapping.CONDITION.get(condicion), (Integer) rs.getObject("plazo_dias"),
				nonNegativeOrZero(rs.getBigDecimal("anticipo_requerido")),
				rs.getObject("fecha_entrega_solicitada", LocalDate.class),
				rs.getObject("fecha_inicio_produccion", LocalDate.class), despacho,
				cxc == null ? null : receivableStatus(cxc), despacho == null ? null : rs.getObject("vence_en", LocalDate.class),
				null, PanelMapping.dataOrigin(rs.getBoolean("demo"), rs.getString("origen")),
				lima(rs.getObject("creado_en", OffsetDateTime.class)),
				person(rs.getObject("vendedor_id", UUID.class), rs.getString("vendedor")), List.of(),
				person(rs.getObject("despachador_id", UUID.class), rs.getString("despachador")));
	}

	/** Agrega los ítems ({@code orden_item}) de toda la página en una sola consulta. */
	private List<Order> withItems(List<Order> orders) {
		if (orders.isEmpty()) {
			return orders;
		}
		Map<UUID, List<OrderItem>> items = new HashMap<>();
		byIds("""
				SELECT i.orden_id, i.descripcion, i.cantidad, i.precio_unit, l.nombre, i.tela, i.talla, i.logo
				  FROM keptai.orden_item i
				  LEFT JOIN keptai.linea_producto l ON l.organizacion_id = i.organizacion_id AND l.id = i.linea_id
				 WHERE i.orden_id = ANY(?)
				 ORDER BY i.orden_id, i.descripcion, i.id""", ids(orders.stream().map(Order::id)), (rs, n) -> {
			String detalle = Stream.of(rs.getString(6), rs.getString(7), rs.getString(8))
				.filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(" · "));
			items.computeIfAbsent(rs.getObject(1, UUID.class), k -> new ArrayList<>())
				.add(new OrderItem(rs.getString(2), rs.getInt(3), nonNegativeOrZero(rs.getBigDecimal(4)), rs.getString(5),
						detalle.isEmpty() ? null : truncate(detalle, 300)));
			return null;
		});
		return orders.stream().map(o -> new Order(o.id(), o.displayCode(), o.customer(), o.brand(), o.productLine(),
				o.productionMode(), o.sale(), o.status(), o.source(), o.paymentCondition(), o.creditTermDays(),
				o.advanceRequired(), o.requestedDeliveryDate(), o.productionStartDate(), o.dispatchDate(), o.receivableStatus(),
				o.dueDate(), o.sourceEvidenceId(), o.dataOrigin(), o.createdAt(), o.seller(),
				List.copyOf(items.getOrDefault(o.id(), List.of())), o.dispatchedBy())).toList();
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
			  SELECT ob.id, ob.orden_id, o.ref, o.cliente_id, c.razon_social AS cliente, c.tipo AS cliente_tipo, c.ruc_dni,
			         c.limite_credito, ob.monto, coalesce(s.cobrado, 0) AS cobrado, coalesce(s.saldo, ob.monto) AS saldo,
			         ob.plazo_dias, ob.vence_en, %1$s AS hoy,
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
		return panel.read(() -> page.page(withApplications(panel.jdbc().query(RECEIVABLES, (rs, i) -> receivable(rs),
				null, null, customerId, customerId, tramo, tramo, page.fetch(), page.offset()))));
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
		return withApplications(rows).get(0);
	}

	private static Receivable receivable(ResultSet rs) throws SQLException {
		LocalDate vence = rs.getObject("vence_en", LocalDate.class);
		LocalDate hoy = rs.getObject("hoy", LocalDate.class);
		DueBucket bucket = switch (rs.getString("tramo")) {
			case "awaiting_dispatch" -> DueBucket.AWAITING_DISPATCH;
			case "overdue" -> DueBucket.OVERDUE;
			case "due_today" -> DueBucket.DUE_TODAY;
			default -> DueBucket.NOT_DUE;
		};
		int atraso = bucket == DueBucket.OVERDUE ? (int) Math.min(36_500, ChronoUnit.DAYS.between(vence, hoy)) : 0;
		return new Receivable(rs.getObject("id", UUID.class), rs.getObject("orden_id", UUID.class), rs.getString("ref"),
				customer(rs.getObject("cliente_id", UUID.class), rs.getString("cliente"), rs.getString("cliente_tipo"),
						rs.getString("ruc_dni"), rs.getBigDecimal("limite_credito")),
				positive(rs.getBigDecimal("monto")), nonNegativeOrZero(rs.getBigDecimal("cobrado")),
				nonNegativeOrZero(rs.getBigDecimal("saldo")), Math.min(365, rs.getInt("plazo_dias")),
				TermStartEvent.DISPATCH, vence, bucket, atraso, receivableStatus(rs.getString("estado")), List.of());
	}

	/** Pagos aplicados vigentes de las obligaciones de la página (una sola consulta). */
	private List<Receivable> withApplications(List<Receivable> receivables) {
		if (receivables.isEmpty()) {
			return receivables;
		}
		Map<UUID, List<ReceivableApplication>> apps = new HashMap<>();
		byIds("WITH " + NUMERADOS + """
				SELECT a.obligacion_id, a.id, a.pago_id, n.n, p.medio, a.monto_aplicado, a.aplicado_en, u.id, u.nombre
				  FROM keptai.aplicacion_pago a
				  JOIN keptai.pago p ON p.organizacion_id = a.organizacion_id AND p.id = a.pago_id
				  JOIN numerados n ON n.id = a.pago_id
				  LEFT JOIN keptai.usuario u ON u.organizacion_id = a.organizacion_id AND u.id = a.aplicado_por
				 WHERE a.obligacion_id = ANY(?) AND a.anulada_en IS NULL
				 ORDER BY a.aplicado_en, a.id""", ids(receivables.stream().map(Receivable::id)), (rs, n) -> {
			apps.computeIfAbsent(rs.getObject(1, UUID.class), k -> new ArrayList<>())
				.add(new ReceivableApplication(rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
						"V-%03d".formatted(rs.getLong(4)), PanelMapping.CHANNEL.get(rs.getString(5)),
						positive(rs.getBigDecimal(6)), lima(rs.getObject(7, OffsetDateTime.class)),
						person(rs.getObject(8, UUID.class), rs.getString(9))));
			return null;
		});
		return receivables.stream().map(r -> new Receivable(r.id(), r.orderId(), r.orderCode(), r.customer(),
				r.originalAmount(), r.appliedAmount(), r.balance(), r.creditTermDays(), r.termStartEvent(), r.dueDate(),
				r.dueBucket(), r.daysOverdue(), r.status(), List.copyOf(apps.getOrDefault(r.id(), List.of())))).toList();
	}

	/* ------------------------------------------------------------------ Alertas */

	private static final String ALERTS = """
			SELECT a.id, a.obligacion_id, a.pago_id, a.regla, a.estado, a.responsable_id, a.resolucion, a.creado_en,
			       a.cerrada_en, u.nombre AS responsable
			  FROM keptai.alerta_cobranza a
			  LEFT JOIN keptai.usuario u ON u.organizacion_id = a.organizacion_id AND u.id = a.responsable_id
			 WHERE (CAST(? AS uuid) IS NULL OR a.id = CAST(? AS uuid))
			   AND (CAST(? AS text) IS NULL OR a.estado = CAST(? AS text))
			 ORDER BY a.creado_en DESC, a.id LIMIT ? OFFSET ?""";

	public PageResponse<CollectionAlert> alerts(PageRequest page, String status) {
		String estado = PanelMapping.orNull(PanelMapping.ALERT_STATUS_SQL, status, "status");
		return panel.read(() -> page.page(panel.jdbc().query(ALERTS, (rs, i) -> alert(rs), null, null, estado, estado,
				page.fetch(), page.offset())));
	}

	CollectionAlert alertInTx(UUID id) {
		List<CollectionAlert> rows = panel.jdbc().query(ALERTS, (rs, i) -> alert(rs), id, id, null, null, 1, 0);
		if (rows.isEmpty()) {
			throw PanelException.notFound("Alerta no encontrada");
		}
		return rows.get(0);
	}

	private static CollectionAlert alert(ResultSet rs) throws SQLException {
		String est = rs.getString("estado");
		String resolucion = rs.getString("resolucion");
		boolean abierta = "ABIERTA".equals(est);
		return new CollectionAlert(rs.getObject("id", UUID.class), rs.getObject("obligacion_id", UUID.class),
				rs.getObject("pago_id", UUID.class), PanelMapping.ALERT_RULE.get(rs.getString("regla")),
				PanelMapping.ALERT_STATUS.get(est), rs.getObject("responsable_id", UUID.class),
				abierta ? null : PanelMapping.alertResolution(resolucion),
				lima(rs.getObject("creado_en", OffsetDateTime.class)),
				abierta ? null : lima(rs.getObject("cerrada_en", OffsetDateTime.class)), rs.getString("responsable"),
				abierta || resolucion == null ? null : truncate(resolucion, 500));
	}

	/* ------------------------------------------------------------------ Pagos */

	private static final String PAYMENTS = """
			WITH numerados AS (
			  SELECT p.*, row_number() OVER (ORDER BY p.creado_en, p.id) AS n FROM keptai.pago p
			)
			SELECT p.id, p.n, p.fase, p.estado_conciliacion, p.medio, p.codigo_operacion, p.cliente_id, c.razon_social,
			       p.fecha_pago, p.monto, p.verificado_por, uv.nombre AS verificador, p.verificado_en, p.duplicado_de_pago_id,
			       p.creado_en,
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
			  LEFT JOIN keptai.usuario uv ON uv.organizacion_id = p.organizacion_id AND uv.id = p.verificado_por
			 WHERE (CAST(? AS uuid) IS NULL OR p.id = CAST(? AS uuid))
			   AND (CAST(? AS text) IS NULL OR p.fase = CAST(? AS text))
			   AND (CAST(? AS text) IS NULL OR p.estado_conciliacion = CAST(? AS text))
			 ORDER BY p.creado_en DESC, p.id
			 LIMIT ? OFFSET ?""";

	public PageResponse<Payment> payments(PageRequest page, String phase, String reconciliationStatus) {
		String fase = PanelMapping.orNull(PanelMapping.PHASE_SQL, phase, "phase");
		String conc = PanelMapping.orNull(PanelMapping.RECONCILIATION_SQL, reconciliationStatus, "reconciliation_status");
		return panel.read(() -> page.page(withAllocations(panel.jdbc().query(PAYMENTS, (rs, i) -> payment(rs), null,
				null, fase, fase, conc, conc, page.fetch(), page.offset())).stream().map(PaymentRow::payment).toList()));
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
		return withAllocations(rows).get(0);
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
				verificador, lima(rs.getObject("verificado_en", OffsetDateTime.class)), null, rs.getString("verificador"))
				: null;
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
				PanelMapping.dataOrigin(rs.getBoolean("demo"), null), lima(rs.getObject("creado_en", OffsetDateTime.class)),
				List.of());
		return new PaymentRow(p, cliente, rs.getString("razon_social"));
	}

	/** Aplicaciones vigentes de los pagos de la página, con su pedido y autor (una sola consulta). */
	private List<PaymentRow> withAllocations(List<PaymentRow> rows) {
		if (rows.isEmpty()) {
			return rows;
		}
		Map<UUID, List<PaymentAllocation>> allocations = new HashMap<>();
		byIds("""
				SELECT a.pago_id, a.id, a.obligacion_id, o.id, o.ref, a.monto_aplicado, a.aplicado_en, u.id, u.nombre
				  FROM keptai.aplicacion_pago a
				  JOIN keptai.obligacion_cobro ob ON ob.organizacion_id = a.organizacion_id AND ob.id = a.obligacion_id
				  JOIN keptai.orden o ON o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
				  LEFT JOIN keptai.usuario u ON u.organizacion_id = a.organizacion_id AND u.id = a.aplicado_por
				 WHERE a.pago_id = ANY(?) AND a.anulada_en IS NULL
				 ORDER BY a.aplicado_en, a.id""", ids(rows.stream().map(r -> r.payment().id())), (rs, n) -> {
			allocations.computeIfAbsent(rs.getObject(1, UUID.class), k -> new ArrayList<>())
				.add(new PaymentAllocation(rs.getObject(2, UUID.class), rs.getObject(3, UUID.class), rs.getObject(4, UUID.class),
						rs.getString(5), positive(rs.getBigDecimal(6)), lima(rs.getObject(7, OffsetDateTime.class)),
						person(rs.getObject(8, UUID.class), rs.getString(9))));
			return null;
		});
		return rows.stream().map(r -> {
			Payment p = r.payment();
			List<PaymentAllocation> mine = allocations.getOrDefault(p.id(), List.of());
			return new PaymentRow(new Payment(p.id(), p.displayCode(), p.phase(), p.reconciliationStatus(), p.channel(),
					p.operationReference(), p.payerName(), p.paidAt(), p.receivedAmount(), p.verifiedAmount(), p.appliedAmount(),
					p.unappliedAmount(), p.duplicateOfPaymentId(), p.evidenceIds(), p.verification(),
					p.modelReportedConfidencePermille(), p.dataOrigin(), p.createdAt(),
					List.copyOf(mine.size() > 20 ? mine.subList(0, 20) : mine)), r.clienteId(), r.cliente());
		}).toList();
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
						NonNegativeMoney.pen(a.saldo()), null,
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

	private static final String CREDIT_COLUMNS = """
			o.estado, a.decision, a.aprobado_por, ua.nombre AS aprobador, a.aviso_mora_mostrado, a.saldo_referencia,
			a.plazo_dias, a.anticipo_pct, a.motivo, a.decidido_en,
			(SELECT coalesce(sum(m.saldo_vencido), 0) FROM keptai.v_cliente_mora m
			  WHERE m.organizacion_id = o.organizacion_id AND m.cliente_id = o.cliente_id) AS vencido""";

	public CreditAuthorization creditDecision(UUID orderId) {
		return panel.read(() -> creditDecisionInTx(orderId));
	}

	CreditAuthorization creditDecisionInTx(UUID orderId) {
		List<CreditAuthorization> rows = panel.jdbc().query("SELECT " + CREDIT_COLUMNS + """
				  FROM keptai.orden o
				  LEFT JOIN keptai.aprobacion_credito a ON a.organizacion_id = o.organizacion_id AND a.orden_id = o.id
				  LEFT JOIN keptai.usuario ua ON ua.organizacion_id = a.organizacion_id AND ua.id = a.aprobado_por
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
					null, false, nonNegativeOrZero(vencido), null, null, null, null, null);
		}
		BigDecimal pct = rs.getBigDecimal("anticipo_pct");
		return new CreditAuthorization(
				"APROBADO".equals(decision) ? CreditAuthorizationStatus.APPROVED : CreditAuthorizationStatus.REJECTED,
				rs.getObject("aprobado_por", UUID.class), rs.getBoolean("aviso_mora_mostrado"),
				nonNegativeOrZero(rs.getBigDecimal("saldo_referencia")), (Integer) rs.getObject("plazo_dias"),
				pct == null ? null : pct.movePointRight(2).intValueExact(), rs.getString("motivo"),
				lima(rs.getObject("decidido_en", OffsetDateTime.class)), rs.getString("aprobador"));
	}

	/* ------------------------------------------------------------------ Estado de cuenta */

	public CustomerStatement statement(UUID customerId) {
		return panel.read(() -> {
			List<Map<String, Object>> cliente = panel.jdbc().queryForList("""
					SELECT c.razon_social, c.tipo, c.ruc_dni, c.limite_credito, org.nombre LIKE 'DEMO %' AS demo
					  FROM keptai.cliente c JOIN keptai.organizacion org ON org.id = c.organizacion_id WHERE c.id = ?""",
					customerId);
			if (cliente.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado");
			}
			Map<String, Object> c = cliente.get(0);
			CustomerRef ref = customer(customerId, (String) c.get("razon_social"), (String) c.get("tipo"),
					(String) c.get("ruc_dni"), (BigDecimal) c.get("limite_credito"));
			boolean demo = Boolean.TRUE.equals(c.get("demo"));
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
			List<StatementApplication> applications = panel.jdbc().query("WITH " + NUMERADOS + """
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
			List<CreditAuthorization> credito = panel.jdbc().query("SELECT " + CREDIT_COLUMNS + """
					  FROM keptai.aprobacion_credito a
					  JOIN keptai.orden o ON o.organizacion_id = a.organizacion_id AND o.id = a.orden_id
					  LEFT JOIN keptai.usuario ua ON ua.organizacion_id = a.organizacion_id AND ua.id = a.aprobado_por
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
					null, false, nonNegativeOrZero(vencido), null, null, null, null, null) : credito.get(0);
			return new CustomerStatement(ref, lima(OffsetDateTime.now()), NonNegativeMoney.pen(total), next, orders,
					applications, ca, PanelMapping.dataOrigin(demo, null));
		});
	}

	/* ------------------------------------------------------------------ Envíos de cobranza (WF3) */

	public PageResponse<Notification> notifications(PageRequest page, UUID orderId, UUID customerId) {
		return panel.read(() -> page.page(panel.jdbc().query("""
				SELECT e.id, e.cliente_id, c.razon_social, c.tipo, c.ruc_dni, c.limite_credito, e.orden_id, o.ref, e.tipo AS envio,
				       e.estado, e.programado_para, e.intentos, e.enviado_en, e.ultimo_error
				  FROM keptai.envio_notificacion e
				  LEFT JOIN keptai.cliente c ON c.organizacion_id = e.organizacion_id AND c.id = e.cliente_id
				  LEFT JOIN keptai.orden o ON o.organizacion_id = e.organizacion_id AND o.id = e.orden_id
				 WHERE (CAST(? AS uuid) IS NULL OR e.orden_id = CAST(? AS uuid))
				   AND (CAST(? AS uuid) IS NULL OR e.cliente_id = CAST(? AS uuid))
				 ORDER BY e.programado_para DESC, e.id LIMIT ? OFFSET ?""", (rs, i) -> {
			UUID cliente = rs.getObject("cliente_id", UUID.class);
			String nombre = rs.getString("razon_social");
			String error = rs.getString("ultimo_error");
			return new Notification(rs.getObject("id", UUID.class),
					cliente == null || nombre == null ? null : customer(cliente, nombre, rs.getString("tipo"),
							rs.getString("ruc_dni"), rs.getBigDecimal("limite_credito")),
					rs.getObject("orden_id", UUID.class), rs.getString("ref"),
					PanelMapping.NOTIFICATION_TYPE.get(rs.getString("envio")),
					PanelMapping.NOTIFICATION_STATUS.get(rs.getString("estado")),
					lima(rs.getObject("programado_para", OffsetDateTime.class)), Math.min(1000, rs.getInt("intentos")),
					lima(rs.getObject("enviado_en", OffsetDateTime.class)), error == null ? null : truncate(error, 500));
		}, orderId, orderId, customerId, customerId, page.fetch(), page.offset())));
	}

	/* ------------------------------------------------------------------ Auditoría */

	public PageResponse<AuditEvent> audit(PageRequest page, UUID entityId) {
		return panel.read(() -> page.page(panel.jdbc().query("""
				SELECT e.id, e.ocurrido_en, e.actor, e.usuario_id, u.nombre, e.operacion, e.entidad, e.entidad_id,
				       e.request_id, e.cambios::text AS cambios
				  FROM keptai.evento_auditoria e
				  LEFT JOIN keptai.usuario u ON u.organizacion_id = e.organizacion_id AND u.id = e.usuario_id
				 WHERE (CAST(? AS uuid) IS NULL OR e.entidad_id = CAST(? AS uuid))
				 ORDER BY e.ocurrido_en DESC, e.id LIMIT ? OFFSET ?""", (rs, i) -> {
			AuditActor actor = PanelMapping.AUDIT_ACTOR.get(rs.getString("actor"));
			UUID usuario = rs.getObject("usuario_id", UUID.class);
			String actorName = switch (actor) {
				case USER -> rs.getString("nombre");
				case N8N -> "n8n";
				case SCHEDULER -> "Programador de cobranza";
				case SYSTEM -> "Sistema";
			};
			return new AuditEvent(rs.getObject("id", UUID.class), lima(rs.getObject("ocurrido_en", OffsetDateTime.class)),
					actor, actor == AuditActor.USER ? usuario : null, rs.getString("operacion"), rs.getString("entidad"),
					rs.getObject("entidad_id", UUID.class), rs.getString("request_id"), changes(rs.getString("cambios")),
					actorName);
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

	/* ------------------------------------------------------------------ Utilidades */

	static CustomerRef customer(UUID id, String name, String tipo, String rucDni, BigDecimal limite) {
		return new CustomerRef(id, name, tipo == null ? null : PanelMapping.CUSTOMER_TYPE.get(tipo),
				rucDni == null || rucDni.isBlank() ? null : rucDni.strip(), nonNegative(limite));
	}

	static PersonRef person(UUID id, String name) {
		return id == null || name == null || name.isBlank() ? null : new PersonRef(id, truncate(name, 200));
	}

	private static String truncate(String s, int max) {
		return s.length() > max ? s.substring(0, max) : s;
	}

	private static List<UUID> ids(Stream<UUID> ids) {
		return ids.distinct().toList();
	}

	/** Consulta con un único parámetro {@code uuid[]} (para {@code = ANY(?)}); el mapeador acumula en su propio mapa. */
	private void byIds(String sql, List<UUID> ids, RowMapper<Void> mapper) {
		panel.jdbc().query(sql, ps -> ps.setArray(1, ps.getConnection().createArrayOf("uuid", ids.toArray())), mapper);
	}

}
