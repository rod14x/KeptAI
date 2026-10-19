package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.ContractJson;
import pe.keptai.backend.contract.TechSheetDtos.TechSheet;
import pe.keptai.backend.contract.TechSheetDtos.UpdateTechSheetRequest;
import pe.keptai.backend.contract.TechSheetDtos.ValidateFabricRequest;
import pe.keptai.backend.web.RequestIdFilter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Servicio de Ficha Técnica, cálculo de consumo textil y validación de telas por taller (Fase 3).
 * Actualizado con protecciones de inmutabilidad tras entrega (Defecto 2) y validación de curva de tallas (Defecto 3).
 * Versión: 1.1 | Fecha: 2026-10-19 | Autora: Isabelita
 */
@Service
public class TechSheetService {

	private final PanelContext panel;

	private final JsonMapper json = ContractJson.newMapper();

	public TechSheetService(PanelContext panel) {
		this.panel = panel;
	}

	public TechSheet getTechSheet(UUID orderId) {
		return panel.read(() -> {
			var rows = panel.jdbc().query("""
					SELECT id, orden_id, estado, modalidad, semaforo_tela, consumo_estimado_kg, validacion_tela,
					       tela_validada_por, prenda_tipo, tela_nombre, gramaje, color_principal, color_contraste,
					       tipo_cuello, curva_tallas, tecnica_personalizacion, ubicaciones_arte, instrucciones_costura,
					       completada_por, completada_en, creado_en, actualizado_en
					FROM keptai.ficha_tecnica
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", (rs, i) -> mapTechSheet(rs), orderId);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Ficha técnica no encontrada para la orden " + orderId);
			}
			return rows.getFirst();
		});
	}

	public TechSheet updateTechSheet(UUID orderId, UpdateTechSheetRequest req) {
		return panel.write(() -> {
			// Defecto 2: Verificar si la orden ya está ENTREGADA / DESPACHADA
			var orderRows = panel.jdbc().queryForList("""
					SELECT estado FROM keptai.orden
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", orderId);
			if (orderRows.isEmpty()) {
				throw PanelException.notFound("Orden no encontrada");
			}
			String orderEstado = (String) orderRows.getFirst().get("estado");
			if ("DESPACHADA".equals(orderEstado) || "CERRADA".equals(orderEstado) || "ENTREGADO".equalsIgnoreCase(orderEstado)) {
				throw PanelException.conflict("Ficha cerrada — pedido entregado");
			}

			var currentRows = panel.jdbc().queryForList("""
					SELECT id, estado, modalidad, semaforo_tela, validacion_tela, consumo_estimado_kg, prenda_tipo,
					       tela_nombre, color_principal, curva_tallas
					FROM keptai.ficha_tecnica
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					FOR UPDATE
					""", orderId);
			if (currentRows.isEmpty()) {
				throw PanelException.notFound("Ficha técnica no encontrada para la orden");
			}
			Map<String, Object> cur = currentRows.getFirst();
			UUID id = (UUID) cur.get("id");

			String modalidad = req.modality() != null ? req.modality().trim() : (String) cur.get("modalidad");
			if (!"CONFECCION_ROLLO".equalsIgnoreCase(modalidad)) {
				modalidad = "STOCK_BORDADO";
			}

			String semaforo = req.fabricSemaphore() != null ? req.fabricSemaphore().trim() : (String) cur.get("semaforo_tela");
			if (semaforo == null || semaforo.isBlank()) {
				semaforo = "HABITUAL_VERDE";
			}

			String validacion = (String) cur.get("validacion_tela");
			if ("STOCK_BORDADO".equals(modalidad)) {
				validacion = "NO_APLICA";
			}
			else if ("HABITUAL_VERDE".equals(semaforo)) {
				if (validacion == null || "PENDIENTE_TALLER".equals(validacion)) {
					validacion = "NO_APLICA";
				}
			}
			else if ("POR_CONFIRMAR_AMARILLO".equals(semaforo) || "ESPECIAL_ROJO".equals(semaforo)) {
				if (validacion == null || "NO_APLICA".equals(validacion)) {
					validacion = "PENDIENTE_TALLER";
				}
			}

			String prendaTipo = req.garmentType() != null ? req.garmentType().trim() : (String) cur.get("prenda_tipo");
			String telaNombre = req.fabricName() != null ? req.fabricName().trim() : (String) cur.get("tela_nombre");
			String colorPrincipal = req.primaryColor() != null ? req.primaryColor().trim() : (String) cur.get("color_principal");

			// Defecto 3: Curva de tallas, estimador de consumo (0.28 kg/prenda) y validación estricta de suma
			Object curvaObj = req.sizeCurve() != null ? req.sizeCurve() : cur.get("curva_tallas");
			int totalCurvaPrendas = calculateTotalGarments(curvaObj);

			Integer totalItems = panel.jdbc().queryForObject(
					"SELECT coalesce(sum(cantidad), 0) FROM keptai.orden_item WHERE orden_id = ?",
					Integer.class, orderId);
			int itemsRequeridos = totalItems != null ? totalItems : 0;

			BigDecimal consumo = req.estimatedConsumptionKg();
			if (consumo == null || consumo.compareTo(BigDecimal.ZERO) <= 0) {
				int prendasBase = totalCurvaPrendas > 0 ? totalCurvaPrendas : itemsRequeridos;
				consumo = BigDecimal.valueOf(prendasBase * 0.28).setScale(2, RoundingMode.HALF_UP);
			}

			boolean datosBasicos = prendaTipo != null && !prendaTipo.isBlank()
					&& colorPrincipal != null && !colorPrincipal.isBlank();
			if ("CONFECCION_ROLLO".equals(modalidad)) {
				datosBasicos = datosBasicos && telaNombre != null && !telaNombre.isBlank();
			}

			boolean semaforoOk = "STOCK_BORDADO".equals(modalidad)
					|| "HABITUAL_VERDE".equals(semaforo)
					|| "CONFIRMADA_TALLER".equals(validacion);

			boolean intentandoCompletar = datosBasicos && semaforoOk;
			if (intentandoCompletar && itemsRequeridos > 0 && totalCurvaPrendas != itemsRequeridos) {
				int diff = totalCurvaPrendas - itemsRequeridos;
				String diffStr = (diff > 0 ? "+" : "") + diff + " prenda" + (Math.abs(diff) == 1 ? "" : "s");
				throw PanelException.badRequest("La suma de la curva de tallas (" + totalCurvaPrendas
						+ " prendas) no coincide con el total del pedido (" + itemsRequeridos
						+ " prendas). Diferencia: " + diffStr);
			}

			boolean completo = intentandoCompletar && (itemsRequeridos == 0 || totalCurvaPrendas == itemsRequeridos);
			String nuevoEstado = completo ? "COMPLETA" : "BORRADOR";
			UUID completadaPor = completo ? panel.identity().usuarioId() : null;

			String curvaJson = null;
			if (req.sizeCurve() != null) {
				curvaJson = json.writeValueAsString(req.sizeCurve());
			}
			String arteJson = null;
			if (req.artPlacements() != null) {
				arteJson = json.writeValueAsString(req.artPlacements());
			}

			panel.jdbc().update("""
					UPDATE keptai.ficha_tecnica
					SET modalidad = ?,
					    semaforo_tela = ?,
					    consumo_estimado_kg = ?,
					    validacion_tela = ?,
					    prenda_tipo = coalesce(?, prenda_tipo),
					    tela_nombre = coalesce(?, tela_nombre),
					    gramaje = coalesce(?, gramaje),
					    color_principal = coalesce(?, color_principal),
					    color_contraste = coalesce(?, color_contraste),
					    tipo_cuello = coalesce(?, tipo_cuello),
					    curva_tallas = coalesce(?::jsonb, curva_tallas),
					    tecnica_personalizacion = coalesce(?, tecnica_personalizacion),
					    ubicaciones_arte = coalesce(?::jsonb, ubicaciones_arte),
					    instrucciones_costura = coalesce(?, instrucciones_costura),
					    estado = ?,
					    completada_por = case when ? = 'COMPLETA' then coalesce(completada_por, ?) else null end,
					    completada_en = case when ? = 'COMPLETA' then coalesce(completada_en, now()) else null end,
					    actualizado_en = now()
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""",
					modalidad, semaforo, consumo, validacion,
					prendaTipo, telaNombre, req.weight(), colorPrincipal, req.contrastColor(), req.collarType(),
					curvaJson, req.customizationTechnique(), arteJson, req.sewingInstructions(),
					nuevoEstado, nuevoEstado, completadaPor, nuevoEstado, id);

			audit(id, "FICHA_TECNICA_ACTUALIZADA", "{\"estado\":\"" + nuevoEstado + "\",\"consumo_kg\":" + consumo + "}");
			return getTechSheet(orderId);
		});
	}

	public TechSheet validateFabric(UUID orderId, ValidateFabricRequest req) {
		String decision = req.decision() != null ? req.decision().trim().toUpperCase() : "";
		if (!"CONFIRMADA_TALLER".equals(decision) && !"COMPRA_REQUERIDA".equals(decision)) {
			throw PanelException.badRequest("La decisión de tela debe ser CONFIRMADA_TALLER o COMPRA_REQUERIDA");
		}

		return panel.write(() -> {
			var rows = panel.jdbc().queryForList("""
					SELECT id, estado, prenda_tipo, tela_nombre, color_principal, semaforo_tela, modalidad, curva_tallas
					FROM keptai.ficha_tecnica
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					FOR UPDATE
					""", orderId);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Ficha técnica no encontrada");
			}
			Map<String, Object> ft = rows.getFirst();
			UUID id = (UUID) ft.get("id");

			boolean completo = false;
			if ("CONFIRMADA_TALLER".equals(decision)) {
				String prendaTipo = (String) ft.get("prenda_tipo");
				String telaNombre = (String) ft.get("tela_nombre");
				String colorPrincipal = (String) ft.get("color_principal");
				boolean datosCompletos = prendaTipo != null && !prendaTipo.isBlank()
						&& telaNombre != null && !telaNombre.isBlank()
						&& colorPrincipal != null && !colorPrincipal.isBlank();

				int totalCurva = calculateTotalGarments(ft.get("curva_tallas"));
				Integer totalItems = panel.jdbc().queryForObject(
						"SELECT coalesce(sum(cantidad), 0) FROM keptai.orden_item WHERE orden_id = ?",
						Integer.class, orderId);
				int itemsReq = totalItems != null ? totalItems : 0;
				completo = datosCompletos && (itemsReq == 0 || totalCurva == itemsReq);
			}

			String nuevoEstado = completo ? "COMPLETA" : (String) ft.get("estado");

			panel.jdbc().update("""
					UPDATE keptai.ficha_tecnica
					SET validacion_tela = ?,
					    tela_validada_por = ?,
					    estado = ?,
					    completada_por = case when ? = 'COMPLETA' then coalesce(completada_por, ?) else completada_por end,
					    completada_en = case when ? = 'COMPLETA' then coalesce(completada_en, now()) else completada_en end,
					    actualizado_en = now()
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""",
					decision, panel.identity().usuarioId(), nuevoEstado, nuevoEstado, panel.identity().usuarioId(), nuevoEstado, id);

			audit(id, "TELA_VALIDADA", "{\"decision\":\"" + decision + "\",\"estado\":\"" + nuevoEstado + "\"}");
			return getTechSheet(orderId);
		});
	}

