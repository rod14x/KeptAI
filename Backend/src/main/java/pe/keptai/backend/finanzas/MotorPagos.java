package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.MDC;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosPago.*;
import pe.keptai.backend.web.RequestIdFilter;

/**
 * Motor de pagos (Andres, roadmap §2): verificar, detectar/marcar duplicado, aplicar y anular.
 * Cada operacion es una transaccion: contexto RLS local, bloqueo pago -> obligacion (mismo orden que el trigger V5),
 * reglas, estados derivados, alertas y auditoria se confirman o revierten juntos. El saldo se calcula, nunca se recibe.
 * La idempotencia HTTP (Idempotency-Key, solicitud_idempotente) la coordina el adapter MIG-05/07 alrededor de estas llamadas.
 */
public class MotorPagos {

	private static final Set<String> ESCRITURA = Set.of("ADMIN");
	private static final Set<String> LECTURA_PAGOS = Set.of("VENDEDOR", "ADMIN", "GERENTE", "INGESTA", "SCHEDULER");
	private static final Set<String> LECTURA_SALDOS = Set.of("VENDEDOR", "ADMIN", "GERENTE", "SCHEDULER");

	private final JdbcTemplate jdbc;
	private final TransactionTemplate tx;

	public MotorPagos(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		this.jdbc = jdbc;
		this.tx = new TransactionTemplate(transactionManager);
	}

	/** Registra la verificacion de fondos (simulada y rotulada en la demo). No aplica ni cambia saldos. */
	public Verificacion verificarPago(ContextoFinanciero ctx, UUID pagoId) {
		return enTransaccion(ctx, ESCRITURA, () -> {
			PagoFila p = bloquearPago(pagoId);
			if (p.duplicado()) {
				throw new MotorFinancieroException(Codigo.DUPLICATE_PAYMENT, "El pago esta marcado como duplicado");
			}
			if (!"RECIBIDO".equals(p.fase())) {
				throw new MotorFinancieroException(Codigo.INVALID_STATE, "El pago ya tiene fondos verificados");
			}
			if (buscarOriginal(p).isPresent()) {
				throw new MotorFinancieroException(Codigo.DUPLICATE_PAYMENT,
						"Referencia, monto y fecha ya usados por otro pago: revisar como duplicado");
			}
			OffsetDateTime en = jdbc.queryForObject("""
					UPDATE keptai.pago SET fase = 'VERIFICADO_BANCO', verificado_por = ?, verificado_en = now(),
					       actualizado_en = now(), version = version + 1
					 WHERE id = ? RETURNING verificado_en""", OffsetDateTime.class, ctx.usuarioId(), pagoId);
			auditar(ctx, "PAGO_VERIFICADO", "pago", pagoId,
					"jsonb_build_object('metodo', 'simulated_demo', 'simulado', true)");
			return new Verificacion(estadoPago(pagoId), en, true);
		});
	}

	/** Pago anterior con la misma referencia, monto y fecha (regla de duplicado D-005). Solo consulta. */
	public Optional<UUID> detectarDuplicado(ContextoFinanciero ctx, UUID pagoId) {
		return enTransaccion(ctx, LECTURA_PAGOS, () -> buscarOriginal(leerPago(pagoId, false)));
	}

