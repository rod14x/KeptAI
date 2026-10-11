package pe.keptai.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class N8nOrderReceptionTests {
    static final String BODY = """
        {"origen":"whatsapp","instancia":"isabel","chatId":"51900000001@s.whatsapp.net",
        "vendedorJid":"51900000002@s.whatsapp.net","clienteNombreChat":"DEMO",
        "extraccion":{"faltantes":["datos_pedido"],"confianza":0},
        "hojaResumenMd":"Faltan datos del pedido","transcript":"TRANSCRIPT_PRIVADO_PRUEBA",
        "mensajesProcesados":4,"generadoEn":"2026-10-11T05:38:18.770Z"}
        """;
    @Autowired MockMvc mvc;
    static ServiceAuthentication actor(AccessRole scope) {
        return new ServiceAuthentication(new ServiceIdentity(UUID.randomUUID(), UUID.randomUUID(), "isabel", scope));
    }
    @Test void validJsonIsAcknowledgedWithoutInventingAnOrderOrRetainingBody(CapturedOutput output) throws Exception {
        var response=mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json")
            .with(authentication(actor(AccessRole.INGESTA))).content(BODY))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("VALIDADO_SIN_PERSISTIR"))
            .andExpect(jsonPath("$.persistido").value(false)).andExpect(jsonPath("$.procesado").value(false))
            .andExpect(jsonPath("$.request_id").isNotEmpty()).andExpect(jsonPath("$.ordenId").doesNotExist()).andReturn();
        assertThat(response.getResponse().getContentAsString()).doesNotContain("TRANSCRIPT_PRIVADO_PRUEBA");
        assertThat(output.getAll()).doesNotContain("TRANSCRIPT_PRIVADO_PRUEBA");
    }
    @Test void missingBodyIsBadRequestNotServerError() throws Exception {
        mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json")
            .with(authentication(actor(AccessRole.INGESTA))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }
    @Test void emptyExtractionIsRejected() throws Exception {
        reject(BODY.replace("{\"faltantes\":[\"datos_pedido\"],\"confianza\":0}", "{}"));
    }
    @Test void arraysAreRejected() throws Exception { reject("["+BODY+"]"); }
    @Test void extraTenantAndFinancialFieldsAreRejected() throws Exception {
        reject(BODY.replace("{\"origen\":", "{\"organizacion_id\":\"forjada\",\"origen\":"));
        reject(BODY.replace("{\"faltantes\":", "{\"fondosVerificados\":true,\"faltantes\":"));
    }
    @Test void malformedAndTrailingJsonAreRejectedWithoutLoggingItsContent(CapturedOutput output) throws Exception {
        reject("{\"TRANSCRIPT_PRIVADO_PRUEBA\":");
        reject(BODY+" {}");
        assertThat(output.getAll()).doesNotContain("TRANSCRIPT_PRIVADO_PRUEBA");
    }
    @Test void instanceMustMatchTheAuthenticatedService() throws Exception {
        mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json")
            .with(authentication(actor(AccessRole.INGESTA))).content(BODY.replace("isabel","otra")))
            .andExpect(status().isForbidden());
    }
    @Test void missingCredentialAndSchedulerCannotReceiveOrders() throws Exception {
        mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json").content(BODY))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json")
            .with(authentication(actor(AccessRole.SCHEDULER))).content(BODY)).andExpect(status().isForbidden());
    }
    private void reject(String body) throws Exception {
        mvc.perform(post("/api/v1/ordenes/ingesta").contentType("application/json")
            .with(authentication(actor(AccessRole.INGESTA))).content(body))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.request_id").isNotEmpty());
    }
}
