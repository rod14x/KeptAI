package pe.keptai.backend.n8n;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import pe.keptai.backend.web.BusinessException;

/**
 * Resolución del CONTACTO registrado a partir del JID canónico y vínculo del canal (V10). Solo dentro de la transacción del
 * negocio (TenantTransaction, contexto de servicio INGESTA): la organización sale del contexto, nunca del cuerpo.
 *
 * <p>El JID se compara de forma EXACTA: {@code <dígitos>@s.whatsapp.net}. No hay coincidencias parciales, por nombre,
 * pushName, últimos dígitos ni por la extracción de la IA; un JID de grupo, con dispositivo ({@code :n}) o {@code @lid}
 * no se interpreta como teléfono. Un contacto inexistente, inactivo, de otra organización o con formato no admitido
 * produce el MISMO error (no revela cuál de esos casos ocurrió ni repite el JID).
 */
final class ContactoCanal {

	static final Pattern JID_CANONICO = Pattern.compile("^[0-9]{5,20}@s\\.whatsapp\\.net$");

	/** Contacto registrado y su cliente (datos reales de la base, no de la IA). */
	record Contacto(UUID id, UUID clienteId, String nombre, String razonSocial, String jid) {
	}

	record Canal(UUID id) {
	}

	private ContactoCanal() {
	}

	static BusinessException noRegistrado() {
		return new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "CONTACT_NOT_REGISTERED", "El contacto no está registrado para esta organización");
	}

	static Contacto resolver(JdbcTemplate db, String jid) {
		if (jid == null || !JID_CANONICO.matcher(jid).matches()) {
			throw noRegistrado();
		}
		List<Contacto> r = db.query("""
				SELECT c.id, c.cliente_id, c.nombre, cl.razon_social, c.whatsapp_jid
				  FROM keptai.contacto c
				  JOIN keptai.cliente cl ON cl.organizacion_id = c.organizacion_id AND cl.id = c.cliente_id
				 WHERE c.organizacion_id = keptai.app_organizacion_actual() AND c.whatsapp_jid = ? AND c.activo""",
				(rs, i) -> new Contacto(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getString(4), rs.getString(5)), jid);
		if (r.size() != 1) {
			throw noRegistrado();
		}
		return r.get(0);
	}

	/**
	 * Canal (organización + instancia + JID) vinculado al contacto. Si el canal ya existía sin cliente se vincula; si ya
	 * pertenece a otro cliente o contacto NO se sobrescribe y se rechaza. Toma el cerrojo transaccional del canal: ingesta y
	 * voucher del mismo contacto se serializan, así «el último pedido» es consistente.
	 */
	static UUID vincular(JdbcTemplate db, String instancia, Contacto c) {
		db.update("""
				INSERT INTO keptai.canal_whatsapp (organizacion_id, instancia, chat_jid, cliente_id, contacto_id)
				VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?) ON CONFLICT (organizacion_id, instancia, chat_jid) DO NOTHING""",
				instancia, c.jid(), c.clienteId(), c.id());
		List<UUID[]> fila = db.query("""
				SELECT id, cliente_id, contacto_id FROM keptai.canal_whatsapp
				 WHERE organizacion_id = keptai.app_organizacion_actual() AND instancia = ? AND chat_jid = ?""",
				(rs, i) -> new UUID[] { rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class) }, instancia, c.jid());
		UUID[] canal = fila.get(0);
		if (canal[1] == null) {
			db.update("UPDATE keptai.canal_whatsapp SET cliente_id = ?, contacto_id = ? WHERE id = ? AND cliente_id IS NULL", c.clienteId(), c.id(), canal[0]);
		}
		else if (!canal[1].equals(c.clienteId()) || (canal[2] != null && !canal[2].equals(c.id()))) {
			throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "CHANNEL_CLIENT_CONFLICT",
					"El canal ya está vinculado a otro cliente: no se reasigna automáticamente");
		}
		else if (canal[2] == null) {
			db.update("UPDATE keptai.canal_whatsapp SET contacto_id = ? WHERE id = ? AND contacto_id IS NULL", c.id(), canal[0]);
		}
		db.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended('CANAL:' || ?, 0))::text", String.class, canal[0].toString());
		return canal[0];
	}

}
