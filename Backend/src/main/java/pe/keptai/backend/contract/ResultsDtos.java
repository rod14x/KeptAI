package pe.keptai.backend.contract;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.keptai.backend.contract.CommonDtos.Money;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PageInfo;
import pe.keptai.backend.contract.ContractEnums.CostComponent;
import pe.keptai.backend.contract.ContractEnums.CostStatus;
import pe.keptai.backend.contract.ContractEnums.DataOrigin;
import pe.keptai.backend.contract.ContractEnums.ForecastStatus;
import pe.keptai.backend.contract.ContractEnums.MarginGroupBy;
import pe.keptai.backend.contract.ContractEnums.OpeningCashSource;
import pe.keptai.backend.contract.ContractEnums.ProductionMode;

/**
 * Resultados: costos, margen, centro productivo y caja a 4 semanas. Contrato PROPUESTO MIG-02. Las cifras las calcula el
 * motor de Andres (MIG-07). Ausente y cero son distintos: costos incompletos dejan costo y margen en {@code null}.
 */
public final class ResultsDtos {

	/** Columnas del CSV de pedidos (importes en centavos; celda vacia = ausente). */
	public static final List<String> ORDERS_CSV_COLUMNS = List.of("order_id", "order_code", "brand", "production_mode",
			"currency", "sale_cents", "cost_cents", "margin_cents", "cost_status", "applied_cents", "balance_cents",
			"due_date", "receivable_status", "data_origin");

	private ResultsDtos() {
	}

	/** Costo completo exige costo y margen; incompleto los deja nulos y enumera lo que falta. */
	static boolean costShapeConsistent(CostStatus status, Object cost, Object margin, List<CostComponent> missing) {
		if (status == null || missing == null) {
			return true;
		}
		return status == CostStatus.COMPLETE ? cost != null && margin != null && missing.isEmpty()
				: cost == null && margin == null && !missing.isEmpty();
	}

	public record ResultsSummary(
			@JsonProperty("as_of") @NotNull LocalDate asOf,
			@JsonProperty("sales_total") @NotNull @Valid NonNegativeMoney salesTotal,
			@JsonProperty("applied_collections_total") @NotNull @Valid NonNegativeMoney appliedCollectionsTotal,
			@JsonProperty("pending_balance_total") @NotNull @Valid NonNegativeMoney pendingBalanceTotal,
			@JsonProperty("cost_total") @Valid NonNegativeMoney costTotal,
			@JsonProperty("margin_total") @Valid Money marginTotal,
			@JsonProperty("cost_status") @NotNull CostStatus costStatus,
			@JsonProperty("missing_cost_components") @NotNull @Size(max = 4) List<@NotNull CostComponent> missingCostComponents,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin) {

		@JsonIgnore
		@AssertTrue(message = "costos incompletos: cost_total y margin_total deben ser null y listar lo que falta")
		public boolean isCostShapeConsistent() {
			return costShapeConsistent(costStatus, costTotal, marginTotal, missingCostComponents);
		}
	}

	public record MarginRow(
			@JsonProperty("group_key") @NotBlank @Size(max = 200) String groupKey,
			@JsonProperty("group_id") UUID groupId,
			@JsonProperty("production_mode") ProductionMode productionMode,
			@JsonProperty("revenue") @NotNull @Valid NonNegativeMoney revenue,
			@JsonProperty("total_cost") @Valid NonNegativeMoney totalCost,
			@JsonProperty("margin") @Valid Money margin,
			@JsonProperty("cost_status") @NotNull CostStatus costStatus,
			@JsonProperty("missing_cost_components") @NotNull @Size(max = 4) List<@NotNull CostComponent> missingCostComponents,
			@JsonProperty("orders_count") @NotNull @Min(0) @Max(1_000_000) Integer ordersCount) {

		@JsonIgnore
		@AssertTrue(message = "costos incompletos: total_cost y margin deben ser null y listar lo que falta")
		public boolean isCostShapeConsistent() {
			return costShapeConsistent(costStatus, totalCost, margin, missingCostComponents);
		}
	}

	public record MarginReport(
			@JsonProperty("as_of") @NotNull LocalDate asOf,
			@JsonProperty("group_by") @NotNull MarginGroupBy groupBy,
			@JsonProperty("items") @NotNull @Size(max = 100) List<@Valid MarginRow> items,
			@JsonProperty("totals") @NotNull @Valid MarginRow totals,
			@JsonProperty("page") @NotNull @Valid PageInfo page,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin) {
	}

