package pe.keptai.backend.panel;

import java.util.List;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.ReceivableDtos.CollectionAlert;
import pe.keptai.backend.web.RequestIdFilter;

/**
 * POST /collection-alerts/{id}/resolution (INT-FE-API-002): Administración cierra a mano una alerta interna abierta y
 * deja la nota en {@code alerta_cobranza.resolucion}. No toca saldos ni envíos; RLS solo deja escribir a ADMIN/SCHEDULER.
 */
@Service
public class AlertCommands {

	private final PanelContext panel;

	private final PanelQueries queries;

	public AlertCommands(PanelContext panel, PanelQueries queries) {
		this.panel = panel;
		this.queries = queries;
	}

	public CollectionAlert resolve(UUID alertId, String note) {
		String nota = note.strip();
		UUID usuario = panel.identity().usuarioId();
		return panel.write(() -> {
			var jdbc = panel.jdbc();
			List<UUID> cerradas = jdbc.queryForList("""
					UPDATE keptai.alerta_cobranza SET estado = 'RESUELTA', cerrada_en = now(), resolucion = ?
					 WHERE id = ? AND estado = 'ABIERTA' RETURNING id""", UUID.class, nota, alertId);
			if (cerradas.isEmpty()) {
				// Inexistente o de otra organización (RLS) = 404; existente pero ya cerrada = 409.
				queries.alertInTx(alertId);
				throw PanelException.conflict("La alerta ya está cerrada");
			}
			jdbc.update("""
					INSERT INTO keptai.evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id,
					       cambios, request_id)
					VALUES (keptai.app_organizacion_actual(), ?, 'USUARIO', 'ALERTA_RESUELTA', 'alerta_cobranza', ?,
					        jsonb_build_object('nota', ?::text), ?)""", usuario, alertId, nota, MDC.get(RequestIdFilter.MDC_KEY));
			return queries.alertInTx(alertId);
		});
	}

}
