package pe.keptai.backend.config;

import java.nio.charset.StandardCharsets;

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

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http,
			@Qualifier("corsConfigurationSource") CorsConfigurationSource cors) throws Exception {
		http
			.cors(c -> c.configurationSource(cors))
			.csrf(AbstractHttpConfigurer::disable)
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(a -> a
				.requestMatchers("/actuator/health/**").permitAll()
				.anyRequest().authenticated())
			.exceptionHandling(e -> e
				.authenticationEntryPoint((req, res, ex) -> write(res, 401, ApiError.of("UNAUTHORIZED", "No autenticado")))
				.accessDeniedHandler((req, res, ex) -> write(res, 403, ApiError.of("FORBIDDEN", "Acceso denegado"))));
		return http.build();
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
