package pe.keptai.backend.contract;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PositiveMoney;
import pe.keptai.backend.contract.ContractEnums.AlertResolution;
import pe.keptai.backend.contract.ContractEnums.AlertRule;
import pe.keptai.backend.contract.ContractEnums.TermStartEvent;
import pe.keptai.backend.contract.ContractEnums.AlertStatus;
import pe.keptai.backend.contract.ContractEnums.CreditAuthorizationStatus;
import pe.keptai.backend.contract.ContractEnums.DataOrigin;
import pe.keptai.backend.contract.ContractEnums.DueBucket;
import pe.keptai.backend.contract.ContractEnums.ReceivableStatus;
import pe.keptai.backend.contract.OrderDtos.CustomerRef;

/** Obligaciones, alertas y estado de cuenta. Contrato PROPUESTO MIG-02; saldos calculados por el motor (MIG-07). */
public final class ReceivableDtos {

	private ReceivableDtos() {
	}

	/**
	 * Obligacion de cobro: una sola por orden, sin cuotas (D-005). {@code balance} lo calcula el motor a partir de aplicaciones
	 * validas (v_saldo_obligacion); nunca desde OCR ni promesas de pago. {@code due_date} es nulo hasta el acta de despacho.
	 */
	public record Receivable(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("order_id") @NotNull UUID orderId,
			@JsonProperty("order_code") @NotNull @Pattern(regexp = OrderDtos.LABEL_REGEX) String orderCode,
			@JsonProperty("customer") @NotNull @Valid CustomerRef customer,
			@JsonProperty("original_amount") @NotNull @Valid PositiveMoney originalAmount,
			@JsonProperty("applied_amount") @NotNull @Valid NonNegativeMoney appliedAmount,
			@JsonProperty("balance") @NotNull @Valid NonNegativeMoney balance,
			@JsonProperty("credit_term_days") @NotNull @Min(0) @Max(365) Integer creditTermDays,
			@JsonProperty("term_start_event") @NotNull TermStartEvent termStartEvent,
			@JsonProperty("due_date") LocalDate dueDate,
			@JsonProperty("due_bucket") @NotNull DueBucket dueBucket,
			@JsonProperty("days_overdue") @NotNull @Min(0) @Max(36_500) Integer daysOverdue,
			@JsonProperty("status") @NotNull ReceivableStatus status) {

		@JsonIgnore
		@AssertTrue(message = "days_overdue solo es mayor que 0 cuando due_bucket=overdue")
		public boolean isOverdueDaysConsistentWithBucket() {
			if (dueBucket == null || daysOverdue == null) {
				return true;
			}
			return (dueBucket == DueBucket.OVERDUE) == (daysOverdue > 0);
		}

		@JsonIgnore
		@AssertTrue(message = "sin acta de despacho (due_date nulo) la obligacion espera despacho; con vencimiento no")
		public boolean isDueDateConsistentWithBucket() {
			return dueBucket == null || (dueBucket == DueBucket.AWAITING_DISPATCH) == (dueDate == null);
		}

		@JsonIgnore
		@AssertTrue(message = "forma del estado: pagada tiene saldo cero; pendiente no tiene nada aplicado; parcial tiene ambos; mora tiene saldo")
		public boolean isStatusShapeConsistent() {
			if (status == null || balance == null || appliedAmount == null || balance.amountCents() == null
					|| appliedAmount.amountCents() == null) {
				return true;
			}
			return switch (status) {
				case PAID -> balance.amountCents() == 0;
				case PENDING -> appliedAmount.amountCents() == 0;
				case PARTIALLY_PAID -> balance.amountCents() > 0 && appliedAmount.amountCents() > 0;
				case OVERDUE -> balance.amountCents() > 0;
				case VOIDED -> true;
			};
		}
	}

	/**
	 * Alerta interna de cobranza (alerta_cobranza): apunta a una obligacion, a un pago en revision o a ambos. Los desfases
	 * -3/0/+3 de la cobranza al cliente pertenecen a la cola de mensajes salientes (WF3), no a la alerta.
	 */
	public record CollectionAlert(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("receivable_id") UUID receivableId,
			@JsonProperty("payment_id") UUID paymentId,
			@JsonProperty("rule") @NotNull AlertRule rule,
			@JsonProperty("status") @NotNull AlertStatus status,
			@JsonProperty("responsible_user_id") UUID responsibleUserId,
			@JsonProperty("resolution") AlertResolution resolution,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt,
			@JsonProperty("closed_at") OffsetDateTime closedAt) {

		@JsonIgnore
		@AssertTrue(message = "la alerta apunta a una obligacion o a un pago")
		public boolean isTargetPresent() {
			return receivableId != null || paymentId != null;
		}

		@JsonIgnore
		@AssertTrue(message = "una alerta abierta no tiene cierre ni resolucion; una cerrada tiene fecha de cierre")
		public boolean isClosureConsistentWithStatus() {
			if (status == null) {
				return true;
			}
			if (status == AlertStatus.OPEN) {
				return closedAt == null && resolution == null;
			}
			return closedAt != null;
		}
	}

