package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;

/** DTOs de Clientes y Contactos comerciales (Fase 1 y Fase 4: B-01, B-02). */
public final class CustomerDtos {

	private CustomerDtos() {
	}

	public record Contact(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("customer_id") @JsonAlias("cliente_id") @NotNull UUID customerId,
			@JsonProperty("name") @JsonAlias("nombre") @NotBlank @Size(max = 200) String name,
			@JsonProperty("whatsapp_jid") @Size(max = 100) String whatsappJid,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("phone") @JsonAlias("telefono") @Size(max = 30) String phone,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("email") @Size(max = 100) String email,
			@JsonProperty("active") @JsonAlias("activo") @NotNull Boolean active,
			@JsonProperty("created_at") @JsonAlias("creado_en") @NotNull OffsetDateTime createdAt) {
	}

	public record CreateContactRequest(
			@JsonProperty("name") @JsonAlias("nombre") @NotBlank @Size(max = 200) String name,
			@JsonProperty("whatsapp_jid") @Size(max = 100) String whatsappJid,
			@JsonProperty("phone") @JsonAlias("telefono") @Size(max = 30) String phone,
			@JsonProperty("email") @Size(max = 100) String email) {
	}

	public record Customer(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("name") @JsonAlias({"razon_social", "razonSocial"}) @NotBlank @Size(max = 200) String name,
			@JsonProperty("customer_type") @JsonAlias({"tipo_persona", "tipoPersona", "tipo"}) @NotNull String customerType,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("tax_id") @JsonAlias({"ruc_dni", "rucDni"}) @Size(max = 11) String taxId,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("primary_phone") @JsonAlias({"telefono_principal", "telefonoPrincipal", "phone", "telefono"}) @Size(max = 30) String primaryPhone,
			@JsonProperty("source_channel") @JsonAlias({"canal_origen", "canalOrigen"}) @NotNull @Size(max = 50) String sourceChannel,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("credit_limit") @JsonAlias({"limite_credito", "limiteCredito"}) @Valid NonNegativeMoney creditLimit,
			@JsonProperty("created_at") @JsonAlias({"creado_en", "creadoEn"}) @NotNull OffsetDateTime createdAt,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("contacts") List<@Valid Contact> contacts,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("assigned_seller_id") @JsonAlias("vendedor_asignado_id") UUID assignedSellerId,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("assigned_seller_name") @JsonAlias("vendedor_asignado_nombre") String assignedSellerName,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("email_contact") @JsonAlias("email_contacto") String emailContact,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("address") @JsonAlias("direccion") String address,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("active") @JsonAlias("activo") Boolean active,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("merged_with_id") @JsonAlias("fusionado_con_id") UUID mergedWithId) {
	}

	public record CreateCustomerRequest(
			@JsonProperty("name") @JsonAlias({"razon_social", "razonSocial"}) @NotBlank @Size(max = 200) String name,
			@JsonProperty("customer_type") @JsonAlias({"tipo_persona", "tipoPersona", "tipo"}) String customerType,
			@JsonProperty("tax_id") @JsonAlias({"ruc_dni", "rucDni"}) @Size(max = 11) String taxId,
			@JsonProperty("primary_phone") @JsonAlias({"telefono_principal", "telefonoPrincipal", "phone", "telefono"}) @Size(max = 30) String primaryPhone,
			@JsonProperty("source_channel") @JsonAlias({"canal_origen", "canalOrigen"}) String sourceChannel,
			@JsonProperty("assigned_seller_id") @JsonAlias("vendedor_asignado_id") UUID assignedSellerId,
			@JsonProperty("email_contact") @JsonAlias("email_contacto") String emailContact,
			@JsonProperty("address") @JsonAlias("direccion") String address) {
	}

	public record UpdateCustomerRequest(
			@JsonProperty("name") @JsonAlias({"razon_social", "razonSocial"}) String name,
			@JsonProperty("customer_type") @JsonAlias({"tipo_persona", "tipoPersona", "tipo"}) String customerType,
			@JsonProperty("tax_id") @JsonAlias({"ruc_dni", "rucDni"}) String taxId,
			@JsonProperty("primary_phone") @JsonAlias({"telefono_principal", "telefonoPrincipal", "phone", "telefono"}) String primaryPhone,
			@JsonProperty("email_contact") @JsonAlias("email_contacto") String emailContact,
			@JsonProperty("address") @JsonAlias("direccion") String address,
			@JsonProperty("assigned_seller_id") @JsonAlias("vendedor_asignado_id") UUID assignedSellerId,
			@JsonProperty("reason") @JsonAlias("motivo") String reason) {
	}

	public record MergeCustomerRequest(
			@JsonProperty("duplicate_customer_id") @JsonAlias("cliente_duplicado_id") @NotNull UUID duplicateCustomerId,
			@JsonProperty("reason") @JsonAlias("motivo") @NotBlank String reason) {
	}

	public record ReassignPortfolioRequest(
			@JsonProperty("assigned_seller_id") @JsonAlias("vendedor_asignado_id") @NotNull UUID assignedSellerId,
			@JsonProperty("reason") @JsonAlias("motivo") String reason) {
	}

	public record CustomerHistoryEntry(
			@JsonProperty("id") @NotNull UUID id,
			@JsonProperty("customer_id") @JsonAlias("cliente_id") @NotNull UUID customerId,
			@JsonProperty("modified_by") @JsonAlias("modificado_por") @NotNull UUID modifiedBy,
			@JsonProperty("modified_by_name") @JsonAlias("modificado_por_nombre") String modifiedByName,
			@JsonProperty("field") @JsonAlias("campo") @NotNull String field,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("previous_value") @JsonAlias("valor_anterior") String previousValue,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("new_value") @JsonAlias("valor_nuevo") String newValue,
			@JsonInclude(JsonInclude.Include.NON_NULL) @JsonProperty("reason") @JsonAlias("motivo") String reason,
			@JsonProperty("created_at") @JsonAlias("creado_en") @NotNull OffsetDateTime createdAt) {
	}

}
