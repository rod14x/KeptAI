package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.CustomerDtos.Contact;
import pe.keptai.backend.contract.CustomerDtos.CreateContactRequest;
import pe.keptai.backend.contract.CustomerDtos.CreateCustomerRequest;
import pe.keptai.backend.contract.CustomerDtos.Customer;
import pe.keptai.backend.web.RequestIdFilter;

/** Servicio de clientes y contactos comerciales (Fase 1). */
@Service
public class CustomerService {

	private final PanelContext panel;

	public CustomerService(PanelContext panel) {
		this.panel = panel;
	}

	public PageResponse<Customer> list(PageRequest page, String query) {
		return panel.read(() -> {
			String q = (query == null || query.isBlank()) ? null : "%" + query.trim().toLowerCase() + "%";
			var rows = panel.jdbc().query("""
					SELECT c.id, c.razon_social, c.tipo, c.ruc_dni, c.telefono_principal, c.canal_origen, c.limite_credito, c.creado_en
					FROM keptai.cliente c
					WHERE c.organizacion_id = keptai.app_organizacion_actual()
					  AND (? IS NULL OR lower(c.razon_social) LIKE ? OR lower(coalesce(c.ruc_dni, '')) LIKE ? OR lower(coalesce(c.telefono_principal, '')) LIKE ?)
					ORDER BY c.creado_en DESC, c.id
					LIMIT ? OFFSET ?
					""", (rs, i) -> mapCustomer(rs), q, q, q, q, page.fetch(), page.offset());
			return page.page(rows);
		});
	}

