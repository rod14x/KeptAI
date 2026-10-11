package pe.keptai.backend.security;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Bootstrap de servicio anterior al contexto transaccional: solo llama a
 * {@code keptai_private.resolver_servicio(hash)} con el login runtime (sin SELECT sobre
 * {@code integracion_servicio}). El hash va parametrizado; la clave nunca llega aquí.
 */
@Component
public class JdbcServiceResolver implements ServiceResolver {

	private static final Logger LOG = LoggerFactory.getLogger(JdbcServiceResolver.class);

	private static final String SQL = "SELECT servicio_id, organizacion_id, instancia, alcance FROM keptai_private.resolver_servicio(?)";

	private final ObjectProvider<DataSource> dataSource;

	public JdbcServiceResolver(ObjectProvider<DataSource> dataSource) {
		this.dataSource = dataSource;
	}

	@Override
	public Optional<ServiceIdentity> resolve(String sha256Hex) {
		DataSource ds = dataSource.getIfAvailable();
		if (ds == null) {
			throw new MembershipUnavailableException("Sin base de datos configurada para resolver el servicio");
		}
		try (Connection c = ds.getConnection(); PreparedStatement ps = c.prepareStatement(SQL)) {
			ps.setString(1, sha256Hex);
			try (ResultSet rs = ps.executeQuery()) {
				if (!rs.next()) {
					return Optional.empty();
				}
				ServiceIdentity id = new ServiceIdentity(rs.getObject("servicio_id", UUID.class), rs.getObject("organizacion_id", UUID.class),
						rs.getString("instancia"), alcance(rs.getString("alcance")));
				if (rs.next()) {
					LOG.warn("Resolución de servicio ambigua: se rechaza");
					return Optional.empty();
				}
				if (id.servicioId() == null || id.organizacionId() == null || id.alcance() == null) {
					LOG.warn("Servicio con fila no válida: se rechaza");
					return Optional.empty();
				}
				return Optional.of(id);
			}
		}
		catch (SQLException e) {
			throw new MembershipUnavailableException("No se pudo resolver el servicio", e);
		}
	}

	private static AccessRole alcance(String value) {
		try {
			AccessRole r = AccessRole.valueOf(value);
			return r.isService() ? r : null;
		}
		catch (IllegalArgumentException | NullPointerException e) {
			return null;
		}
	}

}
