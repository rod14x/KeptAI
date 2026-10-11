package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosFinancieros.*;

// C-07: caja a 4 semanas (lunes a domingo desde el primer lunes posterior a la fecha de corte).
// Los dias entre la fecha de corte y ese lunes entran en la semana 1. Cobro esperado = saldo calculado de cada
// obligacion (vencida -> semana 1); realizado = pagos verificados no duplicados con fecha_pago en la semana, esten o
// no aplicados (un pago no se cuenta como esperado y realizado a la vez). Sin apertura los cierres son null.
public class MotorCaja extends TransaccionFinanciera {

	static final int SEMANAS = 4;
	private static final Set<String> LECTURA = Set.of("GERENTE", "ADMIN", "SCHEDULER");
	private static final BigDecimal CERO = BigDecimal.ZERO.setScale(2);

	public MotorCaja(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		super(jdbc, transactionManager);
	}

	public ProyeccionCaja proyectar(ContextoFinanciero ctx, LocalDate fechaCorte, int riesgoCobroBps) {
		LocalDate corte = MotorResultados.exigirFecha(fechaCorte);
		if (riesgoCobroBps < 0 || riesgoCobroBps > 10_000) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "El riesgo de cobro va de 0 a 10000 puntos basicos");
		}
		return enTransaccion(ctx, LECTURA, () -> {
			String moneda = jdbc.queryForObject(
					"SELECT moneda_base FROM keptai.organizacion WHERE id = keptai.app_organizacion_actual()", String.class).trim();
			LocalDate primerLunes = corte.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
			LocalDate fin = primerLunes.plusDays(7L * SEMANAS - 1);

			List<Map<String, Object>> filaApertura = jdbc.queryForList("""
					SELECT importe, fecha, fuente FROM keptai.apertura_caja
					 WHERE moneda = ? AND fecha <= ? ORDER BY fecha DESC LIMIT 1""", moneda, corte);
			AperturaCaja apertura = filaApertura.isEmpty() ? null : new AperturaCaja(
					(BigDecimal) filaApertura.get(0).get("importe"), fecha(filaApertura.get(0).get("fecha")),
					(String) filaApertura.get(0).get("fuente"));
			BigDecimal saldoInicial = apertura == null ? null : apertura.monto()
					.add(realizado(moneda, apertura.fecha(), corte)).subtract(egresosRealizados(moneda, apertura.fecha(), corte));

			BigDecimal[] esperado = ceros(), realizado = ceros(), egresos = ceros();
			BigDecimal sinFecha = CERO, fueraHorizonte = CERO;
			for (Map<String, Object> o : jdbc.queryForList(
					"SELECT saldo, vence_en FROM keptai.v_saldo_obligacion WHERE moneda = ? AND saldo > 0", moneda)) {
				BigDecimal saldo = (BigDecimal) o.get("saldo");
				LocalDate vence = fecha(o.get("vence_en"));
				if (vence == null) {
					sinFecha = sinFecha.add(saldo);
				} else if (vence.isAfter(fin)) {
					fueraHorizonte = fueraHorizonte.add(saldo);
				} else {
					int s = semana(vence, corte, primerLunes);
					esperado[s] = esperado[s].add(saldo);
				}
			}
			for (Map<String, Object> p : jdbc.queryForList("""
					SELECT fecha_pago AS fecha, monto FROM keptai.pago
					 WHERE moneda = ? AND fase IN ('VERIFICADO_BANCO', 'APLICADO') AND estado_conciliacion <> 'DUPLICADO'
					   AND fecha_pago > ? AND fecha_pago <= ?""", moneda, corte, fin)) {
				int s = semana(fecha(p.get("fecha")), corte, primerLunes);
				realizado[s] = realizado[s].add((BigDecimal) p.get("monto"));
			}
			for (Map<String, Object> e : jdbc.queryForList("""
					SELECT fecha_prevista AS fecha, monto FROM keptai.egreso_caja
					 WHERE moneda = ? AND estado = 'PREVISTO' AND fecha_prevista <= ?
					UNION ALL
					SELECT fecha_realizada, monto FROM keptai.egreso_caja
					 WHERE moneda = ? AND estado = 'REALIZADO' AND fecha_realizada > ? AND fecha_realizada <= ?""",
					moneda, fin, moneda, corte, fin)) {
				int s = semana(fecha(e.get("fecha")), corte, primerLunes);
				egresos[s] = egresos[s].add((BigDecimal) e.get("monto"));
			}

			List<SemanaCaja> semanas = new ArrayList<>();
			BigDecimal saldo = saldoInicial;
			for (int s = 0; s < SEMANAS; s++) {
				BigDecimal esperadoAjustado = esperado[s].multiply(BigDecimal.valueOf(10_000L - riesgoCobroBps))
						.divide(BigDecimal.valueOf(10_000L), 2, RoundingMode.HALF_EVEN);
				BigDecimal neto = esperadoAjustado.add(realizado[s]).subtract(egresos[s]);
				saldo = saldo == null ? null : saldo.add(neto);
				LocalDate inicio = primerLunes.plusWeeks(s);
				semanas.add(new SemanaCaja(inicio, inicio.plusDays(6), esperadoAjustado, realizado[s], egresos[s], neto, saldo));
			}
			BigDecimal sinAsignar = jdbc.queryForObject("""
					SELECT coalesce(sum(p.monto - coalesce(a.usado, 0)), 0) FROM keptai.pago p
					  LEFT JOIN (SELECT pago_id, sum(monto_aplicado) AS usado FROM keptai.aplicacion_pago
					              WHERE anulada_en IS NULL GROUP BY pago_id) a ON a.pago_id = p.id
					 WHERE p.moneda = ? AND p.fase IN ('VERIFICADO_BANCO', 'APLICADO') AND p.estado_conciliacion <> 'DUPLICADO'""",
					BigDecimal.class, moneda);
			return new ProyeccionCaja(corte, moneda, apertura, saldoInicial, riesgoCobroBps, List.copyOf(semanas),
					sinFecha, fueraHorizonte, sinAsignar);
		});
	}

	private BigDecimal realizado(String moneda, LocalDate desdeExclusivo, LocalDate hasta) {
		return jdbc.queryForObject("""
				SELECT coalesce(sum(monto), 0) FROM keptai.pago
				 WHERE moneda = ? AND fase IN ('VERIFICADO_BANCO', 'APLICADO') AND estado_conciliacion <> 'DUPLICADO'
				   AND fecha_pago > ? AND fecha_pago <= ?""", BigDecimal.class, moneda, desdeExclusivo, hasta);
	}

	private BigDecimal egresosRealizados(String moneda, LocalDate desdeExclusivo, LocalDate hasta) {
		return jdbc.queryForObject("""
				SELECT coalesce(sum(monto), 0) FROM keptai.egreso_caja
				 WHERE moneda = ? AND estado = 'REALIZADO' AND fecha_realizada > ? AND fecha_realizada <= ?""",
				BigDecimal.class, moneda, desdeExclusivo, hasta);
	}

	private static int semana(LocalDate fecha, LocalDate corte, LocalDate primerLunes) {
		if (!fecha.isAfter(corte) || fecha.isBefore(primerLunes)) {
			return 0;
		}
		return (int) Math.min(SEMANAS - 1, (fecha.toEpochDay() - primerLunes.toEpochDay()) / 7);
	}

	private static LocalDate fecha(Object valor) {
		if (valor == null) {
			return null;
		}
		return valor instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) valor;
	}

	private static BigDecimal[] ceros() {
		BigDecimal[] arreglo = new BigDecimal[SEMANAS];
		java.util.Arrays.fill(arreglo, CERO);
		return arreglo;
	}
}
