package pe.keptai.backend.contract;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import pe.keptai.backend.contract.CommonDtos.Money;
import pe.keptai.backend.contract.CommonDtos.NonNegativeMoney;
import pe.keptai.backend.contract.CommonDtos.PositiveMoney;
import pe.keptai.backend.contract.ContractEnums.*;
import pe.keptai.backend.contract.EvidenceDtos.UploadEvidenceMetadata;
import pe.keptai.backend.contract.ExtractionDtos.*;
import pe.keptai.backend.contract.PaymentDtos.ApplyPaymentRequest;
import pe.keptai.backend.contract.PaymentDtos.Payment;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;
import pe.keptai.backend.contract.ResultsDtos.*;
import tools.jackson.core.exc.StreamReadException;
import tools.jackson.databind.DatabindException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Reglas de validacion del contrato: importes, fechas, estados, campos desconocidos y forma del JSON. */
class DtoValidationTests {

	private static final JsonMapper MAPPER = ContractJson.newMapper();

	private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

	private static final OpenApiSpec SPEC = OpenApiSpec.load();

	private static <T> Set<String> messages(T dto) {
		return VALIDATOR.validate(dto).stream().map(ConstraintViolation::getMessage).collect(Collectors.toSet());
	}

	private static <T> Set<String> paths(T dto) {
		return VALIDATOR.validate(dto).stream().map(v -> v.getPropertyPath().toString()).collect(Collectors.toSet());
	}

	private static <T> T read(String json, Class<T> type) {
		return MAPPER.readValue(json, type);
	}

	private static <T> T example(String name, Class<T> type) {
		return MAPPER.readValue(MAPPER.writeValueAsString(SPEC.example(name)), type);
	}

	// ---- dinero

	@Test
	void moneyAcceptsNegativesButPaymentAmountsMustBePositive() {
		assertThat(VALIDATOR.validate(Money.pen(-4000))).isEmpty();           // margen de P-001
		assertThat(VALIDATOR.validate(Money.pen(-5000))).isEmpty();           // caja negativa
		assertThat(VALIDATOR.validate(PositiveMoney.pen(1))).isEmpty();
		assertThat(paths(PositiveMoney.pen(0))).contains("amountCents");
		assertThat(paths(PositiveMoney.pen(-100))).contains("amountCents");
		assertThat(paths(NonNegativeMoney.pen(-1))).contains("amountCents");
		assertThat(VALIDATOR.validate(NonNegativeMoney.pen(0))).isEmpty();
	}

	@Test
	void moneyRespectsTheJavaScriptSafeIntegerLimit() {
		assertThat(VALIDATOR.validate(Money.pen(CommonDtos.MAX_SAFE_CENTS))).isEmpty();
		assertThat(VALIDATOR.validate(Money.pen(-CommonDtos.MAX_SAFE_CENTS))).isEmpty();
		assertThat(paths(Money.pen(CommonDtos.MAX_SAFE_CENTS + 1))).contains("amountCents");
		assertThat(paths(Money.pen(-CommonDtos.MAX_SAFE_CENTS - 1))).contains("amountCents");
	}

	@Test
	void moneyRejectsOtherCurrenciesAndMissingParts() {
		assertThat(paths(new Money(100L, "USD"))).contains("currency");
		assertThat(paths(new Money(100L, null))).contains("currency");
		assertThat(paths(new Money(null, "PEN"))).contains("amountCents");
	}

	@ParameterizedTest
	@ValueSource(strings = { "{\"amount_cents\":\"100\",\"currency\":\"PEN\"}", "{\"amount_cents\":10.5,\"currency\":\"PEN\"}",
			"{\"amount_cents\":1.0,\"currency\":\"PEN\"}", "{\"amount_cents\":100,\"currency\":\"PEN\",\"soles\":1}" })
	void moneyJsonMustBeAnExactIntegerWithoutExtraFields(String json) {
		assertThatThrownBy(() -> read(json, Money.class)).isInstanceOf(DatabindException.class);
	}

