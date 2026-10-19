package pe.keptai.backend.panel;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.ManufacturingDtos.OrderStage;
import pe.keptai.backend.contract.ManufacturingDtos.StationAdvanceRequest;
import pe.keptai.backend.contract.ManufacturingDtos.StationAdvanceResponse;
import pe.keptai.backend.web.RequestIdFilter;

/** Servicio de taller y avance de estaciones de fabricación (Fase 4). */
@Service
public class ManufacturingService {

	private static final Set<String> VALID_STAGES = Set.of("CORTE", "SUBLIMADO_BORDADO", "CONFECCION", "CALIDAD");

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

			// 5. Upsert de la etapa en orden_etapa
			if (currentStageRows.isEmpty()) {
				panel.jdbc().update("""
						INSERT INTO keptai.orden_etapa (
						    id, organizacion_id, orden_id, etapa, estado, responsable_id,
						    cantidad_procesada, merma, inicio, fin, observaciones
						) VALUES (
						    gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?,
						    ?, ?, case when ? = 'EN_CURSO' then now() else null end,
						    case when ? = 'TERMINADA' then now() else null end, ?
						)
						""", orderId, stage, targetStatus, panel.identity().usuarioId(),
						req.quantityProcessed(), req.scrap(), targetStatus, targetStatus, req.notes());
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
						    observaciones = coalesce(?, observaciones)
						WHERE orden_id = ? AND etapa = ? AND organizacion_id = keptai.app_organizacion_actual()
						""", targetStatus, panel.identity().usuarioId(),
						req.quantityProcessed(), req.scrap(), targetStatus, targetStatus, req.notes(),
						orderId, stage);
			}

			// Auditar avance
			audit(orderId, "ESTACION_AVANZADA",
					"{\"etapa\":\"" + stage + "\",\"estado\":\"" + targetStatus + "\"}");

			// Listar todas las etapas actualizadas de la orden
			var stages = panel.jdbc().query("""
					SELECT id, etapa, estado, inicio, fin, responsable_id, cantidad_procesada, merma, observaciones
					FROM keptai.orden_etapa
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					ORDER BY CASE etapa
					    WHEN 'CORTE' THEN 1
					    WHEN 'SUBLIMADO_BORDADO' THEN 2
					    WHEN 'CONFECCION' THEN 3
					    WHEN 'CALIDAD' THEN 4
					    ELSE 5 END
					""", (rs, i) -> mapStage(rs), orderId);

			return new StationAdvanceResponse(orderId, orderEstado, stages);
		});
	}

	public List<OrderStage> getOrderStages(UUID orderId) {
		return panel.read(() -> panel.jdbc().query("""
				SELECT id, etapa, estado, inicio, fin, responsable_id, cantidad_procesada, merma, observaciones
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
		return new OrderStage(id, etapa, estado, inicio, fin, responsable, cant, merma, obs);
	}

	private void audit(UUID orderId, String operation, String changes) {
		panel.jdbc().update(
				"INSERT INTO keptai.evento_auditoria(organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id) VALUES(keptai.app_organizacion_actual(), ?, 'USUARIO', ?, 'orden_etapa', ?, ?::jsonb, ?)",
				panel.identity().usuarioId(), operation, orderId, changes, MDC.get(RequestIdFilter.MDC_KEY));
	}

}
