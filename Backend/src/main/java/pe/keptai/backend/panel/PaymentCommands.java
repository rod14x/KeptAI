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
	public Payment verify(UUID paymentId) {
		motorPagos().verificarPago(panel.financiero(), paymentId);
		return queries.payment(paymentId);
	}

	public PaymentApplicationResult apply(UUID paymentId, ApplyPaymentRequest req) {
		ContextoFinanciero ctx = panel.financiero();
		Aplicacion a = motorPagos().aplicarPago(ctx, paymentId, req.receivableId(),
				PanelMapping.soles(req.amount().amountCents()));
		releaseCoveredOrder(req.receivableId());
		PaymentApplication application = new PaymentApplication(a.aplicacionId(), paymentId, req.receivableId(),
				PositiveMoney.pen(PanelMapping.cents(a.montoAplicado())), PanelMapping.lima(a.aplicadoEn()), ctx.usuarioId());
		return panel.read(() -> new PaymentApplicationResult(application, queries.paymentInTx(paymentId),
				queries.receivableInTx(req.receivableId()), a.alertasResueltas()));
	}

	public Order dispatch(UUID orderId, DispatchRequest req) {
		MotorCobranza motor = cobranza.getIfAvailable();
		if (motor == null) {
			throw PanelException.unavailable();
		}
		motor.registrarDespacho(panel.financiero(), orderId, req.dispatchDate(), null);
		return queries.order(orderId);
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
