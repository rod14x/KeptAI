package pe.keptai.backend.n8n;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Idempotencia sobre {@code solicitud_idempotente} (PK organización + operación + clave). Se usa DENTRO de la
 * transacción del negocio: el INSERT ... ON CONFLICT espera a una transacción concurrente con la misma clave, así
 * que dos solicitudes simultáneas nunca crean dos pedidos/pagos. Guarda solo el hash del contenido funcional y la
 * respuesta estructurada (ids y estados), nunca el cuerpo, el transcript ni el Base64.
 */
public final class IdempotencyStore {

	public enum Resultado { NUEVA, REPETIDA, CONFLICTO }

	public record Reserva(Resultado resultado, String respuestaJson) {
	}

	private final JdbcTemplate jdbc;

	public IdempotencyStore(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public Reserva reservar(String operacion, String clave, String hashContenido) {
		int n = jdbc.update("""
				INSERT INTO keptai.solicitud_idempotente (organizacion_id, operacion, clave, hash_contenido)
				VALUES (keptai.app_organizacion_actual(), ?, ?, ?) ON CONFLICT DO NOTHING""", operacion, clave, hashContenido);
		if (n == 1) {
			return new Reserva(Resultado.NUEVA, null);
		}
		List<String[]> fila = jdbc.query("""
				SELECT hash_contenido, respuesta::text FROM keptai.solicitud_idempotente
				 WHERE organizacion_id = keptai.app_organizacion_actual() AND operacion = ? AND clave = ?""",
				(rs, i) -> new String[] { rs.getString(1).trim(), rs.getString(2) }, operacion, clave);
		if (fila.isEmpty() || !fila.get(0)[0].equals(hashContenido) || fila.get(0)[1] == null) {
			return new Reserva(Resultado.CONFLICTO, null);
		}
		return new Reserva(Resultado.REPETIDA, fila.get(0)[1]);
	}

	public void completar(String operacion, String clave, String respuestaJson) {
		jdbc.update("""
				UPDATE keptai.solicitud_idempotente SET respuesta = ?::jsonb
				 WHERE organizacion_id = keptai.app_organizacion_actual() AND operacion = ? AND clave = ?""", respuestaJson, operacion, clave);
	}

}
