package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.uuid;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.TechSheetDtos.TechSheet;
import pe.keptai.backend.contract.TechSheetDtos.UpdateTechSheetRequest;
import pe.keptai.backend.contract.TechSheetDtos.ValidateFabricRequest;
import pe.keptai.backend.panel.PanelRequests;
import pe.keptai.backend.panel.TechSheetService;

/** Endpoints de Ficha Técnica y validación de telas por taller (Fase 3). */
@RestController
public class TechSheetController {

	private final TechSheetService techSheetService;

	private final PanelRequests requests;

	public TechSheetController(TechSheetService techSheetService, PanelRequests requests) {
		this.techSheetService = techSheetService;
		this.requests = requests;
	}

	@GetMapping("/api/v1/orders/{id}/tech-sheet")
	public TechSheet get(@PathVariable("id") String orderId) {
		return techSheetService.getTechSheet(uuid(orderId, "order_id"));
	}

	@PutMapping(value = "/api/v1/orders/{id}/tech-sheet", consumes = MediaType.APPLICATION_JSON_VALUE)
	public TechSheet update(@PathVariable("id") String orderId, @RequestBody String body) {
		UpdateTechSheetRequest req = requests.body(body, UpdateTechSheetRequest.class);
		return techSheetService.updateTechSheet(uuid(orderId, "order_id"), req);
	}

	@PostMapping(value = "/api/v1/orders/{id}/tech-sheet/validate-fabric", consumes = MediaType.APPLICATION_JSON_VALUE)
	public TechSheet validateFabric(@PathVariable("id") String orderId, @RequestBody String body) {
		ValidateFabricRequest req = requests.body(body, ValidateFabricRequest.class);
		return techSheetService.validateFabric(uuid(orderId, "order_id"), req);
	}

}
