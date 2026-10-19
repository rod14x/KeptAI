package pe.keptai.backend.contract;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Corpotex KeptAI - Enumeraciones del contrato
 * Versión: v1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 *
 * Enumeraciones del contrato PROPUESTO (MIG-02). Cada constante fija su valor JSON de forma explicita con
 * {@code @JsonProperty}: el nombre Java no es el contrato. Valores iguales a los de {@code Backend/docs/openapi.yaml}
 * (una prueba compara ambos). Los estados son propuestas pendientes de acuerdo con Andres (PROP-DB-001).
 */
public final class ContractEnums {

	private ContractEnums() {
	}

	public enum DataOrigin {
		@JsonProperty("demo_fixture") DEMO_FIXTURE,
		@JsonProperty("manual_entry") MANUAL_ENTRY,
		@JsonProperty("automated_extraction") AUTOMATED_EXTRACTION,
		@JsonProperty("reviewed_extraction") REVIEWED_EXTRACTION
	}

	/** Roles vigentes de BD (usuario.rol): una fila por usuario y organizacion. Valor JSON = valor SQL. */
	public enum UserRole {
		@JsonProperty("VENDEDOR") VENDEDOR,
		@JsonProperty("ADMIN") ADMIN,
		@JsonProperty("GERENTE") GERENTE,
		@JsonProperty("JEFE_TALLER") JEFE_TALLER,
		@JsonProperty("DISENO") DISENO
	}

	public enum EvidenceKind {
		@JsonProperty("text_chat") TEXT_CHAT,
		@JsonProperty("voucher_image") VOUCHER_IMAGE,
		@JsonProperty("audio_note") AUDIO_NOTE
	}

	public enum EvidenceStatus {
		@JsonProperty("stored") STORED,
		@JsonProperty("discarded") DISCARDED
	}

	public enum DraftType {
		@JsonProperty("order") ORDER,
		@JsonProperty("payment_voucher") PAYMENT_VOUCHER
	}

	public enum DraftStatus {
		@JsonProperty("pending_review") PENDING_REVIEW,
		@JsonProperty("confirmed") CONFIRMED,
		@JsonProperty("discarded") DISCARDED
	}

	public enum FieldStatus {
		@JsonProperty("present") PRESENT,
		@JsonProperty("missing") MISSING,
		@JsonProperty("illegible") ILLEGIBLE
	}

	public enum JobStatus {
		@JsonProperty("queued") QUEUED,
		@JsonProperty("running") RUNNING,
		@JsonProperty("succeeded") SUCCEEDED,
		@JsonProperty("failed") FAILED
	}

	public enum ProductionMode {
		@JsonProperty("own") OWN,
		@JsonProperty("outsourced") OUTSOURCED
	}

	public enum VerificationMethod {
		@JsonProperty("simulated_demo") SIMULATED_DEMO,
		@JsonProperty("manual_confirmation") MANUAL_CONFIRMATION
	}

	/** Estado del pedido; 1:1 con orden.estado (ver DbMapping). */
	public enum OrderStatus {
		@JsonProperty("draft") DRAFT,
		@JsonProperty("pending_approval") PENDING_APPROVAL,
		@JsonProperty("held") HELD,
		@JsonProperty("released") RELEASED,
		@JsonProperty("in_production") IN_PRODUCTION,
		@JsonProperty("dispatched") DISPATCHED,
		@JsonProperty("closed") CLOSED,
		@JsonProperty("cancelled") CANCELLED
	}

	/** orden.origen. No confundir con {@link DataOrigin} (procedencia del dato, p. ej. semilla ficticia). */
	public enum OrderSource {
		@JsonProperty("whatsapp") WHATSAPP,
		@JsonProperty("manual") MANUAL,
		@JsonProperty("csv") CSV
	}

	/** orden.condicion_pago. */
	public enum PaymentCondition {
		@JsonProperty("cash") CASH,
		@JsonProperty("advance") ADVANCE,
		@JsonProperty("credit") CREDIT
	}

	/** pago.fase: recibido no es verificado en banco ni aplicado; solo lo aplicado mueve saldo. */
	public enum PaymentPhase {
		@JsonProperty("received") RECEIVED,
		@JsonProperty("bank_verified") BANK_VERIFIED,
		@JsonProperty("applied") APPLIED
	}

	/** pago.estado_conciliacion, independiente de {@link PaymentPhase}. */
	public enum ReconciliationStatus {
		@JsonProperty("pending") PENDING,
		@JsonProperty("applied") APPLIED,
		@JsonProperty("partial") PARTIAL,
		@JsonProperty("duplicate") DUPLICATE,
		@JsonProperty("orphan") ORPHAN,
		@JsonProperty("amount_mismatch") AMOUNT_MISMATCH
	}

	/** pago.medio. */
	public enum PaymentChannel {
		@JsonProperty("yape") YAPE,
		@JsonProperty("plin") PLIN,
		@JsonProperty("bank_transfer") BANK_TRANSFER,
		@JsonProperty("deposit") DEPOSIT,
		@JsonProperty("cash") CASH,
		@JsonProperty("other") OTHER
	}

