package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.optionalUuid;
import static pe.keptai.backend.panel.PanelRequests.uuid;

import java.util.Set;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.OrderDtos.DispatchRequest;
import pe.keptai.backend.contract.OrderDtos.Order;
import pe.keptai.backend.contract.ReceivableDtos.CreditAuthorization;
import pe.keptai.backend.contract.ReceivableDtos.CreditDecisionRequest;
import pe.keptai.backend.panel.CreditDecisionService;
import pe.keptai.backend.panel.PageRequest;
import pe.keptai.backend.panel.PanelQueries;
import pe.keptai.backend.panel.PanelRequests;
import pe.keptai.backend.panel.PaymentCommands;

/** Pedidos, decisión de crédito y despacho (listOrders, getOrder, get/submitCreditDecision, registerDispatch). */
@RestController
public class OrdersController {

	private final PanelQueries queries;

	private final PanelRequests requests;

	private final CreditDecisionService credit;

	private final PaymentCommands commands;

	public OrdersController(PanelQueries queries, PanelRequests requests, CreditDecisionService credit,
			PaymentCommands commands) {
		this.queries = queries;
		this.requests = requests;
		this.credit = credit;
		this.commands = commands;
	}

	@GetMapping("/api/v1/orders")
	public PageResponse<Order> list(@RequestParam(required = false) Integer limit,
			@RequestParam(required = false) String cursor,
			@RequestParam(name = "customer_id", required = false) String customerId,
			@RequestParam(required = false) String status,
			@RequestParam(name = "receivable_status", required = false) String receivableStatus) {
		return queries.orders(PageRequest.of(limit, cursor), optionalUuid(customerId, "customer_id"), status,
				receivableStatus);
	}

	@GetMapping("/api/v1/orders/{order_id}")
	public Order get(@PathVariable("order_id") String orderId) {
		return queries.order(uuid(orderId, "order_id"));
	}

	@GetMapping("/api/v1/orders/{order_id}/credit-decision")
	public CreditAuthorization creditDecision(@PathVariable("order_id") String orderId) {
		return queries.creditDecision(uuid(orderId, "order_id"));
	}

	@PostMapping(value = "/api/v1/orders/{order_id}/credit-decision", consumes = MediaType.APPLICATION_JSON_VALUE)
	public CreditAuthorization submitCreditDecision(@PathVariable("order_id") String orderId, @RequestBody String body) {
		CreditDecisionRequest req = requests.body(body, CreditDecisionRequest.class,
				Set.of(CreditDecisionService.TERM_RULE_PROPERTY));
		return credit.decide(uuid(orderId, "order_id"), req);
	}

	@PostMapping(value = "/api/v1/orders/{order_id}/dispatch", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Order dispatch(@PathVariable("order_id") String orderId, @RequestBody String body) {
		return commands.dispatch(uuid(orderId, "order_id"), requests.body(body, DispatchRequest.class));
	}

}
