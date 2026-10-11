package pe.keptai.backend.contract;
import java.math.BigDecimal;
import java.util.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.*;
import tools.jackson.databind.JsonNode;
import static org.assertj.core.api.Assertions.*;
class N8nContractTests {
 static final OpenApiSpec SPEC=OpenApiSpec.load();
 static final tools.jackson.databind.json.JsonMapper M=ContractJson.newMapper();
 static final jakarta.validation.Validator V=Validation.buildDefaultValidatorFactory().getValidator();
 @TestFactory Iterable<DynamicTest> n8nExamplesValidateAndRetainAllDeclaredValues(){
  Map<String,Class<?>> types=new LinkedHashMap<>();
  for(Class<?> c:N8nDtos.class.getDeclaredClasses())if(c.isRecord())types.put(c.getSimpleName(),c);
  Map<String,String> names=Map.ofEntries(
   Map.entry("N8nIngestaCredit","N8nIngestaOrdenRequest"),Map.entry("N8nIngestaParseFailure","N8nIngestaOrdenRequest"),Map.entry("N8nIngestaResponse","N8nIngestaOrdenResponse"),
   Map.entry("N8nConfirmarRequest","N8nConfirmarOrdenRequest"),Map.entry("N8nConfirmarResponse","N8nConfirmarOrdenResponse"),
   Map.entry("N8nVoucherYape","N8nPagoVoucherRequest"),Map.entry("N8nVoucherNotVoucher","N8nPagoVoucherRequest"),Map.entry("N8nVoucherRegistered","N8nPagoVoucherResponse"),Map.entry("N8nVoucherDuplicate","N8nPagoVoucherResponse"),Map.entry("N8nVoucherIgnored","N8nPagoVoucherResponse"),
   Map.entry("N8nMensajeEstadoSent","N8nMensajeEstadoRequest"),Map.entry("N8nMensajeEstadoFailed","N8nMensajeEstadoRequest"),Map.entry("N8nMensajeEstadoResponseSent","N8nMensajeEstadoResponse"),Map.entry("N8nMensajeSalienteDemo","N8nMensajeSalienteWebhook"),Map.entry("N8nWebhookAcceptedDemo","N8nWebhookAccepted"),Map.entry("N8nWebhookUnauthorizedDemo","N8nWebhookUnauthorized"));
  assertThat(SPEC.root().path("components").path("examples").propertyNames().stream().filter(x->x.startsWith("N8n")).toList()).containsExactlyInAnyOrderElementsOf(names.keySet());
  return names.entrySet().stream().map(e->DynamicTest.dynamicTest(e.getKey(),()->{
   JsonNode expected=SPEC.example(e.getKey());Object dto=M.readValue(expected.toString(),types.get(e.getValue()));
   assertThat(V.validate(dto)).isEmpty();JsonNode actual=M.readTree(M.writeValueAsString(dto));
   retained(expected,actual);
  })).toList();
 }
 static void retained(JsonNode expected,JsonNode actual){
  if(expected.isObject())expected.properties().forEach(e->retained(e.getValue(),actual.path(e.getKey())));
  else if(expected.isArray()){assertThat(actual.size()).isEqualTo(expected.size());for(int i=0;i<expected.size();i++)retained(expected.get(i),actual.get(i));}
  else if(expected.isNumber())assertThat(new BigDecimal(actual.asString())).isEqualByComparingTo(new BigDecimal(expected.asString()));
  else assertThat(actual).isEqualTo(expected);
 }
 @Test void moneyIsExactAndRejectsFractionalCentOrUnsafeValues(){
  assertThat(MoneyBridge.solesToCents(new BigDecimal("100.10"))).isEqualTo(10010);
  assertThat(MoneyBridge.centsToSoles(10010)).isEqualByComparingTo("100.10");
  assertThatThrownBy(()->MoneyBridge.solesToCents(new BigDecimal("28.499999999999996"))).isInstanceOf(ArithmeticException.class);
  assertThatThrownBy(()->MoneyBridge.solesToCents(new BigDecimal("90071992547409.92"))).isInstanceOf(IllegalArgumentException.class);
 }
 @Test void extraOrganizationAndVerifiedFundsFieldsAreRejected(){
  String json=SPEC.example("N8nVoucherYape").toString();
  for(String extra:List.of("\"organization_id\":\"x\"","\"organizacion_id\":\"x\"","\"fondosVerificados\":true"))
   assertThatThrownBy(()->M.readValue(json.substring(0,json.length()-1)+","+extra+"}",N8nDtos.N8nPagoVoucherRequest.class)).isInstanceOf(tools.jackson.databind.DatabindException.class);
 }
}
