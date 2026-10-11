package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Resultados del motor de pagos. Importes en soles (numeric 18,2); el adapter convierte con MoneyBridge. */
public final class ResultadosPago {

	private ResultadosPago() {
	}

	/** Estado del pago tras una operacion: fase y estado_conciliacion de keptai.pago. */
	public record EstadoPago(UUID pagoId, String fase, String estadoConciliacion, BigDecimal monto,
			BigDecimal aplicado, BigDecimal sinAplicar, UUID duplicadoDePagoId) {
	}

	/** Saldo calculado (v_saldo_obligacion); nunca se acepta desde fuera. */
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
