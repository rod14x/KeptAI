package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.CustomerDtos.Contact;
import pe.keptai.backend.contract.CustomerDtos.CreateContactRequest;
import pe.keptai.backend.contract.CustomerDtos.CreateCustomerRequest;
import pe.keptai.backend.contract.CustomerDtos.Customer;
import pe.keptai.backend.contract.CustomerDtos.CustomerHistoryEntry;
import pe.keptai.backend.contract.CustomerDtos.MergeCustomerRequest;
import pe.keptai.backend.contract.CustomerDtos.ReassignPortfolioRequest;
import pe.keptai.backend.contract.CustomerDtos.UpdateCustomerRequest;
import pe.keptai.backend.web.RequestIdFilter;

/** Servicio de clientes, contactos comerciales, segregación de cartera y control de edición/historial (B-01, B-02). */
@Service
public class CustomerService {

	private final PanelContext panel;

	public CustomerService(PanelContext panel) {
		this.panel = panel;
	}

	public static void validateTaxId(String taxId) {
		if (taxId == null || taxId.isBlank()) {
			return;
		}
		String clean = taxId.trim();
		if (clean.matches("^[0-9]{8}$")) {
			return; // DNI válido
		}
		if (clean.matches("^[0-9]{11}$")) {
			if (!clean.matches("^(10|15|17|20)[0-9]{9}$")) {
				throw PanelException.badRequest("RUC inválido: debe iniciar con 10, 15, 17 o 20");
			}
			int[] weights = {5, 4, 3, 2, 7, 6, 5, 4, 3, 2};
			int sum = 0;
			for (int i = 0; i < 10; i++) {
				sum += Character.getNumericValue(clean.charAt(i)) * weights[i];
			}
			int remainder = sum % 11;
			int checkDigit = 11 - remainder;
			if (checkDigit == 10) checkDigit = 0;
			else if (checkDigit == 11) checkDigit = 1;
			if (checkDigit != Character.getNumericValue(clean.charAt(10))) {
				throw PanelException.badRequest("RUC inválido: el dígito verificador (" + clean.charAt(10) + ") no coincide con el cálculo SUNAT (esperado: " + checkDigit + ")");
			}
			return;
		}
		throw PanelException.badRequest("El documento debe ser un DNI válido de 8 dígitos o un RUC válido de 11 dígitos");
	}

