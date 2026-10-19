package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

/**
 * DTOs para el catálogo de productos, variantes por talla y movimientos de inventario (Defecto 1).
 * Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
public final class InventoryDtos {

	private InventoryDtos() {
	}

	public record ProductResponse(
			UUID id,
			String codigo,
			String nombre,
			String prendaTipo,
			String tela,
			String color,
			String categoria,
			String unidadMedida,
			boolean activo,
			List<VariantResponse> variantes,
			OffsetDateTime creadoEn
	) {
	}

	public record VariantResponse(
			UUID id,
			UUID productoId,
			String talla,
			String sku,
			int stockActual,
			int stockMinimo
	) {
	}

	public record CreateProductRequest(
			@NotBlank String codigo,
			@NotBlank String nombre,
			@NotBlank String prendaTipo,
			String tela,
			String color,
			String categoria,
			String unidadMedida,
			@NotEmpty List<CreateVariantRequest> variantes
	) {
	}

	public record CreateVariantRequest(
			@NotBlank String talla,
			String sku,
			Integer stockMinimo
	) {
	}

	public record StockMatrixMovementRequest(
			@NotBlank String tipo,
			@NotBlank String motivo,
			@NotEmpty Map<String, Integer> tallas
	) {
	}

	public record InventoryMovementResponse(
			UUID id,
			UUID varianteId,
			String talla,
			String tipo,
			int cantidad,
			String motivo,
			UUID usuarioId,
			OffsetDateTime creadoEn
	) {
	}

}