	/** Marca un pago recibido como duplicado del original y abre la alerta de revision. Idempotente. */
	public Duplicado marcarDuplicado(ContextoFinanciero ctx, UUID pagoId) {
		return enTransaccion(ctx, ESCRITURA, () -> {
			PagoFila p = bloquearPago(pagoId);
			UUID original;
			if (p.duplicado()) {
				original = p.duplicadoDe();
			} else {
				if (!"RECIBIDO".equals(p.fase())) {
					throw new MotorFinancieroException(Codigo.INVALID_STATE,
							"Solo un pago sin fondos verificados puede marcarse duplicado");
				}
				original = buscarOriginal(p).orElseThrow(() -> new MotorFinancieroException(Codigo.INVALID_STATE,
						"No hay un pago anterior con la misma referencia, monto y fecha"));
				jdbc.update("""
						UPDATE keptai.pago SET estado_conciliacion = 'DUPLICADO', duplicado_de_pago_id = ?,
						       actualizado_en = now(), version = version + 1
						 WHERE id = ?""", original, pagoId);
				auditar(ctx, "PAGO_DUPLICADO", "pago", pagoId,
						"jsonb_build_object('duplicado_de_pago_id', ?::uuid)", original);
			}
			List<UUID> abierta = jdbc.queryForList("""
					SELECT id FROM keptai.alerta_cobranza
					 WHERE pago_id = ? AND regla = 'PAGO_EN_REVISION' AND estado = 'ABIERTA'""", UUID.class, pagoId);
			UUID alerta = abierta.isEmpty() ? jdbc.queryForObject("""
					INSERT INTO keptai.alerta_cobranza (organizacion_id, pago_id, responsable_id, regla)
					VALUES (keptai.app_organizacion_actual(), ?, ?, 'PAGO_EN_REVISION') RETURNING id""",
					UUID.class, pagoId, ctx.usuarioId()) : abierta.get(0);
			return new Duplicado(estadoPago(pagoId), original, alerta);
		});
	}

	/**
	 * Aplica un pago verificado a una obligacion. Rechaza duplicado, no verificado, huerfano, otra moneda/cliente y
	 * sobreaplicacion; repetir la misma aplicacion tras consumir el pago se rechaza sin alterar la deuda.
	 */
	public Aplicacion aplicarPago(ContextoFinanciero ctx, UUID pagoId, UUID obligacionId, BigDecimal monto) {
		BigDecimal importe = validarImporte(monto);
		return enTransaccion(ctx, ESCRITURA, () -> {
			PagoFila p = bloquearPago(pagoId);
			if (p.duplicado()) {
				throw new MotorFinancieroException(Codigo.DUPLICATE_PAYMENT, "Un pago duplicado no se aplica");
			}
			if ("RECIBIDO".equals(p.fase())) {
				throw new MotorFinancieroException(Codigo.PAYMENT_NOT_VERIFIED,
						"El pago no tiene fondos verificados; el voucher no basta");
			}
			if (p.clienteId() == null) {
				throw new MotorFinancieroException(Codigo.ORPHAN_PAYMENT, "Identificar al cliente antes de aplicar");
			}
			ObligacionFila o = bloquearObligacion(obligacionId);
			if ("ANULADA".equals(o.estado())) {
				throw new MotorFinancieroException(Codigo.INVALID_STATE, "La obligacion esta anulada");
			}
			if (!o.moneda().equals(p.moneda())) {
				throw new MotorFinancieroException(Codigo.CURRENCY_MISMATCH,
						"Moneda del pago " + p.moneda() + " distinta de la obligacion " + o.moneda());
			}
			if (!p.clienteId().equals(o.clienteId())) {
				throw new MotorFinancieroException(Codigo.INVALID_STATE, "El pago pertenece a otro cliente");
			}
			BigDecimal disponible = p.monto().subtract(aplicadoDelPago(pagoId));
			if (importe.compareTo(disponible) > 0) {
				throw new MotorFinancieroException(Codigo.INSUFFICIENT_BALANCE,
						"El importe supera lo verificado sin aplicar (" + disponible + ")");
			}
			BigDecimal saldo = o.monto().subtract(aplicadoDeObligacion(obligacionId));
			if (importe.compareTo(saldo) > 0) {
				throw new MotorFinancieroException(Codigo.INSUFFICIENT_BALANCE,
						"El importe supera el saldo de la obligacion (" + saldo + ")");
			}
			var fila = jdbc.queryForMap("""
					INSERT INTO keptai.aplicacion_pago (organizacion_id, pago_id, obligacion_id, monto_aplicado, aplicado_por)
					VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?) RETURNING id, aplicado_en""",
					pagoId, obligacionId, importe, ctx.usuarioId());
			UUID aplicacionId = (UUID) fila.get("id");
			OffsetDateTime aplicadoEn = jdbc.queryForObject(
					"SELECT aplicado_en FROM keptai.aplicacion_pago WHERE id = ?", OffsetDateTime.class, aplicacionId);
			recalcularObligacion(obligacionId);
			recalcularPago(pagoId);
			BigDecimal saldoNuevo = saldo.subtract(importe);
			List<UUID> resueltas = new ArrayList<>(jdbc.queryForList("""
					UPDATE keptai.alerta_cobranza SET estado = 'RESUELTA', cerrada_en = now(),
					       resolucion = 'Pago verificado aplicado'
					 WHERE pago_id = ? AND regla = 'PAGO_EN_REVISION' AND estado = 'ABIERTA' RETURNING id""",
					UUID.class, pagoId));
			int cancelados = 0;
			if (saldoNuevo.signum() == 0) {
				resueltas.addAll(jdbc.queryForList("""
						UPDATE keptai.alerta_cobranza SET estado = 'RESUELTA', cerrada_en = now(),
						       resolucion = 'Obligacion saldada con pago aplicado'
						 WHERE obligacion_id = ? AND estado = 'ABIERTA' RETURNING id""", UUID.class, obligacionId));
				cancelados = jdbc.update("""
						UPDATE keptai.envio_notificacion SET estado = 'CANCELADO'
						 WHERE obligacion_id = ? AND estado = 'PENDIENTE'""", obligacionId);
			}
			auditar(ctx, "PAGO_APLICADO", "aplicacion_pago", aplicacionId, """
					jsonb_build_object('pago_id', ?::uuid, 'obligacion_id', ?::uuid, 'monto', ?::numeric,
					                   'saldo_resultante', ?::numeric)""", pagoId, obligacionId, importe, saldoNuevo);
			return new Aplicacion(aplicacionId, aplicadoEn, importe, estadoPago(pagoId), leerSaldo(obligacionId),
					List.copyOf(resueltas), cancelados);
		});
	}

