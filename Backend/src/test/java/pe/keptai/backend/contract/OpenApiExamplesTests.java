package pe.keptai.backend.contract;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import pe.keptai.backend.contract.AuditDtos.AuditEvent;
import pe.keptai.backend.contract.CommonDtos.ApiErrorExtended;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.CommonDtos.UserContext;
import pe.keptai.backend.contract.EvidenceDtos.CreateTextEvidenceRequest;
import pe.keptai.backend.contract.EvidenceDtos.Evidence;
import pe.keptai.backend.contract.EvidenceDtos.EvidenceDownloadLink;
import pe.keptai.backend.contract.ExtractionDtos.ConfirmDraftRequest;
import pe.keptai.backend.contract.ExtractionDtos.ConfirmDraftResponse;
import pe.keptai.backend.contract.ExtractionDtos.CorrectDraftRequest;
import pe.keptai.backend.contract.ExtractionDtos.DiscardDraftRequest;
import pe.keptai.backend.contract.ExtractionDtos.ExtractionDraft;
import pe.keptai.backend.contract.ExtractionDtos.ExtractionJob;
import pe.keptai.backend.contract.ExtractionDtos.StartExtractionRequest;
import pe.keptai.backend.contract.OrderDtos.Order;
import pe.keptai.backend.contract.PaymentDtos.ApplyPaymentRequest;
import pe.keptai.backend.contract.PaymentDtos.Payment;
import pe.keptai.backend.contract.PaymentDtos.PaymentApplicationResult;
import pe.keptai.backend.contract.PaymentDtos.ReconciliationResult;
import pe.keptai.backend.contract.PaymentDtos.RegisterVerificationRequest;
import pe.keptai.backend.contract.ReceivableDtos.CollectionAlert;
import pe.keptai.backend.contract.ReceivableDtos.CustomerStatement;
import pe.keptai.backend.contract.ReceivableDtos.Receivable;
import pe.keptai.backend.contract.ResultsDtos.CashForecast;
import pe.keptai.backend.contract.ResultsDtos.MarginReport;
import pe.keptai.backend.contract.ResultsDtos.ProductionCenterReport;
import pe.keptai.backend.contract.ResultsDtos.ResultsSummary;
import pe.keptai.backend.web.ApiError;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cada ejemplo del contrato (components.examples de openapi.yaml) debe: deserializarse con el mapper estricto en su DTO
 * Java, cumplir Bean Validation y volver a serializarse EXACTAMENTE igual (mismos nombres snake_case, nulls explicitos,
 * centavos enteros, desfases de instantes). Es la prueba de que YAML y DTO describen el mismo JSON.
 */
class OpenApiExamplesTests {

	private static final JsonMapper MAPPER = ContractJson.newMapper();

	private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

	private static OpenApiSpec spec;

	private static final Map<String, JavaType> TYPES = new LinkedHashMap<>();

