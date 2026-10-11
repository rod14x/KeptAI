package pe.keptai.backend.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.web.filter.OncePerRequestFilter;
import pe.keptai.backend.web.ApiError;

/**
 * El filtro Bearer relanza {@link AuthenticationServiceException} (fallo de infraestructura, p. ej. base
 * o JWKS caídos). Se traduce a 503 JSON sin detalles y sin conceder ninguna identidad.
 */
public class AuthInfrastructureFailureFilter extends OncePerRequestFilter {

	private static final Logger LOG = LoggerFactory.getLogger(AuthInfrastructureFailureFilter.class);

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		try {
			chain.doFilter(request, response);
		}
		catch (AuthenticationServiceException | ServletException ex) {
			AuthenticationServiceException cause = find(ex);
			if (cause == null || response.isCommitted()) {
				throw ex;
			}
			LOG.error("Fallo de infraestructura al autenticar: {}", cause.getClass().getSimpleName());
			response.setStatus(503);
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			response.setCharacterEncoding(StandardCharsets.UTF_8.name());
			response.getWriter().write(ApiError.of("SERVICE_UNAVAILABLE", "Servicio no disponible").toJson());
		}
	}

	private static AuthenticationServiceException find(Throwable t) {
		for (Throwable c = t; c != null; c = c.getCause()) {
			if (c instanceof AuthenticationServiceException a) {
				return a;
			}
		}
		return null;
	}

}