	@Test
	void moneyJsonUsesSnakeCaseCentsAsIntegers() {
		String json = MAPPER.writeValueAsString(Money.pen(-4000));
		assertThat(json).isEqualTo("{\"amount_cents\":-4000,\"currency\":\"PEN\"}");
		assertThat(read("{\"amount_cents\":9007199254740991,\"currency\":\"PEN\"}", Money.class).amountCents())
			.isEqualTo(CommonDtos.MAX_SAFE_CENTS);
	}

	// ---- fechas e instantes

	@Test
	void businessDatesAreIsoDatesAndInstantsKeepTheirOffset() {
		Receivable r = example("ReceivableP002", Receivable.class);
		assertThat(MAPPER.readTree(MAPPER.writeValueAsString(r)).path("due_date").asString()).isEqualTo("2026-10-05");
		Payment v = example("PaymentV001", Payment.class);
		assertThat(v.paidAt().getOffset()).isEqualTo(ZoneOffset.ofHours(-5));
		assertThat(MAPPER.readTree(MAPPER.writeValueAsString(v)).path("paid_at").asString()).isEqualTo("2026-10-02T10:15:00-05:00");
		// el mismo instante en UTC se acepta y se conserva tal cual
		JsonNode utc = ((tools.jackson.databind.node.ObjectNode) SPEC.example("PaymentV001").deepCopy()).put("paid_at",
				"2026-10-02T15:15:00Z");
		Payment u = MAPPER.readValue(MAPPER.writeValueAsString(utc), Payment.class);
		assertThat(u.paidAt()).isEqualTo(OffsetDateTime.of(2026, 10, 2, 15, 15, 0, 0, ZoneOffset.UTC));
		assertThat(u.paidAt().toInstant()).isEqualTo(v.paidAt().toInstant());
	}

	@ParameterizedTest
	@ValueSource(strings = { "2026-13-45", "05/10/2026", "2026-10-5", "2026-10-05T00:00:00" })
	void dueDateRejectsMalformedDates(String bad) {
		JsonNode copy = ((tools.jackson.databind.node.ObjectNode) SPEC.example("ReceivableP002").deepCopy()).put("due_date", bad);
		assertThatThrownBy(() -> MAPPER.readValue(MAPPER.writeValueAsString(copy), Receivable.class))
			.isInstanceOf(DatabindException.class);
	}

	@ParameterizedTest
	@ValueSource(strings = { "2026-10-02T10:15:00", "02/10/2026 10:15", "2026-10-02", "not-a-date" })
	void instantsWithoutOffsetOrWrongFormatAreRejected(String bad) {
		JsonNode copy = ((tools.jackson.databind.node.ObjectNode) SPEC.example("PaymentV001").deepCopy()).put("paid_at", bad);
		assertThatThrownBy(() -> MAPPER.readValue(MAPPER.writeValueAsString(copy), Payment.class))
			.isInstanceOf(DatabindException.class);
	}

	// ---- requests: cierre de campos y organizacion

	@Test
	void requestsRejectUnknownFieldsIncludingOrganizationId() {
		String body = "{\"receivable_id\":\"b0000000-0000-4000-8000-000000000002\","
				+ "\"amount\":{\"amount_cents\":10000,\"currency\":\"PEN\"},\"organization_id\":\"10000000-0000-4000-8000-000000000001\"}";
		assertThatThrownBy(() -> read(body, ApplyPaymentRequest.class)).isInstanceOf(DatabindException.class)
			.hasMessageContaining("organization_id");
	}

	@Test
	void applyRequestNeedsPositiveAmountAndReceivable() {
		assertThat(paths(new ApplyPaymentRequest(null, PositiveMoney.pen(100)))).contains("receivableId");
		assertThat(paths(new ApplyPaymentRequest(UUID.randomUUID(), null))).contains("amount");
		assertThat(paths(new ApplyPaymentRequest(UUID.randomUUID(), PositiveMoney.pen(0)))).contains("amount.amountCents");
	}

