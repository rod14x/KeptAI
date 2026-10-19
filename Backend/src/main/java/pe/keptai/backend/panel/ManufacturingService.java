/**
 * ManufacturingService.java
 * Versión: 3.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.ContractEnums.OrderStatus;
import pe.keptai.backend.contract.ContractEnums.ProductionMode;
import pe.keptai.backend.contract.ManufacturingDtos.OrderStage;
import pe.keptai.backend.contract.ManufacturingDtos.StationAdvanceRequest;
import pe.keptai.backend.contract.ManufacturingDtos.StationAdvanceResponse;
import pe.keptai.backend.contract.ProductionOrderDtos.ProductionCustomerRef;
import pe.keptai.backend.contract.ProductionOrderDtos.ProductionOrder;
import pe.keptai.backend.contract.ProductionOrderDtos.ProductionOrderItem;
import pe.keptai.backend.web.RequestIdFilter;

/** Servicio de taller, avance de estaciones, orden de producción sin precios y mermas (Fase 4 & B-08). */
@Service
public class ManufacturingService {

	private static final Set<String> VALID_STAGES = Set.of("CORTE", "SUBLIMADO_BORDADO", "CONFECCION", "CALIDAD");
	private static final Set<String> VALID_SCRAP_CAUSES = Set.of(
			"CORTE_DESALINEADO", "MANCHA_TINTA", "SALTO_PUNTADA", "FALLA_TEJIDO",
			"DEGRADADO_SUBLIMADO", "ROTURA_AGUJA", "TONO_DISPAREJO", "OTRO"
	);

	private final PanelContext panel;

	public ManufacturingService(PanelContext panel) {
		this.panel = panel;
	}

