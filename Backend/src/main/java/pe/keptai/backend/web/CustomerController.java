package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.uuid;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.CustomerDtos.Contact;
import pe.keptai.backend.contract.CustomerDtos.CreateContactRequest;
import pe.keptai.backend.contract.CustomerDtos.CreateCustomerRequest;
import pe.keptai.backend.contract.CustomerDtos.Customer;
import pe.keptai.backend.contract.CustomerDtos.CustomerHistoryEntry;
import pe.keptai.backend.contract.CustomerDtos.MergeCustomerRequest;
import pe.keptai.backend.contract.CustomerDtos.ReassignPortfolioRequest;
import pe.keptai.backend.contract.CustomerDtos.UpdateCustomerRequest;
import pe.keptai.backend.panel.CustomerService;
import pe.keptai.backend.panel.PageRequest;
import pe.keptai.backend.panel.PanelRequests;

/** Endpoints de directorio, edición, cartera y contactos comerciales (Fase 1 y Fase 4: B-01, B-02). */
@RestController
public class CustomerController {

	private final CustomerService customerService;

	private final PanelRequests requests;

	public CustomerController(CustomerService customerService, PanelRequests requests) {
		this.customerService = customerService;
		this.requests = requests;
	}

	@GetMapping("/api/v1/customers")
	public PageResponse<Customer> list(
			@RequestParam(required = false) Integer limit,
			@RequestParam(required = false) String cursor,
			@RequestParam(required = false) String query) {
		return customerService.list(PageRequest.of(limit, cursor), query);
	}

	@GetMapping("/api/v1/customers/{id}")
	public Customer get(@PathVariable("id") String id) {
		return customerService.getCustomer(uuid(id, "customer_id"));
	}

	@PostMapping(value = "/api/v1/customers", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Customer create(@RequestBody String body) {
		CreateCustomerRequest req = requests.body(body, CreateCustomerRequest.class);
		return customerService.createCustomer(req);
	}

	@PutMapping(value = "/api/v1/customers/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Customer update(@PathVariable("id") String id, @RequestBody String body) {
		UpdateCustomerRequest req = requests.body(body, UpdateCustomerRequest.class);
		return customerService.updateCustomer(uuid(id, "customer_id"), req);
	}

	@PostMapping(value = "/api/v1/customers/{id}/reassign-portfolio", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Customer reassignPortfolio(@PathVariable("id") String id, @RequestBody String body) {
		ReassignPortfolioRequest req = requests.body(body, ReassignPortfolioRequest.class);
		return customerService.reassignPortfolio(uuid(id, "customer_id"), req);
	}

	@PostMapping(value = "/api/v1/customers/{id}/merge", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Customer merge(@PathVariable("id") String id, @RequestBody String body) {
		MergeCustomerRequest req = requests.body(body, MergeCustomerRequest.class);
		return customerService.mergeCustomers(uuid(id, "customer_id"), req);
	}

	@GetMapping("/api/v1/customers/{id}/history")
	public List<CustomerHistoryEntry> getHistory(@PathVariable("id") String id) {
		return customerService.getCustomerHistory(uuid(id, "customer_id"));
	}

	@PostMapping(value = "/api/v1/customers/{id}/contacts", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Contact createContact(@PathVariable("id") String customerId, @RequestBody String body) {
		CreateContactRequest req = requests.body(body, CreateContactRequest.class);
		return customerService.createContact(uuid(customerId, "customer_id"), req);
	}

}
