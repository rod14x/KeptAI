package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.uuid;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.ManufacturingDtos.OrderStage;
import pe.keptai.backend.contract.ManufacturingDtos.StationAdvanceRequest;
import pe.keptai.backend.contract.ManufacturingDtos.StationAdvanceResponse;
import pe.keptai.backend.panel.ManufacturingService;
import pe.keptai.backend.panel.PanelRequests;

/** Endpoints de avance de estaciones de fabricación en Taller (Fase 4). */
@RestController
public class ManufacturingController {

	private final ManufacturingService manufacturingService;

	private final PanelRequests requests;

	public ManufacturingController(ManufacturingService manufacturingService, PanelRequests requests) {
		this.manufacturingService = manufacturingService;
		this.requests = requests;
	}

	@PostMapping(value = "/api/v1/orders/{id}/station-advance", consumes = MediaType.APPLICATION_JSON_VALUE)
	public StationAdvanceResponse advanceStation(@PathVariable("id") String orderId, @RequestBody String body) {
		StationAdvanceRequest req = requests.body(body, StationAdvanceRequest.class);
		return manufacturingService.advanceStation(uuid(orderId, "order_id"), req);
	}

	@GetMapping("/api/v1/orders/{id}/stages")
	public List<OrderStage> getStages(@PathVariable("id") String orderId) {
		return manufacturingService.getOrderStages(uuid(orderId, "order_id"));
	}

}
