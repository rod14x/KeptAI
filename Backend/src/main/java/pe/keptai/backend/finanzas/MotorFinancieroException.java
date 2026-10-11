package pe.keptai.backend.finanzas;

/**
 * Rechazo de una operacion financiera. El codigo coincide con los codigos de dominio propuestos en
 * Backend/docs/openapi.yaml para que el adapter HTTP (MIG-07) los exponga sin traducir reglas.
 */
public class MotorFinancieroException extends RuntimeException {

	public enum Codigo {
		/** 404: no existe o pertenece a otra organizacion (RLS no distingue ambos casos). */
		NOT_FOUND,
		/** 403: el rol no puede ejecutar la operacion o el contexto no es valido. */
		FORBIDDEN,
		/** 400: datos de entrada invalidos (importe, motivo). */
		VALIDATION_ERROR,
		/** 422: pago solo recibido; OCR/voucher no verifica fondos. */
		PAYMENT_NOT_VERIFIED,
		/** 422: pago duplicado o con referencia ya usada por otro pago. */
		DUPLICATE_PAYMENT,
		/** 422: pago sin cliente identificado. */
		ORPHAN_PAYMENT,
		/** 422: el importe supera lo verificado sin aplicar o el saldo de la obligacion. */
		INSUFFICIENT_BALANCE,
		/** 422: moneda del pago distinta de la obligacion. */
		CURRENCY_MISMATCH,
		/** 409: transicion no permitida para el estado actual. */
		INVALID_STATE,
		/** 409: bloqueo concurrente; reintentar la operacion completa con la misma clave de idempotencia. */
		CONCURRENCY_CONFLICT
	}

	private final Codigo codigo;

	public MotorFinancieroException(Codigo codigo, String mensaje) {
		super(mensaje);
		this.codigo = codigo;
	}

	public MotorFinancieroException(Codigo codigo, String mensaje, Throwable causa) {
		super(mensaje, causa);
		this.codigo = codigo;
	}

	public Codigo codigo() {
		return codigo;
	}
}