	@Test
	void malformedUuidIsRejectedAndLabelsAreNotIdentifiers() {
		JsonNode copy = ((tools.jackson.databind.node.ObjectNode) SPEC.example("OrderP001").deepCopy()).put("id", "P-001");
		assertThatThrownBy(() -> MAPPER.readValue(MAPPER.writeValueAsString(copy), OrderDtos.Order.class))
			.isInstanceOf(DatabindException.class);
		JsonNode badCode = ((tools.jackson.databind.node.ObjectNode) SPEC.example("OrderP001").deepCopy()).put("display_code",
				"11111111-1111-4111-8111-111111111111");
		OrderDtos.Order o = MAPPER.readValue(MAPPER.writeValueAsString(badCode), OrderDtos.Order.class);
		assertThat(paths(o)).contains("displayCode");
	}

	@Test
	void unknownEnumValuesAreRejected() {
		JsonNode copy = ((tools.jackson.databind.node.ObjectNode) SPEC.example("OrderP002").deepCopy()).put("financial_status",
				"parcial");
		assertThatThrownBy(() -> MAPPER.readValue(MAPPER.writeValueAsString(copy), OrderDtos.Order.class))
			.isInstanceOf(DatabindException.class);
		assertThatThrownBy(() -> MAPPER.readValue("\"PAID\"", ContractEnums.OrderStatus.class)).isInstanceOf(DatabindException.class);
	}

	@Test
	void malformedJsonIsAStreamError() {
		assertThatThrownBy(() -> read("{\"amount_cents\":", Money.class)).isInstanceOf(StreamReadException.class);
	}

	// ---- estados

	@Test
	void extractedFieldsNeverInventValuesForMissingOrIllegibleData() {
		var ok = new ExtractedField<String>(null, FieldStatus.ILLEGIBLE, null, false);
		assertThat(VALIDATOR.validate(ok)).isEmpty();
		assertThat(messages(new ExtractedField<>("DEMO-OP", FieldStatus.MISSING, null, false))).isNotEmpty();
		assertThat(messages(new ExtractedField<String>(null, FieldStatus.PRESENT, null, false))).isNotEmpty();
		var money = new ExtractedField<>(PositiveMoney.pen(0), FieldStatus.PRESENT, "S/ 0", false);
		assertThat(paths(money)).contains("value.amountCents");
	}

	@Test
	void draftFieldsMustMatchTheDraftType() {
		ExtractionDraft voucher = example("ExtractionDraftVoucher", ExtractionDraft.class);
		assertThat(VALIDATOR.validate(voucher)).isEmpty();
		ExtractionDraft wrong = new ExtractionDraft(voucher.id(), voucher.evidenceId(), DraftType.ORDER, voucher.status(),
				voucher.revision(), null, voucher.voucherFields(), null, null, null, null, voucher.createdAt(), voucher.updatedAt());
		assertThat(messages(wrong)).contains("los campos deben corresponder a draft_type");
		ExtractionDraft premature = new ExtractionDraft(voucher.id(), voucher.evidenceId(), voucher.draftType(),
				DraftStatus.PENDING_REVIEW, 1, null, voucher.voucherFields(), null, UUID.randomUUID(), null, null, voucher.createdAt(),
				voucher.updatedAt());
		assertThat(messages(premature)).contains("solo un borrador confirmado tiene pedido o pago resultante, segun su tipo");
	}

	@Test
	void confirmingNeverVerifiesFundsOrChangesBalances() {
		ConfirmDraftResponse ok = example("ConfirmDraftResponseVoucher", ConfirmDraftResponse.class);
		assertThat(ok.fundsVerified()).isFalse();
		assertThat(ok.balanceChanged()).isFalse();
		ConfirmDraftResponse lying = new ConfirmDraftResponse(ok.draft(), null, ok.paymentId(), true, true);
		assertThat(paths(lying)).contains("fundsVerified", "balanceChanged");
	}

