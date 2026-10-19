/**
 * Corpotex KeptAI - DTOs de Artes de Diseño y Curva de Personal (B-03, B-06)
 * Versión: v1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.contract;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

public final class ArtAndCurveDtos {

	private ArtAndCurveDtos() {
	}

	public enum ArtTechnique {
		@JsonProperty("SUBLIMADO") SUBLIMADO,
		@JsonProperty("BORDADO") BORDADO,
		@JsonProperty("SERIGRAFIA") SERIGRAFIA,
		@JsonProperty("DTF") DTF,
		@JsonProperty("VINIL") VINIL
	}

	public enum ArtStatus {
		@JsonProperty("BORRADOR") BORRADOR,
		@JsonProperty("ENVIADO_CLIENTE") ENVIADO_CLIENTE,
		@JsonProperty("APROBADO") APROBADO,
		@JsonProperty("CAMBIOS") CAMBIOS
	}

	public record ArtPiece(
			UUID id,
			UUID orderId,
			ArtTechnique technique,
			String location,
			BigDecimal widthCm,
			BigDecimal heightCm,
			String colorsOrThreads,
			Integer stitches,
			String storagePath,
			ArtStatus status,
			int version,
			UUID approvedBy,
			Instant approvedAt,
			String approvalChannel,
			String approvalEvidenceUrl,
			UUID createdBy,
			Instant createdAt,
			Instant updatedAt
	) {}

	public record CreateArtRequest(
			ArtTechnique technique,
			String location,
			BigDecimal widthCm,
			BigDecimal heightCm,
			String colorsOrThreads,
			Integer stitches,
			String storagePath
	) {}

	public record ApproveArtRequest(
			String channel,
			String evidenceUrl,
			String notes
	) {}

	public record PersonnelEntry(
			String fullName,
			String size,
			Integer quantity,
			String embroideryName,
			String department,
			String notes
	) {}

	public record ImportPersonnelRequest(
			List<PersonnelEntry> entries,
			boolean closeCurve
	) {}

	public record ImportPersonnelResult(
			int totalEntries,
			int totalGarments,
			Map<String, Integer> generatedCurve,
			String curveStatus
	) {}

}