	/** obligacion_cobro.estado. */
	public enum ReceivableStatus {
		@JsonProperty("pending") PENDING,
		@JsonProperty("partially_paid") PARTIALLY_PAID,
		@JsonProperty("paid") PAID,
		@JsonProperty("overdue") OVERDUE,
		@JsonProperty("voided") VOIDED
	}

	/** obligacion_cobro.evento_inicio_plazo: el reloj corre desde el despacho (acta), no desde el pedido ni el chat. */
	public enum TermStartEvent {
		@JsonProperty("dispatch") DISPATCH
	}

	/** Derivado por el motor desde vence_en; {@code awaiting_dispatch} mientras no hay acta de despacho. */
	public enum DueBucket {
		@JsonProperty("awaiting_dispatch") AWAITING_DISPATCH,
		@JsonProperty("not_due") NOT_DUE,
		@JsonProperty("due_today") DUE_TODAY,
		@JsonProperty("overdue") OVERDUE
	}

	/** alerta_cobranza.estado. */
	public enum AlertStatus {
		@JsonProperty("open") OPEN,
		@JsonProperty("resolved") RESOLVED,
		@JsonProperty("cancelled") CANCELLED
	}

	/** alerta_cobranza.regla. */
	public enum AlertRule {
		@JsonProperty("early_arrears") EARLY_ARREARS,
		@JsonProperty("payment_in_review") PAYMENT_IN_REVIEW,
		@JsonProperty("advance_pending") ADVANCE_PENDING
	}

	/** Decision que puede enviar el vendedor; aprobacion_credito.decision tambien tiene PENDIENTE (lo fija el servidor). */
	public enum CreditDecisionValue {
		@JsonProperty("approved") APPROVED,
		@JsonProperty("rejected") REJECTED
	}

	/** costo_orden.concepto. */
	public enum CostComponent {
		@JsonProperty("raw_materials") RAW_MATERIALS,
		@JsonProperty("labor") LABOR,
		@JsonProperty("outsourced") OUTSOURCED,
		@JsonProperty("overhead") OVERHEAD,
		@JsonProperty("logistics") LOGISTICS
	}

	/** evento_auditoria.actor. */
	public enum AuditActor {
		@JsonProperty("user") USER,
		@JsonProperty("n8n") N8N,
		@JsonProperty("scheduler") SCHEDULER,
		@JsonProperty("system") SYSTEM
	}

	public enum ReconciliationClass {
		@JsonProperty("matches") MATCHES,
		@JsonProperty("partial") PARTIAL,
		@JsonProperty("duplicate") DUPLICATE,
		@JsonProperty("orphan") ORPHAN,
		@JsonProperty("amount_mismatch") AMOUNT_MISMATCH
	}

	public enum MatchReason {
		@JsonProperty("amount_equal") AMOUNT_EQUAL,
		@JsonProperty("amount_below_balance") AMOUNT_BELOW_BALANCE,
		@JsonProperty("amount_above_balance") AMOUNT_ABOVE_BALANCE,
		@JsonProperty("reference_already_used") REFERENCE_ALREADY_USED,
		@JsonProperty("customer_name_similar") CUSTOMER_NAME_SIMILAR
	}

	public enum AlertResolution {
		@JsonProperty("payment_applied") PAYMENT_APPLIED,
		@JsonProperty("manual") MANUAL
	}

	public enum CreditAuthorizationStatus {
		@JsonProperty("not_required") NOT_REQUIRED,
		@JsonProperty("pending") PENDING,
		@JsonProperty("approved") APPROVED,
		@JsonProperty("rejected") REJECTED
	}

	public enum CostStatus {
		@JsonProperty("complete") COMPLETE,
		@JsonProperty("incomplete") INCOMPLETE
	}

	public enum MarginGroupBy {
		@JsonProperty("order") ORDER,
		@JsonProperty("product_line") PRODUCT_LINE,
		@JsonProperty("brand") BRAND
	}

	public enum OpeningCashSource {
		@JsonProperty("demo_fixture") DEMO_FIXTURE,
		@JsonProperty("manual_entry") MANUAL_ENTRY
	}

	public enum ForecastStatus {
		@JsonProperty("complete") COMPLETE,
		@JsonProperty("missing_opening_cash") MISSING_OPENING_CASH
	}

	/** cliente.tipo (INT-FE-API-002). */
	public enum CustomerType {
		@JsonProperty("school") SCHOOL,
		@JsonProperty("company") COMPANY,
		@JsonProperty("person") PERSON
	}

	/** envio_notificacion.tipo (INT-FE-API-002); solo metadatos, sin texto (D-007). */
	public enum NotificationType {
		@JsonProperty("collection_preventive") COLLECTION_PREVENTIVE,
		@JsonProperty("collection_due") COLLECTION_DUE,
		@JsonProperty("early_arrears") EARLY_ARREARS,
		@JsonProperty("repurchase") REPURCHASE,
		@JsonProperty("account_statement") ACCOUNT_STATEMENT,
		@JsonProperty("payment_confirmation") PAYMENT_CONFIRMATION,
		@JsonProperty("seller_summary") SELLER_SUMMARY
	}

	/** envio_notificacion.estado (INT-FE-API-002). */
	public enum NotificationStatus {
		@JsonProperty("pending") PENDING,
		@JsonProperty("sent") SENT,
		@JsonProperty("error") ERROR,
		@JsonProperty("cancelled") CANCELLED
	}

}
