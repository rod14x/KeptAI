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
import pe.keptai.backend.contract.N8nDtos.N8nIngestaOrdenRequest;
import pe.keptai.backend.contract.N8nDtos.N8nIngestaOrdenResponse;
import pe.keptai.backend.n8n.N8nIngestaService;
import pe.keptai.backend.security.ServiceIdentity;

/** WF1 -> POST /api/v1/ordenes/ingesta (MIG-05, alcance de esta entrega): orden y hoja BORRADOR desde datos estructurados. */
@RestController
public class N8nIngestaController {

	private final Validator validator;

	private final ObjectProvider<N8nIngestaService> service;

	public N8nIngestaController(Validator validator, ObjectProvider<N8nIngestaService> service) {
		this.validator = validator;
		this.service = service;
	}

	@PostMapping(value = "/api/v1/ordenes/ingesta", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<N8nIngestaOrdenResponse> ingest(@RequestBody String body, Authentication authentication) {
		ServiceIdentity servicio = N8nRequestSupport.ingesta(authentication);
		N8nIngestaOrdenRequest data = N8nRequestSupport.parse(body, N8nIngestaOrdenRequest.class, validator);
		N8nRequestSupport.instancia(servicio, data.instancia());
		N8nIngestaService s = service.getIfAvailable();
		if (s == null) {
			throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "Servicio no disponible");
		}
		N8nIngestaService.Resultado r = s.registrar(servicio, data);
		ResponseEntity.BodyBuilder b = ResponseEntity.status(HttpStatus.CREATED);
		if (r.repetida()) {
			b.header("Idempotency-Replayed", "true");
		}
		return b.body(r.respuesta());
	}

}