	@BeforeAll
	static void load() {
		spec = OpenApiSpec.load();
		TYPES.clear();
put("DispatchRequestDemo", pe.keptai.backend.contract.OrderDtos.DispatchRequest.class);
put("CreditDecisionApproveRequest", pe.keptai.backend.contract.ReceivableDtos.CreditDecisionRequest.class);
put("CreditDecisionPendingWithArrears", pe.keptai.backend.contract.ReceivableDtos.CreditAuthorization.class);
put("CreditDecisionApproved", pe.keptai.backend.contract.ReceivableDtos.CreditAuthorization.class);
		put("UserContextDemo", UserContext.class);
		put("CreateTextEvidenceChat", CreateTextEvidenceRequest.class);
		put("EvidenceChat", Evidence.class);
		put("EvidenceVoucher", Evidence.class);
		put("EvidencePageDemo", new TypeReference<PageResponse<Evidence>>() { });
		put("EvidenceDownloadLinkDemo", EvidenceDownloadLink.class);
		put("StartExtractionVoucher", StartExtractionRequest.class);
		put("ExtractionJobQueued", ExtractionJob.class);
		put("ExtractionJobSucceeded", ExtractionJob.class);
		put("ExtractionJobFailed", ExtractionJob.class);
		put("ExtractionDraftVoucher", ExtractionDraft.class);
		put("ExtractionDraftOrder", ExtractionDraft.class);
		put("ExtractionDraftPageDemo", new TypeReference<PageResponse<ExtractionDraft>>() { });
		put("CorrectDraftVoucher", CorrectDraftRequest.class);
		put("ConfirmDraftRequestDemo", ConfirmDraftRequest.class);
		put("ConfirmDraftResponseVoucher", ConfirmDraftResponse.class);
		put("DiscardDraftRequestDemo", DiscardDraftRequest.class);
		put("OrderP001", Order.class);
		put("OrderP002", Order.class);
		put("OrderPageDemo", new TypeReference<PageResponse<Order>>() { });
		put("PaymentV001", Payment.class);
		put("PaymentV002", Payment.class);
		put("PaymentV002Received", Payment.class);
		put("PaymentV002Verified", Payment.class);
		put("PaymentV003Duplicate", Payment.class);
		put("PaymentPageDemo", new TypeReference<PageResponse<Payment>>() { });
		put("ReconciliationV002Partial", ReconciliationResult.class);
		put("ReconciliationV003Duplicate", ReconciliationResult.class);
		put("RegisterVerificationSimulated", RegisterVerificationRequest.class);
		put("ApplyPaymentV002Request", ApplyPaymentRequest.class);
		put("ApplyPaymentV002Result", PaymentApplicationResult.class);
		put("ReceivableP002", Receivable.class);
		put("ReceivablePageDemo", new TypeReference<PageResponse<Receivable>>() { });
		put("CollectionAlertPageDemo", new TypeReference<PageResponse<CollectionAlert>>() { });
		put("CustomerStatementDemo", CustomerStatement.class);
		put("ResultsSummaryDemo", ResultsSummary.class);
		put("MarginReportComplete", MarginReport.class);
		put("MarginReportIncomplete", MarginReport.class);
		put("ProductionCenterReportDemo", ProductionCenterReport.class);
		put("CashForecastDemo", CashForecast.class);
		put("CashForecastMissingOpening", CashForecast.class);
		put("AuditEventPageDemo", new TypeReference<PageResponse<AuditEvent>>() { });
		put("ErrorValidation", ApiErrorExtended.class);
		put("ErrorUnauthorized", ApiError.class);
		put("ErrorForbidden", ApiError.class);
		put("ErrorNotFound", ApiError.class);
		put("ErrorIdempotencyConflict", ApiErrorExtended.class);
		put("ErrorDuplicatePayment", ApiErrorExtended.class);
		put("ErrorPayloadTooLarge", ApiError.class);
		put("ErrorServiceUnavailable", ApiError.class);
		put("ErrorUnsupportedMedia", ApiError.class);
	}

	private static void put(String name, Class<?> type) {
		TYPES.put(name, MAPPER.constructType(type));
	}

	private static void put(String name, TypeReference<?> type) {
		TYPES.put(name, MAPPER.constructType(type));
	}

	@Test
	void everyExampleHasADtoMappingExceptTheCsv() {
		Set<String> all = spec.root().path("components").path("examples").propertyNames().stream().collect(Collectors.toSet());
		all.remove("OrdersCsvDemo");
all.removeIf(name -> name.startsWith("N8n")); // Cubiertos por N8nContractTests, frontera camelCase separada.
		assertThat(all).as("un ejemplo nuevo del YAML debe asociarse a su DTO en esta prueba").isEqualTo(TYPES.keySet());
	}

	@TestFactory
	Iterable<DynamicTest> exampleRoundTripsThroughItsDto() {
		return TYPES.entrySet().stream().map(e -> DynamicTest.dynamicTest(e.getKey(), () -> {
			JsonNode expected = spec.example(e.getKey());
			Object dto = MAPPER.readValue(MAPPER.writeValueAsString(expected), e.getValue());

			Set<ConstraintViolation<Object>> violations = VALIDATOR.validate(dto);
			assertThat(violations).as("violaciones de Bean Validation en %s", e.getKey()).isEmpty();

			JsonNode actual = MAPPER.readTree(MAPPER.writeValueAsString(dto));
			assertThat(actual).as("%s: el DTO serializa distinto al ejemplo del contrato", e.getKey()).isEqualTo(expected);
		})).toList();
	}

	@Test
	void csvHeaderMatchesTheDtoColumnsAndAmountsAreCents() {
		String csv = spec.example("OrdersCsvDemo").asString();
		String[] lines = csv.strip().split("\n");
		assertThat(lines[0]).isEqualTo(String.join(",", ResultsDtos.ORDERS_CSV_COLUMNS));
		for (int i = 1; i < lines.length; i++) {
			String[] cells = lines[i].split(",", -1);
			assertThat(cells).hasSameSizeAs(ResultsDtos.ORDERS_CSV_COLUMNS);
			int saleIdx = ResultsDtos.ORDERS_CSV_COLUMNS.indexOf("sale_cents");
			assertThat(cells[saleIdx]).matches("[0-9]+");
		}
	}

}
