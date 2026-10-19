/**
 * FabricService.java
 * Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.FabricAndScrapDtos.ApproveRequisitionRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.AssignFabricLotRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.CreateFabricRollRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.CreateRequisitionRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.CreateSupplyRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.FabricRequisition;
import pe.keptai.backend.contract.FabricAndScrapDtos.FabricRoll;
import pe.keptai.backend.contract.FabricAndScrapDtos.FabricSemaphoreProposal;
import pe.keptai.backend.contract.FabricAndScrapDtos.OrderFabricAssignment;
import pe.keptai.backend.contract.FabricAndScrapDtos.OrderFabricLotsSummary;
import pe.keptai.backend.contract.FabricAndScrapDtos.ReceiveRequisitionRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.SupplyItem;

/**
 * Servicio de Inventario de Tela, Insumos, Semáforo Automático y Requisición de Compras (Fase 3: B-08, B-10).
 */
@Service
public class FabricService {

	private final PanelContext panel;

	public FabricService(PanelContext panel) {
		this.panel = panel;
	}

	// ------------------------------------------------------------------------
	// 1. Inventario de Tela
	// ------------------------------------------------------------------------

	public List<FabricRoll> listFabricRolls(String fabricType, String color) {
		return panel.read(() -> {
			StringBuilder sql = new StringBuilder("""
					SELECT id, codigo_rollo, tela_tipo, color, gramaje_gsm, partida_tenido,
					       peso_actual_kg, peso_reservado_kg,
					       (peso_actual_kg - peso_reservado_kg) AS peso_disponible_kg,
					       ubicacion, activo, creado_en
					FROM keptai.inventario_tela
					WHERE organizacion_id = keptai.app_organizacion_actual() AND activo = true
					""");
			List<Object> params = new ArrayList<>();
			if (fabricType != null && !fabricType.isBlank()) {
				sql.append(" AND tela_tipo ILIKE ?");
				params.add("%" + fabricType.trim() + "%");
			}
			if (color != null && !color.isBlank()) {
				sql.append(" AND color ILIKE ?");
				params.add("%" + color.trim() + "%");
			}
			sql.append(" ORDER BY creado_en DESC");

			return panel.jdbc().query(sql.toString(), (rs, i) -> mapFabricRoll(rs), params.toArray());
		});
	}

	public FabricRoll createFabricRoll(CreateFabricRollRequest req) {
		return panel.write(() -> {
			UUID id = UUID.randomUUID();
			String rollCode = (req.rollCode() != null && !req.rollCode().isBlank())
					? req.rollCode().trim()
					: "ROL-" + System.currentTimeMillis() % 100000;

			panel.jdbc().update("""
					INSERT INTO keptai.inventario_tela (
					    id, organizacion_id, codigo_rollo, tela_tipo, color, gramaje_gsm,
					    partida_tenido, peso_actual_kg, peso_reservado_kg, ubicacion, activo
					) VALUES (
					    ?, keptai.app_organizacion_actual(), ?, ?, ?, ?,
					    ?, ?, 0, ?, true
					)
					""", id, rollCode, req.fabricType().trim(), req.color().trim(),
					req.gsm(), req.dyeLot().trim(), req.weightKg(), req.location());

			return getFabricRollById(id);
		});
	}

