package pe.keptai.backend.n8n;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import pe.keptai.backend.web.ApiError;

/**
 * Límite del cuerpo HTTP de las rutas de n8n, aplicado ANTES de la autenticación y de leer el cuerpo: una cabecera
 * Content-Length superior responde 413 sin consumir nada, y un cuerpo sin longitud (chunked) se corta al pasar el
 * límite. Evita decodificar o retener entradas gigantes (Base64 de 4/3 del archivo más metadatos).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10) // después de RequestIdFilter, antes de Spring Security
public class BodyLimitFilter extends OncePerRequestFilter {

	static final String INGESTA = "/api/v1/ordenes/ingesta";

	static final String VOUCHER = "/api/v1/pagos/voucher";

	private final N8nProperties props;

	public BodyLimitFilter(N8nProperties props) {
		this.props = props;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !"POST".equals(request.getMethod()) || limitFor(request.getRequestURI()) < 0;
	}

	long limitFor(String uri) {
		return switch (uri) {
			case INGESTA -> props.ingesta().maxBodyBytes();
			case VOUCHER -> props.voucher().maxBodyBytes();
			default -> -1;
		};
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
		long limit = limitFor(request.getRequestURI());
		long declared = request.getContentLengthLong();
		if (declared > limit) {
			tooLarge(response);
			return;
		}
		chain.doFilter(new Limited(request, limit), response);
	}

	private static void tooLarge(HttpServletResponse response) throws IOException {
		response.setStatus(413);
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.getWriter().write(ApiError.of("PAYLOAD_TOO_LARGE", "Cuerpo demasiado grande").toJson());
	}

	private static final class Limited extends HttpServletRequestWrapper {

		private final long limit;

		Limited(HttpServletRequest request, long limit) {
			super(request);
			this.limit = limit;
		}

		@Override
		public ServletInputStream getInputStream() throws IOException {
			ServletInputStream in = super.getInputStream();
			return new ServletInputStream() {
				private long count;

				@Override
				public int read() throws IOException {
					int b = in.read();
					if (b >= 0 && ++count > limit) {
						throw new PayloadTooLargeException(limit);
					}
					return b;
				}

				@Override
				public int read(byte[] buf, int off, int len) throws IOException {
					int n = in.read(buf, off, len);
					if (n > 0) {
						count += n;
						if (count > limit) {
							throw new PayloadTooLargeException(limit);
						}
					}
					return n;
				}

				@Override
				public boolean isFinished() {
					return in.isFinished();
				}

				@Override
				public boolean isReady() {
					return in.isReady();
				}

				@Override
				public void setReadListener(ReadListener listener) {
					in.setReadListener(listener);
				}
			};
		}
	}

}
