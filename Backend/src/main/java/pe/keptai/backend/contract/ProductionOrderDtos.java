/**
 * ProductionOrderDtos.java
 * Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 *
 * B-05: DTOs exclusivos para taller y planta de confección.
 * No incluyen precios, costos, márgenes ni pagos.
 */
package pe.keptai.backend.contract;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.ContractEnums.OrderStatus;
import pe.keptai.backend.contract.ContractEnums.ProductionMode;

public final class ProductionOrderDtos {

	private ProductionOrderDtos() {
	}

	public record ProductionOrderItem(
			@JsonProperty("description") @NotBlank @Size(max = 500) String description,
			@JsonProperty("quantity") @NotNull Integer quantity,
			@JsonProperty("product_line") @Size(max = 100) String productLine,
			@JsonProperty("detail") @Size(max = 300) String detail) {
	}

	public record ProductionCustomerRef(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("name") @NotBlank @Size(max = 200) String name) {
	}

	public record ProductionOrder(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("display_code") @NotNull @Pattern(regexp = OrderDtos.LABEL_REGEX) String displayCode,
			@JsonProperty("customer") @Valid ProductionCustomerRef customer,
			@JsonProperty("brand") @Size(max = 100) String brand,
			@JsonProperty("product_line") @Size(max = 100) String productLine,
			@JsonProperty("production_mode") @NotNull ProductionMode productionMode,
			@JsonProperty("status") @NotNull OrderStatus status,
			@JsonProperty("requested_delivery_date") LocalDate requestedDeliveryDate,
			@JsonProperty("production_start_date") LocalDate productionStartDate,
			@JsonProperty("dispatch_date") LocalDate dispatchDate,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("items") List<@Valid ProductionOrderItem> items) {
	}

}
