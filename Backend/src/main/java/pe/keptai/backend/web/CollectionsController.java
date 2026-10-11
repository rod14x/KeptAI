package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.optionalUuid;
import static pe.keptai.backend.panel.PanelRequests.uuid;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.AuditDtos.AuditEvent;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.ReceivableDtos.CollectionAlert;
import pe.keptai.backend.contract.ReceivableDtos.CustomerStatement;
import pe.keptai.backend.contract.ReceivableDtos.Notification;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;
import pe.keptai.backend.contract.ReceivableDtos.ResolveAlertRequest;
import pe.keptai.backend.panel.AlertCommands;
import pe.keptai.backend.panel.PageRequest;
import pe.keptai.backend.panel.PanelQueries;
import pe.keptai.backend.panel.PanelRequests;

/** Cuentas por cobrar, alertas internas, envíos de cobranza, estado de cuenta del cliente y auditoría. */
@RestController
public class CollectionsController {

	private final PanelQueries queries;

	private final PanelRequests requests;

	private final AlertCommands alerts;

	public CollectionsController(PanelQueries queries, PanelRequests requests, AlertCommands alerts) {
		this.queries = queries;
		this.requests = requests;
		this.alerts = alerts;
	}

	@GetMapping("/api/v1/receivables")
	public PageResponse<Receivable> receivables(@RequestParam(required = false) Integer limit,
			@RequestParam(required = false) String cursor,
			@RequestParam(name = "customer_id", required = false) String customerId,
			@RequestParam(name = "due_bucket", required = false) String dueBucket) {
		return queries.receivables(PageRequest.of(limit, cursor), optionalUuid(customerId, "customer_id"), dueBucket);
	}

	@GetMapping("/api/v1/receivables/{receivable_id}")
	public Receivable receivable(@PathVariable("receivable_id") String receivableId) {
		return queries.receivable(uuid(receivableId, "receivable_id"));
	}

	@GetMapping("/api/v1/collection-alerts")
	public PageResponse<CollectionAlert> alerts(@RequestParam(required = false) Integer limit,
			@RequestParam(required = false) String cursor, @RequestParam(required = false) String status) {
		return queries.alerts(PageRequest.of(limit, cursor), status);
	}

	/** resolveCollectionAlert (INT-FE-API-002). */
	@PostMapping(value = "/api/v1/collection-alerts/{alert_id}/resolution", consumes = MediaType.APPLICATION_JSON_VALUE)
	public CollectionAlert resolveAlert(@PathVariable("alert_id") String alertId, @RequestBody String body) {
		ResolveAlertRequest req = requests.body(body, ResolveAlertRequest.class);
		return alerts.resolve(uuid(alertId, "alert_id"), req.note());
	}

	/** listNotifications (INT-FE-API-002): bitácora de envíos de WF3, solo metadatos. */
	@GetMapping("/api/v1/notifications")
	public PageResponse<Notification> notifications(@RequestParam(required = false) Integer limit,
			@RequestParam(required = false) String cursor,
			@RequestParam(name = "order_id", required = false) String orderId,
			@RequestParam(name = "customer_id", required = false) String customerId) {
		return queries.notifications(PageRequest.of(limit, cursor), optionalUuid(orderId, "order_id"),
				optionalUuid(customerId, "customer_id"));
	}

	@GetMapping("/api/v1/customers/{customer_id}/statement")
	public CustomerStatement statement(@PathVariable("customer_id") String customerId) {
		return queries.statement(uuid(customerId, "customer_id"));
	}

	@GetMapping("/api/v1/audit-events")
	public PageResponse<AuditEvent> audit(@RequestParam(required = false) Integer limit,
			@RequestParam(required = false) String cursor,
			@RequestParam(name = "entity_id", required = false) String entityId) {
		return queries.audit(PageRequest.of(limit, cursor), optionalUuid(entityId, "entity_id"));
	}

}