	public FabricRoll getFabricRollById(UUID id) {
		return panel.read(() -> {
			var rows = panel.jdbc().query("""
					SELECT id, codigo_rollo, tela_tipo, color, gramaje_gsm, partida_tenido,
					       peso_actual_kg, peso_reservado_kg,
					       (peso_actual_kg - peso_reservado_kg) AS peso_disponible_kg,
					       ubicacion, activo, creado_en
					FROM keptai.inventario_tela
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", (rs, i) -> mapFabricRoll(rs), id);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Rollo de tela no encontrado");
			}
			return rows.getFirst();
		});
	}

	// ------------------------------------------------------------------------
	// 2. Semáforo Automático de Tela y Control de Mezcla de Partidas
	// ------------------------------------------------------------------------

	public FabricSemaphoreProposal proposeFabricSemaphore(UUID orderId) {
		return panel.read(() -> {
			// Leer ficha técnica de la orden
			var ftRows = panel.jdbc().queryForList("""
					SELECT prenda_tipo, tela_nombre, color_principal, consumo_estimado_kg
					FROM keptai.ficha_tecnica
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", orderId);

			String telaNombre = ftRows.isEmpty() ? null : (String) ftRows.getFirst().get("tela_nombre");
			String color = ftRows.isEmpty() ? null : (String) ftRows.getFirst().get("color_principal");
			BigDecimal consumoKg = ftRows.isEmpty() ? null : (BigDecimal) ftRows.getFirst().get("consumo_estimado_kg");

			if (consumoKg == null || consumoKg.compareTo(BigDecimal.ZERO) <= 0) {
				Integer totalPrendas = panel.jdbc().queryForObject(
						"SELECT coalesce(sum(cantidad), 0) FROM keptai.orden_item WHERE orden_id = ?",
						Integer.class, orderId);
				int qty = totalPrendas != null ? totalPrendas : 0;
				consumoKg = BigDecimal.valueOf(qty * 0.28).setScale(3, RoundingMode.HALF_UP);
			}

			// Buscar stock disponible para telaNombre y color
			BigDecimal disponibleKg = BigDecimal.ZERO;
			List<String> partidasDisponibles = new ArrayList<>();
			if (telaNombre != null && color != null) {
				var rollRows = panel.jdbc().queryForList("""
						SELECT partida_tenido, sum(peso_actual_kg - peso_reservado_kg) AS disp
						FROM keptai.inventario_tela
						WHERE organizacion_id = keptai.app_organizacion_actual()
						  AND activo = true
						  AND tela_tipo ILIKE ?
						  AND color ILIKE ?
						GROUP BY partida_tenido
						HAVING sum(peso_actual_kg - peso_reservado_kg) > 0
						""", "%" + telaNombre.trim() + "%", "%" + color.trim() + "%");

				for (var r : rollRows) {
					partidasDisponibles.add((String) r.get("partida_tenido"));
					BigDecimal d = (BigDecimal) r.get("disp");
					if (d != null) {
						disponibleKg = disponibleKg.add(d);
					}
				}
			}

			String semaforo;
			String mensaje;
			if (disponibleKg.compareTo(consumoKg) >= 0) {
				semaforo = "HABITUAL_VERDE";
				mensaje = "Stock de tela suficiente en almacén (" + disponibleKg + " kg disponibles vs " + consumoKg + " kg requeridos)";
			}
			else if (disponibleKg.compareTo(BigDecimal.ZERO) > 0) {
				semaforo = "POR_CONFIRMAR_AMARILLO";
				mensaje = "Stock parcial (" + disponibleKg + " kg disponibles de " + consumoKg + " kg requeridos). Se sugiere requisición de compra";
			}
			else {
				semaforo = "ESPECIAL_ROJO";
				mensaje = "Sin stock de tela (" + consumoKg + " kg requeridos). Compra requerida urgente";
			}

			// Verificar si ya tiene partidas asignadas que se mezclan
			var assignedLots = panel.jdbc().queryForList("""
					SELECT DISTINCT partida_tenido
					FROM keptai.orden_partida_tela
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", orderId);

			boolean mixWarning = assignedLots.size() > 1;

			return new FabricSemaphoreProposal(
					orderId, telaNombre, color, consumoKg, disponibleKg,
					semaforo, partidasDisponibles, mixWarning, mensaje);
		});
	}

	public OrderFabricLotsSummary assignFabricLot(UUID orderId, AssignFabricLotRequest req) {
		return panel.write(() -> {
			// 1. Validar existencia y stock atómico del rollo
			var roll = getFabricRollById(req.fabricRollId());
			BigDecimal disponible = roll.availableWeightKg();
			if (disponible.compareTo(req.assignedKg()) < 0) {
				throw PanelException.badRequest("INSUFFICIENT_FABRIC_STOCK: El rollo " + roll.rollCode()
						+ " solo tiene " + disponible + " kg disponibles (se solicitaron " + req.assignedKg() + " kg)");
			}

			int updated = panel.jdbc().update("""
					UPDATE keptai.inventario_tela
					SET peso_reservado_kg = peso_reservado_kg + ?,
					    actualizado_en = now()
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					  AND (peso_actual_kg - peso_reservado_kg) >= ?
					""", req.assignedKg(), req.fabricRollId(), req.assignedKg());

			if (updated == 0) {
				throw PanelException.badRequest("INSUFFICIENT_FABRIC_STOCK: Conflicto concurrente al reservar tela del rollo");
			}

			// 2. Registrar asignación
			panel.jdbc().update("""
					INSERT INTO keptai.orden_partida_tela (
					    id, organizacion_id, orden_id, inventario_tela_id, partida_tenido, kg_asignados
					) VALUES (
					    gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?
					)
					""", orderId, req.fabricRollId(), roll.dyeLot(), req.assignedKg());

			return getOrderFabricLots(orderId);
		});
	}

	public OrderFabricLotsSummary getOrderFabricLots(UUID orderId) {
		return panel.read(() -> {
			var rows = panel.jdbc().query("""
					SELECT opt.id, opt.orden_id, opt.inventario_tela_id, opt.partida_tenido,
					       opt.kg_asignados, opt.asignado_en,
					       it.codigo_rollo, it.tela_tipo, it.color
					FROM keptai.orden_partida_tela opt
					JOIN keptai.inventario_tela it ON it.id = opt.inventario_tela_id AND it.organizacion_id = opt.organizacion_id
					WHERE opt.orden_id = ? AND opt.organizacion_id = keptai.app_organizacion_actual()
					ORDER BY opt.asignado_en ASC
					""", (rs, i) -> new OrderFabricAssignment(
					rs.getObject("id", UUID.class),
					rs.getObject("orden_id", UUID.class),
					rs.getObject("inventario_tela_id", UUID.class),
					rs.getString("codigo_rollo"),
					rs.getString("tela_tipo"),
					rs.getString("color"),
					rs.getString("partida_tenido"),
					rs.getBigDecimal("kg_asignados"),
					rs.getTimestamp("asignado_en").toInstant().atOffset(java.time.ZoneOffset.UTC)
			), orderId);

			List<String> distinctLots = rows.stream().map(OrderFabricAssignment::dyeLot).distinct().toList();
			boolean mixWarning = distinctLots.size() > 1;
			BigDecimal totalAssigned = rows.stream()
					.map(OrderFabricAssignment::assignedKg)
					.reduce(BigDecimal.ZERO, BigDecimal::add);

			return new OrderFabricLotsSummary(orderId, rows, mixWarning, distinctLots, totalAssigned);
		});
	}

	// ------------------------------------------------------------------------
	// 3. Insumos de Producción
	// ------------------------------------------------------------------------

	public List<SupplyItem> listSupplies(String category) {
		return panel.read(() -> {
			StringBuilder sql = new StringBuilder("""
					SELECT id, codigo, nombre, categoria, unidad_medida, stock_actual, stock_minimo
					FROM keptai.inventario_insumo
					WHERE organizacion_id = keptai.app_organizacion_actual()
					""");
			List<Object> params = new ArrayList<>();
			if (category != null && !category.isBlank()) {
				sql.append(" AND categoria = ?");
				params.add(category.trim().toUpperCase());
			}
			sql.append(" ORDER BY nombre ASC");

			return panel.jdbc().query(sql.toString(), (rs, i) -> new SupplyItem(
					rs.getObject("id", UUID.class),
					rs.getString("codigo"),
					rs.getString("nombre"),
					rs.getString("categoria"),
					rs.getString("unidad_medida"),
					rs.getBigDecimal("stock_actual"),
					rs.getBigDecimal("stock_minimo")
			), params.toArray());
		});
	}

	public SupplyItem createSupply(CreateSupplyRequest req) {
		return panel.write(() -> {
			UUID id = UUID.randomUUID();
			BigDecimal initial = req.initialStock() != null ? req.initialStock() : BigDecimal.ZERO;
			BigDecimal min = req.minimumStock() != null ? req.minimumStock() : BigDecimal.ZERO;

			panel.jdbc().update("""
					INSERT INTO keptai.inventario_insumo (
					    id, organizacion_id, codigo, nombre, categoria, unidad_medida, stock_actual, stock_minimo
					) VALUES (
					    ?, keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?
					)
					""", id, req.code().trim().toUpperCase(), req.name().trim(),
					req.category().trim().toUpperCase(), req.unitOfMeasure().trim(), initial, min);

			return new SupplyItem(id, req.code().trim().toUpperCase(), req.name().trim(),
					req.category().trim().toUpperCase(), req.unitOfMeasure().trim(), initial, min);
		});
	}

	// ------------------------------------------------------------------------
	// 4. Requisición de Compra de Tela (B-10)
	// ------------------------------------------------------------------------

	public FabricRequisition createRequisition(CreateRequisitionRequest req) {
		return panel.write(() -> {
			UUID id = UUID.randomUUID();
			BigDecimal merma = req.scrapPercentage() != null ? req.scrapPercentage() : BigDecimal.valueOf(5.0);
			// kg_requeridos = consumo * (1 + merma/100)
			BigDecimal factorMerma = BigDecimal.ONE.add(merma.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
			BigDecimal kgFinal = req.requiredKg().multiply(factorMerma).setScale(3, RoundingMode.HALF_UP);

			panel.jdbc().update("""
					INSERT INTO keptai.requisicion_compra_tela (
					    id, organizacion_id, orden_id, tela_tipo, color, gramaje_gsm,
					    kg_requeridos, porcentaje_merma, fecha_requerida, estado,
					    solicitado_por, notas
					) VALUES (
					    ?, keptai.app_organizacion_actual(), ?, ?, ?, ?,
					    ?, ?, ?, 'BORRADOR',
					    ?, ?
					)
					""", id, req.orderId(), req.fabricType().trim(), req.color().trim(),
					req.gsm(), kgFinal, merma, req.requiredDate(),
					panel.identity().usuarioId(), req.notes());

			return getRequisitionById(id);
		});
	}

	public List<FabricRequisition> listRequisitions(String status) {
		return panel.read(() -> {
			StringBuilder sql = new StringBuilder("""
					SELECT id, orden_id, tela_tipo, color, gramaje_gsm, kg_requeridos,
					       porcentaje_merma, fecha_requerida, estado, solicitado_por,
					       aprobado_por, aprobado_en, partida_ingresada, kg_recibidos,
					       recibido_en, notas, creado_en
					FROM keptai.requisicion_compra_tela
					WHERE organizacion_id = keptai.app_organizacion_actual()
					""");
			List<Object> params = new ArrayList<>();
			if (status != null && !status.isBlank()) {
				sql.append(" AND estado = ?");
				params.add(status.trim().toUpperCase());
			}
			sql.append(" ORDER BY creado_en DESC");

			return panel.jdbc().query(sql.toString(), (rs, i) -> mapRequisition(rs), params.toArray());
		});
	}

	public FabricRequisition getRequisitionById(UUID id) {
		return panel.read(() -> {
			var rows = panel.jdbc().query("""
					SELECT id, orden_id, tela_tipo, color, gramaje_gsm, kg_requeridos,
					       porcentaje_merma, fecha_requerida, estado, solicitado_por,
					       aprobado_por, aprobado_en, partida_ingresada, kg_recibidos,
					       recibido_en, notas, creado_en
					FROM keptai.requisicion_compra_tela
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", (rs, i) -> mapRequisition(rs), id);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Requisición de compra no encontrada");
			}
			return rows.getFirst();
		});
	}

