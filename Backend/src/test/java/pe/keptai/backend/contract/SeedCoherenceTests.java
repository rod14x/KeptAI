package pe.keptai.backend.contract;

import org.junit.jupiter.api.Test;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.OrderDtos.Order;
import pe.keptai.backend.contract.PaymentDtos.Payment;
import pe.keptai.backend.contract.PaymentDtos.PaymentApplicationResult;
import pe.keptai.backend.contract.ReceivableDtos.CustomerStatement;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;
import pe.keptai.backend.contract.ResultsDtos.CashForecast;
import pe.keptai.backend.contract.ResultsDtos.CashWeek;
import pe.keptai.backend.contract.ResultsDtos.MarginReport;
import pe.keptai.backend.contract.ResultsDtos.MarginRow;
import pe.keptai.backend.contract.ResultsDtos.ProductionCenterReport;
import pe.keptai.backend.contract.ResultsDtos.ProductionCenterRow;
import pe.keptai.backend.contract.ResultsDtos.ResultsSummary;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Los ejemplos que recibira German cuentan una sola historia (semilla ficticia P-001/P-002/V-001..V-003): estas pruebas
 * comprueban la aritmetica ENTRE ejemplos. No son un calculo del producto: el motor financiero es de Andres.
 */
class SeedCoherenceTests {

	private static final JsonMapper MAPPER = ContractJson.newMapper();

	private static final OpenApiSpec SPEC = OpenApiSpec.load();

	private static <T> T ex(String name, Class<T> type) {
		return MAPPER.readValue(MAPPER.writeValueAsString(SPEC.example(name)), type);
	}

	private static long cents(CommonDtos.Money m) {
		return m == null ? 0 : m.amountCents();
	}

	@Test
	void salesCostMarginCollectedAndPendingMatchTheDemoStory() {
		Order p1 = ex("OrderP001", Order.class);
		Order p2 = ex("OrderP002", Order.class);
		assertThat(p1.sale().amountCents()).isEqualTo(30000);
		assertThat(p2.sale().amountCents()).isEqualTo(50000);

		MarginReport margins = ex("MarginReportComplete", MarginReport.class);
		MarginRow m1 = margins.items().get(0);
		MarginRow m2 = margins.items().get(1);
		assertThat(m1.groupKey()).isEqualTo(p1.displayCode());
		assertThat(m2.groupKey()).isEqualTo(p2.displayCode());
		assertThat(m1.revenue()).isEqualTo(CommonDtos.NonNegativeMoney.pen(p1.sale().amountCents()));
		assertThat(m1.totalCost().amountCents()).isEqualTo(34000);
		assertThat(m2.totalCost().amountCents()).isEqualTo(35000);
		for (MarginRow r : margins.items()) {
			assertThat(r.margin().amountCents()).isEqualTo(r.revenue().amountCents() - r.totalCost().amountCents());
		}
		assertThat(m1.margin().amountCents()).isEqualTo(-4000);
		assertThat(m2.margin().amountCents()).isEqualTo(15000);
		MarginRow totals = margins.totals();
		assertThat(totals.revenue().amountCents()).isEqualTo(m1.revenue().amountCents() + m2.revenue().amountCents());
		assertThat(totals.totalCost().amountCents()).isEqualTo(69000);
		assertThat(totals.margin().amountCents()).isEqualTo(11000);

		ResultsSummary summary = ex("ResultsSummaryDemo", ResultsSummary.class);
		assertThat(summary.salesTotal().amountCents()).isEqualTo(totals.revenue().amountCents());
		assertThat(summary.costTotal().amountCents()).isEqualTo(totals.totalCost().amountCents());
		assertThat(summary.marginTotal().amountCents()).isEqualTo(totals.margin().amountCents());
		assertThat(summary.appliedCollectionsTotal().amountCents()).isEqualTo(40000);
		assertThat(summary.pendingBalanceTotal().amountCents()).isEqualTo(40000);
		// recaudacion y margen son conceptos distintos: 110 != 400
		assertThat(summary.marginTotal().amountCents()).isNotEqualTo(summary.appliedCollectionsTotal().amountCents());
	}

