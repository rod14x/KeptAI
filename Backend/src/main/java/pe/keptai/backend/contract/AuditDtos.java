package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.AssertTrue;
import pe.keptai.backend.contract.ContractEnums.AuditActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Auditoria (solo lectura). Contrato PROPUESTO MIG-02; los eventos los genera el servidor, nunca el cliente. */
public final class AuditDtos {

	private AuditDtos() {
	}

	public record AuditChange(
			@JsonProperty("field") @NotBlank @Size(max = 200) String field,
			@JsonProperty("old_value") @Size(max = 1000) String oldValue,
			@JsonProperty("new_value") @Size(max = 1000) String newValue) {
	}

	public record AuditEvent(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("occurred_at") @NotNull OffsetDateTime occurredAt,
			@JsonProperty("actor") @NotNull AuditActor actor,
			@JsonProperty("actor_user_id") UUID actorUserId,
			@JsonProperty("operation") @NotNull @Pattern(regexp = "[A-Z][A-Z0-9_]*") @Size(max = 80) String operation,
			@JsonProperty("entity_type") @NotNull @Pattern(regexp = "[a-z][a-z0-9_]*") @Size(max = 60) String entityType,
			@JsonProperty("entity_id") @NotNull UUID entityId,
			@JsonProperty("request_id") String requestId,
			@JsonProperty("changes") @NotNull @Size(max = 50) List<@Valid AuditChange> changes,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("actor_name") @Size(max = 200) String actorName) {

		/** evento_auditoria.usuario_id es nulo cuando actua el sistema (n8n, scheduler); un usuario siempre se identifica. */
		@JsonIgnore
		@AssertTrue(message = "actor=user exige actor_user_id; los demas actores no lo llevan")
		public boolean isActorUserConsistent() {
			return actor == null || (actor == AuditActor.USER) == (actorUserId != null);
		}
	}

}
