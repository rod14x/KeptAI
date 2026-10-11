package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.ContractEnums.CreditDecisionValue;
import pe.keptai.backend.contract.ReceivableDtos.CreditAuthorization;
import pe.keptai.backend.contract.ReceivableDtos.CreditDecisionRequest;
import pe.keptai.backend.tenancy.TenantIdentity;
import pe.keptai.backend.web.RequestIdFilter;

/**
 * POST /orders/{id}/credit-decision (D-005): el vendedor decide cómo se cobra el pedido; la mora avisa, no bloquea.
 * <ul>
 * <li>{@code approved} con {@code credit_term_days}: CREDITO (o ANTICIPO si además trae {@code advance_pct_bps} &gt; 0).
 * La aprobación queda en {@code aprobacion_credito}; con crédito puro la orden pasa a LIBERADA (gate V5).</li>
 * <li>{@code approved} sin plazo: CONTADO. No es una aprobación de crédito ({@code ck_decision_plazo} exige plazo), así
 * que no se inserta en {@code aprobacion_credito}; la orden queda RETENIDA hasta cobrarse completa.</li>
 * <li>ANTICIPO también queda RETENIDA hasta aplicar el anticipo (lo libera {@link PaymentCommands}).</li>
 * <li>{@code rejected}: aprobación RECHAZADO y orden CANCELADA.</li>
 * </ul>
 * La obligación de cobro la crea {@code keptai_private.crear_obligacion_orden} (V10) por el total, sin vencimiento hasta
 * el acta de despacho. Autor = usuario del JWT (trigger de autoría V7); historial en {@code evento_auditoria}.
 */
@Service
public class CreditDecisionService {

	/** Contado aprobado sin plazo: regla de este servicio (el DTO del contrato exige plazo al aprobar). */
	public static final String TERM_RULE_PROPERTY = "termPresentWhenApproving";

	private final PanelContext panel;

	private final PanelQueries queries;

	public CreditDecisionService(PanelContext panel, PanelQueries queries) {
		this.panel = panel;
		this.queries = queries;
	}

