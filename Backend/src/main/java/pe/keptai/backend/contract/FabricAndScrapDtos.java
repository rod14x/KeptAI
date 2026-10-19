/**
 * FabricAndScrapDtos.java
 * Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.contract;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * DTOs de Fase 3: Mermas y segundas (B-08), Inventario de Tela e Insumos y Requisición de Compra (B-10).
 */
public final class FabricAndScrapDtos {

	private FabricAndScrapDtos() {
	}

	// 1. Catálogo de Causas de Merma
	public record ScrapCause(
			@JsonProperty("code") String code,
			@JsonProperty("description") String description) {
	}

	// 2. Inventario de Rollo de Tela
	public record FabricRoll(
			@JsonProperty("id") UUID id,
			@JsonProperty("roll_code") @JsonAlias("codigo_rollo") String rollCode,
			@JsonProperty("fabric_type") @JsonAlias("tela_tipo") String fabricType,
			@JsonProperty("color") String color,
			@JsonProperty("gsm") @JsonAlias("gramaje_gsm") Integer gsm,
			@JsonProperty("dye_lot") @JsonAlias("partida_tenido") String dyeLot,
			@JsonProperty("current_weight_kg") @JsonAlias("peso_actual_kg") BigDecimal currentWeightKg,
			@JsonProperty("reserved_weight_kg") @JsonAlias("peso_reservado_kg") BigDecimal reservedWeightKg,
			@JsonProperty("available_weight_kg") @JsonAlias("peso_disponible_kg") BigDecimal availableWeightKg,
			@JsonProperty("location") @JsonAlias("ubicacion") String location,
			@JsonProperty("active") Boolean active,
			@JsonProperty("created_at") OffsetDateTime createdAt) {
	}

	public record CreateFabricRollRequest(
			@JsonProperty("roll_code") @Size(max = 60) String rollCode,
			@JsonProperty("fabric_type") @NotBlank @Size(max = 100) String fabricType,
			@JsonProperty("color") @NotBlank @Size(max = 60) String color,
			@JsonProperty("gsm") Integer gsm,
			@JsonProperty("dye_lot") @NotBlank @Size(max = 80) String dyeLot,
			@JsonProperty("weight_kg") @NotNull @DecimalMin(value = "0.001") BigDecimal weightKg,
			@JsonProperty("location") @Size(max = 60) String location) {
	}

	// 3. Semáforo Automático y Asignación de Partida
	public record FabricSemaphoreProposal(
			@JsonProperty("order_id") UUID orderId,
			@JsonProperty("fabric_type") String fabricType,
			@JsonProperty("color") String color,
			@JsonProperty("required_kg") BigDecimal requiredKg,
			@JsonProperty("available_kg") BigDecimal availableKg,
			@JsonProperty("proposed_semaphore") String proposedSemaphore,
			@JsonProperty("available_dye_lots") List<String> availableDyeLots,
			@JsonProperty("mix_warning") Boolean mixWarning,
			@JsonProperty("message") String message) {
	}

	public record AssignFabricLotRequest(
			@JsonProperty("fabric_roll_id") @NotNull UUID fabricRollId,
			@JsonProperty("assigned_kg") @NotNull @DecimalMin(value = "0.001") BigDecimal assignedKg) {
	}

	public record OrderFabricAssignment(
			@JsonProperty("id") UUID id,
			@JsonProperty("order_id") UUID orderId,
			@JsonProperty("fabric_roll_id") UUID fabricRollId,
			@JsonProperty("roll_code") String rollCode,
			@JsonProperty("fabric_type") String fabricType,
			@JsonProperty("color") String color,
			@JsonProperty("dye_lot") String dyeLot,
			@JsonProperty("assigned_kg") BigDecimal assignedKg,
			@JsonProperty("assigned_at") OffsetDateTime assignedAt) {
	}

	public record OrderFabricLotsSummary(
			@JsonProperty("order_id") UUID orderId,
			@JsonProperty("assignments") List<OrderFabricAssignment> assignments,
			@JsonProperty("mix_warning") Boolean mixWarning,
			@JsonProperty("distinct_dye_lots") List<String> distinctDyeLots,
			@JsonProperty("total_assigned_kg") BigDecimal totalAssignedKg) {
	}

