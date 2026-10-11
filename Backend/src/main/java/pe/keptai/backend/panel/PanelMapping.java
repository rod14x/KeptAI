package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;

import pe.keptai.backend.contract.CommonDtos;
import pe.keptai.backend.contract.CommonDtos.Money;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PositiveMoney;
import pe.keptai.backend.contract.ContractEnums.AlertRule;
import pe.keptai.backend.contract.ContractEnums.AlertStatus;
import pe.keptai.backend.contract.ContractEnums.AuditActor;
import pe.keptai.backend.contract.ContractEnums.CostComponent;
import pe.keptai.backend.contract.ContractEnums.DataOrigin;
import pe.keptai.backend.contract.ContractEnums.OrderSource;
import pe.keptai.backend.contract.ContractEnums.OrderStatus;
import pe.keptai.backend.contract.ContractEnums.PaymentChannel;
import pe.keptai.backend.contract.ContractEnums.PaymentCondition;
import pe.keptai.backend.contract.ContractEnums.PaymentPhase;
import pe.keptai.backend.contract.ContractEnums.ProductionMode;
import pe.keptai.backend.contract.ContractEnums.ReconciliationStatus;

/**
 * Traducción única entre valores SQL (V1–V10) y el contrato del panel: estados, enums y dinero. Solo transporta lo que
 * calculan la base y el motor; no contiene fórmulas financieras. Importes en soles (numeric) ↔ centavos enteros.
 */
public final class PanelMapping {

	/** Zona de negocio de la organización (organizacion.zona_horaria, V1). */
	public static final ZoneId LIMA = ZoneId.of("America/Lima");

	static final Map<String, OrderStatus> ORDER_STATUS = Map.of("BORRADOR", OrderStatus.DRAFT, "PENDIENTE_APROBACION",
			OrderStatus.PENDING_APPROVAL, "RETENIDA", OrderStatus.HELD, "LIBERADA", OrderStatus.RELEASED, "EN_PRODUCCION",
			OrderStatus.IN_PRODUCTION, "DESPACHADA", OrderStatus.DISPATCHED, "CERRADA", OrderStatus.CLOSED, "CANCELADA",
			OrderStatus.CANCELLED);

	/** Valor JSON del contrato → valor SQL de {@code orden.estado}, para filtros. */
	static final Map<String, String> ORDER_STATUS_SQL = Map.of("draft", "BORRADOR", "pending_approval",
			"PENDIENTE_APROBACION", "held", "RETENIDA", "released", "LIBERADA", "in_production", "EN_PRODUCCION",
			"dispatched", "DESPACHADA", "closed", "CERRADA", "cancelled", "CANCELADA");

	static final Map<String, PaymentPhase> PHASE = Map.of("RECIBIDO", PaymentPhase.RECEIVED, "VERIFICADO_BANCO",
			PaymentPhase.BANK_VERIFIED, "APLICADO", PaymentPhase.APPLIED);

	static final Map<String, String> PHASE_SQL = Map.of("received", "RECIBIDO", "bank_verified", "VERIFICADO_BANCO",
			"applied", "APLICADO");

	static final Map<String, ReconciliationStatus> RECONCILIATION = Map.of("PENDIENTE", ReconciliationStatus.PENDING,
			"APLICADO", ReconciliationStatus.APPLIED, "PARCIAL", ReconciliationStatus.PARTIAL, "DUPLICADO",
			ReconciliationStatus.DUPLICATE, "SIN_ORDEN", ReconciliationStatus.ORPHAN, "NO_CUADRA",
			ReconciliationStatus.AMOUNT_MISMATCH);

	static final Map<String, String> RECONCILIATION_SQL = Map.of("pending", "PENDIENTE", "applied", "APLICADO",
			"partial", "PARCIAL", "duplicate", "DUPLICADO", "orphan", "SIN_ORDEN", "amount_mismatch", "NO_CUADRA");

	static final Map<String, PaymentChannel> CHANNEL = Map.of("YAPE", PaymentChannel.YAPE, "PLIN", PaymentChannel.PLIN,
			"TRANSFERENCIA", PaymentChannel.BANK_TRANSFER, "DEPOSITO", PaymentChannel.DEPOSIT, "EFECTIVO",
			PaymentChannel.CASH, "OTRO", PaymentChannel.OTHER);

	static final Map<String, PaymentCondition> CONDITION = Map.of("CONTADO", PaymentCondition.CASH, "ANTICIPO",
			PaymentCondition.ADVANCE, "CREDITO", PaymentCondition.CREDIT);