	@Test
	void correctionRequiresExactlyOneNonEmptyFieldGroupAndARevision() {
		assertThat(messages(new CorrectDraftRequest(1, null, null))).contains("envie exactamente uno de order_fields o voucher_fields");
		var both = new CorrectDraftRequest(1, new OrderFieldsCorrection("x", null, null, null, null),
				new VoucherFieldsCorrection("y", null, null, null, null));
		assertThat(messages(both)).contains("envie exactamente uno de order_fields o voucher_fields");
		assertThat(messages(new CorrectDraftRequest(1, new OrderFieldsCorrection(null, null, null, null, null), null)))
			.contains("debe corregir al menos un campo");
		assertThat(paths(new CorrectDraftRequest(0, new OrderFieldsCorrection("x", null, null, null, null), null)))
			.contains("expectedRevision");
		assertThat(paths(new CorrectDraftRequest(1, new OrderFieldsCorrection(null, null, null, 0, null), null)))
			.contains("orderFields.quantity");
		// una correccion omitida no viaja como null
		String json = MAPPER.writeValueAsString(new CorrectDraftRequest(1, null, new VoucherFieldsCorrection(null, null, null, "DEMO-OP-0002", null)));
		assertThat(json).isEqualTo("{\"expected_revision\":1,\"voucher_fields\":{\"operation_reference\":\"DEMO-OP-0002\"}}");
	}

	@Test
	void uploadedFilesMustBeVoucherOrAudio() {
		assertThat(messages(new UploadEvidenceMetadata(EvidenceKind.TEXT_CHAT, null))).contains("kind debe ser voucher_image (D-007)");
		assertThat(VALIDATOR.validate(new UploadEvidenceMetadata(EvidenceKind.AUDIO_NOTE, "nota"))).isNotEmpty();
        assertThat(VALIDATOR.validate(new UploadEvidenceMetadata(EvidenceKind.VOUCHER_IMAGE, "voucher"))).isEmpty();
	}

	@Test
	void paymentStatesKeepReceivedVerifiedAndAppliedSeparate() {
		Payment applied = example("PaymentV001", Payment.class);
		assertThat(applied.receivedAmount().amountCents()).isEqualTo(applied.verifiedAmount().amountCents());
		Payment duplicate = example("PaymentV003Duplicate", Payment.class);
		assertThat(duplicate.verifiedAmount()).isNull();
		assertThat(duplicate.appliedAmount().amountCents()).isZero();
		// aplicado sin verificacion: rechazado
		Payment unverifiedApplied = new Payment(applied.id(), applied.displayCode(), PaymentPhase.APPLIED, ReconciliationStatus.APPLIED, applied.channel(),
				applied.operationReference(), applied.payerName(), applied.paidAt(), applied.receivedAmount(), null,
				applied.appliedAmount(), applied.unappliedAmount(), null, applied.evidenceIds(), null, applied.modelReportedConfidencePermille(), applied.dataOrigin(),
				applied.createdAt());
		assertThat(messages(unverifiedApplied)).contains("la fase del pago no coincide con sus verificaciones o importes aplicados");
		// recibido con importe aplicado: rechazado
		Payment receivedButApplied = new Payment(applied.id(), applied.displayCode(), PaymentPhase.RECEIVED, ReconciliationStatus.PENDING, applied.channel(), null,
				null, null, applied.receivedAmount(), null, applied.appliedAmount(), NonNegativeMoney.pen(0), null, List.of(), null,
				applied.modelReportedConfidencePermille(), applied.dataOrigin(), applied.createdAt());
		assertThat(messages(receivedButApplied)).isNotEmpty();
		// duplicado sin referencia al original
		Payment orphanDuplicate = new Payment(duplicate.id(), duplicate.displayCode(), PaymentPhase.RECEIVED, ReconciliationStatus.DUPLICATE, duplicate.channel(),
				null, null, null, duplicate.receivedAmount(), null, NonNegativeMoney.pen(0), duplicate.unappliedAmount(), null,
				List.of(), null, duplicate.modelReportedConfidencePermille(), duplicate.dataOrigin(), duplicate.createdAt());
		assertThat(messages(orphanDuplicate)).isNotEmpty();
		// moneda mezclada
		Payment mixed = new Payment(applied.id(), applied.displayCode(), applied.phase(), applied.reconciliationStatus(), applied.channel(), null, null, null,
				applied.receivedAmount(), new NonNegativeMoney(30000L, "PEN"), applied.appliedAmount(),
				new NonNegativeMoney(0L, "USD"), null, List.of(), applied.verification(), applied.modelReportedConfidencePermille(), applied.dataOrigin(), applied.createdAt());
		assertThat(messages(mixed)).contains("todos los importes del pago deben estar en la misma moneda");
	}

