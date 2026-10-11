package pe.keptai.backend.config;

import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.util.Arrays;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import pe.keptai.backend.security.ApiKeyAuthenticationFilter;
import pe.keptai.backend.security.AuthInfrastructureFailureFilter;
import pe.keptai.backend.security.ServiceResolver;
import pe.keptai.backend.security.JwtDecoders;
import pe.keptai.backend.security.KeptaiAuthentication;
import pe.keptai.backend.security.KeptaiJwtConverter;
import pe.keptai.backend.security.MembershipResolver;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import pe.keptai.backend.web.ApiError;

@Configuration
@EnableConfigurationProperties(KeptaiSecurityProperties.class)
public class SecurityConfig {

	/** Rutas exclusivas de n8n (X-Api-Key, MIG-03-D): un JWT de usuario nunca las autentica. */
	private static final String[] SERVICE_PATHS = { "/api/v1/ordenes/**", "/api/v1/pagos/**", "/api/v1/mensajes/**" };

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http,
			@Qualifier("corsConfigurationSource") CorsConfigurationSource cors,
			JwtDecoder jwtDecoder, MembershipResolver membershipResolver, ServiceResolver serviceResolver,
			AuthorizationManager<RequestAuthorizationContext> serviceRoutes) throws Exception {
		AuthorizationManager<RequestAuthorizationContext> panel = (auth, ctx) -> new AuthorizationDecision(
				auth.get() instanceof KeptaiAuthentication k && k.access() == KeptaiAuthentication.Access.SINGLE);
		http
			.cors(c -> c.configurationSource(cors))
			.csrf(AbstractHttpConfigurer::disable)
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(a -> a
				.requestMatchers("/actuator/health/**").permitAll()
				.requestMatchers(SERVICE_PATHS).access(serviceRoutes)
				.requestMatchers("/api/v1/**").access(panel)
				.anyRequest().denyAll())
			.oauth2ResourceServer(o -> o
				.bearerTokenResolver(healthExemptResolver())
				.jwt(j -> j.decoder(jwtDecoder).jwtAuthenticationConverter(new KeptaiJwtConverter(membershipResolver)))
				.authenticationEntryPoint(this::unauthenticated)
				.accessDeniedHandler(this::denied))
			.addFilterBefore(new AuthInfrastructureFailureFilter(), BearerTokenAuthenticationFilter.class)
			.addFilterAfter(new ApiKeyAuthenticationFilter(serviceResolver, SecurityConfig::isServicePath, this::unauthenticated), AuthInfrastructureFailureFilter.class)
			.exceptionHandling(e -> e
				.authenticationEntryPoint(this::unauthenticated)
				.accessDeniedHandler(this::denied));
		return http.build();
	}

	/**
	 * Autorización de las rutas de servicio. D1 autentica al servicio pero mantiene cerradas todas las rutas de
	 * negocio (siempre denegado, 403 para un servicio válido); los permisos por método/ruta son D2.
	 */
	@Bean
	AuthorizationManager<RequestAuthorizationContext> serviceRouteAuthorization() {
		return (auth, ctx) -> new AuthorizationDecision(false);
	}

	private static boolean isServicePath(HttpServletRequest req) {
		return Arrays.stream(SERVICE_PATHS).anyMatch(p -> PathPatternRequestMatcher.withDefaults().matcher(p).matches(req));
	}

	/** Decodificador configurado desde keptai.security.jwt.*; sin configurar rechaza todo token (401). */
	@Bean
	JwtDecoder jwtDecoder(KeptaiSecurityProperties props) {
		return JwtDecoders.from(props.jwt());
	}

	/** El health es público: un Authorization erróneo allí no debe convertirlo en 401. */
	private static BearerTokenResolver healthExemptResolver() {
		DefaultBearerTokenResolver delegate = new DefaultBearerTokenResolver();
		return request -> request.getRequestURI().startsWith("/actuator/health") ? null : delegate.resolve(request);
	}

	private void unauthenticated(HttpServletRequest req, HttpServletResponse res, AuthenticationException ex) throws IOException {
		res.setHeader("WWW-Authenticate", "Bearer");
		write(res, 401, ApiError.of("UNAUTHORIZED", "No autenticado"));
	}

	private void denied(HttpServletRequest req, HttpServletResponse res, AccessDeniedException ex) throws IOException {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		boolean servicePath = isServicePath(req);
		if (!servicePath && auth instanceof KeptaiAuthentication k && k.access() == KeptaiAuthentication.Access.MULTIPLE) {
			// Selección de organización no definida (propuesta en matriz-acceso.md 5.1): no se elige ninguna ni se listan.
			write(res, 409, ApiError.of("ORGANIZATION_SELECTION_REQUIRED", "Se requiere seleccionar organización; aún no soportado"));
			return;
		}
		write(res, 403, ApiError.of("FORBIDDEN", "Acceso denegado"));
	}

	/**
	 * CORS solo para los orígenes exactos configurados (frontend). Sin orígenes no se registra
	 * ninguna política y el navegador queda bloqueado. No abre rutas: la autorización sigue igual.
	 */
	@Bean
	CorsConfigurationSource corsConfigurationSource(KeptaiSecurityProperties props) {
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		KeptaiSecurityProperties.Cors c = props.cors();
		if (!c.allowedOrigins().isEmpty()) {
			CorsConfiguration cfg = new CorsConfiguration();
			cfg.setAllowedOrigins(c.allowedOrigins());
			cfg.setAllowedMethods(c.allowedMethods());
			cfg.setAllowedHeaders(c.allowedHeaders());
			cfg.setExposedHeaders(c.exposedHeaders());
			cfg.setAllowCredentials(false);
			cfg.setMaxAge(c.maxAge());
			source.registerCorsConfiguration("/api/**", cfg);
		}
		return source;
	}

	/** Sin usuarios: evita el usuario generado con contrasena en el log. */
	@Bean
	UserDetailsService userDetailsService() {
		return new InMemoryUserDetailsManager();
	}

	private static void write(HttpServletResponse res, int status, ApiError body) throws java.io.IOException {
		res.setStatus(status);
		res.setContentType(MediaType.APPLICATION_JSON_VALUE);
		res.setCharacterEncoding(StandardCharsets.UTF_8.name());
		res.getWriter().write(body.toJson());
	}

}
