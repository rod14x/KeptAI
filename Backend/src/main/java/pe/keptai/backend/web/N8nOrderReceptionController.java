package pe.keptai.backend.web;

import jakarta.validation.Validator;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.annotation.JsonProperty;
import pe.keptai.backend.contract.ContractJson;
import pe.keptai.backend.contract.N8nDtos.N8nIngestaOrdenRequest;
import pe.keptai.backend.security.AccessRole;
import pe.keptai.backend.security.ServiceAuthentication;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** Recepción y validación únicamente: no guarda el cuerpo ni crea un pedido. */
@RestController
public class N8nOrderReceptionController {
    private static final JsonMapper JSON = ContractJson.newMapper();
    private final Validator validator;

    public N8nOrderReceptionController(Validator validator) {
        this.validator = validator;
    }

    @PostMapping(value = "/api/v1/ordenes/ingesta", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public Receipt receive(@RequestBody String body, Authentication authentication) {
        if (!(authentication instanceof ServiceAuthentication service)
                || service.identity().alcance() != AccessRole.INGESTA) {
            throw new org.springframework.security.access.AccessDeniedException("Servicio no autorizado");
        }
        N8nIngestaOrdenRequest data;
        try {
            data = JSON.readValue(body, N8nIngestaOrdenRequest.class);
        } catch (JacksonException ex) {
            // No conservar la causa: puede contener fragmentos del transcript o credenciales.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        if (data == null || !validator.validate(data).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        if (!service.identity().instancia().equals(data.instancia())) {
            throw new org.springframework.security.access.AccessDeniedException("Instancia no autorizada");
        }
        return new Receipt("VALIDADO_SIN_PERSISTIR", false, false, MDC.get(RequestIdFilter.MDC_KEY));
    }

    public record Receipt(String estado, boolean persistido, boolean procesado,
            @JsonProperty("request_id") String requestId) {}
}
