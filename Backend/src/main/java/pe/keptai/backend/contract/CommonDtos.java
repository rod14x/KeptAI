package pe.keptai.backend.contract;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.ContractEnums.UserRole;
import pe.keptai.backend.web.ApiError;

/** DTOs comunes del contrato PROPUESTO (MIG-02): dinero, paginas, errores y contexto. No hay endpoints que los usen todavia. */
public final class CommonDtos {

	/** Limite seguro de enteros de JavaScript (Number.MAX_SAFE_INTEGER) para centavos. */
	public static final long MAX_SAFE_CENTS = 9_007_199_254_740_991L;

	public static final String CURRENCY_PEN = "PEN";

	private CommonDtos() {
	}

	/** Dinero con signo (margen, resultado, caja). Centavos enteros; no mezclar monedas. */
	public record Money(
			@JsonProperty("amount_cents") @NotNull @Min(-MAX_SAFE_CENTS) @Max(MAX_SAFE_CENTS) Long amountCents,
			@JsonProperty("currency") @NotNull @Pattern(regexp = "PEN") String currency) {

		public static Money pen(long cents) {
			return new Money(cents, CURRENCY_PEN);
		}
	}

	/** Saldos, cobrado, egresos: cero o mas. */
	public record NonNegativeMoney(
			@JsonProperty("amount_cents") @NotNull @Min(0) @Max(MAX_SAFE_CENTS) Long amountCents,
			@JsonProperty("currency") @NotNull @Pattern(regexp = "PEN") String currency) {

		public static NonNegativeMoney pen(long cents) {
			return new NonNegativeMoney(cents, CURRENCY_PEN);
		}
	}

	/** Importe de un pago o de una venta: mayor que cero. */
	public record PositiveMoney(
			@JsonProperty("amount_cents") @NotNull @Min(1) @Max(MAX_SAFE_CENTS) Long amountCents,
			@JsonProperty("currency") @NotNull @Pattern(regexp = "PEN") String currency) {

		public static PositiveMoney pen(long cents) {
			return new PositiveMoney(cents, CURRENCY_PEN);
		}
	}

	public record PageInfo(
			@JsonProperty("limit") @NotNull @Min(1) @Max(100) Integer limit,
			@JsonProperty("next_cursor") @Size(min = 1, max = 512) String nextCursor) {
	}

	/** Pagina por cursor. {@code next_cursor} nulo = ultima pagina. */
	public record PageResponse<T>(
			@JsonProperty("items") @NotNull @Size(max = 100) List<@Valid T> items,
			@JsonProperty("page") @NotNull @Valid PageInfo page) {
	}

	public record ApiErrorDetail(
			@JsonProperty("field") @NotBlank String field,
			@JsonProperty("code") @NotNull @Pattern(regexp = "[A-Z][A-Z0-9_]*") String code,
			@JsonProperty("message") @NotBlank String message) {
	}

	/**
	 * Extension COMPATIBLE de {@link ApiError}: mismos code/message/request_id mas {@code details} y {@code retryable}
	 * opcionales (se omiten si no aplican). {@code ApiError} no se modifica.
	 */
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record ApiErrorExtended(
			@JsonProperty("code") @NotNull @Pattern(regexp = "[A-Z][A-Z0-9_]*") String code,
			@JsonProperty("message") @NotBlank String message,
			@JsonProperty("request_id") @JsonInclude(JsonInclude.Include.ALWAYS) String requestId,
			@JsonProperty("details") @Size(max = 50) List<@Valid ApiErrorDetail> details,
			@JsonProperty("retryable") Boolean retryable) {

		public static ApiErrorExtended from(ApiError base, List<ApiErrorDetail> details, Boolean retryable) {
			return new ApiErrorExtended(base.code(), base.message(), base.requestId(), details, retryable);
		}
	}

	/**
	 * Contexto resuelto por el servidor por membresia; el cliente nunca lo envia. {@code name} y {@code organization_name}
	 * (INT-FE-API-002) son informativos: la identidad y el rol siguen siendo {@code user_id}/{@code role}.
	 */
	public record UserContext(
			@JsonProperty("user_id") @NotNull UUID userId,
			@JsonProperty("organization_id") @NotNull UUID organizationId,
			@JsonProperty("role") @NotNull UserRole role,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("name") @Size(max = 200) String name,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("organization_name") @Size(max = 200) String organizationName) {
		public UserContext(
			@JsonProperty("user_id") @NotNull UUID userId,
			@JsonProperty("organization_id") @NotNull UUID organizationId,
			@JsonProperty("role") @NotNull UserRole role) {
			this(userId, organizationId, role, null, null);
		}

	}

	/** Persona de la organizacion (usuario.id, usuario.nombre), INT-FE-API-002. Nunca correo ni credenciales. */
	public record PersonRef(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("name") @NotBlank @Size(max = 200) String name) {
	}

}
