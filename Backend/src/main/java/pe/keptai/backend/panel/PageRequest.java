package pe.keptai.backend.panel;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import pe.keptai.backend.contract.CommonDtos.PageInfo;
import pe.keptai.backend.contract.CommonDtos.PageResponse;

/**
 * Paginación por cursor del contrato ({@code limit} 1..100, {@code next_cursor} opaco). El cursor codifica la posición
 * en un orden estable (fecha, id); el cliente no lo interpreta. Un límite mayor se recorta a 100, no se rechaza.
 */
public record PageRequest(int limit, int offset) {

	public static final int MAX = 100;

	private static final String PREFIX = "o:";

	public static PageRequest of(Integer limit, String cursor) {
		int l = limit == null ? MAX : Math.max(1, Math.min(MAX, limit));
		return new PageRequest(l, decode(cursor));
	}

	/** Se piden {@code limit + 1} filas para saber si hay otra página sin un COUNT adicional. */
	public int fetch() {
		return limit + 1;
	}

	public <T> PageResponse<T> page(List<T> rows) {
		boolean more = rows.size() > limit;
		List<T> items = more ? List.copyOf(rows.subList(0, limit)) : List.copyOf(rows);
		return new PageResponse<>(items, info(more));
	}

	/** Página de una lista ya calculada en memoria (reportes del motor). */
	public <T> PageResponse<T> slice(List<T> all) {
		int from = Math.min(offset, all.size());
		int to = Math.min(all.size(), from + limit);
		return new PageResponse<>(List.copyOf(all.subList(from, to)), info(to < all.size()));
	}

	private PageInfo info(boolean more) {
		return new PageInfo(limit, more ? encode(offset + limit) : null);
	}

	private static String encode(int offset) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString((PREFIX + offset).getBytes(StandardCharsets.UTF_8));
	}

	private static int decode(String cursor) {
		if (cursor == null || cursor.isBlank()) {
			return 0;
		}
		try {
			String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
			if (!raw.startsWith(PREFIX)) {
				throw new IllegalArgumentException();
			}
			int offset = Integer.parseInt(raw.substring(PREFIX.length()));
			if (offset < 0 || offset > 1_000_000) {
				throw new IllegalArgumentException();
			}
			return offset;
		}
		catch (IllegalArgumentException e) {
			throw PanelException.badRequest("Cursor no válido");
		}
	}

}
