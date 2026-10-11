package pe.keptai.backend.contract;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
/** Contrato separado n8n (MIG-02); DTOs, no endpoints ni confianza en campos del llamador. */
public final class N8nDtos {
private N8nDtos() {}
public record N8nExtraccionCliente(
@JsonProperty("nombre") @Size(min=0, max=200) String nombre,
@JsonProperty("ruc") @Size(min=0, max=20) String ruc,
@JsonProperty("tipo") @Pattern(regexp="PERSONA|EMPRESA") String tipo
) {}
public record N8nExtraccionItem(
@JsonProperty("descripcion") @NotNull @Size(min=1, max=500) String descripcion,
@JsonProperty("cantidad") @Min(1) @Max(1000000) Integer cantidad,
@JsonProperty("unidad") @Size(min=0, max=50) String unidad,
@JsonProperty("detalle_tallas") @Size(min=0, max=500) String detalle_tallas,
@JsonProperty("tela") @Size(min=0, max=200) String tela,
@JsonProperty("logo_diseno") @Size(min=0, max=500) String logo_diseno,
@JsonProperty("precio_unitario") @DecimalMin("0") @DecimalMax("90071992547409.9") @Digits(integer=14, fraction=2) java.math.BigDecimal precio_unitario
) {}
public record N8nCondicionPago(
@JsonProperty("tipo") @Pattern(regexp="CONTADO|CREDITO|ANTICIPO|NO_DEFINIDA") String tipo,
@JsonProperty("plazo_dias") @Min(0) @Max(365) Integer plazo_dias,
@JsonProperty("anticipo_monto") @DecimalMin("0") @DecimalMax("90071992547409.9") @Digits(integer=14, fraction=2) java.math.BigDecimal anticipo_monto,
@JsonProperty("anticipo_pct") @DecimalMin("0") @DecimalMax("100") java.math.BigDecimal anticipo_pct
) {}
public record N8nPagoMencionado(
@JsonProperty("monto") @DecimalMin("0") @DecimalMax("90071992547409.9") @Digits(integer=14, fraction=2) java.math.BigDecimal monto,
@JsonProperty("fecha")  java.time.LocalDate fecha,
@JsonProperty("medio") @Size(min=0, max=50) String medio,
@JsonProperty("nota") @Size(min=0, max=500) String nota
) {}
public record N8nExtraccionOrden(
@JsonProperty("cliente") @Valid N8nExtraccionCliente cliente,
@JsonProperty("marca") @Pattern(regexp="CORPOTEX|UNICRACK_SPORT|UNICRACK_UNIFORMES") String marca,
@JsonProperty("items") @Size(max=200) java.util.List<@Valid N8nExtraccionItem> items,
@JsonProperty("total") @DecimalMin("0") @DecimalMax("90071992547409.9") @Digits(integer=14, fraction=2) java.math.BigDecimal total,
@JsonProperty("moneda") @Pattern(regexp="PEN") String moneda,
@JsonProperty("condicion_pago") @Valid N8nCondicionPago condicion_pago,
@JsonProperty("fecha_entrega_solicitada")  java.time.LocalDate fecha_entrega_solicitada,
@JsonProperty("pagos_mencionados") @Size(max=50) java.util.List<@Valid N8nPagoMencionado> pagos_mencionados,
@JsonProperty("observaciones") @Size(min=0, max=4000) String observaciones,
@JsonProperty("faltantes") @NotNull @Size(max=50) java.util.List<@Valid String> faltantes,
@JsonProperty("confianza") @NotNull @DecimalMin("0") @DecimalMax("1") java.math.BigDecimal confianza,
@JsonProperty("error_parseo") @Size(min=0, max=1000) String error_parseo,
@JsonProperty("crudo") @Size(min=0, max=500) String crudo
) {}
public record N8nIngestaOrdenRequest(
@JsonProperty("origen") @NotNull @Pattern(regexp="whatsapp|WHATSAPP") String origen,
@JsonProperty("instancia") @NotNull @Pattern(regexp="^[A-Za-z0-9._-]+$") @Size(min=1, max=100) String instancia,
@JsonProperty("chatId") @NotNull @Pattern(regexp="^[0-9]{5,20}(:[0-9]{1,3})?@(s\\.whatsapp\\.net|lid)$") @Size(min=8, max=64) String chatId,
@JsonProperty("vendedorJid") @NotNull @Pattern(regexp="^[0-9]{5,20}(:[0-9]{1,3})?@(s\\.whatsapp\\.net|lid)$") @Size(min=8, max=64) String vendedorJid,
@JsonProperty("clienteNombreChat") @Size(min=0, max=200) String clienteNombreChat,
@JsonProperty("extraccion") @NotNull @Valid N8nExtraccionOrden extraccion,
@JsonProperty("hojaResumenMd") @NotNull @Size(min=1, max=20000) String hojaResumenMd,
@JsonProperty("transcript") @NotNull @Size(min=0, max=60000) String transcript,
@JsonProperty("mensajesProcesados") @NotNull @Min(0) @Max(400) Integer mensajesProcesados,
@JsonProperty("generadoEn") @NotNull java.time.OffsetDateTime generadoEn
) {}
public record N8nAviso(
@JsonProperty("codigo") @NotNull @Pattern(regexp="^[A-Z][A-Z0-9_]*$") @Size(min=0, max=60) String codigo,
@JsonProperty("mensaje") @NotNull @Size(min=0, max=500) String mensaje
) {}
public record N8nIngestaOrdenResponse(
@JsonProperty("ordenId") @NotNull java.util.UUID ordenId,
@JsonProperty("ref") @NotNull @Pattern(regexp="^[A-Z]{1,5}-[0-9]{1,9}$") String ref,
@JsonProperty("estado") @NotNull @Pattern(regexp="BORRADOR") String estado,
@JsonProperty("hojaResumenVersion") @NotNull @Min(1) Integer hojaResumenVersion,
@JsonProperty("camposAusentes") @NotNull @Size(max=50) java.util.List<@Valid String> camposAusentes,
@JsonProperty("avisos") @NotNull @Size(max=20) java.util.List<@Valid N8nAviso> avisos
) {}
public record N8nConfirmarOrdenRequest(
@JsonProperty("ref") @NotNull @Pattern(regexp="^[A-Za-z]{1,5}-[0-9]{1,9}$") String ref,
@JsonProperty("instancia") @NotNull @Pattern(regexp="^[A-Za-z0-9._-]+$") @Size(min=1, max=100) String instancia,
@JsonProperty("chatId") @NotNull @Pattern(regexp="^[0-9]{5,20}(:[0-9]{1,3})?@(s\\.whatsapp\\.net|lid)$") @Size(min=8, max=64) String chatId,
@JsonProperty("vendedorJid") @NotNull @Pattern(regexp="^[0-9]{5,20}(:[0-9]{1,3})?@(s\\.whatsapp\\.net|lid)$") @Size(min=8, max=64) String vendedorJid,
@JsonProperty("mensajeId") @NotNull @Pattern(regexp="^[A-Za-z0-9_.-]+$") @Size(min=4, max=128) String mensajeId
) {}
public record N8nConfirmarOrdenResponse(
@JsonProperty("ordenId") @NotNull java.util.UUID ordenId,
@JsonProperty("ref") @NotNull @Pattern(regexp="^[A-Z]{1,5}-[0-9]{1,9}$") String ref,
@JsonProperty("estado") @NotNull @Pattern(regexp="BORRADOR|PENDIENTE_APROBACION|RETENIDA|LIBERADA|EN_PRODUCCION|DESPACHADA|CERRADA|CANCELADA") String estado,
@JsonProperty("hojaResumenEstado") @NotNull @Pattern(regexp="CONFIRMADA") String hojaResumenEstado,
@JsonProperty("confirmadoPorUsuarioId") @NotNull java.util.UUID confirmadoPorUsuarioId,
@JsonProperty("creditoPendiente") @NotNull Boolean creditoPendiente
) {}
public record N8nVoucherExtraccion(
@JsonProperty("es_voucher") @NotNull Boolean es_voucher,
@JsonProperty("tipo") @Pattern(regexp="YAPE|PLIN|TRANSFERENCIA|DEPOSITO|OTRO") String tipo,
@JsonProperty("banco") @Size(min=0, max=100) String banco,
@JsonProperty("monto") @DecimalMin("0") @DecimalMax("90071992547409.9") @Digits(integer=14, fraction=2) java.math.BigDecimal monto,
@JsonProperty("moneda") @Pattern(regexp="PEN|USD") String moneda,
@JsonProperty("fecha")  java.time.LocalDate fecha,
@JsonProperty("hora") @Pattern(regexp="^([01][0-9]|2[0-3]):[0-5][0-9]$") String hora,
@JsonProperty("codigo_operacion") @Size(min=0, max=64) String codigo_operacion,
@JsonProperty("remitente") @Size(min=0, max=200) String remitente,
@JsonProperty("destinatario") @Size(min=0, max=200) String destinatario,
@JsonProperty("confianza") @NotNull @DecimalMin("0") @DecimalMax("1") java.math.BigDecimal confianza,
@JsonProperty("error_parseo") @Size(min=0, max=1000) String error_parseo
) {}
public record N8nPagoVoucherRequest(
@JsonProperty("instancia") @NotNull @Pattern(regexp="^[A-Za-z0-9._-]+$") @Size(min=1, max=100) String instancia,
@JsonProperty("chatId") @NotNull @Pattern(regexp="^[0-9]{5,20}(:[0-9]{1,3})?@(s\\.whatsapp\\.net|lid)$") @Size(min=8, max=64) String chatId,
@JsonProperty("clienteJid") @NotNull @Pattern(regexp="^[0-9]{5,20}(:[0-9]{1,3})?@(s\\.whatsapp\\.net|lid)$") @Size(min=8, max=64) String clienteJid,
@JsonProperty("mensajeId") @NotNull @Pattern(regexp="^[A-Za-z0-9_.-]+$") @Size(min=4, max=128) String mensajeId,
@JsonProperty("pushName") @Size(min=0, max=200) String pushName,
@JsonProperty("recibidoEn") @NotNull java.time.OffsetDateTime recibidoEn,
@JsonProperty("extraccion") @NotNull @Valid N8nVoucherExtraccion extraccion
) {}
public record N8nPagoVoucherResponse(
@JsonProperty("resultado") @NotNull @Pattern(regexp="REGISTRADO|IGNORADO_NO_VOUCHER") String resultado,
@JsonProperty("pagoId")  java.util.UUID pagoId,
@JsonProperty("fase") @Pattern(regexp="RECIBIDO") String fase,
@JsonProperty("estadoConciliacion") @Pattern(regexp="PENDIENTE|PARCIAL|DUPLICADO|SIN_ORDEN|NO_CUADRA") String estadoConciliacion,
@JsonProperty("duplicadoDePagoId")  java.util.UUID duplicadoDePagoId,
@JsonProperty("ordenRef") @Pattern(regexp="^[A-Z]{1,5}-[0-9]{1,9}$") String ordenRef,
@JsonProperty("alertaId")  java.util.UUID alertaId,
@JsonProperty("fondosVerificados") @NotNull Boolean fondosVerificados,
@JsonProperty("saldoModificado") @NotNull Boolean saldoModificado
) {}
public record N8nMensajeEstadoRequest(
@JsonProperty("mensajeId") @NotNull java.util.UUID mensajeId,
@JsonProperty("ordenId")  java.util.UUID ordenId,
@JsonProperty("tipo") @Pattern(regexp="COBRANZA_PREVENTIVA|COBRANZA_VENCIMIENTO|MORA_TEMPRANA|RECOMPRA|ESTADO_CUENTA|CONFIRMACION_PAGO|RESUMEN_VENDEDOR") String tipo,
@JsonProperty("idempotencyKey") @Size(min=0, max=128) String idempotencyKey,
@JsonProperty("estado") @NotNull @Pattern(regexp="ENVIADO|ERROR") String estado,
@JsonProperty("providerMessageId") @Size(min=0, max=128) String providerMessageId,
@JsonProperty("error") @Size(min=0, max=400) String error,
@JsonProperty("enviadoEn") @NotNull java.time.OffsetDateTime enviadoEn
) {}
public record N8nMensajeEstadoResponse(
@JsonProperty("mensajeId") @NotNull java.util.UUID mensajeId,
@JsonProperty("estado") @NotNull @Pattern(regexp="PENDIENTE|ENVIADO|ERROR|CANCELADO") String estado,
@JsonProperty("intentos") @NotNull @Min(0) @Max(100) Integer intentos
) {}
public record N8nMensajeSalienteWebhook(
@JsonProperty("mensajeId") @NotNull java.util.UUID mensajeId,
@JsonProperty("tipo") @NotNull @Pattern(regexp="COBRANZA_PREVENTIVA|COBRANZA_VENCIMIENTO|MORA_TEMPRANA|RECOMPRA|ESTADO_CUENTA|CONFIRMACION_PAGO|RESUMEN_VENDEDOR") String tipo,
@JsonProperty("instance") @NotNull @Pattern(regexp="^[A-Za-z0-9._-]+$") @Size(min=1, max=100) String instance,
@JsonProperty("numero") @NotNull @Pattern(regexp="^[0-9]{9,15}$") String numero,
@JsonProperty("texto") @NotNull @Size(min=1, max=4000) String texto,
@JsonProperty("delayMs") @Min(0) @Max(60000) Integer delayMs,
@JsonProperty("ordenId")  java.util.UUID ordenId,
@JsonProperty("clienteId")  java.util.UUID clienteId,
@JsonProperty("idempotencyKey") @NotNull @Size(min=1, max=128) String idempotencyKey
) {}
public record N8nWebhookAccepted(
@JsonProperty("aceptado") @NotNull Boolean aceptado,
@JsonProperty("mensajeId")  java.util.UUID mensajeId
) {}
public record N8nWebhookUnauthorized(
@JsonProperty("error") @NotNull @Pattern(regexp="no autorizado") String error
) {}
}