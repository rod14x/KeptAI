package pe.keptai.backend.security;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Usa únicamente la función de arranque {@code keptai_private.resolver_usuario(uuid)} con la conexión
 * JDBC runtime (sin SELECT sobre tablas, sin migrador). La consulta lleva solo el sub ya validado:
 * no existe parámetro de organización ni de rol, así que no puede listar membresías de otros sub.
 */
@Component
public class JdbcMembershipResolver implements MembershipResolver {

	private static final Logger LOG = LoggerFactory.getLogger(JdbcMembershipResolver.class);

	private static final String SQL = "SELECT usuario_id, organizacion_id, rol FROM keptai_private.resolver_usuario(?) ORDER BY organizacion_id, usuario_id";

	private final ObjectProvider<DataSource> dataSource;

	public JdbcMembershipResolver(ObjectProvider<DataSource> dataSource) {
		this.dataSource = dataSource;
	}

	@Override
	public List<Membership> resolve(UUID authUserId) {
		DataSource ds = dataSource.getIfAvailable();
		if (ds == null) {
			throw new MembershipUnavailableException("Sin base de datos configurada para resolver la membresía");
		}
		try (Connection c = ds.getConnection(); PreparedStatement ps = c.prepareStatement(SQL)) {
			ps.setObject(1, authUserId);
			List<Membership> out = new ArrayList<>();
			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					AccessRole rol = userRole(rs.getString("rol"));
					if (rol == null) {
						LOG.warn("Membresía ignorada: rol no válido para un usuario");
						continue;
					}
					out.add(new Membership(rs.getObject("usuario_id", UUID.class), rs.getObject("organizacion_id", UUID.class), rol));
				}
			}
			return out;
		}
		catch (SQLException e) {
			throw new MembershipUnavailableException("No se pudo resolver la membresía", e);
		}
	}

	private static AccessRole userRole(String value) {
		try {
			AccessRole r = AccessRole.valueOf(value);
			return r.isService() ? null : r;
		}
		catch (IllegalArgumentException | NullPointerException e) {
			return null;
		}
	}

}
