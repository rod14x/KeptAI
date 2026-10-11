package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.ContractEnums.DataOrigin;
import pe.keptai.backend.contract.ContractEnums.EvidenceKind;
import pe.keptai.backend.contract.ContractEnums.EvidenceStatus;

/** Evidencias (texto, voucher, audio). Contrato PROPUESTO MIG-02; carga real en MIG-04. */
public final class EvidenceDtos {

	private EvidenceDtos() {
	}

	public record Evidence(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("kind") @NotNull EvidenceKind kind,
			@JsonProperty("status") @NotNull EvidenceStatus status,
			@JsonProperty("content_type") @Size(max = 100) String contentType,
			@JsonProperty("size_bytes") @Min(0) @Max(10_485_760) Long sizeBytes,
			@JsonProperty("sha256") @Pattern(regexp = "[0-9a-f]{64}") String sha256,
			@JsonProperty("text_preview") @Size(max = 200) String textPreview,
			@JsonProperty("label") @Size(max = 120) String label,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin,
			@JsonProperty("uploaded_by_user_id") @NotNull UUID uploadedByUserId,
			@JsonProperty("created_at") @NotNull OffsetDateTime createdAt) {

		/** Los archivos privados llevan hash y tamano; el texto no es un archivo. */
		@JsonIgnore
		@AssertTrue(message = "voucher/audio requieren sha256, size_bytes y content_type; el texto no requiere archivo")
		public boolean isFileMetadataConsistentWithKind() {
			if (kind == null) {
				return true;
			}
			boolean file = kind != EvidenceKind.TEXT_CHAT;
			return !file || (sha256 != null && sizeBytes != null && contentType != null);
		}
	}

	public record CreateTextEvidenceRequest(
			@JsonProperty("content") @NotBlank @Size(max = 20_000) String content,
			@JsonProperty("label") @Size(max = 120) String label) {
	}

	/** Metadatos del multipart; el binario viaja aparte. Solo voucher (D-007); los otros valores de enum son antecedentes. */
	public record UploadEvidenceMetadata(
			@JsonProperty("kind") @NotNull EvidenceKind kind,
			@JsonProperty("label") @Size(max = 120) String label) {

		@JsonIgnore
		@AssertTrue(message = "kind debe ser voucher_image (D-007)")
		public boolean isFileKind() {
			return kind == null || kind == EvidenceKind.VOUCHER_IMAGE;
		}
	}

	public record EvidenceDownloadLink(
			@JsonProperty("url") @NotBlank @Pattern(regexp = "https://.+") String url,
			@JsonProperty("expires_at") @NotNull OffsetDateTime expiresAt) {
	}

}