	public StationAdvanceResponse advanceStation(UUID orderId, StationAdvanceRequest req) {
		String stage = req.stage() != null ? req.stage().trim().toUpperCase() : null;
		if (stage == null || !VALID_STAGES.contains(stage)) {
			throw PanelException.badRequest("Etapa inválida. Debe ser una de: " + VALID_STAGES);
		}

		return panel.write(() -> {
			// 1. Verificar estado de la orden
			var orderRows = panel.jdbc().queryForList("""
					SELECT id, estado, ref, fecha_inicio_produccion
					FROM keptai.orden
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					FOR UPDATE
					""", orderId);
			if (orderRows.isEmpty()) {
				throw PanelException.notFound("Orden no encontrada");
			}
			Map<String, Object> order = orderRows.getFirst();
			String orderEstado = (String) order.get("estado");

			if ("RETENIDA".equals(orderEstado) || "BORRADOR".equals(orderEstado)
					|| "PENDIENTE_APROBACION".equals(orderEstado) || "CANCELADA".equals(orderEstado)) {
				throw PanelException.unprocessable("FINANCIAL_HOLD",
						"La orden no puede entrar al taller en estado " + orderEstado + ". Debe estar LIBERADA");
			}

			// 2. Verificar compuerta de ficha técnica completa
			var ftRows = panel.jdbc().queryForList("""
					SELECT estado, validacion_tela, semaforo_tela
					FROM keptai.ficha_tecnica
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", orderId);
			if (ftRows.isEmpty() || !"COMPLETA".equals(ftRows.getFirst().get("estado"))) {
				throw PanelException.unprocessable("INCOMPLETE_TECH_SHEET",
						"La ficha técnica debe estar en estado COMPLETA para iniciar o avanzar la fabricación");
			}

			// B-08: Leer total pedido para validaciones y alerta de recorte
			Integer totalItems = panel.jdbc().queryForObject(
					"SELECT coalesce(sum(cantidad), 0) FROM keptai.orden_item WHERE orden_id = ?",
					Integer.class, orderId);
			int totalPedido = totalItems != null ? totalItems : 0;

			// B-08: Validación matemática estricta de conservación de masa:
			// entrada = buenas + segundas + merma + reproceso
			Integer inputQty = req.inputQuantity();
			Integer goodPieces = req.goodPieces();
			Integer secondPieces = req.secondPieces();
			Integer scrap = req.scrap();
			Integer rework = req.reworkPieces();
			String scrapCause = req.scrapCause() != null ? req.scrapCause().trim().toUpperCase() : null;

			if (scrapCause != null && !VALID_SCRAP_CAUSES.contains(scrapCause)) {
				throw PanelException.badRequest("Causa de merma inválida. Debe ser una de: " + VALID_SCRAP_CAUSES);
			}

			if (inputQty != null && inputQty > 0) {
				int g = goodPieces != null ? goodPieces : 0;
				int s = secondPieces != null ? secondPieces : 0;
				int m = scrap != null ? scrap : 0;
				int r = rework != null ? rework : 0;
				int suma = g + s + m + r;
				if (suma != inputQty) {
					throw PanelException.badRequest("MASS_BALANCE_MISMATCH: La entrada (" + inputQty
							+ ") debe ser exactamente igual a buenas (" + g + ") + segundas (" + s
							+ ") + merma (" + m + ") + reproceso (" + r + ") = " + suma);
				}
			}

			// B-08: En CORTE, registrar consumo real de tela en kg y calcular factor
			BigDecimal fabricFactor = null;
			if ("CORTE".equals(stage) && req.actualFabricKg() != null && req.actualFabricKg().compareTo(BigDecimal.ZERO) > 0) {
				int basePrendas = (goodPieces != null && goodPieces > 0) ? goodPieces
						: (req.quantityProcessed() != null && req.quantityProcessed() > 0 ? req.quantityProcessed() : totalPedido);
				if (basePrendas > 0) {
					fabricFactor = req.actualFabricKg().divide(BigDecimal.valueOf(basePrendas), 4, RoundingMode.HALF_UP);
				}
			}

			// B-08: Alerta de recorte si las buenas no cubren lo pedido
			Boolean shortageAlert = null;
			Integer missingPieces = null;
			if (goodPieces != null && goodPieces > 0 && totalPedido > 0 && goodPieces < totalPedido) {
				shortageAlert = true;
				missingPieces = totalPedido - goodPieces;
			}

			// 3. Determinar el estado destino de la etapa
			String targetStatus = req.status() != null ? req.status().trim().toUpperCase() : null;
			var currentStageRows = panel.jdbc().queryForList("""
					SELECT id, estado, inicio, fin
					FROM keptai.orden_etapa
					WHERE orden_id = ? AND etapa = ? AND organizacion_id = keptai.app_organizacion_actual()
					FOR UPDATE
					""", orderId, stage);

			if (targetStatus == null) {
				if (currentStageRows.isEmpty() || "PENDIENTE".equals(currentStageRows.getFirst().get("estado"))) {
					targetStatus = "EN_CURSO";
				}
				else if ("EN_CURSO".equals(currentStageRows.getFirst().get("estado"))) {
					targetStatus = "TERMINADA";
				}
				else {
					targetStatus = "TERMINADA";
				}
			}

			if (!Set.of("PENDIENTE", "EN_CURSO", "TERMINADA", "BLOQUEADA").contains(targetStatus)) {
				throw PanelException.badRequest("Estado de etapa inválido: " + targetStatus);
			}

			// 4. Si la etapa es CORTE y la orden está LIBERADA, pasa formalmente a EN_PRODUCCION
			if ("CORTE".equals(stage) && "LIBERADA".equals(orderEstado)) {
				panel.jdbc().update("""
						UPDATE keptai.orden
						SET estado = 'EN_PRODUCCION',
						    fecha_inicio_produccion = coalesce(fecha_inicio_produccion, CURRENT_DATE),
						    actualizado_en = now(),
						    version = version + 1
						WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
						""", orderId);
				orderEstado = "EN_PRODUCCION";

				audit(orderId, "ORDEN_EN_PRODUCCION", "{\"estado_previo\":\"LIBERADA\",\"nuevo_estado\":\"EN_PRODUCCION\"}");
			}

			// Cantidad procesada general (retrocompatible)
			Integer processed = req.quantityProcessed() != null ? req.quantityProcessed() : goodPieces;

			// 5. Upsert de la etapa en orden_etapa con campos de B-08
			if (currentStageRows.isEmpty()) {
				panel.jdbc().update("""
						INSERT INTO keptai.orden_etapa (
						    id, organizacion_id, orden_id, etapa, estado, responsable_id,
						    cantidad_procesada, merma, inicio, fin, observaciones,
						    cantidad_entrada, buenas, segundas, reproceso, causa_merma,
						    consumo_real_kg, factor_consumo_calculado
						) VALUES (
						    gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?,
						    ?, ?, case when ? = 'EN_CURSO' then now() else null end,
						    case when ? = 'TERMINADA' then now() else null end, ?,
						    ?, ?, ?, ?, ?,
						    ?, ?
						)
						""", orderId, stage, targetStatus, panel.identity().usuarioId(),
						processed, scrap, targetStatus, targetStatus, req.notes(),
						inputQty, goodPieces, secondPieces, rework, scrapCause,
						req.actualFabricKg(), fabricFactor);
			}
			else {
				panel.jdbc().update("""
						UPDATE keptai.orden_etapa
						SET estado = ?,
						    responsable_id = ?,
						    cantidad_procesada = coalesce(?, cantidad_procesada),
						    merma = coalesce(?, merma),
						    inicio = case when ? = 'EN_CURSO' then coalesce(inicio, now()) else inicio end,
						    fin = case when ? = 'TERMINADA' then now() else fin end,
						    observaciones = coalesce(?, observaciones),
						    cantidad_entrada = coalesce(?, cantidad_entrada),
						    buenas = coalesce(?, buenas),
						    segundas = coalesce(?, segundas),
						    reproceso = coalesce(?, reproceso),
						    causa_merma = coalesce(?, causa_merma),
						    consumo_real_kg = coalesce(?, consumo_real_kg),
						    factor_consumo_calculado = coalesce(?, factor_consumo_calculado)
						WHERE orden_id = ? AND etapa = ? AND organizacion_id = keptai.app_organizacion_actual()
						""", targetStatus, panel.identity().usuarioId(),
						processed, scrap, targetStatus, targetStatus, req.notes(),
						inputQty, goodPieces, secondPieces, rework, scrapCause,
						req.actualFabricKg(), fabricFactor,
						orderId, stage);
			}

			// Auditar avance
			audit(orderId, "ESTACION_AVANZADA",
					"{\"etapa\":\"" + stage + "\",\"estado\":\"" + targetStatus + "\"}");

			// Listar todas las etapas actualizadas de la orden
			var stages = panel.jdbc().query("""
					SELECT id, etapa, estado, inicio, fin, responsable_id, cantidad_procesada, merma, observaciones,
					       cantidad_entrada, buenas, segundas, reproceso, causa_merma, consumo_real_kg, factor_consumo_calculado
					FROM keptai.orden_etapa
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					ORDER BY CASE etapa
					    WHEN 'CORTE' THEN 1
					    WHEN 'SUBLIMADO_BORDADO' THEN 2
					    WHEN 'CONFECCION' THEN 3
					    WHEN 'CALIDAD' THEN 4
					    ELSE 5 END
					""", (rs, i) -> mapStage(rs), orderId);

			return new StationAdvanceResponse(orderId, orderEstado, stages, shortageAlert, missingPieces, fabricFactor);
		});
	}

	public List<OrderStage> getOrderStages(UUID orderId) {
		return panel.read(() -> panel.jdbc().query("""
				SELECT id, etapa, estado, inicio, fin, responsable_id, cantidad_procesada, merma, observaciones,
				       cantidad_entrada, buenas, segundas, reproceso, causa_merma, consumo_real_kg, factor_consumo_calculado
				FROM keptai.orden_etapa
				WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
				ORDER BY CASE etapa
				    WHEN 'CORTE' THEN 1
				    WHEN 'SUBLIMADO_BORDADO' THEN 2
				    WHEN 'CONFECCION' THEN 3
				    WHEN 'CALIDAD' THEN 4
				    ELSE 5 END
				""", (rs, i) -> mapStage(rs), orderId));
	}

	/**
	 * B-05: Orden de producción sin precios.
	 * No incluye precios, costos, márgenes ni pagos.
	 */
	public ProductionOrder getProductionOrder(UUID orderId) {
		return panel.read(() -> {
			var rows = panel.jdbc().queryForList("""
					SELECT o.id, o.ref, o.tipo_produccion, o.estado,
					       o.fecha_entrega_solicitada, o.fecha_inicio_produccion, o.fecha_despacho,
					       o.creado_en, c.id AS cliente_id, c.razon_social AS cliente_nombre,
					       m.nombre AS marca_nombre
					FROM keptai.orden o
					LEFT JOIN keptai.cliente c ON c.id = o.cliente_id AND c.organizacion_id = o.organizacion_id
					LEFT JOIN keptai.marca m ON m.id = o.marca_id AND m.organizacion_id = o.organizacion_id
					WHERE o.id = ? AND o.organizacion_id = keptai.app_organizacion_actual()
					""", orderId);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Orden de producción no encontrada");
			}
			return mapProductionOrder(rows.getFirst(), orderId);
		});
	}

	/**
	 * B-05: Listado de órdenes de producción para taller.
	 * Solo órdenes liberadas o en curso físico.
	 */
	public List<ProductionOrder> listProductionOrders() {
		return panel.read(() -> {
			var rows = panel.jdbc().queryForList("""
					SELECT o.id, o.ref, o.tipo_produccion, o.estado,
					       o.fecha_entrega_solicitada, o.fecha_inicio_produccion, o.fecha_despacho,
					       o.creado_en, c.id AS cliente_id, c.razon_social AS cliente_nombre,
					       m.nombre AS marca_nombre
					FROM keptai.orden o
					LEFT JOIN keptai.cliente c ON c.id = o.cliente_id AND c.organizacion_id = o.organizacion_id
					LEFT JOIN keptai.marca m ON m.id = o.marca_id AND m.organizacion_id = o.organizacion_id
					WHERE o.organizacion_id = keptai.app_organizacion_actual()
					  AND o.estado IN ('LIBERADA', 'EN_PRODUCCION', 'DESPACHADA', 'CERRADA')
					ORDER BY o.creado_en DESC
					""");
			return rows.stream().map(r -> mapProductionOrder(r, (UUID) r.get("id"))).toList();
		});
	}

	private ProductionOrder mapProductionOrder(Map<String, Object> r, UUID orderId) {
		var itemRows = panel.jdbc().queryForList("""
				SELECT descripcion, cantidad, detalle
				FROM keptai.orden_item
				WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
				ORDER BY id
				""", orderId);
		List<ProductionOrderItem> items = itemRows.stream().map(it -> new ProductionOrderItem(
				(String) it.get("descripcion"),
				((Number) it.get("cantidad")).intValue(),
				null,
				(String) it.get("detalle")
		)).toList();

		UUID clientId = (UUID) r.get("cliente_id");
		String clientName = (String) r.get("cliente_nombre");
		ProductionCustomerRef customer = (clientId != null && clientName != null)
				? new ProductionCustomerRef(clientId, clientName)
				: null;

		String estadoStr = (String) r.get("estado");
		OrderStatus status = PanelMapping.ORDER_STATUS.getOrDefault(estadoStr, OrderStatus.DRAFT);
		String tipoProd = (String) r.get("tipo_produccion");
		ProductionMode mode = "TERCERIZADA".equalsIgnoreCase(tipoProd) ? ProductionMode.OUTSOURCED : ProductionMode.OWN;

		LocalDate entrega = r.get("fecha_entrega_solicitada") instanceof java.sql.Date d ? d.toLocalDate() : null;
		LocalDate inicio = r.get("fecha_inicio_produccion") instanceof java.sql.Date d ? d.toLocalDate() : null;
		LocalDate despacho = r.get("fecha_despacho") instanceof java.sql.Date d ? d.toLocalDate() : null;
		OffsetDateTime creado = r.get("creado_en") instanceof java.sql.Timestamp ts
				? ts.toInstant().atOffset(java.time.ZoneOffset.UTC) : OffsetDateTime.now();

		return new ProductionOrder(
				orderId,
				(String) r.get("ref"),
				customer,
				(String) r.get("marca_nombre"),
				null,
				mode,
				status,
				entrega,
				inicio,
				despacho,
				creado,
				items
		);
	}

	private OrderStage mapStage(ResultSet rs) throws SQLException {
		UUID id = rs.getObject("id", UUID.class);
		String etapa = rs.getString("etapa");
		String estado = rs.getString("estado");
		OffsetDateTime inicio = rs.getTimestamp("inicio") == null ? null
				: rs.getTimestamp("inicio").toInstant().atOffset(java.time.ZoneOffset.UTC);
		OffsetDateTime fin = rs.getTimestamp("fin") == null ? null
				: rs.getTimestamp("fin").toInstant().atOffset(java.time.ZoneOffset.UTC);
		UUID responsable = rs.getObject("responsable_id", UUID.class);
		Integer cant = (Integer) rs.getObject("cantidad_procesada");
		Integer merma = (Integer) rs.getObject("merma");
		String obs = rs.getString("observaciones");

		Integer entrada = (Integer) rs.getObject("cantidad_entrada");
		Integer buenas = (Integer) rs.getObject("buenas");
		Integer segundas = (Integer) rs.getObject("segundas");
		Integer reproceso = (Integer) rs.getObject("reproceso");
		String causa = rs.getString("causa_merma");
		BigDecimal consumoReal = rs.getBigDecimal("consumo_real_kg");
		BigDecimal factor = rs.getBigDecimal("factor_consumo_calculado");

		return new OrderStage(id, etapa, estado, inicio, fin, responsable, cant, merma,
				entrada, buenas, segundas, reproceso, causa, consumoReal, factor, obs);
	}

	private void audit(UUID orderId, String operation, String changes) {
		panel.jdbc().update(
				"INSERT INTO keptai.evento_auditoria(organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id) VALUES(keptai.app_organizacion_actual(), ?, 'USUARIO', ?, 'orden_etapa', ?, ?::jsonb, ?)",
				panel.identity().usuarioId(), operation, orderId, changes, MDC.get(RequestIdFilter.MDC_KEY));
	}

}