	public Customer getCustomer(UUID id) {
		return panel.read(() -> {
			var rows = panel.jdbc().query("""
					SELECT c.id, c.razon_social, c.tipo, c.ruc_dni, c.telefono_principal, c.canal_origen, c.limite_credito, c.creado_en
					FROM keptai.cliente c
					WHERE c.organizacion_id = keptai.app_organizacion_actual() AND c.id = ?
					""", (rs, i) -> mapCustomer(rs), id);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado");
			}
			Customer c = rows.getFirst();
			var contacts = panel.jdbc().query("""
					SELECT id, cliente_id, nombre, whatsapp_jid, activo, creado_en
					FROM keptai.contacto
					WHERE organizacion_id = keptai.app_organizacion_actual() AND cliente_id = ?
					ORDER BY creado_en DESC
					""", (rs, i) -> mapContact(rs), id);
			return new Customer(c.id(), c.name(), c.customerType(), c.taxId(), c.primaryPhone(), c.sourceChannel(), c.creditLimit(), c.createdAt(), contacts);
		});
	}

	public Customer createCustomer(CreateCustomerRequest req) {
		if (req.name() == null || req.name().isBlank()) {
			throw PanelException.badRequest("La razón social o nombre del cliente es obligatoria");
		}
		String taxId = (req.taxId() != null && !req.taxId().isBlank()) ? req.taxId().trim() : null;
		if (taxId != null && !taxId.matches("^[0-9]{8}$|^[0-9]{11}$")) {
			throw PanelException.badRequest("El documento debe ser un DNI de 8 dígitos o un RUC de 11 dígitos");
		}
		String type = (req.customerType() != null && !req.customerType().isBlank()) ? req.customerType().toUpperCase() : "PERSONA";
		if (!Set.of("PERSONA", "EMPRESA", "COLEGIO").contains(type)) {
			type = "PERSONA";
		}
		String phone = (req.primaryPhone() != null && !req.primaryPhone().isBlank()) ? req.primaryPhone().trim() : null;
		String channel = (req.sourceChannel() != null && !req.sourceChannel().isBlank()) ? req.sourceChannel().trim() : "MANUAL";

		final String finalTaxId = taxId;
		final String finalType = type;
		final String finalPhone = phone;
		final String finalChannel = channel;

		return panel.write(() -> {
			if (finalTaxId != null) {
				var existing = panel.jdbc().queryForList(
						"SELECT id FROM keptai.cliente WHERE organizacion_id = keptai.app_organizacion_actual() AND ruc_dni = ?",
						UUID.class, finalTaxId);
				if (!existing.isEmpty()) {
					throw PanelException.conflict("Ya existe un cliente registrado con ese RUC/DNI en la organización");
				}
			}
			UUID id = UUID.randomUUID();
			panel.jdbc().update("""
					INSERT INTO keptai.cliente (id, organizacion_id, razon_social, tipo, ruc_dni, telefono_principal, canal_origen, creado_en)
					VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, now())
					""", id, req.name().trim(), finalType, finalTaxId, finalPhone, finalChannel);

			audit(id, "CLIENTE_CREADO", "{\"nombre\":\"" + req.name().trim() + "\"}");
			return getCustomer(id);
		});
	}

	public Contact createContact(UUID customerId, CreateContactRequest req) {
		if (req.name() == null || req.name().isBlank()) {
			throw PanelException.badRequest("El nombre del contacto es obligatorio");
		}
		String jid = (req.whatsappJid() != null && !req.whatsappJid().isBlank()) ? req.whatsappJid().trim() : null;
		String phone = (req.phone() != null && !req.phone().isBlank()) ? req.phone().trim() : null;
		if (jid == null && phone != null) {
			String digits = phone.replaceAll("[^0-9]", "");
			if (digits.length() == 9 && digits.startsWith("9")) {
				digits = "51" + digits;
			}
			if (digits.length() >= 8) {
				jid = digits + "@s.whatsapp.net";
			}
		}
		if (jid == null) {
			throw PanelException.badRequest("Se requiere whatsapp_jid o un número de teléfono válido para el contacto");
		}
		if (!jid.matches("^[0-9]{5,20}@s\\.whatsapp\\.net$")) {
			throw PanelException.badRequest("El formato de whatsapp_jid debe ser [digitos]@s.whatsapp.net");
		}

		final String finalJid = jid;
		final String finalPhone = phone;
		final String finalEmail = (req.email() != null && !req.email().isBlank()) ? req.email().trim() : null;

		return panel.write(() -> {
			var cust = panel.jdbc().queryForList(
					"SELECT id, telefono_principal FROM keptai.cliente WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?",
					customerId);
			if (cust.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado");
			}
			var existing = panel.jdbc().queryForList(
					"SELECT id FROM keptai.contacto WHERE organizacion_id = keptai.app_organizacion_actual() AND whatsapp_jid = ?",
					UUID.class, finalJid);
			if (!existing.isEmpty()) {
				throw PanelException.conflict("Ya existe un contacto con ese WhatsApp JID en la organización");
			}
			UUID contactId = UUID.randomUUID();
			panel.jdbc().update("""
					INSERT INTO keptai.contacto (id, organizacion_id, cliente_id, nombre, whatsapp_jid, activo, creado_en)
					VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, true, now())
					""", contactId, customerId, req.name().trim(), finalJid);

			if (cust.getFirst().get("telefono_principal") == null && finalPhone != null) {
				panel.jdbc().update(
						"UPDATE keptai.cliente SET telefono_principal = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()",
						finalPhone, customerId);
			}

			audit(contactId, "CONTACTO_CREADO", "{\"cliente_id\":\"" + customerId + "\",\"nombre\":\"" + req.name().trim() + "\"}");

			var rows = panel.jdbc().query("""
					SELECT id, cliente_id, nombre, whatsapp_jid, activo, creado_en
					FROM keptai.contacto
					WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?
					""", (rs, i) -> mapContact(rs), contactId);
			Contact created = rows.getFirst();
			return new Contact(created.id(), created.customerId(), created.name(), created.whatsappJid(), finalPhone, finalEmail, created.active(), created.createdAt());
		});
	}

	private Customer mapCustomer(ResultSet rs) throws SQLException {
		UUID id = rs.getObject("id", UUID.class);
		String name = rs.getString("razon_social");
		String tipo = rs.getString("tipo");
		String rucDni = rs.getString("ruc_dni");
		String phone = rs.getString("telefono_principal");
		String canal = rs.getString("canal_origen");
		BigDecimal limit = rs.getBigDecimal("limite_credito");
		OffsetDateTime created = rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC);
		NonNegativeMoney credit = limit == null ? null : NonNegativeMoney.pen(PanelMapping.cents(limit));
		return new Customer(id, name, tipo, rucDni, phone, canal == null ? "MANUAL" : canal, credit, created, null);
	}

	private Contact mapContact(ResultSet rs) throws SQLException {
		UUID id = rs.getObject("id", UUID.class);
		UUID clienteId = rs.getObject("cliente_id", UUID.class);
		String nombre = rs.getString("nombre");
		String jid = rs.getString("whatsapp_jid");
		boolean activo = rs.getBoolean("activo");
		OffsetDateTime created = rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC);
		return new Contact(id, clienteId, nombre, jid, null, null, activo, created);
	}

	private void audit(UUID id, String operation, String changes) {
		panel.jdbc().update(
				"INSERT INTO keptai.evento_auditoria(organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id) VALUES(keptai.app_organizacion_actual(), ?, 'USUARIO', ?, 'cliente', ?, ?::jsonb, ?)",
				panel.identity().usuarioId(), operation, id, changes, MDC.get(RequestIdFilter.MDC_KEY));
	}

}
