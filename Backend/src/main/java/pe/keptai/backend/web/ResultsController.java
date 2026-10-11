package pe.keptai.backend.web;

import static pe.keptai.backend.panel.PanelRequests.asOf;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.ResultsDtos.CashForecast;
import pe.keptai.backend.contract.ResultsDtos.MarginReport;
import pe.keptai.backend.contract.ResultsDtos.ProductionCenterReport;
import pe.keptai.backend.contract.ResultsDtos.ResultsSummary;
import pe.keptai.backend.panel.PageRequest;
import pe.keptai.backend.panel.ResultsAdapter;

/** Resultados de gerencia y CSV de pedidos (MotorResultados, MotorCaja). */
@RestController
public class ResultsController {

	private static final MediaType CSV = new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8);

	private final ResultsAdapter results;

	public ResultsController(ResultsAdapter results) {
		this.results = results;
	}

	@GetMapping("/api/v1/results/summary")
	public ResultsSummary summary(@RequestParam(name = "as_of", required = false) String asOfDate) {
		return results.summary(asOf(asOfDate));
	}

	@GetMapping("/api/v1/results/margins")
	public MarginReport margins(@RequestParam(name = "as_of", required = false) String asOfDate,
			@RequestParam(name = "group_by", required = false) String groupBy,
			@RequestParam(name = "production_mode", required = false) String productionMode,
			@RequestParam(required = false) Integer limit, @RequestParam(required = false) String cursor) {
		return results.margins(asOf(asOfDate), groupBy, productionMode, PageRequest.of(limit, cursor));
	}

	@GetMapping("/api/v1/results/production-center")
	public ProductionCenterReport productionCenter(@RequestParam(name = "as_of", required = false) String asOfDate,
			@RequestParam(required = false) Integer limit, @RequestParam(required = false) String cursor) {
		return results.productionCenter(asOf(asOfDate), PageRequest.of(limit, cursor));
	}

	@GetMapping("/api/v1/results/cash-forecast")
	public CashForecast cashForecast(@RequestParam(name = "as_of", required = false) String asOfDate) {
		return results.cashForecast(asOf(asOfDate));
	}

	@GetMapping("/api/v1/reports/orders.csv")
	public ResponseEntity<String> ordersCsv(@RequestParam(name = "as_of", required = false) String asOfDate) {
		var corte = asOf(asOfDate);
		return ResponseEntity.ok()
			.contentType(CSV)
			.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"pedidos-" + corte + ".csv\"")
			.body(results.ordersCsv(corte));
	}

}
