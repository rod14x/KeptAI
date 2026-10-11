package pe.keptai.backend.config;

import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import pe.keptai.backend.web.ApiError;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
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
