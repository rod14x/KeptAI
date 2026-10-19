package pe.keptai.backend.web;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.InventoryDtos.CreateProductRequest;
import pe.keptai.backend.contract.InventoryDtos.InventoryMovementResponse;
import pe.keptai.backend.contract.InventoryDtos.ProductResponse;
import pe.keptai.backend.contract.InventoryDtos.StockMatrixMovementRequest;
import pe.keptai.backend.contract.InventoryDtos.VariantResponse;
import pe.keptai.backend.panel.InventoryService;

/**
 * Controlador REST para el inventario textil: alta de productos, variantes y kárdex (Defecto 1).
 * Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {

	private final InventoryService service;

	public InventoryController(InventoryService service) {
		this.service = service;
	}

	@GetMapping("/products")
	public List<ProductResponse> listProducts() {
		return service.listProducts();
	}

	@PostMapping("/products")
	@ResponseStatus(HttpStatus.CREATED)
	public ProductResponse createProduct(@Valid @RequestBody CreateProductRequest req) {
		return service.createProduct(req);
	}

	@PostMapping("/products/{productId}/stock-matrix")
	public List<VariantResponse> registerStockMatrix(
			@PathVariable("productId") UUID productId,
			@Valid @RequestBody StockMatrixMovementRequest req) {
		return service.registerStockMatrix(productId, req);
	}

	@GetMapping("/products/{productId}/movements")
	public List<InventoryMovementResponse> listMovements(@PathVariable("productId") UUID productId) {
		return service.listMovements(productId);
	}

}