	static final Map<String, OrderSource> SOURCE = Map.of("WHATSAPP", OrderSource.WHATSAPP, "MANUAL",
			OrderSource.MANUAL, "CSV", OrderSource.CSV);

	static final Map<String, AlertRule> ALERT_RULE = Map.of("MORA_TEMPRANA", AlertRule.EARLY_ARREARS,
			"PAGO_EN_REVISION", AlertRule.PAYMENT_IN_REVIEW, "ANTICIPO_PENDIENTE", AlertRule.ADVANCE_PENDING);

	static final Map<String, AlertStatus> ALERT_STATUS = Map.of("ABIERTA", AlertStatus.OPEN, "RESUELTA",
			AlertStatus.RESOLVED, "CANCELADA", AlertStatus.CANCELLED);

	static final Map<String, String> ALERT_STATUS_SQL = Map.of("open", "ABIERTA", "resolved", "RESUELTA", "cancelled",
			"CANCELADA");

	static final Map<String, AuditActor> AUDIT_ACTOR = Map.of("USUARIO", AuditActor.USER, "N8N", AuditActor.N8N,
			"SCHEDULER", AuditActor.SCHEDULER, "SISTEMA", AuditActor.SYSTEM);

	public static final Map<String, CostComponent> COST_COMPONENT = Map.of("MATERIA_PRIMA", CostComponent.RAW_MATERIALS,
			"MANO_OBRA", CostComponent.LABOR, "TERCERO", CostComponent.OUTSOURCED, "CIF", CostComponent.OVERHEAD,
			"LOGISTICA", CostComponent.LOGISTICS);

	private PanelMapping() {
	}

	/** Fecha de negocio vigente (America/Lima): fecha de corte por defecto. */
	public static LocalDate today() {
		return LocalDate.now(LIMA);
	}

	/** Instantes con el desfase de Lima, para que la fecha visible coincida con la de negocio. */
	public static OffsetDateTime lima(OffsetDateTime instant) {
		return instant == null ? null : instant.atZoneSameInstant(LIMA).toOffsetDateTime();
	}

	public static OffsetDateTime startOfDay(LocalDate date) {
		return date == null ? null : date.atStartOfDay(LIMA).toOffsetDateTime();
	}

	static ProductionMode productionMode(String tipo) {
		return "TERCERIZADA".equals(tipo) ? ProductionMode.OUTSOURCED : ProductionMode.OWN;
	}

	/** Procedencia del dato: organización DEMO (semilla ficticia), extracción revisada (WhatsApp) o carga manual. */
	static DataOrigin dataOrigin(boolean demo, String origen) {
		if (demo) {
			return DataOrigin.DEMO_FIXTURE;
		}
		return "WHATSAPP".equals(origen) ? DataOrigin.REVIEWED_EXTRACTION : DataOrigin.MANUAL_ENTRY;
	}

	/** Centavos con signo, exactos: un importe con más de dos decimales es un error, no se redondea. */
	public static long cents(BigDecimal soles) {
		long c = soles.setScale(2, RoundingMode.UNNECESSARY).movePointRight(2).longValueExact();
		if (Math.abs(c) > CommonDtos.MAX_SAFE_CENTS) {
			throw new IllegalArgumentException("Importe fuera del rango seguro del contrato");
		}
		return c;
	}

	public static BigDecimal soles(long cents) {
		return BigDecimal.valueOf(cents, 2);
	}

	public static Money money(BigDecimal soles) {
		return soles == null ? null : Money.pen(cents(soles));
	}

	public static NonNegativeMoney nonNegative(BigDecimal soles) {
		return soles == null ? null : NonNegativeMoney.pen(Math.max(0, cents(soles)));
	}

	public static NonNegativeMoney nonNegativeOrZero(BigDecimal soles) {
		return NonNegativeMoney.pen(soles == null ? 0 : Math.max(0, cents(soles)));
	}

	/** Venta o pago: positivo; un total nulo o cero (borrador) no es una venta. */
	public static PositiveMoney positive(BigDecimal soles) {
		if (soles == null || soles.signum() <= 0) {
			return null;
		}
		return PositiveMoney.pen(cents(soles));
	}

	static String orNull(Map<String, String> map, String contractValue, String parameter) {
		if (contractValue == null || contractValue.isBlank()) {
			return null;
		}
		String v = map.get(contractValue);
		if (v == null) {
			throw PanelException.badRequest("Valor no válido para " + parameter);
		}
		return v;
	}

}
