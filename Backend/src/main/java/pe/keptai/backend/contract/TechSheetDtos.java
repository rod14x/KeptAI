package pe.keptai.backend.contract;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** DTOs de Ficha Técnica, Semáforo de Telas y Validación de Taller (Fase 3). */
public final class TechSheetDtos {

	private TechSheetDtos() {
	}

	public record TechSheet(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("order_id") @JsonAlias("orden_id") @NotNull UUID orderId,
			@JsonProperty("status") @JsonAlias("estado") @NotNull String status,
			@JsonProperty("modality") @JsonAlias("modalidad") @NotNull String modality,
			@JsonProperty("fabric_semaphore") @JsonAlias("semaforo_tela") String fabricSemaphore,
			@JsonProperty("estimated_consumption_kg") @JsonAlias("consumo_estimado_kg") BigDecimal estimatedConsumptionKg,
			@JsonProperty("fabric_validation") @JsonAlias("validacion_tela") String fabricValidation,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("fabric_validated_by") @JsonAlias("tela_validada_por") UUID fabricValidatedBy,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("garment_type") @JsonAlias({"prenda_tipo", "prendaTipo"}) String garmentType,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("fabric_name") @JsonAlias({"tela_nombre", "tela"}) String fabricName,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("weight") @JsonAlias("gramaje") String weight,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("primary_color") @JsonAlias({"color_principal", "colorPrincipal"}) String primaryColor,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("contrast_color") @JsonAlias({"color_contraste", "colorContraste"}) String contrastColor,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("collar_type") @JsonAlias({"tipo_cuello", "tipoCuello"}) String collarType,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("size_curve") @JsonAlias({"curva_tallas", "curvaTallas"}) Object sizeCurve,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("customization_technique") @JsonAlias({"tecnica_personalizacion", "tecnicaPersonalizacion"}) String customizationTechnique,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("art_placements") @JsonAlias({"ubicaciones_arte", "arteUbicaciones"}) Object artPlacements,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("sewing_instructions") @JsonAlias({"instrucciones_costura", "instruccionesCostura"}) String sewingInstructions,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("completed_by") @JsonAlias("completada_por") UUID completedBy,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("completed_at") @JsonAlias("completada_en") OffsetDateTime completedAt,
			@JsonProperty("created_at") @JsonAlias("creado_en") @NotNull OffsetDateTime createdAt,
			@JsonProperty("updated_at") @JsonAlias("actualizado_en") @NotNull OffsetDateTime updatedAt) {
	}

	public record UpdateTechSheetRequest(
			@JsonProperty("modality") @JsonAlias("modalidad") String modality,
			@JsonProperty("fabric_semaphore") @JsonAlias("semaforo_tela") String fabricSemaphore,
			@JsonProperty("estimated_consumption_kg") @JsonAlias("consumo_estimado_kg") BigDecimal estimatedConsumptionKg,
			@JsonProperty("garment_type") @JsonAlias({"prenda_tipo", "prendaTipo"}) String garmentType,
			@JsonProperty("fabric_name") @JsonAlias({"tela_nombre", "tela"}) String fabricName,
			@JsonProperty("weight") @JsonAlias("gramaje") String weight,
			@JsonProperty("primary_color") @JsonAlias({"color_principal", "colorPrincipal"}) String primaryColor,
			@JsonProperty("contrast_color") @JsonAlias({"color_contraste", "colorContraste"}) String contrastColor,
			@JsonProperty("collar_type") @JsonAlias({"tipo_cuello", "tipoCuello"}) String collarType,
			@JsonProperty("size_curve") @JsonAlias({"curva_tallas", "curvaTallas"}) Object sizeCurve,
			@JsonProperty("customization_technique") @JsonAlias({"tecnica_personalizacion", "tecnicaPersonalizacion"}) String customizationTechnique,
			@JsonProperty("art_placements") @JsonAlias({"ubicaciones_arte", "arteUbicaciones"}) Object artPlacements,
			@JsonProperty("sewing_instructions") @JsonAlias({"instrucciones_costura", "instruccionesCostura"}) String sewingInstructions) {
	}

	public record ValidateFabricRequest(
			@JsonProperty("decision") @NotBlank @Size(max = 50) String decision,
			@JsonProperty("note") @JsonAlias({"observaciones", "notas"}) @Size(max = 500) String note) {
	}

}