	/**
	 * Decision de credito (aprobacion_credito): la toma el vendedor tras el aviso de mora; la mora no bloquea. Solo lectura aqui;
	 * la accion es {@code POST /orders/{order_id}/credit-decision}. {@code overdue_balance_reference} = saldo_referencia.
	 */
	public record CreditAuthorization(
			@JsonProperty("status") @NotNull CreditAuthorizationStatus status,
			@JsonProperty("responsible_user_id") UUID responsibleUserId,
			@JsonProperty("arrears_notice_shown") @NotNull Boolean arrearsNoticeShown,
			@JsonProperty("overdue_balance_reference") @Valid NonNegativeMoney overdueBalanceReference,
			@JsonProperty("credit_term_days") @Min(0) @Max(365) Integer creditTermDays,
			@JsonProperty("advance_pct_bps") @Min(0) @Max(10_000) Integer advancePctBps,
			@JsonProperty("reason") @Size(max = 500) String reason,
			@JsonProperty("decided_at") OffsetDateTime decidedAt) {

		@JsonIgnore
		@AssertTrue(message = "aprobada o rechazada exige responsable y fecha de decision")
		public boolean isDecisionConsistent() {
			if (status == null) {
				return true;
			}
			boolean decided = status == CreditAuthorizationStatus.APPROVED || status == CreditAuthorizationStatus.REJECTED;
			return !decided || (responsibleUserId != null && decidedAt != null);
		}

		@JsonIgnore
		@AssertTrue(message = "una decision con saldo vencido de referencia exige que el aviso de mora se haya mostrado")
		public boolean isNoticeShownWhenDecidedWithArrears() {
			if (status == null || overdueBalanceReference == null || overdueBalanceReference.amountCents() == null) {
				return true;
			}
			boolean decided = status == CreditAuthorizationStatus.APPROVED || status == CreditAuthorizationStatus.REJECTED;
			return !decided || overdueBalanceReference.amountCents() == 0 || Boolean.TRUE.equals(arrearsNoticeShown);
		}

		@JsonIgnore
		@AssertTrue(message = "una orden sin decision no tiene plazo ni responsable")
		public boolean isUndecidedWithoutTerms() {
			if (status != CreditAuthorizationStatus.PENDING && status != CreditAuthorizationStatus.NOT_REQUIRED) {
				return true;
			}
			return responsibleUserId == null && decidedAt == null;
		}
	}

	/**
	 * Cuerpo de {@code POST /orders/{order_id}/credit-decision}. El actor es el usuario del JWT (nunca el cuerpo). Si el cliente
	 * tiene saldo vencido, {@code arrears_notice_acknowledged} debe ser {@code true}: el aviso es obligatorio, el bloqueo no existe.
	 */
	@com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
	public record CreditDecisionRequest(
			@JsonProperty("decision") @NotNull ContractEnums.CreditDecisionValue decision,
			@JsonProperty("arrears_notice_acknowledged") @NotNull Boolean arrearsNoticeAcknowledged,
			@JsonProperty("credit_term_days") @Min(15) @Max(30) Integer creditTermDays,
			@JsonProperty("advance_pct_bps") @Min(0) @Max(10_000) Integer advancePctBps,
			@JsonProperty("reason") @Size(max = 500) String reason) {

		@JsonIgnore
		@AssertTrue(message = "aprobar credito exige credit_term_days (15 a 30 dias, direccion D-005)")
		public boolean isTermPresentWhenApproving() {
			return decision != ContractEnums.CreditDecisionValue.APPROVED || creditTermDays != null;
		}
	}

	public record StatementOrder(
			@JsonProperty("order_id") @NotNull UUID orderId,
			@JsonProperty("order_code") @NotNull @Pattern(regexp = OrderDtos.LABEL_REGEX) String orderCode,
			@JsonProperty("sale") @NotNull @Valid PositiveMoney sale,
			@JsonProperty("applied_amount") @NotNull @Valid NonNegativeMoney appliedAmount,
			@JsonProperty("balance") @NotNull @Valid NonNegativeMoney balance,
			@JsonProperty("due_date") LocalDate dueDate) {
	}

	public record StatementApplication(
			@JsonProperty("payment_code") @Pattern(regexp = OrderDtos.LABEL_REGEX) String paymentCode,
			@JsonProperty("order_code") @NotNull @Pattern(regexp = OrderDtos.LABEL_REGEX) String orderCode,
			@JsonProperty("applied_amount") @NotNull @Valid PositiveMoney appliedAmount,
			@JsonProperty("applied_at") @NotNull OffsetDateTime appliedAt) {
	}

	public record CustomerStatement(
			@JsonProperty("customer") @NotNull @Valid CustomerRef customer,
			@JsonProperty("generated_at") @NotNull OffsetDateTime generatedAt,
			@JsonProperty("total_balance") @NotNull @Valid NonNegativeMoney totalBalance,
			@JsonProperty("next_due_date") LocalDate nextDueDate,
			@JsonProperty("orders") @NotNull @Size(max = 200) List<@Valid StatementOrder> orders,
			@JsonProperty("applications") @NotNull @Size(max = 500) List<@Valid StatementApplication> applications,
			@JsonProperty("credit_authorization") @NotNull @Valid CreditAuthorization creditAuthorization,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin) {
	}

}