	@Test
	void paymentsApplicationsAndBalancesAgree() {
		Payment v1 = ex("PaymentV001", Payment.class);
		Payment v2 = ex("PaymentV002", Payment.class);
		Payment v3 = ex("PaymentV003Duplicate", Payment.class);
		assertThat(v1.appliedAmount().amountCents() + v2.appliedAmount().amountCents()).isEqualTo(40000);
		assertThat(v3.reconciliationStatus()).isEqualTo(ContractEnums.ReconciliationStatus.DUPLICATE);
		assertThat(v3.appliedAmount().amountCents()).as("el duplicado V-003 no se aplica").isZero();
		assertThat(v3.operationReference()).isEqualTo(v2.operationReference());
		assertThat(v3.duplicateOfPaymentId()).isEqualTo(v2.id());
		assertThat(v3.receivedAmount()).isEqualTo(v2.receivedAmount());

		PaymentApplicationResult applied = ex("ApplyPaymentV002Result", PaymentApplicationResult.class);
		Receivable r2 = ex("ReceivableP002", Receivable.class);
		assertThat(applied.receivable()).isEqualTo(r2);
		assertThat(applied.application().paymentId()).isEqualTo(v2.id());
		assertThat(applied.application().appliedAmount().amountCents()).isEqualTo(v2.appliedAmount().amountCents());
		assertThat(r2.originalAmount().amountCents() - r2.appliedAmount().amountCents()).isEqualTo(r2.balance().amountCents()).isEqualTo(40000);
		assertThat(r2.orderId()).isEqualTo(ex("OrderP002", Order.class).id());

		PageResponse<Receivable> page = MAPPER.readValue(MAPPER.writeValueAsString(SPEC.example("ReceivablePageDemo")),
				new TypeReference<PageResponse<Receivable>>() { });
		long balances = page.items().stream().mapToLong(r -> r.balance().amountCents()).sum();
		assertThat(balances).isEqualTo(40000);
		assertThat(page.items().get(1)).isEqualTo(r2);

		CustomerStatement statement = ex("CustomerStatementDemo", CustomerStatement.class);
		assertThat(statement.totalBalance().amountCents()).isEqualTo(balances);
		assertThat(statement.orders().get(0).balance()).isEqualTo(r2.balance());
		assertThat(statement.applications().get(0).paymentCode()).isEqualTo(v2.displayCode());
		assertThat(statement.nextDueDate()).isEqualTo(r2.dueDate());
		assertThat(statement.creditAuthorization().status()).isEqualTo(ContractEnums.CreditAuthorizationStatus.PENDING);
	}

	@Test
	void internalChargeIsEliminatedInTheConsolidation() {
		// Relaciones ILUSTRATIVAS de la semilla (PROP-DB-001); la formula vigente es del motor de Andres y esta por acordar.
		ProductionCenterRow row = ex("ProductionCenterReportDemo", ProductionCenterReport.class).items().get(0);
		Order p1 = ex("OrderP001", Order.class);
		MarginRow m1 = ex("MarginReportComplete", MarginReport.class).items().get(0);
		assertThat(row.orderId()).isEqualTo(p1.id());
		assertThat(row.internalCharge().amountCents()).isEqualTo(32000);
		assertThat(row.workshopResult().amountCents()).isEqualTo(row.internalCharge().amountCents() - row.workshopCost().amountCents());
		assertThat(row.commercialResult().amountCents()).isEqualTo(p1.sale().amountCents() - row.internalCharge().amountCents());
		assertThat(cents(row.workshopResult()) + cents(row.commercialResult())).isEqualTo(cents(row.consolidatedMargin()));
		assertThat(row.consolidatedMargin()).isEqualTo(m1.margin());
	}

	@Test
	void cashForecastIsArithmeticallyConsistentAndFollowsTheReceivable() {
		CashForecast cash = ex("CashForecastDemo", CashForecast.class);
		long balance = cash.openingCash().amount().amountCents();
		for (CashWeek w : cash.weeks()) {
			long net = w.expectedInflows().amountCents() + w.realizedInflows().amountCents() - w.outflows().amountCents();
			assertThat(w.net().amountCents()).as("neto semana %s", w.weekStart()).isEqualTo(net);
			balance += net;
			assertThat(w.closingBalance().amountCents()).as("cierre semana %s", w.weekStart()).isEqualTo(balance);
		}
		// el cobro esperado es el saldo pendiente de P-002 y no incluye lo ya aplicado (sin doble conteo)
		long expected = cash.weeks().stream().mapToLong(w -> w.expectedInflows().amountCents()).sum();
		assertThat(expected).isEqualTo(ex("ReceivableP002", Receivable.class).balance().amountCents());
		assertThat(cash.weeks().stream().mapToLong(w -> w.realizedInflows().amountCents()).sum()).isZero();
		// el cargo interno de 320 no es ingreso ni caja
		assertThat(expected).isNotEqualTo(32000);
		// las semanas empiezan en lunes
		cash.weeks().forEach(w -> assertThat(w.weekStart().getDayOfWeek()).isEqualTo(java.time.DayOfWeek.MONDAY));
	}

}
