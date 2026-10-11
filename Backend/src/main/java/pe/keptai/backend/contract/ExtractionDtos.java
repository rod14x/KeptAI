package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertFalse;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.CommonDtos.PositiveMoney;
import pe.keptai.backend.contract.ContractEnums.DraftStatus;
import pe.keptai.backend.contract.ContractEnums.DraftType;
import pe.keptai.backend.contract.ContractEnums.FieldStatus;
import pe.keptai.backend.contract.ContractEnums.JobStatus;

/** Extraccion, borradores, correccion y confirmacion. Contrato PROPUESTO MIG-02; implementacion MIG-05/06. */
public final class ExtractionDtos {

	private ExtractionDtos() {
	}

	public record StartExtractionRequest(@JsonProperty("expected_draft_type") @NotNull DraftType expectedDraftType) {
	}

	public record ExtractionJob(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("evidence_id") @NotNull UUID evidenceId,
			@JsonProperty("expected_draft_type") @NotNull DraftType expectedDraftType,
			@JsonProperty("status") @NotNull JobStatus status,
			@JsonProperty("attempt") @NotNull @Min(0) @Max(10) Integer attempt,
			@JsonProperty("error_code") @Pattern(regexp = "[A-Z][A-Z0-9_]*") String errorCode,
			@JsonProperty("error_message") @Size(max = 500) String errorMessage,
			@JsonProperty("retryable") @NotNull Boolean retryable,
			@JsonProperty("draft_id") UUID draftId,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt,
			@JsonProperty("finished_at") OffsetDateTime finishedAt) {

		@JsonIgnore
		@AssertTrue(message = "succeeded exige draft_id; failed exige error_code; en curso no tiene fin ni error")
		public boolean isStateConsistent() {
			if (status == null) {
				return true;
			}
			return switch (status) {
				case SUCCEEDED -> draftId != null && errorCode == null && finishedAt != null;
				case FAILED -> draftId == null && errorCode != null && finishedAt != null;
				case QUEUED, RUNNING -> draftId == null && errorCode == null && finishedAt == null;
			};
		}
	}

	/**
	 * Campo extraido con procedencia. Un valor ausente o ilegible es {@code null} con su estado: nunca se inventa.
	 * No hay porcentaje de confianza: no existe una medida de origen definida.
	 */
	public record ExtractedField<T>(
			@JsonProperty("value") @Valid T value,
			@JsonProperty("status") @NotNull FieldStatus status,
			@JsonProperty("source_fragment") @Size(max = 500) String sourceFragment,
			@JsonProperty("human_corrected") @NotNull Boolean humanCorrected) {

		@JsonIgnore
		@AssertTrue(message = "value debe existir solo cuando status=present")
		public boolean isValueConsistentWithStatus() {
			return status == null || (status == FieldStatus.PRESENT) == (value != null);
		}
	}

	public record OrderDraftFields(
			@JsonProperty("customer_name") @NotNull @Valid ExtractedField<String> customerName,
			@JsonProperty("brand") @NotNull @Valid ExtractedField<String> brand,
			@JsonProperty("product_description") @NotNull @Valid ExtractedField<String> productDescription,
			@JsonProperty("quantity") @NotNull @Valid ExtractedField<Integer> quantity,
			@JsonProperty("sale_amount") @NotNull @Valid ExtractedField<PositiveMoney> saleAmount) {

		@JsonIgnore
		@AssertTrue(message = "quantity debe estar entre 1 y 1000000")
		public boolean isQuantityInRange() {
			if (quantity == null || quantity.value() == null) {
				return true;
			}
			return quantity.value() >= 1 && quantity.value() <= 1_000_000;
		}
	}

	public record VoucherDraftFields(
			@JsonProperty("payer_name") @NotNull @Valid ExtractedField<String> payerName,
			@JsonProperty("channel") @NotNull @Valid ExtractedField<String> channel,
			@JsonProperty("amount") @NotNull @Valid ExtractedField<PositiveMoney> amount,
			@JsonProperty("operation_reference") @NotNull @Valid ExtractedField<String> operationReference,
			@JsonProperty("paid_at") @NotNull @Valid ExtractedField<OffsetDateTime> paidAt) {
	}

