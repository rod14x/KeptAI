package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class ResultadosCostos {

	private ResultadosCostos() {
	}

	public record Costo(UUID costoId, UUID ordenId, UUID etapaId, String concepto, BigDecimal monto, String moneda,
			String origen) {
	}

	public record Asignacion(UUID costoId, UUID ordenItemId, BigDecimal monto, String metodo) {
	}

	public record Reparto(UUID ordenId, String metodo, List<Asignacion> asignaciones) {
	}

	public record Transferencia(UUID transferenciaId, UUID ordenId, UUID unidadId, BigDecimal monto, String moneda,
			boolean anulada) {
	}

	// Avisos, no bloqueos: el cierre es una decision humana auditada; faltantes y asignacion incompleta se informan.
	public record CierreCosteo(UUID ordenId, String origen, BigDecimal costoTotal, List<String> componentesFaltantes,
			boolean asignacionCompleta) {
	}
}