	/** Anula una aplicacion con motivo; no borra historia. Reanular se rechaza y no resta dos veces. */
	public Anulacion anularAplicacion(ContextoFinanciero ctx, UUID aplicacionId, String motivo) {
		if (motivo == null || motivo.isBlank() || motivo.length() > 500) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "Motivo obligatorio (maximo 500 caracteres)");
		}
		return enTransaccion(ctx, ESCRITURA, () -> {
			List<java.util.Map<String, Object>> refs = jdbc.queryForList(
					"SELECT pago_id, obligacion_id FROM keptai.aplicacion_pago WHERE id = ?", aplicacionId);
			if (refs.isEmpty()) {
				throw new MotorFinancieroException(Codigo.NOT_FOUND, "Aplicacion no encontrada");
			}
			UUID pagoId = (UUID) refs.get(0).get("pago_id");
			UUID obligacionId = (UUID) refs.get(0).get("obligacion_id");
			bloquearPago(pagoId);
			bloquearObligacion(obligacionId);
			Boolean anulada = jdbc.queryForObject(
					"SELECT anulada_en IS NOT NULL FROM keptai.aplicacion_pago WHERE id = ? FOR UPDATE", Boolean.class,
					aplicacionId);
			if (Boolean.TRUE.equals(anulada)) {
				throw new MotorFinancieroException(Codigo.INVALID_STATE, "La aplicacion ya estaba anulada");
			}
			OffsetDateTime en = jdbc.queryForObject("""
					UPDATE keptai.aplicacion_pago SET anulada_en = now(), anulada_por = ?, motivo_anulacion = ?
					 WHERE id = ? RETURNING anulada_en""", OffsetDateTime.class, ctx.usuarioId(), motivo.strip(),
					aplicacionId);
			recalcularObligacion(obligacionId);
			recalcularPago(pagoId);
			auditar(ctx, "APLICACION_ANULADA", "aplicacion_pago", aplicacionId,
					"jsonb_build_object('pago_id', ?::uuid, 'obligacion_id', ?::uuid)", pagoId, obligacionId);
			return new Anulacion(aplicacionId, en, estadoPago(pagoId), leerSaldo(obligacionId));
		});
	}

	public SaldoObligacion saldo(ContextoFinanciero ctx, UUID obligacionId) {
		return enTransaccion(ctx, LECTURA_SALDOS, () -> leerSaldo(obligacionId));
	}

	public EstadoPago estadoPago(ContextoFinanciero ctx, UUID pagoId) {
		return enTransaccion(ctx, LECTURA_PAGOS, () -> {
			leerPago(pagoId, false);
			return estadoPago(pagoId);
		});
	}

	// ---------------------------------------------------------------------------------------------------------------

	private record PagoFila(UUID id, UUID clienteId, BigDecimal monto, String moneda, LocalDate fechaPago,
			String codigoOperacion, String fase, String estadoConciliacion, UUID duplicadoDe, OffsetDateTime creadoEn) {
		boolean duplicado() {
			return "DUPLICADO".equals(estadoConciliacion);
		}
	}

	private record ObligacionFila(UUID id, BigDecimal monto, String moneda, String estado, UUID clienteId) {
	}

	private <T> T enTransaccion(ContextoFinanciero ctx, Set<String> roles, Supplier<T> trabajo) {
		try {
			return tx.execute(estado -> {
				jdbc.queryForObject("""
						SELECT set_config('app.organizacion_id', ?, true) || set_config('app.usuario_id', ?, true)
						       || set_config('app.servicio_id', ?, true)""", String.class,
						ctx.organizacionId().toString(), texto(ctx.usuarioId()), texto(ctx.servicioId()));
				String actor = jdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class);
				if (actor == null) {
					throw new MotorFinancieroException(Codigo.FORBIDDEN,
							"Sin usuario o servicio activo en la organizacion");
				}
				if (!roles.contains(actor)) {
					throw new MotorFinancieroException(Codigo.FORBIDDEN, "El rol " + actor + " no puede ejecutar esta operacion");
				}
				return trabajo.get();
			});
		} catch (MotorFinancieroException e) {
			throw e;
		} catch (DataAccessException e) {
			throw traducir(e);
		}
	}

	private static String texto(UUID id) {
		return id == null ? "" : id.toString();
	}

	private PagoFila leerPago(UUID pagoId, boolean bloquear) {
		List<PagoFila> filas = jdbc.query("""
				SELECT id, cliente_id, monto, moneda, fecha_pago, codigo_operacion, fase, estado_conciliacion,
				       duplicado_de_pago_id, creado_en
				  FROM keptai.pago WHERE id = ?""" + (bloquear ? " FOR UPDATE" : ""),
				(rs, i) -> new PagoFila(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getBigDecimal(3),
						rs.getString(4).trim(), rs.getObject(5, LocalDate.class), rs.getString(6), rs.getString(7),
						rs.getString(8), rs.getObject(9, UUID.class), rs.getObject(10, OffsetDateTime.class)),
				pagoId);
		if (filas.isEmpty()) {
			throw new MotorFinancieroException(Codigo.NOT_FOUND, "Pago no encontrado");
		}
		return filas.get(0);
	}

	private PagoFila bloquearPago(UUID pagoId) {
		return leerPago(pagoId, true);
	}

	private ObligacionFila bloquearObligacion(UUID obligacionId) {
		List<ObligacionFila> filas = jdbc.query("""
				SELECT o.id, o.monto, o.moneda, o.estado, ord.cliente_id
				  FROM keptai.obligacion_cobro o
				  JOIN keptai.orden ord ON ord.organizacion_id = o.organizacion_id AND ord.id = o.orden_id
				 WHERE o.id = ? FOR UPDATE OF o""",
				(rs, i) -> new ObligacionFila(rs.getObject(1, UUID.class), rs.getBigDecimal(2), rs.getString(3).trim(),
						rs.getString(4), rs.getObject(5, UUID.class)),
				obligacionId);
		if (filas.isEmpty()) {
			throw new MotorFinancieroException(Codigo.NOT_FOUND, "Obligacion no encontrada");
		}
		return filas.get(0);
	}

	/** Original = pago anterior (creado_en, id) no duplicado con la misma referencia, monto y fecha. */
	private Optional<UUID> buscarOriginal(PagoFila p) {
		if (p.codigoOperacion() == null || p.codigoOperacion().isBlank()) {
			return Optional.empty();
		}
		return jdbc.queryForList("""
				SELECT id FROM keptai.pago
				 WHERE organizacion_id = keptai.app_organizacion_actual() AND id <> ?
				   AND codigo_operacion = ? AND monto = ? AND fecha_pago = ? AND estado_conciliacion <> 'DUPLICADO'
				   AND (creado_en, id) < (?, ?)
				 ORDER BY creado_en, id LIMIT 1""", UUID.class,
				p.id(), p.codigoOperacion(), p.monto(), p.fechaPago(), p.creadoEn(), p.id()).stream().findFirst();
	}

	private BigDecimal aplicadoDelPago(UUID pagoId) {
		return jdbc.queryForObject("""
				SELECT coalesce(sum(monto_aplicado), 0) FROM keptai.aplicacion_pago
				 WHERE pago_id = ? AND anulada_en IS NULL""", BigDecimal.class, pagoId);
	}

	private BigDecimal aplicadoDeObligacion(UUID obligacionId) {
		return jdbc.queryForObject("""
				SELECT coalesce(sum(monto_aplicado), 0) FROM keptai.aplicacion_pago
				 WHERE obligacion_id = ? AND anulada_en IS NULL""", BigDecimal.class, obligacionId);
	}

	/** Estado persistido coherente con el saldo calculado y la fecha local de la organizacion. */
	private void recalcularObligacion(UUID obligacionId) {
		jdbc.update("""
				UPDATE keptai.obligacion_cobro o
				   SET estado = CASE WHEN s.saldo = 0 THEN 'PAGADA'
				                     WHEN o.vence_en IS NOT NULL
				                      AND o.vence_en < timezone(org.zona_horaria, now())::date THEN 'MORA'
				                     WHEN s.cobrado > 0 THEN 'PARCIAL'
				                     ELSE 'PENDIENTE' END,
				       actualizado_en = now(), version = o.version + 1
				  FROM keptai.v_saldo_obligacion s, keptai.organizacion org
				 WHERE o.id = ? AND s.obligacion_id = o.id AND org.id = o.organizacion_id""", obligacionId);
	}

	/** APLICADO si todo lo aplicado salda sus obligaciones; PARCIAL si alguna sigue con saldo. */
	private void recalcularPago(UUID pagoId) {
		jdbc.update("""
				UPDATE keptai.pago p
				   SET fase = CASE WHEN x.usado > 0 THEN 'APLICADO' ELSE 'VERIFICADO_BANCO' END,
				       estado_conciliacion = CASE WHEN x.usado = 0 THEN 'PENDIENTE'
				                                  WHEN x.con_saldo THEN 'PARCIAL' ELSE 'APLICADO' END,
				       actualizado_en = now(), version = p.version + 1
				  FROM (SELECT coalesce(sum(a.monto_aplicado), 0) AS usado,
				               coalesce(bool_or(s.saldo > 0), false) AS con_saldo
				          FROM keptai.aplicacion_pago a
				          JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = a.obligacion_id
				         WHERE a.pago_id = ? AND a.anulada_en IS NULL) x
				 WHERE p.id = ?""", pagoId, pagoId);
	}

	private EstadoPago estadoPago(UUID pagoId) {
		return jdbc.queryForObject("""
				SELECT p.id, p.fase, p.estado_conciliacion, p.monto, p.duplicado_de_pago_id,
				       coalesce(sum(a.monto_aplicado) FILTER (WHERE a.anulada_en IS NULL), 0) AS aplicado
				  FROM keptai.pago p LEFT JOIN keptai.aplicacion_pago a ON a.pago_id = p.id
				 WHERE p.id = ? GROUP BY p.id""",
				(rs, i) -> {
					String fase = rs.getString(2);
					String estado = rs.getString(3);
					BigDecimal monto = rs.getBigDecimal(4);
					BigDecimal aplicado = rs.getBigDecimal(6);
					boolean verificado = !"RECIBIDO".equals(fase) && !"DUPLICADO".equals(estado);
					BigDecimal sinAplicar = verificado ? monto.subtract(aplicado) : BigDecimal.ZERO.setScale(2);
					return new EstadoPago(rs.getObject(1, UUID.class), fase, estado, monto, aplicado, sinAplicar,
							rs.getObject(5, UUID.class));
				}, pagoId);
	}

	private SaldoObligacion leerSaldo(UUID obligacionId) {
		List<SaldoObligacion> filas = jdbc.query("""
				SELECT o.id, o.orden_id, o.monto, coalesce(s.cobrado, 0), coalesce(s.saldo, 0), o.moneda, o.vence_en, o.estado
				  FROM keptai.obligacion_cobro o LEFT JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = o.id
				 WHERE o.id = ?""",
				(rs, i) -> new SaldoObligacion(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
						rs.getBigDecimal(3), rs.getBigDecimal(4), rs.getBigDecimal(5), rs.getString(6).trim(),
						rs.getObject(7, LocalDate.class), rs.getString(8)),
				obligacionId);
		if (filas.isEmpty()) {
			throw new MotorFinancieroException(Codigo.NOT_FOUND, "Obligacion no encontrada");
		}
		return filas.get(0);
	}

	/** Auditoria append-only en la misma transaccion; actor USUARIO = usuario del contexto (politica V7). */
	private void auditar(ContextoFinanciero ctx, String operacion, String entidad, UUID entidadId, String cambiosSql,
			Object... parametros) {
		Object[] args = new Object[5 + parametros.length];
		args[0] = ctx.usuarioId();
		args[1] = operacion;
		args[2] = entidad;
		args[3] = entidadId;
		System.arraycopy(parametros, 0, args, 4, parametros.length);
		args[args.length - 1] = MDC.get(RequestIdFilter.MDC_KEY);
		jdbc.update("INSERT INTO keptai.evento_auditoria (organizacion_id, usuario_id, actor, operacion, entidad, entidad_id, cambios, request_id) "
				+ "VALUES (keptai.app_organizacion_actual(), ?, 'USUARIO', ?, ?, ?, " + cambiosSql + ", ?)", args);
	}

	private static BigDecimal validarImporte(BigDecimal monto) {
		if (monto == null || monto.signum() <= 0) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "El importe debe ser positivo");
		}
		if (monto.stripTrailingZeros().scale() > 2) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "El importe admite como maximo dos decimales");
		}
		return monto.setScale(2, RoundingMode.UNNECESSARY);
	}

	/** Errores SQL de invariantes/permisos/bloqueos a codigos de dominio; el resto se propaga. */
	private static RuntimeException traducir(DataAccessException e) {
		Throwable t = e;
		while (t != null && !(t instanceof SQLException)) {
			t = t.getCause();
		}
		String estado = t == null ? null : ((SQLException) t).getSQLState();
		String detalle = t == null ? e.getMessage() : t.getMessage();
		if (estado == null) {
			return e;
		}
		return switch (estado) {
			case "42501" -> new MotorFinancieroException(Codigo.FORBIDDEN, "Operacion no autorizada por la base", e);
			case "23514" -> detalle != null && detalle.contains("Sobreaplicacion")
					? new MotorFinancieroException(Codigo.INSUFFICIENT_BALANCE, "Sobreaplicacion rechazada por la base", e)
					: new MotorFinancieroException(Codigo.INVALID_STATE, "Invariante financiero rechazado por la base", e);
			case "40P01", "40001", "55P03" ->
					new MotorFinancieroException(Codigo.CONCURRENCY_CONFLICT, "Conflicto de concurrencia; reintentar", e);
			default -> e;
		};
	}
}
