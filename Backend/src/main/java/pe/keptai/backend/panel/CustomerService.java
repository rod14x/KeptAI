package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
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
					  AND (? IS NULL OR lower(c.razon_social) LIKE ? OR lower(coalesce(c.ruc_dni, '')) LIKE ? OR lower(coalesce(c.telefono_principal, '')) LIKE ?)\r
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

		BigDecimal limit = BigDecimal.ZERO;
		if (req.creditLimit() instanceof Number n) {
			limit = BigDecimal.valueOf(n.doubleValue());
		} else if (req.creditLimit() instanceof Map<?, ?> map && map.get("amount_cents") instanceof Number ac) {
			limit = BigDecimal.valueOf(ac.longValue(), 2);
		}

		final String finalTaxId = taxId;
		final String finalType = type;
		final String finalPhone = phone;
		final String finalChannel = channel;
		final BigDecimal finalLimit = limit;
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
					INSERT INTO keptai.cliente (id, organizacion_id, razon_social, tipo, ruc_dni, telefono_principal, canal_origen, limite_credito, vendedor_asignado_id, email_contacto, direccion, creado_en)
					VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
					""", id, req.name().trim(), finalType, finalTaxId, finalPhone, finalChannel, finalLimit, finalSellerId, finalEmail, finalAddress);

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
				if ((req.name() != null && !req.name().equals(currentName)) ||
					(req.customerType() != null && !req.customerType().equalsIgnoreCase(currentType)) ||
					(req.taxId() != null && !req.taxId().equals(currentTaxId)) ||
					(req.assignedSellerId() != null && !req.assignedSellerId().equals(currentSeller))) {
					throw PanelException.forbidden("El vendedor solo puede editar datos de contacto (teléfono, email, dirección). La razón social, tipo, RUC/DNI y cartera requieren rol Administración.");
				}
			}

			String newName = (req.name() != null && !req.name().isBlank()) ? req.name().trim() : currentName;
			String newType = (req.customerType() != null && !req.customerType().isBlank()) ? req.customerType().toUpperCase() : currentType;
			String newTaxId = (req.taxId() != null) ? (req.taxId().isBlank() ? null : req.taxId().trim()) : currentTaxId;
			if (newTaxId != null && !newTaxId.equals(currentTaxId)) {
				validateTaxId(newTaxId);
				var existing = panel.jdbc().queryForList(
						"SELECT id FROM keptai.cliente WHERE organizacion_id = keptai.app_organizacion_actual() AND ruc_dni = ? AND id <> ?",
						UUID.class, newTaxId, id);
				if (!existing.isEmpty()) {
					throw PanelException.conflict("Ya existe otro cliente con ese RUC/DNI en la organización");
				}
			}

			String newPhone = (req.primaryPhone() != null) ? (req.primaryPhone().isBlank() ? null : req.primaryPhone().trim()) : currentPhone;
			String newEmail = (req.emailContact() != null) ? (req.emailContact().isBlank() ? null : req.emailContact().trim()) : currentEmail;
			String newAddress = (req.address() != null) ? (req.address().isBlank() ? null : req.address().trim()) : currentAddress;
			UUID newSeller = req.assignedSellerId() != null ? req.assignedSellerId() : currentSeller;

			UUID actorId = panel.identity().usuarioId();
			String reason = req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : "Actualización de datos";

			// Registrar auditoría de campos modificados
			if (!java.util.Objects.equals(currentName, newName)) logHistory(id, actorId, "razon_social", currentName, newName, reason);
			if (!java.util.Objects.equals(currentType, newType)) logHistory(id, actorId, "tipo", currentType, newType, reason);
			if (!java.util.Objects.equals(currentTaxId, newTaxId)) logHistory(id, actorId, "ruc_dni", currentTaxId, newTaxId, reason);
			if (!java.util.Objects.equals(currentPhone, newPhone)) logHistory(id, actorId, "telefono_principal", currentPhone, newPhone, reason);
			if (!java.util.Objects.equals(currentEmail, newEmail)) logHistory(id, actorId, "email_contacto", currentEmail, newEmail, reason);
			if (!java.util.Objects.equals(currentAddress, newAddress)) logHistory(id, actorId, "direccion", currentAddress, newAddress, reason);
			if (!java.util.Objects.equals(currentSeller, newSeller)) logHistory(id, actorId, "vendedor_asignado_id", String.valueOf(currentSeller), String.valueOf(newSeller), reason);

			panel.jdbc().update("""
					UPDATE keptai.cliente
					SET razon_social = ?, tipo = ?, ruc_dni = ?, telefono_principal = ?, email_contacto = ?, direccion = ?, vendedor_asignado_id = ?
					WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?
					""", newName, newType, newTaxId, newPhone, newEmail, newAddress, newSeller, id);

			audit(id, "CLIENTE_ACTUALIZADO", "{\"motivo\":\"" + reason + "\"}");
			return getCustomer(id);
		});
	}

	public Customer reassignPortfolio(UUID customerId, ReassignPortfolioRequest req) {
		return panel.write(() -> {
			var rows = panel.jdbc().queryForList("""
					SELECT c.vendedor_asignado_id, u.nombre as vendedor_actual
					FROM keptai.cliente c
					LEFT JOIN keptai.usuario u ON u.organizacion_id = c.organizacion_id AND u.id = c.vendedor_asignado_id
					WHERE c.organizacion_id = keptai.app_organizacion_actual() AND c.id = ?
					""", customerId);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado");
			}
			UUID prevSellerId = (UUID) rows.getFirst().get("vendedor_asignado_id");

			// Verificar que el nuevo vendedor exista y sea VENDEDOR
			var targetSeller = panel.jdbc().queryForList("""
					SELECT nombre FROM keptai.usuario
					WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ? AND rol = 'VENDEDOR' AND activo = true
					""", req.assignedSellerId());
			if (targetSeller.isEmpty()) {
				throw PanelException.badRequest("El vendedor asignado no existe o no tiene rol VENDEDOR activo");
			}

			String reason = req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : "Reasignación de cartera comercial";
			UUID actorId = panel.identity().usuarioId();

			panel.jdbc().update("""
					UPDATE keptai.cliente
					SET vendedor_asignado_id = ?
					WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?
					""", req.assignedSellerId(), customerId);

			logHistory(customerId, actorId, "vendedor_asignado_id", String.valueOf(prevSellerId), String.valueOf(req.assignedSellerId()), reason);
			audit(customerId, "CARTERA_REASIGNADA", "{\"nuevo_vendedor\":\"" + req.assignedSellerId() + "\",\"motivo\":\"" + reason + "\"}");

			return getCustomer(customerId);
		});
	}

	public Customer mergeCustomers(UUID primaryCustomerId, MergeCustomerRequest req) {
		return panel.write(() -> {
			if (primaryCustomerId.equals(req.duplicateCustomerId())) {
				throw PanelException.badRequest("No se puede fusionar un cliente consigo mismo");
			}

			// Verificar cliente principal
			var primary = panel.jdbc().queryForList("""
					SELECT id, razon_social, activo, fusionado_con_id FROM keptai.cliente
					WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?
					""", primaryCustomerId);
			if (primary.isEmpty()) {
				throw PanelException.notFound("Cliente principal no encontrado");
			}
			if (Boolean.FALSE.equals(primary.getFirst().get("activo"))) {
				throw PanelException.badRequest("El cliente principal está inactivo o ya fue fusionado");
			}

			// Verificar cliente duplicado
			var duplicate = panel.jdbc().queryForList("""
					SELECT id, razon_social, activo, fusionado_con_id FROM keptai.cliente
					WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?
					""", req.duplicateCustomerId());
			if (duplicate.isEmpty()) {
				throw PanelException.notFound("Cliente duplicado no encontrado");
			}
			if (Boolean.FALSE.equals(duplicate.getFirst().get("activo"))) {
				throw PanelException.badRequest("El cliente duplicado ya se encuentra inactivo o fusionado");
			}

			UUID actorId = panel.identity().usuarioId();
			String reason = req.reason().trim();

			// 1. Reasignar pedidos del duplicado al principal
			panel.jdbc().update("""
					UPDATE keptai.orden
					SET cliente_id = ?
					WHERE organizacion_id = keptai.app_organizacion_actual() AND cliente_id = ?
					""", primaryCustomerId, req.duplicateCustomerId());

			// 2. Reasignar contactos del duplicado al principal
			panel.jdbc().update("""
					UPDATE keptai.contacto
					SET cliente_id = ?
					WHERE organizacion_id = keptai.app_organizacion_actual() AND cliente_id = ?
					""", primaryCustomerId, req.duplicateCustomerId());

			// 3. Reasignar obligaciones de cobro
			panel.jdbc().update("""
					UPDATE keptai.obligacion_cobro
					SET cliente_id = ?
					WHERE organizacion_id = keptai.app_organizacion_actual() AND cliente_id = ?
					""", primaryCustomerId, req.duplicateCustomerId());

			// 4. Marcar duplicado como inactivo y referenciar al principal
			panel.jdbc().update("""
					UPDATE keptai.cliente
					SET activo = false, fusionado_con_id = ?
					WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?
					""", primaryCustomerId, req.duplicateCustomerId());

			// 5. Historial y auditoría
			logHistory(req.duplicateCustomerId(), actorId, "activo", "true", "false", "Fusión en cliente " + primaryCustomerId + ": " + reason);
			logHistory(req.duplicateCustomerId(), actorId, "fusionado_con_id", null, String.valueOf(primaryCustomerId), reason);
			audit(primaryCustomerId, "CLIENTE_FUSIONADO", "{\"absorbido\":\"" + req.duplicateCustomerId() + "\",\"motivo\":\"" + reason + "\"}");

			return getCustomer(primaryCustomerId);
		});
	}

	public List<CustomerHistoryEntry> getCustomerHistory(UUID customerId) {
		return panel.read(() -> {
			return panel.jdbc().query("""
					SELECT h.id, h.cliente_id, h.modificado_por, u.nombre as modificado_por_nombre,
					       h.campo, h.valor_anterior, h.valor_nuevo, h.motivo, h.creado_en
					FROM keptai.cliente_historial h
					JOIN keptai.usuario u ON u.organizacion_id = h.organizacion_id AND u.id = h.modificado_por
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
							rs.getObject("creado_en", OffsetDateTime.class)), customerId);
		});
	}

	public Contact createContact(UUID customerId, CreateContactRequest req) {
		return panel.write(() -> {
			var customer = panel.jdbc().queryForList(
					"SELECT id FROM keptai.cliente WHERE organizacion_id = keptai.app_organizacion_actual() AND id = ?",
					UUID.class, customerId);
			if (customer.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado");
			}
			UUID id = UUID.randomUUID();
			panel.jdbc().update("""
					INSERT INTO keptai.contacto (id, organizacion_id, cliente_id, nombre, whatsapp_jid, creado_en)
					VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, now())
					""", id, customerId, req.name().trim(), req.whatsappJid());

			audit(customerId, "CONTACTO_CREADO", "{\"contacto_id\":\"" + id + "\",\"nombre\":\"" + req.name().trim() + "\"}");

			return new Contact(id, customerId, req.name().trim(), req.whatsappJid(), req.phone(), req.email(), true, OffsetDateTime.now());
		});
	}

	private Customer mapCustomer(ResultSet rs) throws SQLException {
		UUID id = rs.getObject("id", UUID.class);
		String name = rs.getString("razon_social");
		String type = rs.getString("tipo");
		String taxId = rs.getString("ruc_dni");
		String phone = rs.getString("telefono_principal");
		String channel = rs.getString("canal_origen");
		BigDecimal limit = rs.getBigDecimal("limite_credito");
		OffsetDateTime createdAt = rs.getObject("creado_en", OffsetDateTime.class);
		UUID sellerId = rs.getObject("vendedor_asignado_id", UUID.class);
		String sellerName = rs.getString("vendedor_nombre");
		String email = rs.getString("email_contacto");
		String address = rs.getString("direccion");
		Boolean active = rs.getBoolean("activo");
		UUID mergedWith = rs.getObject("fusionado_con_id", UUID.class);

		NonNegativeMoney money = limit != null
				? new NonNegativeMoney(limit.movePointRight(2).longValue(), "PEN")
				: null;

		return new Customer(id, name, type, taxId, phone, channel, money, createdAt, List.of(), sellerId, sellerName, email, address, active, mergedWith);
	}

	private Contact mapContact(ResultSet rs) throws SQLException {
		return new Contact(
				rs.getObject("id", UUID.class),
				rs.getObject("cliente_id", UUID.class),
				rs.getString("nombre"),
				rs.getString("whatsapp_jid"),
				null,
				null,
				rs.getBoolean("activo"),
				rs.getObject("creado_en", OffsetDateTime.class));
	}

	private void logHistory(UUID customerId, UUID actorId, String field, String prev, String next, String reason) {
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