	/**
	 * Exactamente uno de {@code order_fields}/{@code voucher_fields}, segun {@code draft_type}. {@code model_reported_confidence_permille}
	 * (0..1000, hoja_resumen.confianza x 1000) es el valor que el MODELO declaro via n8n: no es probabilidad calibrada, no aprueba
	 * nada y no sustituye la revision humana ({@code reviewed_by_user_id}); es {@code null} si no hubo extraccion automatica.
	 */
	public record ExtractionDraft(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("evidence_id") UUID evidenceId,
			@JsonProperty("draft_type") @NotNull DraftType draftType,
			@JsonProperty("status") @NotNull DraftStatus status,
			@JsonProperty("revision") @NotNull @Min(1) @Max(1_000_000) Integer revision,
			@JsonProperty("order_fields") @Valid OrderDraftFields orderFields,
			@JsonProperty("voucher_fields") @Valid VoucherDraftFields voucherFields,
			@JsonProperty("resulting_order_id") UUID resultingOrderId,
			@JsonProperty("resulting_payment_id") UUID resultingPaymentId,
			@JsonProperty("reviewed_by_user_id") UUID reviewedByUserId,
			@JsonProperty("model_reported_confidence_permille") @Min(0) @Max(1000) Integer modelReportedConfidencePermille,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt,
			@JsonProperty("updated_at") @NotNull OffsetDateTime updatedAt) {

		@JsonIgnore
		@AssertTrue(message = "los campos deben corresponder a draft_type")
		public boolean isFieldsMatchDraftType() {
			if (draftType == null) {
				return true;
			}
			return draftType == DraftType.ORDER ? orderFields != null && voucherFields == null
					: voucherFields != null && orderFields == null;
		}

		@JsonIgnore
		@AssertTrue(message = "solo un borrador confirmado tiene pedido o pago resultante, segun su tipo")
		public boolean isResultConsistentWithStatus() {
			if (status == null || draftType == null) {
				return true;
			}
			if (status != DraftStatus.CONFIRMED) {
				return resultingOrderId == null && resultingPaymentId == null;
			}
			return draftType == DraftType.ORDER ? resultingOrderId != null && resultingPaymentId == null
					: resultingPaymentId != null && resultingOrderId == null;
		}
	}

	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record OrderFieldsCorrection(
			@JsonProperty("customer_name") @Size(min = 1, max = 200) String customerName,
			@JsonProperty("brand") @Size(min = 1, max = 100) String brand,
			@JsonProperty("product_description") @Size(min = 1, max = 1000) String productDescription,
			@JsonProperty("quantity") @Min(1) @Max(1_000_000) Integer quantity,
			@JsonProperty("sale_amount") @Valid PositiveMoney saleAmount) {

		@JsonIgnore
		@AssertTrue(message = "debe corregir al menos un campo")
		public boolean isNotEmpty() {
			return customerName != null || brand != null || productDescription != null || quantity != null || saleAmount != null;
		}
	}

	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record VoucherFieldsCorrection(
			@JsonProperty("payer_name") @Size(min = 1, max = 200) String payerName,
			@JsonProperty("channel") @Size(min = 1, max = 50) String channel,
			@JsonProperty("amount") @Valid PositiveMoney amount,
			@JsonProperty("operation_reference") @Size(min = 1, max = 100) String operationReference,
			@JsonProperty("paid_at") OffsetDateTime paidAt) {

		@JsonIgnore
		@AssertTrue(message = "debe corregir al menos un campo")
		public boolean isNotEmpty() {
			return payerName != null || channel != null || amount != null || operationReference != null || paidAt != null;
		}
	}

	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record CorrectDraftRequest(
			@JsonProperty("expected_revision") @NotNull @Min(1) @Max(1_000_000) Integer expectedRevision,
			@JsonProperty("order_fields") @Valid OrderFieldsCorrection orderFields,
			@JsonProperty("voucher_fields") @Valid VoucherFieldsCorrection voucherFields,
            @JsonProperty("items") @Size(min=1,max=100) java.util.List<@Valid ReviewItem> items,
            @JsonProperty("payment_condition") @Pattern(regexp="CONTADO|CREDITO|ANTICIPO") String paymentCondition,
            @JsonProperty("credit_term_days") @Min(15) @Max(30) Integer creditTermDays,
            @JsonProperty("downpayment") @Valid pe.keptai.backend.contract.CommonDtos.NonNegativeMoney downpayment) {
        public CorrectDraftRequest(Integer revision, OrderFieldsCorrection order, VoucherFieldsCorrection voucher) { this(revision,order,voucher,null,null,null,null); }

		@JsonIgnore
		@AssertTrue(message = "envie exactamente uno de order_fields o voucher_fields")
		public boolean isExactlyOneFieldGroup() {
			return (voucherFields != null) != (orderFields != null || items != null || paymentCondition != null || creditTermDays != null || downpayment != null);
		}
	}

    public record ReviewItem(@JsonProperty("description") @jakarta.validation.constraints.NotBlank @Size(max=1000) String description,
        @JsonProperty("quantity") @NotNull @Min(1) @Max(1000000) Integer quantity,
        @JsonProperty("unit_price") @NotNull @Valid pe.keptai.backend.contract.CommonDtos.NonNegativeMoney unitPrice) { }

	public record ConfirmDraftRequest(
			@JsonProperty("expected_revision") @NotNull @Min(1) @Max(1_000_000) Integer expectedRevision) {
	}

	/** Confirmar nunca verifica fondos ni cambia saldos: ambos indicadores son siempre falsos. */
	public record ConfirmDraftResponse(
			@JsonProperty("draft") @NotNull @Valid ExtractionDraft draft,
			@JsonProperty("order_id") UUID orderId,
			@JsonProperty("payment_id") UUID paymentId,
			@JsonProperty("funds_verified") @NotNull @AssertFalse Boolean fundsVerified,
			@JsonProperty("balance_changed") @NotNull @AssertFalse Boolean balanceChanged) {
	}

	public record DiscardDraftRequest(@JsonProperty("reason") @Size(max = 500) String reason) {
	}

}
