package pe.keptai.backend.panel;

import static pe.keptai.backend.panel.PanelMapping.money;
import static pe.keptai.backend.panel.PanelMapping.nonNegative;
import static pe.keptai.backend.panel.PanelMapping.nonNegativeOrZero;

import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.ContractEnums.CostComponent;
import pe.keptai.backend.contract.ContractEnums.CostStatus;
import pe.keptai.backend.contract.ContractEnums.DataOrigin;
import pe.keptai.backend.contract.ContractEnums.ForecastStatus;
import pe.keptai.backend.contract.ContractEnums.MarginGroupBy;
import pe.keptai.backend.contract.ContractEnums.OpeningCashSource;
import pe.keptai.backend.contract.ContractEnums.ProductionMode;
import pe.keptai.backend.contract.ResultsDtos.CashAssumptions;
import pe.keptai.backend.contract.ResultsDtos.CashForecast;
import pe.keptai.backend.contract.ResultsDtos.CashWeek;
import pe.keptai.backend.contract.ResultsDtos.MarginReport;
import pe.keptai.backend.contract.ResultsDtos.MarginRow;
import pe.keptai.backend.contract.ResultsDtos.OpeningCash;
import pe.keptai.backend.contract.ResultsDtos.ProductionCenterReport;
import pe.keptai.backend.contract.ResultsDtos.ProductionCenterRow;
import pe.keptai.backend.contract.ResultsDtos.ResultsSummary;
import pe.keptai.backend.finanzas.MotorCaja;
import pe.keptai.backend.finanzas.MotorResultados;
import pe.keptai.backend.finanzas.ResultadosFinancieros.Agrupacion;
import pe.keptai.backend.finanzas.ResultadosFinancieros.FilaMargen;
import pe.keptai.backend.finanzas.ResultadosFinancieros.ProyeccionCaja;
import pe.keptai.backend.finanzas.ResultadosFinancieros.ReporteCentro;
import pe.keptai.backend.finanzas.ResultadosFinancieros.ReporteMargen;
import pe.keptai.backend.finanzas.ResultadosFinancieros.Resumen;

/**
 * Resultados de gerencia (C-02/C-05/C-06/C-07): las cifras las calcula {@link MotorResultados}/{@link MotorCaja}; este
 * adaptador solo convierte soles a centavos y nombres del motor a los del contrato. Costo incompleto = {@code null},
 * nunca cero. El riesgo de cobro es el supuesto del escenario (0 por defecto, contrato CashAssumptions).
 */
@Service
public class ResultsAdapter {

	private final PanelContext panel;

	private final ObjectProvider<MotorResultados> resultados;

	private final ObjectProvider<MotorCaja> caja;

	public ResultsAdapter(PanelContext panel, ObjectProvider<MotorResultados> resultados, ObjectProvider<MotorCaja> caja) {
		this.panel = panel;
		this.resultados = resultados;
		this.caja = caja;
	}

	public ResultsSummary summary(LocalDate asOf) {
		Resumen r = motor().resumen(panel.financiero(), asOf);
		// Costeo sin cerrar con todos los conceptos presentes: falta la certificación, no un componente (lista vacía).
		List<CostComponent> faltantes = components(r.componentesFaltantes());
		boolean completo = r.costosCompletos() && r.costoTotal() != null;
		return new ResultsSummary(r.fechaCorte(), nonNegativeOrZero(r.ventas()), nonNegativeOrZero(r.cobradoAplicado()),
				nonNegativeOrZero(r.saldoPendiente()), completo ? nonNegative(r.costoTotal()) : null,
				completo ? money(r.margen()) : null, completo ? CostStatus.COMPLETE : CostStatus.INCOMPLETE,
				completo ? List.of() : faltantes, origin());
	}

	public MarginReport margins(LocalDate asOf, String groupBy, String productionMode, PageRequest page) {
		Agrupacion agrupacion;
		MarginGroupBy grupo;
		switch (groupBy == null ? "" : groupBy) {
			case "order" -> {
				agrupacion = Agrupacion.ORDEN;
				grupo = MarginGroupBy.ORDER;
			}
			case "brand" -> {
				agrupacion = Agrupacion.MARCA;
				grupo = MarginGroupBy.BRAND;
			}
			case "product_line" -> {
				agrupacion = Agrupacion.LINEA;
				grupo = MarginGroupBy.PRODUCT_LINE;
			}
			default -> throw PanelException.badRequest("group_by debe ser order, brand o product_line");
		}
		String tipo = switch (productionMode == null ? "" : productionMode) {
			case "" -> null;
			case "own" -> "INTERNA";
			case "outsourced" -> "TERCERIZADA";
			default -> throw PanelException.badRequest("production_mode debe ser own u outsourced");
		};
		ReporteMargen r = motor().margen(panel.financiero(), agrupacion, tipo, asOf);
		List<MarginRow> rows = r.filas().stream().map(this::row).toList();
		PageResponse<MarginRow> p = page.slice(rows);
		return new MarginReport(r.fechaCorte(), grupo, p.items(), row(r.totales()), p.page(), origin());
	}

