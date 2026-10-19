package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** DTOs de Taller y Avance de Estaciones de Fabricación (Fase 4). Tabla orden_etapa (V1, V17). */
public final class ManufacturingDtos {

	private ManufacturingDtos() {
	}

	public record OrderStage(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("stage") @JsonAlias("etapa") @NotNull String stage,
			@JsonProperty("status") @JsonAlias("estado") @NotNull String status,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("started_at") @JsonAlias("inicio") OffsetDateTime startedAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("ended_at") @JsonAlias("fin") OffsetDateTime endedAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("operator_id") @JsonAlias("responsable_id") UUID operatorId,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("quantity_processed") @JsonAlias("cantidad_procesada") Integer quantityProcessed,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("scrap") @JsonAlias("merma") Integer scrap,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("notes") @JsonAlias("observaciones") String notes) {
	}

	public record StationAdvanceRequest(
			@JsonProperty("stage") @JsonAlias({"station", "etapa", "estacion"}) @NotBlank @Size(max = 50) String stage,
			@JsonProperty("status") @JsonAlias({"estado", "station_status"}) @Size(max = 50) String status,
			@JsonProperty("notes") @JsonAlias({"observaciones", "nota"}) @Size(max = 500) String notes,
			@JsonProperty("quantity_processed") @JsonAlias("cantidad_procesada") Integer quantityProcessed,
			@JsonProperty("scrap") @JsonAlias("merma") Integer scrap) {
	}

	public record StationAdvanceResponse(
			@JsonProperty("order_id") @JsonAlias("orden_id") @NotNull UUID orderId,
			@JsonProperty("order_status") @JsonAlias("orden_estado") @NotNull String orderStatus,
			@JsonProperty("stages") @JsonAlias("etapas") @NotNull List<OrderStage> stages) {
	}

}
