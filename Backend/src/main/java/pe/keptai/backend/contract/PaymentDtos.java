package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PersonRef;
import pe.keptai.backend.contract.CommonDtos.PositiveMoney;
import pe.keptai.backend.contract.ContractEnums.DataOrigin;
import pe.keptai.backend.contract.ContractEnums.MatchReason;
import pe.keptai.backend.contract.ContractEnums.PaymentChannel;
import pe.keptai.backend.contract.ContractEnums.PaymentPhase;
import pe.keptai.backend.contract.ContractEnums.ReconciliationStatus;
import pe.keptai.backend.contract.ContractEnums.ReconciliationClass;
import pe.keptai.backend.contract.ContractEnums.VerificationMethod;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;

/**
 * Pagos, conciliacion, verificacion y aplicacion. Contrato PROPUESTO MIG-02. Saldos y clasificaciones los calcula el motor
 * de Andres (MIG-07); estos DTO solo los transportan y no contienen formulas financieras.
 */
public final class PaymentDtos {

	private PaymentDtos() {
	}

	public record PaymentVerification(
			@JsonProperty("method") @NotNull VerificationMethod method,
			@JsonProperty("is_simulated") @NotNull Boolean simulated,
			@JsonProperty("verified_by_user_id") @NotNull UUID verifiedByUserId,
			@JsonProperty("verified_at") @NotNull OffsetDateTime verifiedAt,
			@JsonProperty("note") @Size(max = 500) String note,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("verified_by_name") @Size(max = 200) String verifiedByName) {
		public PaymentVerification(
			@JsonProperty("method") @NotNull VerificationMethod method,
			@JsonProperty("is_simulated") @NotNull Boolean simulated,
			@JsonProperty("verified_by_user_id") @NotNull UUID verifiedByUserId,
			@JsonProperty("verified_at") @NotNull OffsetDateTime verifiedAt,
			@JsonProperty("note") @Size(max = 500) String note) {
			this(method, simulated, verifiedByUserId, verifiedAt, note, null);
		}


		@JsonIgnore
		@AssertTrue(message = "la verificacion simulada debe rotularse is_simulated=true y no puede ser otra")
		public boolean isSimulationFlagConsistent() {
			return method == null || simulated == null || (method == VerificationMethod.SIMULATED_DEMO) == simulated;
		}
	}

