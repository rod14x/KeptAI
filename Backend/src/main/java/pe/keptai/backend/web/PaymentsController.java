package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.uuid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.PaymentDtos.ApplyPaymentRequest;
import pe.keptai.backend.contract.PaymentDtos.Payment;
import pe.keptai.backend.contract.PaymentDtos.PaymentApplicationResult;
import pe.keptai.backend.contract.PaymentDtos.ReconciliationResult;
import pe.keptai.backend.contract.PaymentDtos.RegisterVerificationRequest;
import pe.keptai.backend.panel.PageRequest;
import pe.keptai.backend.panel.PanelQueries;
import pe.keptai.backend.panel.PanelRequests;
import pe.keptai.backend.panel.PaymentCommands;

/** Pagos: lectura, candidatos de conciliación, verificación de fondos y aplicación (MotorPagos). */
@RestController
public class PaymentsController {

	private final PanelQueries queries;

	private final PanelRequests requests;

	private final PaymentCommands commands;

	public PaymentsController(PanelQueries queries, PanelRequests requests, PaymentCommands commands) {
		this.queries = queries;
		this.requests = requests;
		this.commands = commands;
	}

	@GetMapping("/api/v1/payments")
	public PageResponse<Payment> list(@RequestParam(required = false) Integer limit,
			@RequestParam(required = false) String cursor, @RequestParam(required = false) String phase,
			@RequestParam(name = "reconciliation_status", required = false) String reconciliationStatus) {
		return queries.payments(PageRequest.of(limit, cursor), phase, reconciliationStatus);
	}

	@GetMapping("/api/v1/payments/{payment_id}")
	public Payment get(@PathVariable("payment_id") String paymentId) {
		return queries.payment(uuid(paymentId, "payment_id"));
	}

	@GetMapping("/api/v1/payments/{payment_id}/reconciliation")
	public ReconciliationResult reconciliation(@PathVariable("payment_id") String paymentId) {
		return queries.reconciliation(uuid(paymentId, "payment_id"));
	}

	@PostMapping(value = "/api/v1/payments/{payment_id}/verifications", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Payment verify(@PathVariable("payment_id") String paymentId, @RequestBody String body) {
		requests.body(body, RegisterVerificationRequest.class);
		return commands.verify(uuid(paymentId, "payment_id"));
	}

	@PostMapping(value = "/api/v1/payments/{payment_id}/applications", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	public PaymentApplicationResult apply(@PathVariable("payment_id") String paymentId, @RequestBody String body) {
		return commands.apply(uuid(paymentId, "payment_id"), requests.body(body, ApplyPaymentRequest.class));
	}

}