	@Test
	void simulatedVerificationMustBeLabelledAsSimulated() {
		Payment p = example("PaymentV001", Payment.class);
		var v = p.verification();
		var mislabelled = new PaymentDtos.PaymentVerification(v.method(), false, v.verifiedByUserId(), v.verifiedAt(), v.note());
		assertThat(messages(mislabelled)).contains("la verificacion simulada debe rotularse is_simulated=true y no puede ser otra");
	}

	@Test
	void receivableOverdueAndStatusShapeAreConsistent() {
		Receivable r = example("ReceivableP002", Receivable.class);
		assertThat(r.balance().amountCents()).isEqualTo(40000);
		var notOverdue = new Receivable(r.id(), r.orderId(), r.orderCode(), r.customer(), r.originalAmount(), r.appliedAmount(),
				r.balance(), r.creditTermDays(), r.termStartEvent(), r.dueDate(), DueBucket.NOT_DUE, 5, r.status());
		assertThat(messages(notOverdue)).contains("days_overdue solo es mayor que 0 cuando due_bucket=overdue");
		var paidWithBalance = new Receivable(r.id(), r.orderId(), r.orderCode(), r.customer(), r.originalAmount(), r.appliedAmount(),
				r.balance(), r.creditTermDays(), r.termStartEvent(), r.dueDate(), r.dueBucket(), r.daysOverdue(), ReceivableStatus.PAID);
		assertThat(messages(paidWithBalance)).contains("forma del estado: pagada tiene saldo cero; pendiente no tiene nada aplicado; parcial tiene ambos; mora tiene saldo");
	}

	@Test
	void incompleteCostsAreNullNeverZero() {
		MarginReport incomplete = example("MarginReportIncomplete", MarginReport.class);
		MarginRow row = incomplete.items().get(0);
		assertThat(row.totalCost()).isNull();
		assertThat(row.margin()).isNull();
		assertThat(row.missingCostComponents()).containsExactly(CostComponent.LABOR, CostComponent.OVERHEAD);
		JsonNode json = MAPPER.readTree(MAPPER.writeValueAsString(row));
		assertThat(json.has("margin")).as("el null se envia de forma explicita").isTrue();
		assertThat(json.path("margin").isNull()).isTrue();
		// cero inventado para un costo incompleto: rechazado
		var zeroed = new MarginRow(row.groupKey(), row.groupId(), row.productionMode(), row.revenue(), NonNegativeMoney.pen(0),
				Money.pen(20000), CostStatus.INCOMPLETE, row.missingCostComponents(), 1);
		assertThat(messages(zeroed)).contains("costos incompletos: total_cost y margin deben ser null y listar lo que falta");
		// completo sin margen: rechazado
		var noMargin = new MarginRow("P-9", null, null, NonNegativeMoney.pen(1), NonNegativeMoney.pen(1), null, CostStatus.COMPLETE,
				List.of(), 1);
		assertThat(messages(noMargin)).isNotEmpty();
	}

