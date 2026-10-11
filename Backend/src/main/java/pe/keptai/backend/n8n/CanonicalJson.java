package pe.keptai.backend.n8n;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import tools.jackson.databind.JsonNode;

/**
 * Forma canónica de los datos estructurados permitidos (nunca el cuerpo completo): claves ordenadas, sin nulos,
 * importes normalizados (3.5 == 3.50). Sirve para el hash de contenido funcional de la idempotencia.
 */
final class CanonicalJson {

	private CanonicalJson() {
	}

	static String of(JsonNode node) {
		StringBuilder sb = new StringBuilder();
		write(node, sb);
		return sb.toString();
	}

	static String sha256(String text) {
		return sha256(text.getBytes(StandardCharsets.UTF_8));
	}

	static String sha256(byte[] bytes) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
		}
		catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

	private static void write(JsonNode n, StringBuilder sb) {
		if (n.isObject()) {
			List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
			n.properties().forEach(e -> {
				if (!e.getValue().isNull()) {
					entries.add(e);
				}
			});
			entries.sort(Map.Entry.comparingByKey());
			sb.append('{');
			boolean first = true;
			for (Map.Entry<String, JsonNode> e : entries) {
				if (!first) {
					sb.append(',');
				}
				first = false;
				string(e.getKey(), sb);
				sb.append(':');
				write(e.getValue(), sb);
			}
			sb.append('}');
		}
		else if (n.isArray()) {
			sb.append('[');
			for (int i = 0; i < n.size(); i++) {
				if (i > 0) {
					sb.append(',');
				}
				write(n.get(i), sb);
			}
			sb.append(']');
		}
		else if (n.isNumber()) {
			sb.append(n.decimalValue().stripTrailingZeros().toPlainString());
		}
		else if (n.isBoolean()) {
			sb.append(n.booleanValue());
		}
		else {
			string(n.asString(), sb);
		}
	}

	private static void string(String s, StringBuilder sb) {
		sb.append('"');
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			switch (c) {
				case '"' -> sb.append("\\\"");
				case '\\' -> sb.append("\\\\");
				case '\n' -> sb.append("\\n");
				case '\r' -> sb.append("\\r");
				case '\t' -> sb.append("\\t");
				default -> {
					if (c < 0x20) {
						sb.append(String.format("\\u%04x", (int) c));
					}
					else {
						sb.append(c);
					}
				}
			}
		}
		sb.append('"');
	}

}