	/**
	 * Recibido, verificado en banco y aplicado son fases y importes distintos (pago.fase); la conciliacion es otro eje
	 * (pago.estado_conciliacion). {@code verified_amount} es nulo hasta registrar la verificacion. Un comprobante extraido por
	 * IA nunca crea un pago verificado ni aplicado.
	 */
	public record Payment(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("display_code") @Pattern(regexp = OrderDtos.LABEL_REGEX) String displayCode,
			@JsonProperty("phase") @NotNull PaymentPhase phase,
			@JsonProperty("reconciliation_status") @NotNull ReconciliationStatus reconciliationStatus,
			@JsonProperty("channel") @NotNull PaymentChannel channel,
			@JsonProperty("operation_reference") @Size(max = 100) String operationReference,
			@JsonProperty("payer_name") @Size(max = 200) String payerName,
			@JsonProperty("paid_at") OffsetDateTime paidAt,
			@JsonProperty("received_amount") @NotNull @Valid PositiveMoney receivedAmount,
			@JsonProperty("verified_amount") @Valid NonNegativeMoney verifiedAmount,
			@JsonProperty("applied_amount") @NotNull @Valid NonNegativeMoney appliedAmount,
			@JsonProperty("unapplied_amount") @NotNull @Valid NonNegativeMoney unappliedAmount,
			@JsonProperty("duplicate_of_payment_id") UUID duplicateOfPaymentId,
			@JsonProperty("evidence_ids") @NotNull @Size(max = 20) List<@NotNull UUID> evidenceIds,
			@JsonProperty("verification") @Valid PaymentVerification verification,
			@JsonProperty("model_reported_confidence_permille") @Min(0) @Max(1000) Integer modelReportedConfidencePermille,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("applications") @Size(max = 20) List<@Valid PaymentAllocation> applications) {
		public Payment(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("display_code") @Pattern(regexp = OrderDtos.LABEL_REGEX) String displayCode,
			@JsonProperty("phase") @NotNull PaymentPhase phase,
			@JsonProperty("reconciliation_status") @NotNull ReconciliationStatus reconciliationStatus,
			@JsonProperty("channel") @NotNull PaymentChannel channel,
			@JsonProperty("operation_reference") @Size(max = 100) String operationReference,
			@JsonProperty("payer_name") @Size(max = 200) String payerName,
			@JsonProperty("paid_at") OffsetDateTime paidAt,
			@JsonProperty("received_amount") @NotNull @Valid PositiveMoney receivedAmount,
			@JsonProperty("verified_amount") @Valid NonNegativeMoney verifiedAmount,
			@JsonProperty("applied_amount") @NotNull @Valid NonNegativeMoney appliedAmount,
			@JsonProperty("unapplied_amount") @NotNull @Valid NonNegativeMoney unappliedAmount,
			@JsonProperty("duplicate_of_payment_id") UUID duplicateOfPaymentId,
			@JsonProperty("evidence_ids") @NotNull @Size(max = 20) List<@NotNull UUID> evidenceIds,
			@JsonProperty("verification") @Valid PaymentVerification verification,
			@JsonProperty("model_reported_confidence_permille") @Min(0) @Max(1000) Integer modelReportedConfidencePermille,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt) {
			this(id, displayCode, phase, reconciliationStatus, channel, operationReference, payerName, paidAt, receivedAmount, verifiedAmount, appliedAmount, unappliedAmount, duplicateOfPaymentId, evidenceIds, verification, modelReportedConfidencePermille, dataOrigin, createdAt, null);
		}


		/** Forma de cada fase (no recalcula saldos): solo recibido sin verificar; solo verificado puede aplicarse. */
		@JsonIgnore
		@AssertTrue(message = "la fase del pago no coincide con sus verificaciones o importes aplicados")
		public boolean isPhaseShapeConsistent() {
			if (phase == null || appliedAmount == null || appliedAmount.amountCents() == null) {
				return true;
			}
			boolean noneApplied = appliedAmount.amountCents() == 0;
			return switch (phase) {
				case RECEIVED -> verification == null && verifiedAmount == null && noneApplied;
				case BANK_VERIFIED -> verification != null && verifiedAmount != null;
				case APPLIED -> verification != null && verifiedAmount != null && !noneApplied;
			};
		}

		/** Un duplicado apunta al pago original, queda en revision (fase recibido) y nunca se aplica; solo un duplicado apunta. */
		@JsonIgnore
		@AssertTrue(message = "un pago duplicado apunta al original, no esta verificado ni aplicado; un no duplicado no apunta")
		public boolean isDuplicateShapeConsistent() {
			if (reconciliationStatus == null || phase == null) {
				return true;
			}
			boolean duplicate = reconciliationStatus == ReconciliationStatus.DUPLICATE;
			if (duplicate != (duplicateOfPaymentId != null)) {
				return false;
			}
			return !duplicate || (phase == PaymentPhase.RECEIVED && verification == null && verifiedAmount == null
					&& (appliedAmount == null || appliedAmount.amountCents() == null || appliedAmount.amountCents() == 0));
		}

		/** Una conciliacion APLICADO/PARCIAL describe un pago ya aplicado (lectura propuesta de PARCIAL: cubre parte de la obligacion). */
		@JsonIgnore
		@AssertTrue(message = "conciliacion aplicada exige fase applied; pendiente o huerfano no tienen importe aplicado")
		public boolean isReconciliationConsistentWithPhase() {
			if (reconciliationStatus == null || phase == null || appliedAmount == null || appliedAmount.amountCents() == null) {
				return true;
			}
			return switch (reconciliationStatus) {
				case APPLIED -> phase == PaymentPhase.APPLIED;
                case PARTIAL -> true; // Clasificacion del candidato o de la aplicacion; fase sigue siendo la fuente de fondos.
				case PENDING, ORPHAN -> appliedAmount.amountCents() == 0;
				case DUPLICATE, AMOUNT_MISMATCH -> true;
			};
		}

		@JsonIgnore
		@AssertTrue(message = "todos los importes del pago deben estar en la misma moneda")
		public boolean isSingleCurrency() {
			String c = receivedAmount == null ? null : receivedAmount.currency();
			return c == null || (same(c, verifiedAmount == null ? null : verifiedAmount.currency())
					&& same(c, appliedAmount == null ? null : appliedAmount.currency())
					&& same(c, unappliedAmount == null ? null : unappliedAmount.currency()));
		}

		private static boolean same(String a, String b) {
			return b == null || a.equals(b);
		}
	}

