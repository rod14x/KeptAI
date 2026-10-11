package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class ResultadosPago {

	private ResultadosPago() {
	}

	public record EstadoPago(UUID pagoId, String fase, String estadoConciliacion, BigDecimal monto,
			BigDecimal aplicado, BigDecimal sinAplicar, UUID duplicadoDePagoId) {
	}

	public record SaldoObligacion(UUID obligacionId, UUID ordenId, BigDecimal monto, BigDecimal cobrado,
			BigDecimal saldo, String moneda, LocalDate venceEn, String estado) {
	}

	public record Verificacion(EstadoPago pago, OffsetDateTime verificadoEn, boolean simulado) {
	}

	public record Duplicado(EstadoPago pago, UUID originalId, UUID alertaId) {
	}

	public record Aplicacion(UUID aplicacionId, OffsetDateTime aplicadoEn, BigDecimal montoAplicado,
			EstadoPago pago, SaldoObligacion obligacion, List<UUID> alertasResueltas, int enviosCancelados) {
	}

	public record Anulacion(UUID aplicacionId, OffsetDateTime anuladaEn, EstadoPago pago, SaldoObligacion obligacion) {
	}
}
