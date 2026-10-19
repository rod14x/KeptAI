package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.OrderDtos.CreateOrderItemRequest;
import pe.keptai.backend.contract.OrderDtos.CreateOrderRequest;
import pe.keptai.backend.contract.OrderDtos.Order;
import pe.keptai.backend.web.RequestIdFilter;

/** Creación comercial de pedidos en BORRADOR con hoja_resumen y ficha_tecnica (Fase 2). */
@Service
public class OrderCreationService {

	private final PanelContext panel;

	private final PanelQueries queries;

	public OrderCreationService(PanelContext panel, PanelQueries queries) {
		this.panel = panel;
		this.queries = queries;
	}

	public Order createOrder(CreateOrderRequest req) {
		if (req.customerId() == null) {
			throw PanelException.badRequest("El cliente es obligatorio");
		}
		if (req.items() == null || req.items().isEmpty()) {
			throw PanelException.badRequest("El pedido debe contener al menos un artículo");
		}

		return panel.write(() -> {
			var clientRows = panel.jdbc().queryForList(
					"SELECT razon_social FROM keptai.cliente WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()",
					req.customerId());
			if (clientRows.isEmpty()) {
				throw PanelException.notFound("Cliente no encontrado en la organización");
			}
			String clienteNombre = (String) clientRows.getFirst().get("razon_social");

			// Resolver marca
			UUID marcaId = null;
			String marcaNombre = req.brand();
			if (marcaNombre != null && !marcaNombre.isBlank()) {
				var brandRows = panel.jdbc().queryForList(
						"SELECT id, nombre FROM keptai.marca WHERE lower(nombre) = lower(?) AND organizacion_id = keptai.app_organizacion_actual()",
						marcaNombre.trim());
				if (!brandRows.isEmpty()) {
					marcaId = (UUID) brandRows.getFirst().get("id");
					marcaNombre = (String) brandRows.getFirst().get("nombre");
				}
			}
			if (marcaId == null) {
				var defaultBrand = panel.jdbc().queryForList(
						"SELECT id, nombre FROM keptai.marca WHERE organizacion_id = keptai.app_organizacion_actual() ORDER BY creado_en LIMIT 1");
				if (!defaultBrand.isEmpty()) {
					marcaId = (UUID) defaultBrand.getFirst().get("id");
					if (marcaNombre == null) {
						marcaNombre = (String) defaultBrand.getFirst().get("nombre");
					}
				}
			}

			// Calcular total
			BigDecimal total = BigDecimal.ZERO;
			for (CreateOrderItemRequest item : req.items()) {
				BigDecimal unitPrice = PanelMapping.soles(item.unitPrice().amountCents());
				total = total.add(unitPrice.multiply(BigDecimal.valueOf(item.quantity())));
			}
			if (total.compareTo(BigDecimal.ZERO) <= 0) {
				throw PanelException.badRequest("El importe total de la orden debe ser mayor que cero");
			}

			// Generar código único ORD-YYYYMMDD-XXXX
			String datePrefix = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
			String ref = null;
			for (int i = 0; i < 10; i++) {
				String candidate = "ORD-" + datePrefix + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
				var exists = panel.jdbc().queryForList(
						"SELECT id FROM keptai.orden WHERE ref = ? AND organizacion_id = keptai.app_organizacion_actual()",
						candidate);
				if (exists.isEmpty()) {
					ref = candidate;
					break;
				}
			}
			if (ref == null) {
				ref = "ORD-" + datePrefix + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
			}

			UUID orderId = UUID.randomUUID();
			String condicionPago = req.paymentCondition() != null ? req.paymentCondition().name() : "ANTICIPO";
			Integer plazoDias = "CREDITO".equals(condicionPago) ? 30 : 0;
			BigDecimal anticipoReq = req.advanceRequired() != null
					? PanelMapping.soles(req.advanceRequired().amountCents())
					: ("ANTICIPO".equals(condicionPago) ? total.multiply(new BigDecimal("0.50")).setScale(2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO);

			String canal = req.sourceChannel() != null ? req.sourceChannel().toUpperCase() : "MANUAL";
			String origen = "WHATSAPP".equals(canal) ? "WHATSAPP" : "MANUAL";

			panel.jdbc().update("""
					INSERT INTO keptai.orden (
					    id, organizacion_id, ref, cliente_id, marca_id, vendedor_id, estado,
					    condicion_pago, plazo_dias, anticipo_requerido, total, moneda, tipo_produccion,
					    fecha_entrega_solicitada, origen, version, creado_en, actualizado_en
					) VALUES (
					    ?, keptai.app_organizacion_actual(), ?, ?, ?, ?, 'BORRADOR',
					    ?, ?, ?, ?, 'PEN', 'INTERNA',
					    ?, ?, 0, now(), now()
					)
					""", orderId, ref, req.customerId(), marcaId, panel.identity().usuarioId(),
					condicionPago, plazoDias, anticipoReq, total, req.requestedDeliveryDate(), origen);

			// Insertar items
			for (CreateOrderItemRequest item : req.items()) {
				panel.jdbc().update("""
						INSERT INTO keptai.orden_item (id, organizacion_id, orden_id, descripcion, cantidad, precio_unit)
						VALUES (gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?)
						""", orderId, item.description().trim(), item.quantity(), PanelMapping.soles(item.unitPrice().amountCents()));
			}

			// Insertar hoja_resumen en BORRADOR
			String summaryMd = "# Pedido " + ref + "\nCliente: " + clienteNombre + "\nTotal: S/ " + total;
			panel.jdbc().update("""
					INSERT INTO keptai.hoja_resumen (
					    id, organizacion_id, orden_id, version, estado, confianza, extraccion, resumen_md, creado_en
					) VALUES (
					    gen_random_uuid(), keptai.app_organizacion_actual(), ?, 1, 'BORRADOR', 1.00, '{}'::jsonb, ?, now()
					)
					""", orderId, summaryMd);

			// Insertar ficha_tecnica en BORRADOR
			String modalidad = (req.modality() != null && !req.modality().isBlank())
					? ("CONFECCION_ROLLO".equalsIgnoreCase(req.modality()) ? "CONFECCION_ROLLO" : "STOCK_BORDADO")
					: "STOCK_BORDADO";

			panel.jdbc().update("""
					INSERT INTO keptai.ficha_tecnica (
					    id, organizacion_id, orden_id, estado, modalidad, semaforo_tela,
					    consumo_estimado_kg, validacion_tela, creado_en, actualizado_en
					) VALUES (
					    gen_random_uuid(), keptai.app_organizacion_actual(), ?, 'BORRADOR', ?, 'HABITUAL_VERDE',
					    0, 'NO_APLICA', now(), now()
					)
					""", orderId, modalidad);

			// Auditar
			panel.jdbc().update("""
					INSERT INTO keptai.evento_auditoria(organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id)
					VALUES(keptai.app_organizacion_actual(), ?, 'USUARIO', 'ORDEN_CREADA', 'orden', ?, jsonb_build_object('ref', ?), ?)
					""", panel.identity().usuarioId(), orderId, ref, MDC.get(RequestIdFilter.MDC_KEY));

			return queries.orderInTx(orderId);
		});
	}

}
