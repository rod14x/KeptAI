/**
 * Corpotex KeptAI - Servicio de Artes de Diseño y Curva de Personal (B-03, B-06)
 * Versión: v1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import pe.keptai.backend.contract.ArtAndCurveDtos.ApproveArtRequest;
import pe.keptai.backend.contract.ArtAndCurveDtos.ArtPiece;
import pe.keptai.backend.contract.ArtAndCurveDtos.ArtStatus;
import pe.keptai.backend.contract.ArtAndCurveDtos.ArtTechnique;
import pe.keptai.backend.contract.ArtAndCurveDtos.CreateArtRequest;
import pe.keptai.backend.contract.ArtAndCurveDtos.ImportPersonnelRequest;
import pe.keptai.backend.contract.ArtAndCurveDtos.ImportPersonnelResult;
import pe.keptai.backend.contract.ArtAndCurveDtos.PersonnelEntry;

@Service
public class ArtService {

	private final PanelContext panel;

	public ArtService(PanelContext panel) {
		this.panel = panel;
	}

	public List<ArtPiece> listOrderArts(UUID orderId) {
		return panel.read(() -> {
			String sql = """
					SELECT id, orden_id, tecnica, ubicacion, ancho_cm, alto_cm, colores_hilos, puntadas,
					       archivo_storage_path, estado, version_actual, aprobado_por, aprobado_en,
					       aprobacion_canal, aprobacion_evidencia_url, creado_por, creado_en, actualizado_en
					FROM keptai.arte_pedido
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					ORDER BY creado_en ASC
					""";
			return panel.jdbc().query(sql, (rs, i) -> mapArt(rs), orderId);
		});
	}

	public ArtPiece createArt(UUID orderId, CreateArtRequest req) {
		return panel.write(() -> {
			if (req.technique() == null) {
				throw PanelException.badRequest("La técnica de arte es obligatoria (SUBLIMADO, BORDADO, etc.)");
			}
			if (req.location() == null || req.location().isBlank()) {
				throw PanelException.badRequest("La ubicación del arte es obligatoria");
			}

			UUID id = UUID.randomUUID();
			UUID userId = panel.identity().usuarioId();

			String sql = """
					INSERT INTO keptai.arte_pedido (
					    id, organizacion_id, orden_id, tecnica, ubicacion, ancho_cm, alto_cm,
					    colores_hilos, puntadas, archivo_storage_path, estado, version_actual,
					    creado_por, creado_en, actualizado_en
					) VALUES (
					    ?, keptai.app_organizacion_actual(), ?, ?, ?, ?, ?,
					    ?, ?, ?, 'BORRADOR', 1,
					    ?, now(), now()
					)
					""";

			panel.jdbc().update(sql,
					id,
					orderId,
					req.technique().name(),
					req.location().trim(),
					req.widthCm(),
					req.heightCm(),
					req.colorsOrThreads(),
					req.stitches(),
					req.storagePath(),
					userId);

			return getArtById(id);
		});
	}

	public ArtPiece approveArt(UUID orderId, UUID artId, ApproveArtRequest req) {
		return panel.write(() -> {
			var rows = panel.jdbc().queryForList("""
					SELECT estado, version_actual FROM keptai.arte_pedido
					WHERE id = ? AND orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					FOR UPDATE
					""", artId, orderId);

			if (rows.isEmpty()) {
				throw PanelException.notFound("Arte no encontrado para la orden " + orderId);
			}

			String estadoActual = (String) rows.getFirst().get("estado");
			if ("APROBADO".equals(estadoActual)) {
				throw PanelException.conflict("El arte ya se encuentra en estado APROBADO e inmutable");
			}

			UUID userId = panel.identity().usuarioId();
			String canal = req.channel() != null ? req.channel().trim() : "WhatsApp";
			String evidencia = req.evidenceUrl();

			String sql = """
					UPDATE keptai.arte_pedido
					SET estado = 'APROBADO',
					    aprobado_por = ?,
					    aprobado_en = now(),
					    aprobacion_canal = ?,
					    aprobacion_evidencia_url = ?,
					    actualizado_en = now()
					WHERE id = ? AND orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""";

			panel.jdbc().update(sql, userId, canal, evidencia, artId, orderId);
			return getArtById(artId);
		});
	}

	public ImportPersonnelResult importPersonnel(UUID orderId, ImportPersonnelRequest req) {
		return panel.write(() -> {
			if (req.entries() == null || req.entries().isEmpty()) {
				throw PanelException.badRequest("La relación de personal no puede estar vacía");
			}

			// Limpiar relación anterior si existe
			panel.jdbc().update("""
					DELETE FROM keptai.relacion_personal_pedido
					WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", orderId);

			Map<String, Integer> tallasConteo = new HashMap<>();
			int totalPrendas = 0;

			for (PersonnelEntry entry : req.entries()) {
				if (entry.size() == null || entry.size().isBlank()) {
					throw PanelException.badRequest("Cada registro de personal debe tener una talla obligatoria");
				}
				String talla = entry.size().trim().toUpperCase();
				int cant = entry.quantity() != null && entry.quantity() > 0 ? entry.quantity() : 1;

				tallasConteo.put(talla, tallasConteo.getOrDefault(talla, 0) + cant);
				totalPrendas += cant;

				panel.jdbc().update("""
						INSERT INTO keptai.relacion_personal_pedido (
						    id, organizacion_id, orden_id, nombre_completo, talla, cantidad,
						    nombre_bordar, area_departamento, observaciones, creado_en
						) VALUES (
						    gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?,
						    ?, ?, ?, now()
						)
						""",
						orderId,
						entry.fullName() != null ? entry.fullName().trim() : null,
						talla,
						cant,
						entry.embroideryName() != null ? entry.embroideryName().trim() : null,
						entry.department() != null ? entry.department().trim() : null,
						entry.notes() != null ? entry.notes().trim() : null);
			}

			// Actualizar estado de curva en orden
			String estadoCurva = req.closeCurve() ? "CERRADA" : "PENDIENTE";
			panel.jdbc().update("""
					UPDATE keptai.orden
					SET curva_estado = ?,
					    actualizado_en = now()
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", estadoCurva, orderId);

			return new ImportPersonnelResult(req.entries().size(), totalPrendas, tallasConteo, estadoCurva);
		});
	}

	public void validateOrderGatesForRelease(UUID orderId) {
		var orderRows = panel.jdbc().queryForList("""
				SELECT curva_estado FROM keptai.orden
				WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
				""", orderId);
		if (orderRows.isEmpty()) {
			throw PanelException.notFound("Orden no encontrada");
		}

		String curvaEstado = (String) orderRows.getFirst().get("curva_estado");
		if (!"CERRADA".equalsIgnoreCase(curvaEstado)) {
			throw PanelException.conflict("Bloqueo de producción: el pedido no puede liberarse sin curva de tallas CERRADA");
		}

		Integer pendientes = panel.jdbc().queryForObject("""
				SELECT count(*) FROM keptai.arte_pedido
				WHERE orden_id = ? AND organizacion_id = keptai.app_organizacion_actual()
				  AND estado <> 'APROBADO'
				""", Integer.class, orderId);

		if (pendientes != null && pendientes > 0) {
			throw PanelException.conflict("Bloqueo de producción: el pedido tiene " + pendientes + " arte(s) sin aprobación del cliente");
		}
	}

	private ArtPiece getArtById(UUID artId) {
		String sql = """
				SELECT id, orden_id, tecnica, ubicacion, ancho_cm, alto_cm, colores_hilos, puntadas,
				       archivo_storage_path, estado, version_actual, aprobado_por, aprobado_en,
				       aprobacion_canal, aprobacion_evidencia_url, creado_por, creado_en, actualizado_en
				FROM keptai.arte_pedido
				WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
				""";
		return panel.jdbc().queryForObject(sql, (rs, i) -> mapArt(rs), artId);
	}

	private ArtPiece mapArt(ResultSet rs) throws SQLException {
		return new ArtPiece(
				rs.getObject("id", UUID.class),
				rs.getObject("orden_id", UUID.class),
				ArtTechnique.valueOf(rs.getString("tecnica")),
				rs.getString("ubicacion"),
				rs.getBigDecimal("ancho_cm"),
				rs.getBigDecimal("alto_cm"),
				rs.getString("colores_hilos"),
				rs.getObject("puntadas") != null ? rs.getInt("puntadas") : null,
				rs.getString("archivo_storage_path"),
				ArtStatus.valueOf(rs.getString("estado")),
				rs.getInt("version_actual"),
				rs.getObject("aprobado_por", UUID.class),
				toInstant(rs.getTimestamp("aprobado_en")),
				rs.getString("aprobacion_canal"),
				rs.getString("aprobacion_evidencia_url"),
				rs.getObject("creado_por", UUID.class),
				toInstant(rs.getTimestamp("creado_en")),
				toInstant(rs.getTimestamp("actualizado_en"))
		);
	}

	private Instant toInstant(Timestamp ts) {
		return ts != null ? ts.toInstant() : null;
	}

}