	/** El cargo interno se elimina en el consolidado: nunca es ingreso externo ni entra a caja. */
	public record ProductionCenterRow(
			@JsonProperty("order_id") @NotNull UUID orderId,
			@JsonProperty("order_code") @NotNull @Pattern(regexp = OrderDtos.LABEL_REGEX) String orderCode,
			@JsonProperty("internal_charge") @NotNull @Valid NonNegativeMoney internalCharge,
			@JsonProperty("workshop_cost") @Valid NonNegativeMoney workshopCost,
			@JsonProperty("workshop_result") @Valid Money workshopResult,
			@JsonProperty("commercial_result") @NotNull @Valid Money commercialResult,
			@JsonProperty("consolidated_margin") @Valid Money consolidatedMargin,
			@JsonProperty("internal_charge_eliminated_in_consolidation") @NotNull Boolean internalChargeEliminatedInConsolidation) {

		@JsonIgnore
		@AssertTrue(message = "el cargo interno siempre se elimina en el consolidado")
		public boolean isChargeEliminated() {
			return internalChargeEliminatedInConsolidation == null || internalChargeEliminatedInConsolidation;
		}

		@JsonIgnore
		@AssertTrue(message = "sin costo del taller no hay resultado del taller ni margen consolidado")
		public boolean isResultsNullWhenCostMissing() {
			return workshopCost != null || (workshopResult == null && consolidatedMargin == null);
		}
	}

	public record ProductionCenterReport(
			@JsonProperty("as_of") @NotNull LocalDate asOf,
			@JsonProperty("items") @NotNull @Size(max = 100) List<@Valid ProductionCenterRow> items,
			@JsonProperty("page") @NotNull @Valid PageInfo page,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin) {
	}

	public record OpeningCash(
			@JsonProperty("amount") @NotNull @Valid Money amount,
			@JsonProperty("as_of") @NotNull LocalDate asOf,
			@JsonProperty("source") @NotNull OpeningCashSource source) {
	}

	/** Supuesto de escenario editable con valor inicial 0; no se deriva del 30% no verificado de la empresa. */
	public record CashAssumptions(
			@JsonProperty("collection_risk_factor_bps") @NotNull @Min(0) @Max(10_000) Integer collectionRiskFactorBps,
			@JsonProperty("source") @NotNull @Pattern(regexp = "scenario_assumption") String source) {
	}

	/** {@code closing_balance} puede ser negativo, o nulo si no hay saldo de apertura. */
	public record CashWeek(
			@JsonProperty("week_start") @NotNull LocalDate weekStart,
			@JsonProperty("week_end") @NotNull LocalDate weekEnd,
			@JsonProperty("expected_inflows") @NotNull @Valid NonNegativeMoney expectedInflows,
			@JsonProperty("realized_inflows") @NotNull @Valid NonNegativeMoney realizedInflows,
			@JsonProperty("outflows") @NotNull @Valid NonNegativeMoney outflows,
			@JsonProperty("net") @NotNull @Valid Money net,
			@JsonProperty("closing_balance") @Valid Money closingBalance) {

		@JsonIgnore
		@AssertTrue(message = "week_end no puede ser anterior a week_start")
		public boolean isWeekRangeOrdered() {
			return weekStart == null || weekEnd == null || !weekEnd.isBefore(weekStart);
		}
	}

	public record CashForecast(
			@JsonProperty("as_of") @NotNull LocalDate asOf,
			@JsonProperty("forecast_status") @NotNull ForecastStatus forecastStatus,
			@JsonProperty("opening_cash") @Valid OpeningCash openingCash,
			@JsonProperty("assumptions") @NotNull @Valid CashAssumptions assumptions,
			@JsonProperty("weeks") @NotNull @Size(min = 4, max = 4) List<@Valid CashWeek> weeks,
			@JsonProperty("data_origin") @NotNull DataOrigin dataOrigin) {

		@JsonIgnore
		@AssertTrue(message = "sin saldo de apertura, los saldos de cierre son null; con apertura, ninguno lo es")
		public boolean isOpeningCashConsistentWithStatus() {
			if (forecastStatus == null || weeks == null) {
				return true;
			}
			boolean complete = forecastStatus == ForecastStatus.COMPLETE;
			if (complete != (openingCash != null)) {
				return false;
			}
			return weeks.stream().allMatch(w -> w == null || complete == (w.closingBalance() != null));
		}

		@JsonIgnore
		@AssertTrue(message = "las semanas deben ser consecutivas")
		public boolean isWeeksConsecutive() {
			if (weeks == null) {
				return true;
			}
			for (int i = 1; i < weeks.size(); i++) {
				CashWeek prev = weeks.get(i - 1);
				CashWeek cur = weeks.get(i);
				if (prev != null && cur != null && prev.weekEnd() != null && cur.weekStart() != null
						&& !cur.weekStart().equals(prev.weekEnd().plusDays(1))) {
					return false;
				}
			}
			return true;
		}
	}

}