	@Test
	void negativeMarginAndNegativeCashAreValid() {
		MarginReport complete = example("MarginReportComplete", MarginReport.class);
		assertThat(complete.items().get(0).margin().amountCents()).isEqualTo(-4000);
		assertThat(VALIDATOR.validate(complete)).isEmpty();
		CashForecast cash = example("CashForecastDemo", CashForecast.class);
		assertThat(cash.weeks().get(2).closingBalance().amountCents()).isEqualTo(-5000);
		assertThat(VALIDATOR.validate(cash)).isEmpty();
	}

	@Test
	void cashForecastExplicitlyReportsAMissingOpeningBalance() {
		CashForecast missing = example("CashForecastMissingOpening", CashForecast.class);
		assertThat(missing.openingCash()).isNull();
		assertThat(missing.weeks()).allSatisfy(w -> assertThat(w.closingBalance()).isNull());
		CashForecast complete = example("CashForecastDemo", CashForecast.class);
		// "complete" sin apertura, o con saldos null
		assertThat(messages(new CashForecast(complete.asOf(), ForecastStatus.COMPLETE, null, complete.assumptions(), complete.weeks(),
				complete.dataOrigin()))).isNotEmpty();
		assertThat(messages(new CashForecast(complete.asOf(), ForecastStatus.MISSING_OPENING_CASH, complete.openingCash(),
				complete.assumptions(), missing.weeks(), complete.dataOrigin()))).isNotEmpty();
		// 3 semanas, semana invertida, no consecutivas
		assertThat(paths(new CashForecast(complete.asOf(), ForecastStatus.COMPLETE, complete.openingCash(), complete.assumptions(),
				complete.weeks().subList(0, 3), complete.dataOrigin()))).contains("weeks");
		CashWeek w0 = complete.weeks().get(0);
		var inverted = new CashWeek(w0.weekEnd(), w0.weekStart(), w0.expectedInflows(), w0.realizedInflows(), w0.outflows(), w0.net(),
				w0.closingBalance());
		assertThat(messages(inverted)).contains("week_end no puede ser anterior a week_start");
		var gap = List.of(w0, complete.weeks().get(2), complete.weeks().get(1), complete.weeks().get(3));
		assertThat(messages(new CashForecast(complete.asOf(), ForecastStatus.COMPLETE, complete.openingCash(), complete.assumptions(),
				gap, complete.dataOrigin()))).contains("las semanas deben ser consecutivas");
	}

	@Test
	void collectionRiskFactorIsAnEditableScenarioAssumptionStartingAtZero() {
		CashForecast cash = example("CashForecastDemo", CashForecast.class);
		assertThat(cash.assumptions().collectionRiskFactorBps()).isZero();
		assertThat(cash.assumptions().source()).isEqualTo("scenario_assumption");
		assertThat(paths(new CashAssumptions(10001, "scenario_assumption"))).contains("collectionRiskFactorBps");
		assertThat(paths(new CashAssumptions(3000, "company_data"))).contains("source");
	}

	@Test
	void productionCenterNeverCountsTheInternalChargeAsExternalIncome() {
		ProductionCenterReport report = example("ProductionCenterReportDemo", ProductionCenterReport.class);
		ProductionCenterRow row = report.items().get(0);
		assertThat(row.internalChargeEliminatedInConsolidation()).isTrue();
		var kept = new ProductionCenterRow(row.orderId(), row.orderCode(), row.internalCharge(), row.workshopCost(),
				row.workshopResult(), row.commercialResult(), row.consolidatedMargin(), false);
		assertThat(messages(kept)).contains("el cargo interno siempre se elimina en el consolidado");
	}

	@Test
	void pageAndPaginationBounds() {
		var info = new CommonDtos.PageInfo(101, null);
		assertThat(paths(info)).contains("limit");
		assertThat(paths(new CommonDtos.PageInfo(0, null))).contains("limit");
		assertThat(paths(new CommonDtos.PageInfo(25, ""))).contains("nextCursor");
		assertThat(MAPPER.writeValueAsString(new CommonDtos.PageInfo(25, null))).isEqualTo("{\"limit\":25,\"next_cursor\":null}");
	}

}