	public ProductionCenterReport productionCenter(LocalDate asOf, PageRequest page) {
		ReporteCentro r = motor().centroProductivo(panel.financiero(), asOf);
		// Sin costeo completo el motor no calcula el resultado comercial; el contrato lo exige, así que la fila no se emite.
		List<ProductionCenterRow> rows = r.filas().stream().filter(f -> f.resultadoComercial() != null)
			.map(f -> new ProductionCenterRow(f.ordenId(), f.ref(), nonNegativeOrZero(f.cargoInterno()),
					nonNegative(f.costoTaller()), money(f.resultadoTaller()), money(f.resultadoComercial()),
					money(f.margenConsolidado()), true))
			.toList();
		PageResponse<ProductionCenterRow> p = page.slice(rows);
		return new ProductionCenterReport(r.fechaCorte(), p.items(), p.page(), origin());
	}

	public CashForecast cashForecast(LocalDate asOf) {
		MotorCaja m = caja.getIfAvailable();
		if (m == null) {
			throw PanelException.unavailable();
		}
		ProyeccionCaja c = m.proyectar(panel.financiero(), asOf, 0);
		OpeningCash apertura = c.apertura() == null ? null : new OpeningCash(money(c.apertura().monto()),
				c.apertura().fecha(), c.apertura().fuente() != null && c.apertura().fuente().contains("semilla")
						? OpeningCashSource.DEMO_FIXTURE : OpeningCashSource.MANUAL_ENTRY);
		List<CashWeek> semanas = c.semanas().stream()
			.map(s -> new CashWeek(s.inicio(), s.fin(), nonNegativeOrZero(s.esperado()), nonNegativeOrZero(s.realizado()),
					nonNegativeOrZero(s.egresos()), money(s.neto()), c.aperturaCargada() ? money(s.cierre()) : null))
			.toList();
		return new CashForecast(c.fechaCorte(), c.aperturaCargada() ? ForecastStatus.COMPLETE : ForecastStatus.MISSING_OPENING_CASH,
				apertura, new CashAssumptions(c.riesgoCobroBps(), "scenario_assumption"), semanas, origin());
	}

	public String ordersCsv(LocalDate asOf) {
		return motor().csvPedidos(panel.financiero(), asOf);
	}

	private MarginRow row(FilaMargen f) {
		boolean completo = f.completo() && f.costoTotal() != null;
		List<CostComponent> faltantes = components(f.componentesFaltantes());
		return new MarginRow(f.clave(), f.id(), f.tipoProduccion() == null ? null
				: "TERCERIZADA".equals(f.tipoProduccion()) ? ProductionMode.OUTSOURCED : ProductionMode.OWN,
				nonNegativeOrZero(f.ingreso()), completo ? nonNegative(f.costoTotal()) : null,
				completo ? money(f.margen()) : null, completo ? CostStatus.COMPLETE : CostStatus.INCOMPLETE,
				completo ? List.of() : faltantes, f.ordenes());
	}

	private static List<CostComponent> components(List<String> conceptos) {
		return conceptos.stream().map(PanelMapping.COST_COMPONENT::get).filter(java.util.Objects::nonNull).distinct()
			.limit(4).toList();
	}

	/** La procedencia del reporte es la de la organización: la semilla ficticia vive solo en organizaciones DEMO. */
	private DataOrigin origin() {
		return panel.read(() -> Boolean.TRUE.equals(panel.jdbc().queryForObject(
				"SELECT nombre LIKE 'DEMO %' FROM keptai.organizacion WHERE id = keptai.app_organizacion_actual()",
				Boolean.class)) ? DataOrigin.DEMO_FIXTURE : DataOrigin.MANUAL_ENTRY);
	}

	private MotorResultados motor() {
		MotorResultados m = resultados.getIfAvailable();
		if (m == null) {
			throw PanelException.unavailable();
		}
		return m;
	}

}
