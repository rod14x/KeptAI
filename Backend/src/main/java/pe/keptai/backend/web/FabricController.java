/**
 * FabricController.java
 * Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.web;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.FabricAndScrapDtos.ApproveRequisitionRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.AssignFabricLotRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.CreateFabricRollRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.CreateRequisitionRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.CreateSupplyRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.FabricRequisition;
import pe.keptai.backend.contract.FabricAndScrapDtos.FabricRoll;
import pe.keptai.backend.contract.FabricAndScrapDtos.FabricSemaphoreProposal;
import pe.keptai.backend.contract.FabricAndScrapDtos.OrderFabricLotsSummary;
import pe.keptai.backend.contract.FabricAndScrapDtos.ReceiveRequisitionRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.SupplyItem;
import pe.keptai.backend.panel.FabricService;

/**
 * Controlador de Inventario de Telas, Insumos, Semáforo y Requisiciones de Compra (Fase 3: B-08, B-10).
 */
@RestController
@RequestMapping("/api/v1")
public class FabricController {

	private final FabricService fabricService;

	public FabricController(FabricService fabricService) {
		this.fabricService = fabricService;
	}

	// 1. Inventario de Tela
	@GetMapping("/fabric/rolls")
	public ResponseEntity<List<FabricRoll>> listFabricRolls(
			@RequestParam(required = false, name = "fabric_type") String fabricType,
			@RequestParam(required = false, name = "color") String color) {
		return ResponseEntity.ok(fabricService.listFabricRolls(fabricType, color));
	}

	@PostMapping("/fabric/rolls")
	public ResponseEntity<FabricRoll> createFabricRoll(@Valid @RequestBody CreateFabricRollRequest req) {
		return ResponseEntity.status(HttpStatus.CREATED).body(fabricService.createFabricRoll(req));
	}

	// 2. Semáforo Automático y Asignación de Partidas
	@GetMapping("/orders/{orderId}/fabric-semaphore")
	public ResponseEntity<FabricSemaphoreProposal> getFabricSemaphore(@PathVariable UUID orderId) {
		return ResponseEntity.ok(fabricService.proposeFabricSemaphore(orderId));
	}

	@GetMapping("/orders/{orderId}/fabric-lots")
	public ResponseEntity<OrderFabricLotsSummary> getOrderFabricLots(@PathVariable UUID orderId) {
		return ResponseEntity.ok(fabricService.getOrderFabricLots(orderId));
	}

	@PostMapping("/orders/{orderId}/fabric-lots")
	public ResponseEntity<OrderFabricLotsSummary> assignFabricLot(
			@PathVariable UUID orderId,
			@Valid @RequestBody AssignFabricLotRequest req) {
		return ResponseEntity.ok(fabricService.assignFabricLot(orderId, req));
	}

	// 3. Insumos
	@GetMapping("/supplies")
	public ResponseEntity<List<SupplyItem>> listSupplies(
			@RequestParam(required = false, name = "category") String category) {
		return ResponseEntity.ok(fabricService.listSupplies(category));
	}

	@PostMapping("/supplies")
	public ResponseEntity<SupplyItem> createSupply(@Valid @RequestBody CreateSupplyRequest req) {
		return ResponseEntity.status(HttpStatus.CREATED).body(fabricService.createSupply(req));
	}

	// 4. Requisiciones de Compra de Tela (B-10)
	@GetMapping("/fabric/requisitions")
	public ResponseEntity<List<FabricRequisition>> listRequisitions(
			@RequestParam(required = false, name = "status") String status) {
		return ResponseEntity.ok(fabricService.listRequisitions(status));
	}

	@PostMapping("/fabric/requisitions")
	public ResponseEntity<FabricRequisition> createRequisition(@Valid @RequestBody CreateRequisitionRequest req) {
		return ResponseEntity.status(HttpStatus.CREATED).body(fabricService.createRequisition(req));
	}

	@PostMapping("/fabric/requisitions/{id}/approve")
	public ResponseEntity<FabricRequisition> approveRequisition(
			@PathVariable UUID id,
			@RequestBody(required = false) ApproveRequisitionRequest req) {
		return ResponseEntity.ok(fabricService.approveRequisition(id, req));
	}

	@PostMapping("/fabric/requisitions/{id}/receive")
	public ResponseEntity<FabricRequisition> receiveRequisition(
			@PathVariable UUID id,
			@Valid @RequestBody ReceiveRequisitionRequest req) {
		return ResponseEntity.ok(fabricService.receiveRequisition(id, req));
	}

}
