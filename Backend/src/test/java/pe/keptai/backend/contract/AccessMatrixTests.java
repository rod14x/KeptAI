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

import org.junit.jupiter.api.Test;
import pe.keptai.backend.security.AccessRole;
import tools.jackson.databind.JsonNode;

/** MIG-03-A: la matriz de acceso documentada coincide con el contrato y con V7. */
class AccessMatrixTests {

	private static final Path MATRIZ = Path.of("docs", "matriz-acceso.md");

	private static final Path V7 = Path.of("..", "BD", "migrations", "V7__autorizacion_critica.sql");

	private static String read(Path p) throws IOException {
		return Files.readString(p, StandardCharsets.UTF_8);
	}

	private record Op(String id, String path, JsonNode node) {
	}

	private static List<Op> operations(OpenApiSpec spec) {
		List<Op> ops = new ArrayList<>();
		spec.root().path("paths").properties().forEach(pe -> pe.getValue().properties().forEach(me -> {
			if (me.getValue().has("operationId")) {
				ops.add(new Op(me.getValue().path("operationId").asString(), pe.getKey(), me.getValue()));
			}
		}));
		return ops;
	}

	@Test
	void everyOperationAppearsInTheAccessMatrix() throws IOException {
		String doc = read(MATRIZ);
		for (Op op : operations(OpenApiSpec.load())) {
			assertThat(doc).as("operationId %s", op.id()).contains(op.id().equals("n8nOutboundSendMessage") ? "enviarMensajeWF3" : op.id());
		}
	}

	@Test
	void panelRoutesUseOnlyJwtAndUserRolesAndN8nRoutesOnlyServiceKey() {
		Set<String> userRoles = new HashSet<>();
		AccessRole.userRoles().forEach(r -> userRoles.add(r.name()));
		for (Op op : operations(OpenApiSpec.load())) {
			JsonNode security = op.node().path("security");
			assertThat(security.size()).as("%s: una sola forma de autenticacion", op.id()).isEqualTo(1);
			boolean n8n = op.path().startsWith("/api/v1/ordenes/") || op.path().equals("/api/v1/pagos/voucher")
					|| op.path().startsWith("/api/v1/mensajes/");
			if (n8n) {
				assertThat(security.get(0).has("serviceApiKey")).as(op.id()).isTrue();
			}
			else {
				assertThat(security.get(0).has("bearerAuth")).as(op.id()).isTrue();
				op.node().path("x-keptai-proposed-roles").forEach(r -> assertThat(userRoles).as(op.id()).contains(r.asString()));
			}
		}
	}

	@Test
	void creditDecisionIsOnlyForVendedorAndMatchesV7Policies() throws IOException {
		Op submit = operations(OpenApiSpec.load()).stream().filter(o -> o.id().equals("submitCreditDecision")).findFirst().orElseThrow();
		List<String> roles = new ArrayList<>();
		submit.node().path("x-keptai-proposed-roles").forEach(r -> roles.add(r.asString()));
		assertThat(roles).containsExactly("VENDEDOR");
		String sql = read(V7);
		assertThat(sql).contains("CREATE POLICY p_insercion ON aprobacion_credito")
			.contains("(SELECT keptai_private.actor_actual())='VENDEDOR'")
			.contains("validar_autoria('aprobado_por')");
	}

	@Test
	void serviceRoutesStayInsideIngestaBorradorLimitsOfV7() throws IOException {
		String sql = read(V7);
		assertThat(sql).contains("p_ingesta_orden_actualizacion").contains("estado='BORRADOR'")
			.contains("'orden_item','hoja_resumen'");
		String doc = read(MATRIZ);
		assertThat(doc).contains("INGESTA").contains("SCHEDULER").contains("X-Api-Key").contains("X-Api-Secret")
			.contains("Fuera del MVP");
	}

}
