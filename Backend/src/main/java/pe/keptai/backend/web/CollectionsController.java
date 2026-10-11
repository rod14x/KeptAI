package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.optionalUuid;
import static pe.keptai.backend.panel.PanelRequests.uuid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.AuditDtos.AuditEvent;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.ReceivableDtos.CollectionAlert;
import pe.keptai.backend.contract.ReceivableDtos.CustomerStatement;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;
import pe.keptai.backend.panel.PageRequest;
import pe.keptai.backend.panel.PanelQueries;

/** Cuentas por cobrar, alertas internas, estado de cuenta del cliente y auditoría (solo lectura). */
@RestController
public class CollectionsController {

	private final PanelQueries queries;

	public CollectionsController(PanelQueries queries) {
		this.queries = queries;
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
