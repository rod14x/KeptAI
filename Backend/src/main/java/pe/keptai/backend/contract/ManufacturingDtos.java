/**
 * ManufacturingDtos.java
 * Versión: 2.1 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.contract;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** DTOs de Taller y Avance de Estaciones de Fabricación (Fase 4 & B-08). Tabla orden_etapa (V1, V17, V21). */
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
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("input_quantity") @JsonAlias("cantidad_entrada") Integer inputQuantity,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("good_pieces") @JsonAlias("buenas") Integer goodPieces,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("second_pieces") @JsonAlias("segundas") Integer secondPieces,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("rework_pieces") @JsonAlias("reproceso") Integer reworkPieces,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("scrap_cause") @JsonAlias("causa_merma") String scrapCause,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("actual_fabric_kg") @JsonAlias("consumo_real_kg") BigDecimal actualFabricKg,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("consumption_factor_calculated") @JsonAlias("factor_consumo_calculado") BigDecimal consumptionFactorCalculated,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("notes") @JsonAlias("observaciones") String notes) {
	}

	public record StationAdvanceRequest(
			@JsonProperty("stage") @JsonAlias({"station", "etapa", "estacion"}) @NotBlank @Size(max = 50) String stage,
			@JsonProperty("status") @JsonAlias({"estado", "station_status"}) @Size(max = 50) String status,
			@JsonProperty("notes") @JsonAlias({"observaciones", "nota"}) @Size(max = 500) String notes,
			@JsonProperty("quantity_processed") @JsonAlias("cantidad_procesada") Integer quantityProcessed,
			@JsonProperty("scrap") @JsonAlias("merma") Integer scrap,
			@JsonProperty("input_quantity") @JsonAlias("cantidad_entrada") Integer inputQuantity,
			@JsonProperty("good_pieces") @JsonAlias("buenas") Integer goodPieces,
			@JsonProperty("second_pieces") @JsonAlias("segundas") Integer secondPieces,
			@JsonProperty("rework_pieces") @JsonAlias("reproceso") Integer reworkPieces,
			@JsonProperty("scrap_cause") @JsonAlias("causa_merma") String scrapCause,
			@JsonProperty("actual_fabric_kg") @JsonAlias("consumo_real_kg") BigDecimal actualFabricKg) {
	}

	public record StationAdvanceResponse(
			@JsonProperty("order_id") @JsonAlias("orden_id") @NotNull UUID orderId,
			@JsonProperty("order_status") @JsonAlias("orden_estado") @NotNull String orderStatus,
			@JsonProperty("stages") @JsonAlias("etapas") @NotNull List<OrderStage> stages,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("shortage_alert") @JsonAlias("alerta_recorte") Boolean shortageAlert,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("missing_pieces") @JsonAlias("piezas_faltantes") Integer missingPieces,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("fabric_factor") @JsonAlias("factor_consumo_real") BigDecimal fabricFactor) {

		public StationAdvanceResponse(UUID orderId, String orderStatus, List<OrderStage> stages) {
			this(orderId, orderStatus, stages, null, null, null);
		}
	}

}
