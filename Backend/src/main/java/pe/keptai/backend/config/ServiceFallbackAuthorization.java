package pe.keptai.backend.config;

import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

/**
 * Autorización de las rutas bajo {@code SERVICE_PATHS} que NO figuran en {@code AccessPolicy}. Producción:
 * siempre denegado. Punto de sustitución solo para probes de {@code src/test}.
 */
public interface ServiceFallbackAuthorization extends AuthorizationManager<RequestAuthorizationContext> {
}
