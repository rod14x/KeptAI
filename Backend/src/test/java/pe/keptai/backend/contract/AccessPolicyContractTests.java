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
 * Versión: 1.1 | Fecha: 2026-10-19 | Autora: Isabelita
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
		assertThat(ops).hasSize(AccessPolicy.RULES.size());
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
	}

	@Test
	void everyClosedRuleHasDocumentedReason() {
		for (Rule r : AccessPolicy.RULES.stream().filter(r -> !r.open()).toList()) {
			assertThat(r.closedReason()).as(r.operationId()).isNotBlank();
		}
	}

	@Test
	void accessMatrixDocumentReflectsEveryRule() throws IOException {
		String doc = Files.readString(Path.of("docs/matriz-acceso.md"), StandardCharsets.UTF_8);
		for (Rule r : AccessPolicy.RULES) {
			assertThat(doc).as("matriz-acceso.md omite " + r.operationId()).contains(r.operationId());
		}
	}

}