	public FabricRequisition approveRequisition(UUID id, ApproveRequisitionRequest req) {
		return panel.write(() -> {
			var reqCur = getRequisitionById(id);
			if (!"BORRADOR".equals(reqCur.status())) {
				throw PanelException.badRequest("Solo se pueden aprobar requisiciones en estado BORRADOR. Estado actual: " + reqCur.status());
			}

			panel.jdbc().update("""
					UPDATE keptai.requisicion_compra_tela
					SET estado = 'APROBADA',
					    aprobado_por = ?,
					    aprobado_en = now(),
					    notas = coalesce(?, notas),
					    actualizado_en = now()
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", panel.identity().usuarioId(), req != null ? req.notes() : null, id);

			return getRequisitionById(id);
		});
	}

	public FabricRequisition receiveRequisition(UUID id, ReceiveRequisitionRequest req) {
		return panel.write(() -> {
			var reqCur = getRequisitionById(id);
			if (!"APROBADA".equals(reqCur.status())) {
				throw PanelException.badRequest("Solo se pueden recibir requisiciones en estado APROBADA. Estado actual: " + reqCur.status());
			}

			// 1. Registrar recepción
			panel.jdbc().update("""
					UPDATE keptai.requisicion_compra_tela
					SET estado = 'RECIBIDA',
					    partida_ingresada = ?,
					    kg_recibidos = ?,
					    recibido_en = now(),
					    notas = coalesce(?, notas),
					    actualizado_en = now()
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", req.dyeLot().trim(), req.receivedKg(), req.notes(), id);

			// 2. Ingresar la tela con su partida al inventario de tela
			String rollCode = (req.rollCode() != null && !req.rollCode().isBlank())
					? req.rollCode().trim()
					: "ROL-REC-" + System.currentTimeMillis() % 100000;

			panel.jdbc().update("""
					INSERT INTO keptai.inventario_tela (
					    id, organizacion_id, codigo_rollo, tela_tipo, color, gramaje_gsm,
					    partida_tenido, peso_actual_kg, peso_reservado_kg, ubicacion, activo
					) VALUES (
					    gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?,
					    ?, ?, 0, ?, true
					)
					""", rollCode, reqCur.fabricType(), reqCur.color(),
					reqCur.gsm(), req.dyeLot().trim(), req.receivedKg(), req.location());

			return getRequisitionById(id);
		});
	}

	// ------------------------------------------------------------------------
	// Mappers
	// ------------------------------------------------------------------------

	private FabricRoll mapFabricRoll(ResultSet rs) throws SQLException {
		return new FabricRoll(
				rs.getObject("id", UUID.class),
				rs.getString("codigo_rollo"),
				rs.getString("tela_tipo"),
				rs.getString("color"),
				(Integer) rs.getObject("gramaje_gsm"),
				rs.getString("partida_tenido"),
				rs.getBigDecimal("peso_actual_kg"),
				rs.getBigDecimal("peso_reservado_kg"),
				rs.getBigDecimal("peso_disponible_kg"),
				rs.getString("ubicacion"),
				rs.getBoolean("activo"),
				rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC)
		);
	}

	private FabricRequisition mapRequisition(ResultSet rs) throws SQLException {
		return new FabricRequisition(
				rs.getObject("id", UUID.class),
				rs.getObject("orden_id", UUID.class),
				rs.getString("tela_tipo"),
				rs.getString("color"),
				(Integer) rs.getObject("gramaje_gsm"),
				rs.getBigDecimal("kg_requeridos"),
				rs.getBigDecimal("porcentaje_merma"),
				rs.getDate("fecha_requerida").toLocalDate(),
				rs.getString("estado"),
				rs.getObject("solicitado_por", UUID.class),
				rs.getObject("aprobado_por", UUID.class),
				rs.getTimestamp("aprobado_en") != null
						? rs.getTimestamp("aprobado_en").toInstant().atOffset(java.time.ZoneOffset.UTC) : null,
				rs.getString("partida_ingresada"),
				rs.getBigDecimal("kg_recibidos"),
				rs.getTimestamp("recibido_en") != null
						? rs.getTimestamp("recibido_en").toInstant().atOffset(java.time.ZoneOffset.UTC) : null,
				rs.getString("notas"),
				rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC)
		);
	}
}
