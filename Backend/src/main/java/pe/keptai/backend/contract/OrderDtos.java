package pe.keptai.backend.contract;

import java.time.LocalDate;
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
import pe.keptai.backend.contract.ContractEnums.CustomerType;
import pe.keptai.backend.contract.ContractEnums.DataOrigin;
import pe.keptai.backend.contract.ContractEnums.OrderSource;
import pe.keptai.backend.contract.ContractEnums.OrderStatus;
import pe.keptai.backend.contract.ContractEnums.PaymentCondition;
import pe.keptai.backend.contract.ContractEnums.ProductionMode;
import pe.keptai.backend.contract.ContractEnums.ReceivableStatus;

/** Pedidos. Contrato PROPUESTO MIG-02; persistencia por servicio de Andres (MIG-06). Tabla de origen: orden (V1). */
public final class OrderDtos {

	/** Etiqueta legible de orden.ref (p. ej. ORD-123; la semilla ficticia usa P-001). No es identificador. */
	public static final String LABEL_REGEX = "[A-Z]{1,5}-[0-9]{1,9}";

	private OrderDtos() {
	}

	/**
	 * Referencia al cliente. {@code type}, {@code tax_id} y {@code credit_limit} (INT-FE-API-002) salen de {@code cliente};
	 * son nulos si no constan. La linea de credito es referencia para el vendedor: no bloquea (D-005).
	 */
	public record CustomerRef(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("name") @NotBlank @Size(max = 200) String name,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("type") CustomerType type,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("tax_id") @Size(max = 11) String taxId,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("credit_limit") @Valid NonNegativeMoney creditLimit) {
		public CustomerRef(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("name") @NotBlank @Size(max = 200) String name) {
			this(id, name, null, null, null);
		}


		/** Referencia sin ficha (estado de cuenta, candidatos). */
		public static CustomerRef of(UUID id, String name) {
			return new CustomerRef(id, name, null, null, null);
		}
	}

	/** Item del pedido ({@code orden_item}), INT-FE-API-002. {@code detail} resume tela, talla y logo. */
	public record OrderItem(
			@JsonProperty("description") @NotBlank @Size(max = 500) String description,
			@JsonProperty("quantity") @NotNull @Min(1) @Max(1_000_000) Integer quantity,
			@JsonProperty("unit_price") @NotNull @Valid NonNegativeMoney unitPrice,
			@JsonProperty("product_line") @Size(max = 100) String productLine,
			@JsonProperty("detail") @Size(max = 300) String detail) {
	}

	/**
	 * {@code display_code} = orden.ref; la identidad es {@code id} (UUID). {@code status} es el estado de la orden (1:1 con SQL);
	 * {@code receivable_status} es el de su unica obligacion (nulo mientras no exista). El plazo corre desde {@code dispatch_date}.
	 */
	public record Order(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("display_code") @NotNull @Pattern(regexp = LABEL_REGEX) String displayCode,
			@JsonProperty("customer") @Valid CustomerRef customer,
			@JsonProperty("brand") @Size(max = 100) String brand,
			@JsonProperty("product_line") @Size(max = 100) String productLine,
			@JsonProperty("production_mode") @NotNull ProductionMode productionMode,
			@JsonProperty("sale") @Valid PositiveMoney sale,
			@JsonProperty("status") @NotNull OrderStatus status,
			@JsonProperty("source") @NotNull OrderSource source,
			@JsonProperty("payment_condition") PaymentCondition paymentCondition,
			@JsonProperty("credit_term_days") @Min(0) @Max(365) Integer creditTermDays,
			@JsonProperty("advance_required") @NotNull @Valid NonNegativeMoney advanceRequired,
			@JsonProperty("requested_delivery_date") LocalDate requestedDeliveryDate,
			@JsonProperty("production_start_date") LocalDate productionStartDate,
			@JsonProperty("dispatch_date") LocalDate dispatchDate,
			@JsonProperty("receivable_status") ReceivableStatus receivableStatus,
			@JsonProperty("due_date") LocalDate dueDate,
			@JsonProperty("source_evidence_id") UUID sourceEvidenceId,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("seller") @Valid PersonRef seller,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("items") @Size(max = 100) List<@Valid OrderItem> items,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("dispatched_by") @Valid PersonRef dispatchedBy) {
		public Order(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("display_code") @NotNull @Pattern(regexp = LABEL_REGEX) String displayCode,
			@JsonProperty("customer") @Valid CustomerRef customer,
			@JsonProperty("brand") @Size(max = 100) String brand,
			@JsonProperty("product_line") @Size(max = 100) String productLine,
			@JsonProperty("production_mode") @NotNull ProductionMode productionMode,
			@JsonProperty("sale") @Valid PositiveMoney sale,
			@JsonProperty("status") @NotNull OrderStatus status,
			@JsonProperty("source") @NotNull OrderSource source,
			@JsonProperty("payment_condition") PaymentCondition paymentCondition,
			@JsonProperty("credit_term_days") @Min(0) @Max(365) Integer creditTermDays,
			@JsonProperty("advance_required") @NotNull @Valid NonNegativeMoney advanceRequired,
			@JsonProperty("requested_delivery_date") LocalDate requestedDeliveryDate,
			@JsonProperty("production_start_date") LocalDate productionStartDate,
			@JsonProperty("dispatch_date") LocalDate dispatchDate,
			@JsonProperty("receivable_status") ReceivableStatus receivableStatus,
			@JsonProperty("due_date") LocalDate dueDate,
			@JsonProperty("source_evidence_id") UUID sourceEvidenceId,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt) {
			this(id, displayCode, customer, brand, productLine, productionMode, sale, status, source, paymentCondition, creditTermDays, advanceRequired, requestedDeliveryDate, productionStartDate, dispatchDate, receivableStatus, dueDate, sourceEvidenceId, dataOrigin, createdAt, null, null, null);
		}


        @JsonIgnore
        @AssertTrue(message = "fuera de borrador exige cliente, venta y condicion de pago")
        public boolean isConfirmedShapeComplete() {
            return status == null || status == OrderStatus.DRAFT || (customer != null && sale != null && paymentCondition != null);
        }

		@JsonIgnore
		@AssertTrue(message = "una orden a credito exige credit_term_days (orden.condicion_pago = CREDITO exige plazo_dias)")
		public boolean isCreditTermPresentForCredit() {
			return paymentCondition != PaymentCondition.CREDIT || creditTermDays != null;
		}

		@JsonIgnore
		@AssertTrue(message = "due_date solo existe tras el despacho (obligacion_cobro.vence_en es nulo hasta el acta)")
		public boolean isDueDateOnlyAfterDispatch() {
			return dueDate == null || dispatchDate != null;
		}

		@JsonIgnore
		@AssertTrue(message = "advance_required no puede superar la venta")
		public boolean isAdvanceNotAboveSale() {
			return advanceRequired == null || sale == null || advanceRequired.amountCents() == null || sale.amountCents() == null
					|| advanceRequired.amountCents() <= sale.amountCents();
		}
	}

	/** Cuerpo de {@code POST /orders/{id}/dispatch}: la fecha del acta es una fecha de negocio (America/Lima), no la hora del chat. */
	public record DispatchRequest(
			@JsonProperty("dispatch_date") @NotNull LocalDate dispatchDate,
			@JsonProperty("note") @Size(max = 500) String note) {
	}

}
