package pe.keptai.backend.finanzas;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ResultadosCobranza {

	private ResultadosCobranza() {
	}

	public record Despacho(UUID despachoId, UUID ordenId, LocalDate fechaDespacho, String estadoOrden, LocalDate venceEn) {
	}

	public record Cobranza(LocalDate fechaCorte, int estadosActualizados, List<UUID> alertasCreadas,
			int enviosProgramados, int enviosCancelados) {
	}
}