	// 4. Insumos de Producción
	public record SupplyItem(
			@JsonProperty("id") UUID id,
			@JsonProperty("code") @JsonAlias("codigo") String code,
			@JsonProperty("name") @JsonAlias("nombre") String name,
			@JsonProperty("category") @JsonAlias("categoria") String category,
			@JsonProperty("unit_of_measure") @JsonAlias("unidad_medida") String unitOfMeasure,
			@JsonProperty("current_stock") @JsonAlias("stock_actual") BigDecimal currentStock,
			@JsonProperty("minimum_stock") @JsonAlias("stock_minimo") BigDecimal minimumStock) {
	}

	public record CreateSupplyRequest(
			@JsonProperty("code") @NotBlank @Size(max = 50) String code,
			@JsonProperty("name") @NotBlank @Size(max = 150) String name,
			@JsonProperty("category") @NotBlank @Size(max = 50) String category,
			@JsonProperty("unit_of_measure") @NotBlank @Size(max = 20) String unitOfMeasure,
			@JsonProperty("initial_stock") BigDecimal initialStock,
			@JsonProperty("minimum_stock") BigDecimal minimumStock) {
	}

	// 5. Requisición de Compra de Tela (B-10)
	public record FabricRequisition(
			@JsonProperty("id") UUID id,
			@JsonProperty("order_id") UUID orderId,
			@JsonProperty("fabric_type") @JsonAlias("tela_tipo") String fabricType,
			@JsonProperty("color") String color,
			@JsonProperty("gsm") @JsonAlias("gramaje_gsm") Integer gsm,
			@JsonProperty("required_kg") @JsonAlias("kg_requeridos") BigDecimal requiredKg,
			@JsonProperty("scrap_percentage") @JsonAlias("porcentaje_merma") BigDecimal scrapPercentage,
			@JsonProperty("required_date") @JsonAlias("fecha_requerida") LocalDate requiredDate,
			@JsonProperty("status") @JsonAlias("estado") String status,
			@JsonProperty("requested_by") @JsonAlias("solicitado_por") UUID requestedBy,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("approved_by") @JsonAlias("aprobado_por") UUID approvedBy,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("approved_at") @JsonAlias("aprobado_en") OffsetDateTime approvedAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("dye_lot_received") @JsonAlias("partida_ingresada") String dyeLotReceived,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("received_kg") @JsonAlias("kg_recibidos") BigDecimal receivedKg,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("received_at") @JsonAlias("recibido_en") OffsetDateTime receivedAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("notes") @JsonAlias("notas") String notes,
			@JsonProperty("created_at") OffsetDateTime createdAt) {
	}

	public record CreateRequisitionRequest(
			@JsonProperty("order_id") UUID orderId,
			@JsonProperty("fabric_type") @NotBlank @Size(max = 100) String fabricType,
			@JsonProperty("color") @NotBlank @Size(max = 60) String color,
			@JsonProperty("gsm") Integer gsm,
			@JsonProperty("required_kg") @NotNull @DecimalMin(value = "0.001") BigDecimal requiredKg,
			@JsonProperty("scrap_percentage") BigDecimal scrapPercentage,
			@JsonProperty("required_date") @NotNull LocalDate requiredDate,
			@JsonProperty("notes") @Size(max = 500) String notes) {
	}

	public record ApproveRequisitionRequest(
			@JsonProperty("notes") @Size(max = 500) String notes) {
	}

	public record ReceiveRequisitionRequest(
			@JsonProperty("dye_lot") @NotBlank @Size(max = 80) String dyeLot,
			@JsonProperty("received_kg") @NotNull @DecimalMin(value = "0.001") BigDecimal receivedKg,
			@JsonProperty("roll_code") @Size(max = 60) String rollCode,
			@JsonProperty("location") @Size(max = 60) String location,
			@JsonProperty("notes") @Size(max = 500) String notes) {
	}
}