	public CreditAuthorization decide(UUID orderId, CreditDecisionRequest req) {
		TenantIdentity actor = panel.identity();
		return panel.write(() -> {
			var jdbc = panel.jdbc();
			List<Map<String, Object>> rows = jdbc.queryForList("""
					SELECT o.estado, o.total, o.vendedor_id, o.cliente_id,
					       (SELECT a.decision FROM keptai.aprobacion_credito a
					         WHERE a.organizacion_id = o.organizacion_id AND a.orden_id = o.id) AS decision,
					       (SELECT coalesce(sum(m.saldo_vencido), 0) FROM keptai.v_cliente_mora m
					         WHERE m.organizacion_id = o.organizacion_id AND m.cliente_id = o.cliente_id) AS vencido
					  FROM keptai.orden o WHERE o.id = ? FOR UPDATE OF o""", orderId);
			if (rows.isEmpty()) {
				throw PanelException.notFound("Pedido no encontrado");
			}
			Map<String, Object> o = rows.get(0);
			String decisionPrevia = (String) o.get("decision");
			if (decisionPrevia != null && !"PENDIENTE".equals(decisionPrevia)) {
				throw PanelException.conflict("La orden ya tiene una decisión de crédito registrada");
			}
			if (!"PENDIENTE_APROBACION".equals(o.get("estado"))) {
				throw PanelException.conflict("Solo se decide una orden pendiente de aprobación");
			}
			UUID vendedor = (UUID) o.get("vendedor_id");
			if (vendedor != null && !vendedor.equals(actor.usuarioId())) {
				throw PanelException.forbidden("Solo el vendedor asignado decide el crédito de esta orden");
			}
			BigDecimal vencido = (BigDecimal) o.get("vencido");
			boolean mora = vencido != null && vencido.signum() > 0;
			if (mora && !Boolean.TRUE.equals(req.arrearsNoticeAcknowledged())) {
				throw PanelException.unprocessable("ARREARS_NOTICE_NOT_ACKNOWLEDGED",
						"El cliente tiene saldo vencido: confirma que viste el aviso de mora antes de decidir");
			}
			BigDecimal total = (BigDecimal) o.get("total");
			String motivo = req.reason() == null || req.reason().isBlank() ? null : req.reason().strip();
			String requestId = MDC.get(RequestIdFilter.MDC_KEY);

			if (req.decision() == CreditDecisionValue.REJECTED) {
				upsertDecision(orderId, actor.usuarioId(), "RECHAZADO", mora, vencido, req.creditTermDays(), null, motivo);
				jdbc.update("""
						UPDATE keptai.orden SET estado = 'CANCELADA', vendedor_id = coalesce(vendedor_id, ?),
						       actualizado_en = now(), version = version + 1 WHERE id = ?""", actor.usuarioId(), orderId);
				audit(actor, "CREDITO_RECHAZADO", orderId, Map.of("motivo", motivo == null ? "" : motivo), requestId);
				return queries.creditDecisionInTx(orderId);
			}

			Integer plazo = req.creditTermDays();
			Integer bps = req.advancePctBps();
			String condicion = plazo == null ? "CONTADO" : bps != null && bps > 0 ? "ANTICIPO" : "CREDITO";
			if (plazo == null && bps != null && bps > 0) {
				throw PanelException.badRequest("El anticipo exige el plazo del saldo restante (credit_term_days)");
			}
			BigDecimal anticipo = "ANTICIPO".equals(condicion)
					? total.multiply(BigDecimal.valueOf(bps)).divide(BigDecimal.valueOf(10_000), 2, RoundingMode.HALF_UP)
					: BigDecimal.ZERO;
			jdbc.update("""
					UPDATE keptai.orden SET condicion_pago = ?, plazo_dias = ?, anticipo_requerido = ?,
					       vendedor_id = coalesce(vendedor_id, ?), actualizado_en = now(), version = version + 1
					 WHERE id = ?""", condicion, plazo, anticipo, actor.usuarioId(), orderId);
			if ("CONTADO".equals(condicion)) {
				jdbc.update("""
						UPDATE keptai.orden SET estado = 'RETENIDA', actualizado_en = now(), version = version + 1
						 WHERE id = ?""", orderId);
				jdbc.queryForObject("SELECT keptai_private.crear_obligacion_orden(?)", UUID.class, orderId);
				audit(actor, "ORDEN_CONFIRMADA_CONTADO", orderId, Map.of("condicion_pago", condicion), requestId);
				return queries.creditDecisionInTx(orderId);
			}
			BigDecimal pct = bps == null ? null : BigDecimal.valueOf(bps, 2);
			upsertDecision(orderId, actor.usuarioId(), "APROBADO", mora, vencido, plazo, pct, motivo);
			jdbc.queryForObject("SELECT keptai_private.crear_obligacion_orden(?)", UUID.class, orderId);
			if ("CREDITO".equals(condicion)) {
				jdbc.update("""
						UPDATE keptai.orden o SET estado = 'LIBERADA',
						       fecha_inicio_produccion = coalesce(o.fecha_inicio_produccion, timezone(org.zona_horaria, now())::date),
						       actualizado_en = now(), version = o.version + 1
						  FROM keptai.organizacion org WHERE o.id = ? AND org.id = o.organizacion_id""", orderId);
			}
			else {
				jdbc.update("""
						UPDATE keptai.orden SET estado = 'RETENIDA', actualizado_en = now(), version = version + 1
						 WHERE id = ?""", orderId);
			}
			audit(actor, "CREDITO_APROBADO", orderId,
					Map.of("condicion_pago", condicion, "plazo_dias", String.valueOf(plazo), "aviso_mora_mostrado",
							String.valueOf(mora)), requestId);
			return queries.creditDecisionInTx(orderId);
		});
	}

	private void upsertDecision(UUID orderId, UUID usuario, String decision, boolean mora, BigDecimal vencido,
			Integer plazo, BigDecimal pct, String motivo) {
		BigDecimal referencia = vencido == null ? BigDecimal.ZERO : vencido;
		int updated = panel.jdbc().update("""
				UPDATE keptai.aprobacion_credito SET aprobado_por = ?, decision = ?, aviso_mora_mostrado = ?,
				       saldo_referencia = ?, plazo_dias = ?, anticipo_pct = ?, motivo = ?, decidido_en = now()
				 WHERE orden_id = ? AND decision = 'PENDIENTE'""", usuario, decision, mora, referencia, plazo, pct, motivo,
				orderId);
		if (updated == 0) {
			panel.jdbc().update("""
					INSERT INTO keptai.aprobacion_credito (organizacion_id, orden_id, aprobado_por, decision,
					       aviso_mora_mostrado, saldo_referencia, plazo_dias, anticipo_pct, motivo, decidido_en)
					VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?, ?, now())""", orderId, usuario, decision,
					mora, referencia, plazo, pct, motivo);
		}
	}

	private void audit(TenantIdentity actor, String operacion, UUID orderId, Map<String, String> cambios, String requestId) {
		StringBuilder json = new StringBuilder("{");
		cambios.forEach((k, v) -> {
			if (json.length() > 1) {
				json.append(',');
			}
			json.append('"').append(k).append("\":\"").append(v.replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
		});
		json.append('}');
		panel.jdbc().update("""
				INSERT INTO keptai.evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id,
				       cambios, request_id)
				VALUES (keptai.app_organizacion_actual(), ?, 'USUARIO', ?, 'orden', ?, CAST(? AS jsonb), ?)""",
				actor.usuarioId(), operacion, orderId, json.toString(), requestId);
	}

}
