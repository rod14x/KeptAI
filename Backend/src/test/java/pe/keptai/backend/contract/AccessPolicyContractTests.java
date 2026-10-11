package pe.keptai.backend.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import pe.keptai.backend.security.AccessPolicy;
import pe.keptai.backend.security.AccessPolicy.Rule;
import tools.jackson.databind.JsonNode;

/**
 * MIG-03-D2: la tabla de autorización {@link AccessPolicy} debe cubrir exactamente las operaciones entrantes del
 * contrato (método + ruta + roles), sin rutas inventadas, y toda regla cerrada debe tener motivo y figurar en la matriz.
 */
class AccessPolicyContractTests {

	private record Op(String id, String method, String path, Set<String> roles) {
	}

	private List<Op> contractOperations() {
		JsonNode paths = OpenApiSpec.load().root().path("paths");
		List<Op> ops = new ArrayList<>();
		paths.properties().forEach(p -> p.getValue().properties().forEach(m -> {
			if (!m.getValue().has("operationId")) {
				return;
			}
			Set<String> roles = new HashSet<>();
			m.getValue().path("x-keptai-proposed-roles").forEach(r -> roles.add(r.asString()));
			ops.add(new Op(m.getValue().path("operationId").asString(), m.getKey().toUpperCase(), p.getKey(), roles));
		}));
		return ops;
	}

	@Test
	void everyIncomingContractOperationHasExactlyOneRuleAndNoRuleIsInvented() {
		List<Op> ops = contractOperations();
		// 37 de MIG-02 + 3 de INT-FE-API-002 (resolución de alertas, marca de duplicado y bitácora de envíos).
		assertThat(ops).hasSize(40);
		assertThat(AccessPolicy.RULES).hasSize(40);
		for (Op op : ops) {
			List<Rule> found = AccessPolicy.RULES.stream().filter(r -> r.operationId().equals(op.id())).toList();
			assertThat(found).as(op.id()).hasSize(1);
			Rule r = found.get(0);
			assertThat(r.method().name()).as(op.id()).isEqualTo(op.method());
			assertThat(r.path()).as(op.id()).isEqualTo(op.path());
			assertThat(op.roles()).as(op.id() + " declara actores").isNotEmpty();
			assertThat(r.kind() == AccessPolicy.Kind.SERVICE).as(op.id() + " tipo de credencial")
				.isEqualTo(op.roles().equals(Set.of("service_n8n")));
			if (r.open() && r.kind() == AccessPolicy.Kind.PANEL) {
				assertThat(r.actors().stream().map(Enum::name).collect(Collectors.toSet())).as(op.id() + " roles").isEqualTo(op.roles());
			}
		}
		Set<String> ids = ops.stream().map(Op::id).collect(Collectors.toSet());
		assertThat(AccessPolicy.RULES).allSatisfy(r -> assertThat(ids).contains(r.operationId()));
	}

	@Test
	void theOutgoingWebhookIsNotASpringEndpoint() {
		JsonNode webhooks = OpenApiSpec.load().root().path("webhooks");
		assertThat(webhooks.has("enviarMensajeWF3")).isTrue();
		assertThat(AccessPolicy.RULES).noneMatch(r -> r.operationId().equals("enviarMensajeWF3") || r.path().contains("enviar-mensaje") || r.path().contains("webhook"));
	}

	@Test
	void serviceRulesGrantOnlyServiceScopesAndPanelRulesOnlyUserRoles() {
		assertThat(AccessPolicy.RULES).allSatisfy(r -> {
			if (r.kind() == AccessPolicy.Kind.SERVICE) {
				assertThat(r.actors()).allMatch(a -> a.isService());
			}
			else {
				assertThat(r.actors()).noneMatch(a -> a.isService());
			}
		});
		// Solo INGESTA en rutas abiertas de servicio (SCHEDULER no tiene ruta abierta: callback WF3 pendiente).
		assertThat(AccessPolicy.RULES.stream().filter(r -> r.open() && r.kind() == AccessPolicy.Kind.SERVICE).map(Rule::operationId))
			.containsExactlyInAnyOrder("n8nIngestOrder", "n8nReceiveVoucher");
	}

	@Test
	void closedRulesCarryTheirPendingReasonAndAreDocumentedInTheMatrix() throws IOException {
		List<Rule> closed = AccessPolicy.RULES.stream().filter(r -> !r.open()).toList();
		assertThat(closed).extracting(Rule::operationId).containsExactlyInAnyOrder("createTextEvidence", "startExtraction", "getExtractionJob",
			"n8nConfirmOrder", "n8nReportMessageStatus");
		assertThat(closed).allSatisfy(r -> {
			assertThat(r.closedReason()).isNotBlank();
			assertThat(r.actors()).isEmpty();
		});
		String matrix = Files.readString(Path.of("docs", "matriz-acceso.md"), StandardCharsets.UTF_8);
		assertThat(matrix).contains("MIG-03-D2");
		for (Rule r : closed) {
			assertThat(matrix).as("la matriz debe listar la operación cerrada " + r.operationId()).contains(r.operationId());
		}
	}

}
