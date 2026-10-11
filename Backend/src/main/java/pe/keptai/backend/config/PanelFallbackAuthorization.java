package pe.keptai.backend.config;

import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

/**
 * Autorización de las rutas {@code /api/v1/**} que NO figuran en {@code AccessPolicy}. Producción: siempre
 * denegado (deny por defecto). Existe como punto de sustitución solo para probes de {@code src/test}.
 */
public interface PanelFallbackAuthorization extends AuthorizationManager<RequestAuthorizationContext> {
}
