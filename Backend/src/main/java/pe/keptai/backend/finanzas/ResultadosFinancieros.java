package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ResultadosFinancieros {

	private ResultadosFinancieros() {
	}

	public enum Agrupacion {
		ORDEN, MARCA, LINEA
	}

	// costoTotal y margen son null si el costeo esta incompleto: nunca se presenta costo cero por ausencia.
	public record FilaMargen(String clave, UUID id, String tipoProduccion, BigDecimal ingreso, BigDecimal costoTotal,
			BigDecimal margen, boolean completo, List<String> componentesFaltantes, int ordenes) {
	}

	public record ReporteMargen(LocalDate fechaCorte, Agrupacion agrupacion, List<FilaMargen> filas, FilaMargen totales) {
	}

	public record FilaCentro(UUID ordenId, String ref, UUID unidadId, String unidad, BigDecimal cargoInterno,
			BigDecimal costoTaller, BigDecimal resultadoTaller, BigDecimal resultadoComercial,
			BigDecimal margenConsolidado, boolean completo) {
	}

	public record ReporteCentro(LocalDate fechaCorte, List<FilaCentro> filas, BigDecimal resultadoTalleres,
			BigDecimal resultadoComercial, BigDecimal margenConsolidado, boolean completo) {
	}

	public record Resumen(LocalDate fechaCorte, BigDecimal ventas, BigDecimal cobradoAplicado, BigDecimal saldoPendiente,
			BigDecimal costoTotal, BigDecimal margen, boolean costosCompletos, List<String> componentesFaltantes) {
	}

	public record AperturaCaja(BigDecimal monto, LocalDate fecha, String fuente) {
	}

	// cierre es null sin apertura cargada; un saldo negativo es valido.
	public record SemanaCaja(LocalDate inicio, LocalDate fin, BigDecimal esperado, BigDecimal realizado,
			BigDecimal egresos, BigDecimal neto, BigDecimal cierre) {
	}

	public record ProyeccionCaja(LocalDate fechaCorte, String moneda, AperturaCaja apertura, BigDecimal saldoInicial,
			int riesgoCobroBps, List<SemanaCaja> semanas, BigDecimal cobrosSinFecha, BigDecimal cobrosFueraHorizonte,
			BigDecimal dineroSinAsignar) {
		public boolean aperturaCargada() {
			return apertura != null;
		}
	}
}
