package pe.keptai.backend.panel;

import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.CommonDtos.PositiveMoney;
import pe.keptai.backend.contract.OrderDtos.Order;
import pe.keptai.backend.contract.PaymentDtos.ApplyPaymentRequest;
import pe.keptai.backend.contract.PaymentDtos.Payment;
import pe.keptai.backend.contract.PaymentDtos.PaymentApplication;
import pe.keptai.backend.contract.PaymentDtos.PaymentApplicationResult;
import pe.keptai.backend.contract.OrderDtos.DispatchRequest;
import pe.keptai.backend.finanzas.ContextoFinanciero;
import pe.keptai.backend.finanzas.MotorCobranza;
import pe.keptai.backend.finanzas.MotorPagos;
import pe.keptai.backend.finanzas.ResultadosPago.Aplicacion;
import pe.keptai.backend.web.RequestIdFilter;

/**
 * Adaptador HTTP de los motores de Andrés para pagos y despacho (MIG-07). Las reglas (fondos verificados, moneda,
 * cliente, sobreaplicación, vencimiento por acta) viven en {@link MotorPagos}/{@link MotorCobranza} y en V5–V8; aquí
 * solo se traduce entrada y salida. Única regla propia: tras aplicar, una orden RETENIDA cuyo contado o anticipo ya
 * quedó cubierto pasa a LIBERADA (mismo criterio que el gate {@code fn_validar_liberacion}).
 */
@Service
public class PaymentCommands {

	private final PanelContext panel;

	private final PanelQueries queries;

	private final ObjectProvider<MotorPagos> pagos;

	private final ObjectProvider<MotorCobranza> cobranza;

	public PaymentCommands(PanelContext panel, PanelQueries queries, ObjectProvider<MotorPagos> pagos,
			ObjectProvider<MotorCobranza> cobranza) {
		this.panel = panel;
		this.queries = queries;
		this.pagos = pagos;
		this.cobranza = cobranza;
	}

	/** Verificación de fondos: el motor la registra rotulada como simulada (sin conexión bancaria). */
	public Payment verify(UUID paymentId, String key) {
		return idempotent("PANEL_VERIFICAR", key, paymentId.toString(), Payment.class, () -> {
			motorPagos().verificarPago(panel.financiero(), paymentId);
			return queries.paymentInTx(paymentId);
		});
	}

	/**
	 * Marca un pago recibido como duplicado de uno anterior con la misma referencia, monto y fecha
	 * ({@code MotorPagos.marcarDuplicado}): queda en revisión con alerta y nunca se aplica (INT-FE-API-002).
	 */
	public Payment markDuplicate(UUID paymentId) {
		motorPagos().marcarDuplicado(panel.financiero(), paymentId);
		return queries.payment(paymentId);
	}

	public PaymentApplicationResult apply(UUID paymentId, ApplyPaymentRequest req, String key) {
		return idempotent("PANEL_APLICAR", key, paymentId + ":" + req.receivableId() + ":" + req.amount().amountCents(), PaymentApplicationResult.class, () -> {
			ContextoFinanciero ctx = panel.financiero();
			var rows = panel.jdbc().queryForList("SELECT verificado_por FROM keptai.pago WHERE id=? AND organizacion_id=keptai.app_organizacion_actual() FOR UPDATE", paymentId);
			if (rows.isEmpty()) throw PanelException.notFound("Pago no encontrado");
			if (ctx.usuarioId().equals(rows.getFirst().get("verificado_por")))
				throw PanelException.forbidden("La aplicación requiere un ADMIN distinto de quien verificó");
			Aplicacion a = motorPagos().aplicarPago(ctx, paymentId, req.receivableId(), PanelMapping.soles(req.amount().amountCents()));
			releaseCoveredOrder(req.receivableId());
			PaymentApplication application = new PaymentApplication(a.aplicacionId(), paymentId, req.receivableId(),
				PositiveMoney.pen(PanelMapping.cents(a.montoAplicado())), PanelMapping.lima(a.aplicadoEn()), ctx.usuarioId());
			return new PaymentApplicationResult(application, queries.paymentInTx(paymentId), queries.receivableInTx(req.receivableId()), a.alertasResueltas());
		});
	}