	private String currentActorRole() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth != null && auth.getAuthorities() != null && !auth.getAuthorities().isEmpty()) {
			return auth.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "").toUpperCase();
		}
		try {
			String dbActor = panel.jdbc().queryForObject("SELECT keptai_private.actor_actual()", String.class);
			return dbActor == null ? "ADMIN" : dbActor.toUpperCase();
		} catch (Exception e) {
			return "ADMIN";
		}
	}

	public PageResponse<Customer> list(PageRequest page, String query) {
		return panel.read(() -> {
			String q = (query == null || query.isBlank()) ? null : "%" + query.trim().toLowerCase() + "%";
			var rows = panel.jdbc().query("""
					SELECT c.id, c.razon_social, c.tipo, c.ruc_dni, c.telefono_principal, c.canal_origen, c.limite_credito, c.creado_en,
					       c.vendedor_asignado_id, u.nombre as vendedor_nombre, c.email_contacto, c.direccion, c.activo, c.fusionado_con_id
					FROM keptai.cliente c
					LEFT JOIN keptai.usuario u ON u.organizacion_id = c.organizacion_id AND u.id = c.vendedor_asignado_id
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
					SELECT c.id, c.razon_social, c.tipo, c.ruc_dni, c.telefono_principal, c.canal_origen, c.limite_credito, c.creado_en,
					       c.vendedor_asignado_id, u.nombre as vendedor_nombre, c.email_contacto, c.direccion, c.activo, c.fusionado_con_id
					FROM keptai.cliente c
					LEFT JOIN keptai.usuario u ON u.organizacion_id = c.organizacion_id AND u.id = c.vendedor_asignado_id
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
			return new Customer(c.id(), c.name(), c.customerType(), c.taxId(), c.primaryPhone(), c.sourceChannel(), c.creditLimit(),
					c.createdAt(), contacts, c.assignedSellerId(), c.assignedSellerName(), c.emailContact(), c.address(), c.active(), c.mergedWithId());
		});
	}

	public Customer createCustomer(CreateCustomerRequest req) {
		if (req.name() == null || req.name().isBlank()) {
			throw PanelException.badRequest("La razón social o nombre del cliente es obligatoria");
		}
		String taxId = (req.taxId() != null && !req.taxId().isBlank()) ? req.taxId().trim() : null;
		validateTaxId(taxId);
		String type = (req.customerType() != null && !req.customerType().isBlank()) ? req.customerType().toUpperCase() : "PERSONA";
		if (!Set.of("PERSONA", "EMPRESA", "COLEGIO").contains(type)) {
			type = "PERSONA";
		}
		String phone = (req.primaryPhone() != null && !req.primaryPhone().isBlank()) ? req.primaryPhone().trim() : null;
		String channel = (req.sourceChannel() != null && !req.sourceChannel().isBlank()) ? req.sourceChannel().trim() : "MANUAL";
		UUID sellerId = req.assignedSellerId() != null ? req.assignedSellerId() : panel.identity().usuarioId();

		final String finalTaxId = taxId;
		final String finalType = type;
		final String finalPhone = phone;
		final String finalChannel = channel;
		final UUID finalSellerId = sellerId;
		final String finalEmail = (req.emailContact() != null && !req.emailContact().isBlank()) ? req.emailContact().trim() : null;
		final String finalAddress = (req.address() != null && !req.address().isBlank()) ? req.address().trim() : null;

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
					INSERT INTO keptai.cliente (id, organizacion_id, razon_social, tipo, ruc_dni, telefono_principal, canal_origen, vendedor_asignado_id, email_contacto, direccion, creado_en)
					VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?, ?, now())
					""", id, req.name().trim(), finalType, finalTaxId, finalPhone, finalChannel, finalSellerId, finalEmail, finalAddress);

			audit(id, "CLIENTE_CREADO", "{\"nombre\":\"" + req.name().trim() + "\"}");
			return getCustomer(id);
		});
	}

	public Customer updateCustomer(UUID id, UpdateCustomerRequest req) {
		return panel.write(() -> {
			var rows = panel.jdbc().queryForList("""
					SELECT c.id, c.razon_social, c.tipo, c.ruc_dni, c.telefono_principal, c.canal_origen, c.limite_credito, 
					       c.vendedor_asignado_id, c.email_contacto, c.direccion, c.activo, c.fusionado_con_id, c.creado_en
					FROM keptai.cliente c
					WHERE c.organizacion_id = keptai.app_organizacion_actual() AND c.id = ?
					""", id);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado");
			}
			var current = rows.getFirst();
			String currentName = (String) current.get("razon_social");
			String currentType = (String) current.get("tipo");
			String currentTaxId = (String) current.get("ruc_dni");
			String currentPhone = (String) current.get("telefono_principal");
			String currentEmail = (String) current.get("email_contacto");
			String currentAddress = (String) current.get("direccion");
			UUID currentSeller = (UUID) current.get("vendedor_asignado_id");
			Boolean active = (Boolean) current.get("activo");
			if (Boolean.FALSE.equals(active)) {
				throw PanelException.badRequest("El cliente se encuentra inactivo o fusionado y no puede editarse");
			}

			String role = currentActorRole();
			boolean isSeller = "VENDEDOR".equals(role);

			// Vendedor solo puede editar datos de contacto
			if (isSeller) {
				if ((req.name() != null && !req.name().trim().equalsIgnoreCase(currentName))
						|| (req.customerType() != null && !req.customerType().trim().equalsIgnoreCase(currentType))
						|| (req.taxId() != null && !req.taxId().trim().equalsIgnoreCase(currentTaxId == null ? "" : currentTaxId))
						|| (req.assignedSellerId() != null && !req.assignedSellerId().equals(currentSeller))) {
					throw PanelException.forbidden("El vendedor solo puede editar datos de contacto (teléfono, email, dirección). La razón social, tipo, RUC/DNI y cartera requieren rol Administración.");
				}
			}

			// Admin: si cambia RUC/DNI o Razón Social, verificar comprobantes / órdenes previas
			if (req.name() != null || req.taxId() != null) {
				boolean nameChanged = req.name() != null && !req.name().trim().equalsIgnoreCase(currentName);
				boolean taxIdChanged = req.taxId() != null && !req.taxId().trim().equalsIgnoreCase(currentTaxId == null ? "" : currentTaxId);
				if (nameChanged || taxIdChanged) {
					var hasInvoicesOrOrders = !panel.jdbc().queryForList("""
							SELECT 1 FROM keptai.pago WHERE organizacion_id = keptai.app_organizacion_actual() AND cliente_id = ?
							UNION ALL
							SELECT 1 FROM keptai.orden WHERE organizacion_id = keptai.app_organizacion_actual() AND cliente_id = ? AND estado NOT IN ('ANULADA', 'CANCELADA')
							LIMIT 1
							""", id, id).isEmpty();
					if (hasInvoicesOrOrders) {
						throw PanelException.badRequest("RUC_HAS_INVOICES_MERGE_REQUIRED: El cliente ya registra comprobantes o pedidos en producción. No se puede modificar RUC ni Razón Social; utilice la opción de fusión de clientes duplicados.");
					}
				}
			}

			if (req.taxId() != null && !req.taxId().isBlank()) {
				validateTaxId(req.taxId());
				// Verificar unicidad de taxId
				var existing = panel.jdbc().queryForList("""
						SELECT id FROM keptai.cliente 
						WHERE organizacion_id = keptai.app_organizacion_actual() AND ruc_dni = ? AND id <> ?
						""", UUID.class, req.taxId().trim(), id);
				if (!existing.isEmpty()) {
					throw PanelException.conflict("Ya existe otro cliente con ese RUC/DNI en la organización");
				}
			}

			UUID actorId = panel.identity().usuarioId();
			String reason = req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : "Actualización de ficha";

			if (req.name() != null && !req.name().trim().equalsIgnoreCase(currentName)) {
				recordHistory(id, actorId, "razon_social", currentName, req.name().trim(), reason);
				panel.jdbc().update("UPDATE keptai.cliente SET razon_social = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", req.name().trim(), id);
			}
			if (req.customerType() != null && !req.customerType().trim().equalsIgnoreCase(currentType)) {
				recordHistory(id, actorId, "tipo", currentType, req.customerType().trim(), reason);
				panel.jdbc().update("UPDATE keptai.cliente SET tipo = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", req.customerType().trim().toUpperCase(), id);
			}
			if (req.taxId() != null && !req.taxId().trim().equalsIgnoreCase(currentTaxId == null ? "" : currentTaxId)) {
				recordHistory(id, actorId, "ruc_dni", currentTaxId, req.taxId().trim(), reason);
				panel.jdbc().update("UPDATE keptai.cliente SET ruc_dni = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", req.taxId().trim(), id);
			}
			if (req.primaryPhone() != null && !req.primaryPhone().trim().equalsIgnoreCase(currentPhone == null ? "" : currentPhone)) {
				recordHistory(id, actorId, "telefono_principal", currentPhone, req.primaryPhone().trim(), reason);
				panel.jdbc().update("UPDATE keptai.cliente SET telefono_principal = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", req.primaryPhone().trim(), id);
			}
			if (req.emailContact() != null && !req.emailContact().trim().equalsIgnoreCase(currentEmail == null ? "" : currentEmail)) {
				recordHistory(id, actorId, "email_contacto", currentEmail, req.emailContact().trim(), reason);
				panel.jdbc().update("UPDATE keptai.cliente SET email_contacto = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", req.emailContact().trim(), id);
			}
			if (req.address() != null && !req.address().trim().equalsIgnoreCase(currentAddress == null ? "" : currentAddress)) {
				recordHistory(id, actorId, "direccion", currentAddress, req.address().trim(), reason);
				panel.jdbc().update("UPDATE keptai.cliente SET direccion = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", req.address().trim(), id);
			}
			if (req.assignedSellerId() != null && !req.assignedSellerId().equals(currentSeller)) {
				recordHistory(id, actorId, "vendedor_asignado_id", currentSeller == null ? null : currentSeller.toString(), req.assignedSellerId().toString(), reason);
				panel.jdbc().update("UPDATE keptai.cliente SET vendedor_asignado_id = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", req.assignedSellerId(), id);
			}

			audit(id, "CLIENTE_ACTUALIZADO", "{\"motivo\":\"" + reason + "\"}");
			return getCustomer(id);
		});
	}

	public Customer reassignPortfolio(UUID customerId, ReassignPortfolioRequest req) {
		UpdateCustomerRequest updateReq = new UpdateCustomerRequest(null, null, null, null, null, null, req.assignedSellerId(), req.reason());
		return updateCustomer(customerId, updateReq);
	}

	public Customer mergeCustomers(UUID targetCustomerId, MergeCustomerRequest req) {
		return panel.write(() -> {
			UUID duplicateId = req.duplicateCustomerId();
			if (targetCustomerId.equals(duplicateId)) {
				throw PanelException.badRequest("No se puede fusionar un cliente consigo mismo");
			}
			var target = panel.jdbc().queryForList("SELECT id, razon_social FROM keptai.cliente WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ? AND activo = true", targetCustomerId);
			if (target.isEmpty()) {
				throw PanelException.notFound("Cliente principal no encontrado o inactivo");
			}
			var duplicate = panel.jdbc().queryForList("SELECT id, razon_social, ruc_dni FROM keptai.cliente WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ? AND activo = true", duplicateId);
			if (duplicate.isEmpty()) {
				throw PanelException.notFound("Cliente duplicado no encontrado o ya inactivo");
			}

			// Reasignar contactos
			panel.jdbc().update("UPDATE keptai.contacto SET cliente_id = ? WHERE cliente_id = ? AND organizacion_id = keptai.app_organizacion_actual()", targetCustomerId, duplicateId);
			// Reasignar órdenes
			panel.jdbc().update("UPDATE keptai.orden SET cliente_id = ? WHERE cliente_id = ? AND organizacion_id = keptai.app_organizacion_actual()", targetCustomerId, duplicateId);
			// Reasignar chats
			panel.jdbc().update("UPDATE keptai.chat SET cliente_id = ? WHERE cliente_id = ? AND organizacion_id = keptai.app_organizacion_actual()", targetCustomerId, duplicateId);
			// Reasignar pagos
			panel.jdbc().update("UPDATE keptai.pago SET cliente_id = ? WHERE cliente_id = ? AND organizacion_id = keptai.app_organizacion_actual()", targetCustomerId, duplicateId);

			// Marcar cliente duplicado como inactivo y fusionado
			panel.jdbc().update("UPDATE keptai.cliente SET activo = false, fusionado_con_id = ? WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()", targetCustomerId, duplicateId);

			UUID actorId = panel.identity().usuarioId();
			recordHistory(duplicateId, actorId, "activo", "true", "false", "Fusión en cliente " + targetCustomerId + ": " + req.reason());
			recordHistory(duplicateId, actorId, "fusionado_con_id", null, targetCustomerId.toString(), req.reason());
			recordHistory(targetCustomerId, actorId, "fusion_recibida", null, duplicateId.toString(), "Fusión recibida desde duplicado: " + req.reason());

			audit(targetCustomerId, "CLIENTE_FUSIONADO", "{\"duplicado_id\":\"" + duplicateId + "\",\"motivo\":\"" + req.reason() + "\"}");
			return getCustomer(targetCustomerId);
		});
	}

	public List<CustomerHistoryEntry> getCustomerHistory(UUID customerId) {
		return panel.read(() -> {
			return panel.jdbc().query("""
					SELECT h.id, h.cliente_id, h.modificado_por, coalesce(u.nombre, 'Usuario') as modificado_por_nombre,
					       h.campo, h.valor_anterior, h.valor_nuevo, h.motivo, h.creado_en
					FROM keptai.cliente_historial h
					LEFT JOIN keptai.usuario u ON u.organizacion_id = h.organizacion_id AND u.id = h.modificado_por
					WHERE h.organizacion_id = keptai.app_organizacion_actual() AND h.cliente_id = ?
					ORDER BY h.creado_en DESC
					""", (rs, i) -> new CustomerHistoryEntry(
							rs.getObject("id", UUID.class),
							rs.getObject("cliente_id", UUID.class),
							rs.getObject("modificado_por", UUID.class),
							rs.getString("modificado_por_nombre"),
							rs.getString("campo"),
							rs.getString("valor_anterior"),
							rs.getString("valor_nuevo"),
							rs.getString("motivo"),
							rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC)
					), customerId);
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
		UUID sellerId = rs.getObject("vendedor_asignado_id", UUID.class);
		String sellerName = rs.getString("vendedor_nombre");
		String email = rs.getString("email_contacto");
		String address = rs.getString("direccion");
		boolean active = rs.getBoolean("activo");
		UUID mergedWithId = rs.getObject("fusionado_con_id", UUID.class);
		return new Customer(id, name, tipo, rucDni, phone, canal == null ? "MANUAL" : canal, credit, created, null,
				sellerId, sellerName, email, address, active, mergedWithId);
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

	private void recordHistory(UUID customerId, UUID actorId, String field, String prev, String next, String reason) {
		panel.jdbc().update("""
				INSERT INTO keptai.cliente_historial (id, organizacion_id, cliente_id, modificado_por, campo, valor_anterior, valor_nuevo, motivo, creado_en)
				VALUES (gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, now())
				""", customerId, actorId, field, prev, next, reason);
	}

	private void audit(UUID id, String operation, String changes) {
		panel.jdbc().update(
				"INSERT INTO keptai.evento_auditoria(organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id) VALUES(keptai.app_organizacion_actual(), ?, 'USUARIO', ?, 'cliente', ?, ?::jsonb, ?)",
				panel.identity().usuarioId(), operation, id, changes, MDC.get(RequestIdFilter.MDC_KEY));
	}

}