	private int calculateTotalGarments(Object curveObj) {
		if (curveObj == null) {
			return 0;
		}
		try {
			JsonNode node = curveObj instanceof JsonNode jn ? jn : json.valueToTree(curveObj);
			if (node.isTextual()) {
				node = json.readTree(node.asString());
			}
			if (node.isObject()) {
				int sum = 0;
				for (var entry : node.properties()) {
					sum += entry.getValue().asInt(0);
				}
				return sum;
			}
			else if (node.isArray()) {
				int sum = 0;
				for (JsonNode item : node) {
					sum += item.path("cantidad").asInt(item.path("quantity").asInt(0));
				}
				return sum;
			}
		}
		catch (Exception ignored) {
		}
		return 0;
	}

	private TechSheet mapTechSheet(ResultSet rs) throws SQLException {
		UUID id = rs.getObject("id", UUID.class);
		UUID ordenId = rs.getObject("orden_id", UUID.class);
		String estado = rs.getString("estado");
		String modalidad = rs.getString("modalidad");
		String semaforo = rs.getString("semaforo_tela");
		BigDecimal consumo = rs.getBigDecimal("consumo_estimado_kg");
		String validacion = rs.getString("validacion_tela");
		UUID validadaPor = rs.getObject("tela_validada_por", UUID.class);
		String prendaTipo = rs.getString("prenda_tipo");
		String tela = rs.getString("tela_nombre");
		String gramaje = rs.getString("gramaje");
		String colorPrincipal = rs.getString("color_principal");
		String colorContraste = rs.getString("color_contraste");
		String cuello = rs.getString("tipo_cuello");

		Object curva = null;
		String curvaRaw = rs.getString("curva_tallas");
		if (curvaRaw != null) {
			try {
				curva = json.readTree(curvaRaw);
			}
			catch (Exception ignored) {
			}
		}

		String tecnica = rs.getString("tecnica_personalizacion");
		Object arte = null;
		String arteRaw = rs.getString("ubicaciones_arte");
		if (arteRaw != null) {
			try {
				arte = json.readTree(arteRaw);
			}
			catch (Exception ignored) {
			}
		}

		String instrucciones = rs.getString("instrucciones_costura");
		UUID completadaPor = rs.getObject("completada_por", UUID.class);
		OffsetDateTime completadaEn = rs.getTimestamp("completada_en") == null ? null
				: rs.getTimestamp("completada_en").toInstant().atOffset(java.time.ZoneOffset.UTC);
		OffsetDateTime creadoEn = rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC);
		OffsetDateTime actualizadoEn = rs.getTimestamp("actualizado_en").toInstant().atOffset(java.time.ZoneOffset.UTC);

		return new TechSheet(id, ordenId, estado, modalidad, semaforo, consumo, validacion, validadaPor,
				prendaTipo, tela, gramaje, colorPrincipal, colorContraste, cuello, curva, tecnica, arte,
				instrucciones, completadaPor, completadaEn, creadoEn, actualizadoEn);
	}

	private void audit(UUID id, String operation, String changes) {
		panel.jdbc().update("""
				INSERT INTO keptai.evento_auditoria(organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id)
				VALUES(keptai.app_organizacion_actual(), ?, 'USUARIO', ?, 'ficha_tecnica', ?, ?::jsonb, ?)
				""",
				panel.identity().usuarioId(), operation, id, changes, MDC.get(RequestIdFilter.MDC_KEY));
	}

}
