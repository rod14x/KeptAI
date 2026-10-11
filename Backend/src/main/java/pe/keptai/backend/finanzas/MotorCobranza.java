package pe.keptai.backend.finanzas;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosCobranza.*;

public class MotorCobranza extends TransaccionFinanciera {

	static final int DIAS_AVISO = 3;

	private static final Set<String> DESPACHO = Set.of("ADMIN", "JEFE_TALLER");
	private static final Set<String> COBRANZA = Set.of("ADMIN", "SCHEDULER");

	public MotorCobranza(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		super(jdbc, transactionManager);
	}

	public Despacho registrarDespacho(ContextoFinanciero ctx, UUID ordenId, LocalDate fechaDespacho, String actaStoragePath) {
		if (fechaDespacho == null) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "La fecha de despacho es obligatoria");
		}
		if (actaStoragePath != null && !rutaPrivadaValida(ctx, actaStoragePath)) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR,
					"El acta debe ser una ruta privada que empiece con la organizacion, sin URL ni '..'");
		}
		return enTransaccion(ctx, DESPACHO, () -> {
			UUID despachoId = jdbc.queryForObject("""
					INSERT INTO keptai.despacho (organizacion_id, orden_id, fecha_despacho, acta_storage_path, registrado_por)
					VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?) RETURNING id""", UUID.class,
					ordenId, fechaDespacho, actaStoragePath, ctx.usuarioId());
			String estadoOrden = jdbc.queryForList("SELECT estado FROM keptai.orden WHERE id = ?", String.class, ordenId)
					.stream().findFirst().orElse(null);
			LocalDate vence = jdbc.queryForList("""
					SELECT vence_en FROM keptai.obligacion_cobro WHERE orden_id = ? AND estado <> 'ANULADA'""",
					LocalDate.class, ordenId).stream().findFirst().orElse(null);
			auditar(ctx, "DESPACHO_REGISTRADO", "despacho", despachoId,
					"jsonb_build_object('orden_id', ?::uuid, 'fecha_despacho', ?::date)", ordenId, fechaDespacho);
			return new Despacho(despachoId, ordenId, fechaDespacho, estadoOrden, vence);
		});
	}

	public Cobranza evaluarCobranza(ContextoFinanciero ctx, LocalDate fechaCorte) {
		if (fechaCorte == null) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "La fecha de corte es obligatoria");
		}
		return enTransaccion(ctx, COBRANZA, () -> {
			Integer estados = jdbc.queryForObject("SELECT keptai_private.actualizar_estados_cobranza()", Integer.class);
			List<UUID> alertas = jdbc.queryForList("""
					INSERT INTO keptai.alerta_cobranza (organizacion_id, obligacion_id, regla)
					SELECT s.organizacion_id, s.obligacion_id, 'MORA_TEMPRANA'
					  FROM keptai.v_saldo_obligacion s
					 WHERE s.saldo > 0 AND s.vence_en IS NOT NULL AND s.vence_en + ? <= ?
					   AND NOT EXISTS (SELECT 1 FROM keptai.alerta_cobranza a
					                    WHERE a.organizacion_id = s.organizacion_id AND a.obligacion_id = s.obligacion_id
					                      AND a.regla = 'MORA_TEMPRANA' AND a.estado = 'ABIERTA')
					RETURNING id""", UUID.class, DIAS_AVISO, fechaCorte);
			int programados = jdbc.update("""
					INSERT INTO keptai.envio_notificacion (organizacion_id, cliente_id, orden_id, obligacion_id, instancia,
					                                       numero_destino, tipo, idempotency_key, programado_para)
					SELECT s.organizacion_id, ord.cliente_id, s.orden_id, s.obligacion_id, c.instancia,
					       split_part(c.chat_jid, '@', 1), h.tipo, s.obligacion_id::text || ':' || h.tipo,
					       (h.fecha + time '09:00') AT TIME ZONE org.zona_horaria
					  FROM keptai.v_saldo_obligacion s
					  JOIN keptai.orden ord ON ord.organizacion_id = s.organizacion_id AND ord.id = s.orden_id
					  JOIN keptai.organizacion org ON org.id = s.organizacion_id
					  JOIN LATERAL (SELECT cw.instancia, cw.chat_jid FROM keptai.canal_whatsapp cw
					                 WHERE cw.organizacion_id = s.organizacion_id AND cw.cliente_id = ord.cliente_id
					                 ORDER BY cw.creado_en DESC, cw.id LIMIT 1) c ON true
					  CROSS JOIN LATERAL (VALUES ('COBRANZA_PREVENTIVA', s.vence_en - ?),
					                             ('COBRANZA_VENCIMIENTO', s.vence_en),
					                             ('MORA_TEMPRANA', s.vence_en + ?)) h(tipo, fecha)
					 WHERE s.saldo > 0 AND s.vence_en IS NOT NULL AND h.fecha >= ?
					ON CONFLICT (organizacion_id, idempotency_key) DO NOTHING""", DIAS_AVISO, DIAS_AVISO, fechaCorte);
			int cancelados = jdbc.update("""
					UPDATE keptai.envio_notificacion e SET estado = 'CANCELADO'
					 WHERE e.estado = 'PENDIENTE' AND e.obligacion_id IS NOT NULL
					   AND NOT EXISTS (SELECT 1 FROM keptai.v_saldo_obligacion s
					                    WHERE s.obligacion_id = e.obligacion_id AND s.saldo > 0)""");
			auditar(ctx, "COBRANZA_EVALUADA", "organizacion", ctx.organizacionId(), """
					jsonb_build_object('fecha_corte', ?::date, 'estados', ?::int, 'alertas', ?::int,
					                   'envios', ?::int, 'cancelados', ?::int)""",
					fechaCorte, estados, alertas.size(), programados, cancelados);
			return new Cobranza(fechaCorte, estados == null ? 0 : estados, List.copyOf(alertas), programados, cancelados);
		});
	}

	private static boolean rutaPrivadaValida(ContextoFinanciero ctx, String ruta) {
		return ruta.startsWith(ctx.organizacionId() + "/") && !ruta.contains("://")
				&& !ruta.matches("(^|.*/)\\.\\.(/.*|$)");
	}
}
