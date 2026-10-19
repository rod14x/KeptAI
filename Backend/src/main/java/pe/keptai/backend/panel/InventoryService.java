package pe.keptai.backend.panel;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.InventoryDtos.CreateProductRequest;
import pe.keptai.backend.contract.InventoryDtos.CreateVariantRequest;
import pe.keptai.backend.contract.InventoryDtos.InventoryMovementResponse;
import pe.keptai.backend.contract.InventoryDtos.ProductResponse;
import pe.keptai.backend.contract.InventoryDtos.StockMatrixMovementRequest;
import pe.keptai.backend.contract.InventoryDtos.VariantResponse;
import pe.keptai.backend.web.RequestIdFilter;

/**
 * Servicio de inventario, catálogo de productos con variantes, movimientos auditables y reservas atómicas (B-04).
 * Versión: 2.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
@Service
public class InventoryService {

	private final PanelContext panel;

	public InventoryService(PanelContext panel) {
		this.panel = panel;
	}

	public List<ProductResponse> listProducts() {
		return panel.read(() -> {
			var products = panel.jdbc().query("""
					SELECT id, codigo, nombre, prenda_tipo, tela, color, categoria, unidad_medida, activo, creado_en
					FROM keptai.producto
					WHERE organizacion_id = keptai.app_organizacion_actual() AND activo = true
					ORDER BY creado_en DESC
					""", (rs, i) -> mapProduct(rs));

			if (products.isEmpty()) {
				return List.of();
			}

			var variants = panel.jdbc().query("""
					SELECT id, producto_id, talla, sku, stock_actual, stock_minimo
					FROM keptai.producto_variante
					WHERE organizacion_id = keptai.app_organizacion_actual()
					ORDER BY producto_id, talla
					""", (rs, i) -> mapVariant(rs));

			Map<UUID, List<VariantResponse>> variantMap = new LinkedHashMap<>();
			for (VariantResponse v : variants) {
				variantMap.computeIfAbsent(v.productoId(), k -> new ArrayList<>()).add(v);
			}

			return products.stream()
					.map(p -> new ProductResponse(
							p.id(), p.codigo(), p.nombre(), p.prendaTipo(), p.tela(), p.color(),
							p.categoria(), p.unidadMedida(), p.activo(),
							variantMap.getOrDefault(p.id(), List.of()),
							p.creadoEn()))
					.toList();
		});
	}

	public ProductResponse createProduct(CreateProductRequest req) {
		if (req.variantes() == null || req.variantes().isEmpty()) {
			throw PanelException.badRequest("El producto debe tener al menos una variante con talla obligatoria");
		}
		for (CreateVariantRequest v : req.variantes()) {
			if (v.talla() == null || v.talla().isBlank()) {
				throw PanelException.badRequest("La talla es obligatoria en cada variante de producto");
			}
		}

		return panel.write(() -> {
			UUID productId = UUID.randomUUID();
			String categoria = req.categoria() != null && !req.categoria().isBlank() ? req.categoria().trim() : "PRENDA_BASE";
			String unidad = req.unidadMedida() != null && !req.unidadMedida().isBlank() ? req.unidadMedida().trim() : "prendas";

			panel.jdbc().update("""
					INSERT INTO keptai.producto (id, organizacion_id, codigo, nombre, prenda_tipo, tela, color, categoria, unidad_medida)
					VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?)
					""",
					productId, req.codigo().trim(), req.nombre().trim(), req.prendaTipo().trim(),
					req.tela(), req.color(), categoria, unidad);

			List<VariantResponse> createdVariants = new ArrayList<>();
			for (CreateVariantRequest v : req.variantes()) {
				UUID varId = UUID.randomUUID();
				String talla = v.talla().trim().toUpperCase();
				String sku = v.sku() != null && !v.sku().isBlank() ? v.sku().trim() : req.codigo().trim() + "-" + talla;
				int min = v.stockMinimo() != null ? v.stockMinimo() : 0;

				panel.jdbc().update("""
						INSERT INTO keptai.producto_variante (id, organizacion_id, producto_id, talla, sku, stock_actual, stock_minimo)
						VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, 0, ?)
						""",
						varId, productId, talla, sku, min);

				createdVariants.add(new VariantResponse(varId, productId, talla, sku, 0, min));
			}

			audit(productId, "PRODUCTO_CREADO", "{\"codigo\":\"" + req.codigo() + "\",\"variantes\":" + createdVariants.size() + "}");

			return new ProductResponse(
					productId, req.codigo().trim(), req.nombre().trim(), req.prendaTipo().trim(),
					req.tela(), req.color(), categoria, unidad, true, createdVariants, OffsetDateTime.now());
		});
	}

	public List<VariantResponse> registerStockMatrix(UUID productId, StockMatrixMovementRequest req) {
		String tipo = req.tipo() != null ? req.tipo().trim().toUpperCase() : "ENTRADA";
		if (!List.of("ENTRADA", "SALIDA", "AJUSTE").contains(tipo)) {
			throw PanelException.badRequest("Tipo de movimiento inválido. Debe ser ENTRADA, SALIDA o AJUSTE");
		}
		if (req.motivo() == null || req.motivo().isBlank()) {
			throw PanelException.badRequest("El motivo del movimiento de inventario es obligatorio");
		}
		if (req.tallas() == null || req.tallas().isEmpty()) {
			throw PanelException.badRequest("Debe indicar al menos una talla y cantidad en la matriz de stock");
		}

		return panel.write(() -> {
			// Verificar producto existente
			var prodRows = panel.jdbc().queryForList("""
					SELECT id, codigo FROM keptai.producto
					WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
					""", productId);
			if (prodRows.isEmpty()) {
				throw PanelException.notFound("Producto no encontrado");
			}

			UUID userId = panel.identity().usuarioId();

			for (Map.Entry<String, Integer> entry : req.tallas().entrySet()) {
				String talla = entry.getKey().trim().toUpperCase();
				int qty = entry.getValue() != null ? entry.getValue() : 0;
				if (qty <= 0) {
					continue;
				}

				// Obtener o crear variante
				var varRows = panel.jdbc().queryForList("""
						SELECT id, stock_actual, sku FROM keptai.producto_variante
						WHERE producto_id = ? AND talla = ? AND organizacion_id = keptai.app_organizacion_actual()
						FOR UPDATE
						""", productId, talla);

				UUID varId;
				int stockActual = 0;
				if (varRows.isEmpty()) {
					varId = UUID.randomUUID();
					String sku = prodRows.getFirst().get("codigo") + "-" + talla;
					panel.jdbc().update("""
							INSERT INTO keptai.producto_variante (id, organizacion_id, producto_id, talla, sku, stock_actual, stock_minimo)
							VALUES (?, keptai.app_organizacion_actual(), ?, ?, ?, 0, 0)
							""", varId, productId, talla, sku);
				}
				else {
					varId = (UUID) varRows.getFirst().get("id");
					stockActual = ((Number) varRows.getFirst().get("stock_actual")).intValue();
				}

				int nuevoStock;
				int deltaMovimiento;
				if ("ENTRADA".equals(tipo)) {
					nuevoStock = stockActual + qty;
					deltaMovimiento = qty;
				}
				else if ("SALIDA".equals(tipo)) {
					if (stockActual < qty) {
						throw PanelException.badRequest("Stock insuficiente en talla " + talla + ". Disponible: " + stockActual + ", Solicitado: " + qty);
					}
					nuevoStock = stockActual - qty;
					deltaMovimiento = -qty;
				}
				else { // AJUSTE
					nuevoStock = qty;
					deltaMovimiento = qty - stockActual;
				}

				if (deltaMovimiento != 0) {
					// Actualizar stock de variante
					panel.jdbc().update("""
							UPDATE keptai.producto_variante
							SET stock_actual = ?,
							    actualizado_en = now()
							WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
							""", nuevoStock, varId);

					// Registrar en kardex de movimientos
					panel.jdbc().update("""
							INSERT INTO keptai.movimiento_inventario (id, organizacion_id, variante_id, tipo, cantidad, motivo, usuario_id, creado_en)
							VALUES (gen_random_uuid(), keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, now())
							""", varId, tipo, deltaMovimiento, req.motivo().trim(), userId);
				}
			}

			audit(productId, "STOCK_MATRIZ_REGISTRADO", "{\"tipo\":\"" + tipo + "\",\"motivo\":\"" + req.motivo() + "\"}");

			return panel.jdbc().query("""
					SELECT id, producto_id, talla, sku, stock_actual, stock_minimo
					FROM keptai.producto_variante
					WHERE producto_id = ? AND organizacion_id = keptai.app_organizacion_actual()
					ORDER BY talla
					""", (rs, i) -> mapVariant(rs), productId);
		});
	}

	/**
	 * B-04: Reserva atómica de stock al confirmar el pedido.
	 * Stock disponible = stock_actual - stock_reservado.
	 * UPDATE condicionado que falla si no alcanza.
	 */
	public void reserveStockForVariants(Map<UUID, Integer> requiredByVariant) {
		panel.write(() -> {
			for (Map.Entry<UUID, Integer> entry : requiredByVariant.entrySet()) {
				UUID varId = entry.getKey();
				int qty = entry.getValue();
				if (qty <= 0) continue;

				int updated = panel.jdbc().update("""
						UPDATE keptai.producto_variante
						SET stock_reservado = stock_reservado + ?,
						    actualizado_en = now()
						WHERE id = ?
						  AND organizacion_id = keptai.app_organizacion_actual()
						  AND (stock_actual - stock_reservado) >= ?
						""", qty, varId, qty);

				if (updated == 0) {
					var rows = panel.jdbc().queryForList("""
							SELECT talla, stock_actual, stock_reservado FROM keptai.producto_variante
							WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
							""", varId);
					if (rows.isEmpty()) {
						throw PanelException.notFound("Variante de producto no encontrada");
					}
					var r = rows.getFirst();
					int actual = ((Number) r.get("stock_actual")).intValue();
					int reservado = ((Number) r.get("stock_reservado")).intValue();
					int disponible = actual - reservado;
					String talla = (String) r.get("talla");
					throw PanelException.conflict("Stock insuficiente para reservar talla " + talla +
							": disponible " + disponible + " (físico " + actual + " - reservado " + reservado + "), solicitado " + qty);
				}
			}
			return null;
		});
	}

	/**
	 * B-04: Liberar reserva si el pedido se anula o cancela.
	 */
	public void releaseStockReservation(Map<UUID, Integer> reservedByVariant) {
		panel.write(() -> {
			for (Map.Entry<UUID, Integer> entry : reservedByVariant.entrySet()) {
				UUID varId = entry.getKey();
				int qty = entry.getValue();
				if (qty <= 0) continue;

				panel.jdbc().update("""
						UPDATE keptai.producto_variante
						SET stock_reservado = GREATEST(0, stock_reservado - ?),
						    actualizado_en = now()
						WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
						""", qty, varId);
			}
			return null;
		});
	}

	/**
	 * B-04: Descuento físico al dar salida a taller (descuenta físico y libera reserva).
	 */
	public void dispatchReservedStock(Map<UUID, Integer> dispatchedByVariant, UUID userId, String orderRef) {
		panel.write(() -> {
			for (Map.Entry<UUID, Integer> entry : dispatchedByVariant.entrySet()) {
				UUID varId = entry.getKey();
				int qty = entry.getValue();
				if (qty <= 0) continue;

				panel.jdbc().update("""
						UPDATE keptai.producto_variante
						SET stock_actual = stock_actual - ?,
						    stock_reservado = GREATEST(0, stock_reservado - ?),
						    actualizado_en = now()
						WHERE id = ? AND organizacion_id = keptai.app_organizacion_actual()
						""", qty, qty, varId);

				panel.jdbc().update("""
						INSERT INTO keptai.movimiento_inventario (
						    id, organizacion_id, variante_id, tipo, cantidad, motivo, usuario_id, creado_en
						) VALUES (
						    gen_random_uuid(), keptai.app_organizacion_actual(), ?, 'SALIDA', ?, ?, ?, now()
						)
						""", varId, -qty, "Salida a taller - Orden " + orderRef, userId);
			}
			return null;
		});
	}

	public List<InventoryMovementResponse> listMovements(UUID productId) {
		return panel.read(() -> panel.jdbc().query("""
				SELECT m.id, m.variante_id, v.talla, m.tipo, m.cantidad, m.motivo, m.usuario_id, m.creado_en
				FROM keptai.movimiento_inventario m
				JOIN keptai.producto_variante v ON v.id = m.variante_id AND v.organizacion_id = m.organizacion_id
				WHERE v.producto_id = ? AND m.organizacion_id = keptai.app_organizacion_actual()
				ORDER BY m.creado_en DESC
				LIMIT 100
				""", (rs, i) -> new InventoryMovementResponse(
				rs.getObject("id", UUID.class),
				rs.getObject("variante_id", UUID.class),
				rs.getString("talla"),
				rs.getString("tipo"),
				rs.getInt("cantidad"),
				rs.getString("motivo"),
				rs.getObject("usuario_id", UUID.class),
				rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC)
		), productId));
	}

	private ProductResponse mapProduct(ResultSet rs) throws SQLException {
		return new ProductResponse(
				rs.getObject("id", UUID.class),
				rs.getString("codigo"),
				rs.getString("nombre"),
				rs.getString("prenda_tipo"),
				rs.getString("tela"),
				rs.getString("color"),
				rs.getString("categoria"),
				rs.getString("unidad_medida"),
				rs.getBoolean("activo"),
				List.of(),
				rs.getTimestamp("creado_en").toInstant().atOffset(java.time.ZoneOffset.UTC)
		);
	}

	private VariantResponse mapVariant(ResultSet rs) throws SQLException {
		return new VariantResponse(
				rs.getObject("id", UUID.class),
				rs.getObject("producto_id", UUID.class),
				rs.getString("talla"),
				rs.getString("sku"),
				rs.getInt("stock_actual"),
				rs.getInt("stock_minimo")
		);
	}

	private void audit(UUID id, String operation, String changes) {
		panel.jdbc().update("""
				INSERT INTO keptai.evento_auditoria(organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id)
				VALUES(keptai.app_organizacion_actual(), ?, 'USUARIO', ?, 'inventario', ?, ?::jsonb, ?)
				""",
				panel.identity().usuarioId(), operation, id, changes, MDC.get(RequestIdFilter.MDC_KEY));
	}

}