	/** Aplicacion vigente del pago a una obligacion (aplicacion_pago sin anular), INT-FE-API-002. */
	public record PaymentAllocation(
			@JsonProperty("application_id") @NotNull UUID applicationId,
			@JsonProperty("receivable_id") @NotNull UUID receivableId,
			@JsonProperty("order_id") @NotNull UUID orderId,
			@JsonProperty("order_code") @NotNull @Pattern(regexp = OrderDtos.LABEL_REGEX) String orderCode,
			@JsonProperty("amount") @NotNull @Valid PositiveMoney amount,
			@JsonProperty("applied_at") @NotNull OffsetDateTime appliedAt,
			@JsonProperty("applied_by") @Valid PersonRef appliedBy) {
	}

	/** {@code match_score} lo define el motor de Andres (pendiente); nulo si no se calcula. No es confianza de extraccion. */
	public record ReconciliationCandidate(
			@JsonProperty("receivable_id") @NotNull UUID receivableId,
			@JsonProperty("order_id") @NotNull UUID orderId,
			@JsonProperty("order_code") @NotNull @Pattern(regexp = OrderDtos.LABEL_REGEX) String orderCode,
			@JsonProperty("customer_name") @NotBlank @Size(max = 200) String customerName,
			@JsonProperty("balance") @NotNull @Valid NonNegativeMoney balance,
			@JsonProperty("match_score") @Min(0) @Max(100) Integer matchScore,
			@JsonProperty("reasons") @NotNull @Size(max = 10) List<@NotNull MatchReason> reasons) {
	}

	public record ReconciliationResult(
			@JsonProperty("payment_id") @NotNull UUID paymentId,
			@JsonProperty("classification") @NotNull ReconciliationClass classification,
			@JsonProperty("candidates") @NotNull @Size(max = 20) List<@Valid ReconciliationCandidate> candidates) {

		@JsonIgnore
		@AssertTrue(message = "un pago huerfano no tiene candidatos")
		public boolean isOrphanWithoutCandidates() {
			return classification != ReconciliationClass.ORPHAN || candidates == null || candidates.isEmpty();
		}
	}

	public record RegisterVerificationRequest(
			@JsonProperty("method") @NotNull VerificationMethod method,
			@JsonProperty("note") @Size(max = 500) String note) {
	}

	/** El cliente indica obligacion e importe; nunca envia saldos ni organizacion. */
	public record ApplyPaymentRequest(
			@JsonProperty("receivable_id") @NotNull UUID receivableId,
			@JsonProperty("amount") @NotNull @Valid PositiveMoney amount) {
	}

	public record PaymentApplication(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("payment_id") @NotNull UUID paymentId,
			@JsonProperty("receivable_id") @NotNull UUID receivableId,
			@JsonProperty("applied_amount") @NotNull @Valid PositiveMoney appliedAmount,
			@JsonProperty("applied_at") @NotNull OffsetDateTime appliedAt,
			@JsonProperty("applied_by_user_id") @NotNull UUID appliedByUserId) {
	}

	public record PaymentApplicationResult(
			@JsonProperty("application") @NotNull @Valid PaymentApplication application,
			@JsonProperty("payment") @NotNull @Valid Payment payment,
			@JsonProperty("receivable") @NotNull @Valid Receivable receivable,
			@JsonProperty("resolved_alert_ids") @NotNull @Size(max = 20) List<@NotNull UUID> resolvedAlertIds) {
	}

}