	private <T> T idempotent(String operation, String key, String content, Class<T> type, java.util.function.Supplier<T> work) {
		if (key == null || !key.matches("[A-Za-z0-9._:-]{8,128}")) throw PanelException.badRequest("Falta Idempotency-Key válida (8 a 128 caracteres)");
		return idempotent(operation,key,content,type,java.util.Set.of("ADMIN"),work);
	}

	private <T> T idempotent(String operation,String key,String content,Class<T> type,java.util.Set<String> roles,java.util.function.Supplier<T> work) {
		if (key == null || !key.matches("[A-Za-z0-9._:-]{8,128}")) throw PanelException.badRequest("Falta Idempotency-Key válida");
		return panel.write(() -> {
			if (!roles.contains(panel.jdbc().queryForObject("SELECT keptai_private.actor_actual()", String.class))) throw PanelException.forbidden("Acceso denegado");
			var store = new pe.keptai.backend.n8n.IdempotencyStore(panel.jdbc());
			String hash = pe.keptai.backend.security.ApiKeyAuthenticationFilter.sha256(panel.identity().usuarioId() + ":" + content);
			var reserved = store.reservar(operation,key,hash);
			if (reserved.resultado() == pe.keptai.backend.n8n.IdempotencyStore.Resultado.CONFLICTO)
				throw new PanelException(org.springframework.http.HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","La clave ya se usó con otra operación o autor");
			var json = pe.keptai.backend.contract.ContractJson.newMapper();
			if (reserved.resultado() == pe.keptai.backend.n8n.IdempotencyStore.Resultado.REPETIDA) return json.readValue(reserved.respuestaJson(),type);
			T result = work.get();
			store.completar(operation,key,json.writeValueAsString(result));
			return result;
		});
	}

	public Order dispatch(UUID orderId, DispatchRequest req, String key) {
        return idempotent("PANEL_DESPACHAR",key,orderId+":"+req.dispatchDate(),Order.class,java.util.Set.of("ADMIN","JEFE_TALLER"),()-> {
            MotorCobranza motor=cobranza.getIfAvailable();if(motor==null)throw PanelException.unavailable();
            motor.registrarDespacho(panel.financiero(),orderId,req.dispatchDate(),null);
            return queries.orderInTx(orderId);
        });
    }

	private void releaseCoveredOrder(UUID receivableId) {
		panel.write(() -> {
			var jdbc = panel.jdbc();
			java.util.List<UUID> liberadas = jdbc.queryForList("""
					UPDATE keptai.orden o SET estado = 'LIBERADA',
					       fecha_inicio_produccion = coalesce(o.fecha_inicio_produccion, timezone(org.zona_horaria, now())::date),
					       actualizado_en = now(), version = o.version + 1
					  FROM keptai.obligacion_cobro ob, keptai.v_saldo_obligacion s, keptai.organizacion org
					 WHERE ob.id = ? AND o.organizacion_id = ob.organizacion_id AND o.id = ob.orden_id
					   AND s.obligacion_id = ob.id AND org.id = o.organizacion_id AND o.estado = 'RETENIDA'
					   AND ((o.condicion_pago = 'CONTADO' AND s.cobrado >= o.total)
					     OR (o.condicion_pago = 'ANTICIPO' AND o.anticipo_requerido > 0 AND s.cobrado >= o.anticipo_requerido))
					RETURNING o.id""", UUID.class, receivableId);
			for (UUID orden : liberadas) {
				jdbc.update("""
						INSERT INTO keptai.evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id,
						       cambios, request_id)
						VALUES (keptai.app_organizacion_actual(), ?, 'USUARIO', 'ORDEN_LIBERADA', 'orden', ?,
						        jsonb_build_object('motivo', 'contado o anticipo cubierto'), ?)""",
						panel.identity().usuarioId(), orden, MDC.get(RequestIdFilter.MDC_KEY));
			}
			return liberadas.size();
		});
	}

	private MotorPagos motorPagos() {
		MotorPagos m = pagos.getIfAvailable();
		if (m == null) {
			throw PanelException.unavailable();
		}
		return m;
	}

}
