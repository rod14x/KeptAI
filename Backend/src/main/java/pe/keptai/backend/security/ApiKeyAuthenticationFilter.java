package pe.keptai.backend.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Autentica servicios (n8n) por {@code X-Api-Key}. Solo en rutas de servicio: la clave se rechaza en cualquier
 * otra ruta, nunca coexiste con otra credencial y no hay respaldo JWT/clave. El SHA-256 de la clave exacta
 * (UTF-8) se consulta en PostgreSQL; organización y alcance salen de la base. Todo rechazo es un 401 uniforme
 * que no distingue clave inexistente, revocada, mal formada o ambigua. Un fallo de base se propaga y el filtro
 * de infraestructura lo traduce a 503.
 */
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

	public static final String HEADER = "X-Api-Key";

	/** Claves técnicas: 32 a 128 caracteres ASCII visibles (p. ej. 32 bytes aleatorios en hex o base64). */
	static final int MIN_LENGTH = 32;

	static final int MAX_LENGTH = 128;

	private final ServiceResolver resolver;

	private final Predicate<HttpServletRequest> servicePath;

	private final AuthenticationEntryPoint entryPoint;

	public ApiKeyAuthenticationFilter(ServiceResolver resolver, Predicate<HttpServletRequest> servicePath, AuthenticationEntryPoint entryPoint) {
		this.resolver = resolver;
		this.servicePath = servicePath;
		this.entryPoint = entryPoint;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return request.getRequestURI().startsWith("/actuator/health");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		List<String> keys = Collections.list(request.getHeaders(HEADER));
		if (keys.isEmpty()) {
			chain.doFilter(request, response);
			return;
		}
		boolean otherCredential = request.getHeader("Authorization") != null || request.getParameterMap().containsKey("access_token");
		if (keys.size() != 1 || otherCredential || !servicePath.test(request) || !wellFormed(keys.get(0))) {
			reject(request, response);
			return;
		}
		Optional<ServiceIdentity> service = resolver.resolve(sha256(keys.get(0)));
		if (service.isEmpty()) {
			reject(request, response);
			return;
		}
		SecurityContextHolder.getContext().setAuthentication(new ServiceAuthentication(service.get()));
		chain.doFilter(request, response);
	}

	private void reject(HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
		SecurityContextHolder.clearContext();
		entryPoint.commence(request, response, new BadCredentialsException("Credencial no válida"));
	}

	static boolean wellFormed(String key) {
		if (key.length() < MIN_LENGTH || key.length() > MAX_LENGTH) {
			return false;
		}
		for (int i = 0; i < key.length(); i++) {
			char ch = key.charAt(i);
			if (ch < 0x21 || ch > 0x7e) {
				return false;
			}
		}
		return true;
	}

	/** SHA-256 en hex minúsculas de la clave exacta (UTF-8): el formato de {@code clave_hash} (64 hex). */
	public static String sha256(String key) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));
		}
		catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

}
