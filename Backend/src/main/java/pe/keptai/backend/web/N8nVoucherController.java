package pe.keptai.backend.web;

import jakarta.validation.Validator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.N8nDtos.N8nPagoVoucherRequest;
import pe.keptai.backend.contract.N8nDtos.N8nPagoVoucherResponse;
import pe.keptai.backend.n8n.N8nVoucherService;
import pe.keptai.backend.security.ServiceIdentity;

/** WF2 -> POST /api/v1/pagos/voucher: pago RECIBIDO con comprobante privado; JSON con imagen_base64 (nunca multipart). */
@RestController
public class N8nVoucherController {

	private final Validator validator;

	private final ObjectProvider<N8nVoucherService> service;

	public N8nVoucherController(Validator validator, ObjectProvider<N8nVoucherService> service) {
		this.validator = validator;
		this.service = service;
	}

	@PostMapping(value = "/api/v1/pagos/voucher", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<N8nPagoVoucherResponse> voucher(@RequestBody String body, Authentication authentication) {
		ServiceIdentity servicio = N8nRequestSupport.ingesta(authentication);
		N8nPagoVoucherRequest data = N8nRequestSupport.parse(body, N8nPagoVoucherRequest.class, validator);
		N8nRequestSupport.instancia(servicio, data.instancia());
		N8nVoucherService s = service.getIfAvailable();
		if (s == null) {
			throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "Servicio no disponible");
		}
		N8nVoucherService.Resultado r = s.registrar(servicio, data);
		ResponseEntity.BodyBuilder b = ResponseEntity.status(r.estado());
		if (r.repetida()) {
			b.header("Idempotency-Replayed", "true");
		}
		return b.body(r.respuesta());
	}

}
