package pe.keptai.backend.n8n;

import java.util.Base64;

import org.springframework.http.HttpStatus;
import pe.keptai.backend.web.BusinessException;

/**
 * Archivo de voucher recibido como Base64 PURO (sin prefijo {@code data:}) dentro del JSON de WF2. Decodificación
 * estricta, tamaño acotado ANTES de decodificar y tipo real por firma y cierre del formato (JPEG, PNG o PDF);
 * el MIME o la extensión declarados por quien llama no se usan. El SHA-256 se calcula sobre los bytes decodificados.
 */
record VoucherFile(byte[] bytes, String extension, String contentType, String sha256) {

	static VoucherFile decode(String base64, long maxFileBytes) {
		if (base64 == null || base64.isEmpty()) {
			throw new BusinessException(HttpStatus.BAD_REQUEST, "IMAGE_REQUIRED", "Falta imagen_base64");
		}
		long maxChars = 4 * ((maxFileBytes + 2) / 3);
		if (base64.length() > maxChars) {
			throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", "El archivo supera el límite permitido");
		}
		if (base64.startsWith("data:") || base64.contains(",")) {
			throw new BusinessException(HttpStatus.BAD_REQUEST, "IMAGE_INVALID_BASE64", "imagen_base64 debe ser Base64 puro, sin prefijo data:");
		}
		if (base64.length() % 4 != 0) {
			throw new BusinessException(HttpStatus.BAD_REQUEST, "IMAGE_INVALID_BASE64", "imagen_base64 está incompleta o mal formada");
		}
		byte[] bytes;
		try {
			bytes = Base64.getDecoder().decode(base64); // alfabeto estándar; rechaza espacios, saltos de línea y '='' intermedio
		}
		catch (IllegalArgumentException e) {
			throw new BusinessException(HttpStatus.BAD_REQUEST, "IMAGE_INVALID_BASE64", "imagen_base64 está incompleta o mal formada");
		}
		if (bytes.length > maxFileBytes) {
			throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", "El archivo supera el límite permitido");
		}
		String type = detect(bytes);
		if (type == null || !validContent(bytes, type)) {
			throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "IMAGE_UNSUPPORTED_TYPE",
					"El contenido no es un JPEG, PNG o PDF completo");
		}
		return switch (type) {
			case "jpg" -> new VoucherFile(bytes, "jpg", "image/jpeg", CanonicalJson.sha256(bytes));
			case "png" -> new VoucherFile(bytes, "png", "image/png", CanonicalJson.sha256(bytes));
			default -> new VoucherFile(bytes, "pdf", "application/pdf", CanonicalJson.sha256(bytes));
		};
	}

	/** Validación del formato real, no solo sus marcadores. No registra datos ni causas del parser. */
	private static boolean validContent(byte[] bytes, String type) {
		try {
			if ("pdf".equals(type)) {
				try (var input = new org.apache.pdfbox.io.RandomAccessReadBuffer(bytes)) {
					var parser = new org.apache.pdfbox.pdfparser.PDFParser(input);
					try (var document = parser.parse(false)) {
						return !document.isEncrypted() && document.getNumberOfPages() > 0;
					}
				}
			}
			try (var input = new javax.imageio.stream.MemoryCacheImageInputStream(new java.io.ByteArrayInputStream(bytes))) {
				var readers = javax.imageio.ImageIO.getImageReaders(input);
				if (!readers.hasNext()) return false;
				var reader = readers.next();
				try {
					reader.setInput(input, true, true);
					int width = reader.getWidth(0), height = reader.getHeight(0);
					// Evitar asignaciones enormes al expandir una imagen comprimida pequeña.
					if (width <= 0 || height <= 0 || (long) width * height > 25_000_000L) return false;
					boolean[] warning = { false };
					reader.addIIOReadWarningListener((source, message) -> warning[0] = true);
					var image = reader.read(0);
					return image != null && !warning[0];
				} finally {
					reader.dispose();
				}
			}
		} catch (java.io.IOException | RuntimeException rejected) {
			return false;
		}
	}

	/** Tipo por contenido; {@code null} si la firma no corresponde o el archivo está cortado (sin marcador final). */
	static String detect(byte[] b) {
		int n = b.length;
		if (n >= 4 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
			return n >= 4 && (b[n - 2] & 0xFF) == 0xFF && (b[n - 1] & 0xFF) == 0xD9 ? "jpg" : null;
		}
		byte[] png = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };
		if (n >= 33 && startsWith(b, png) && b[12] == 'I' && b[13] == 'H' && b[14] == 'D' && b[15] == 'R') {
			byte[] iend = { 0, 0, 0, 0, 'I', 'E', 'N', 'D', (byte) 0xAE, 0x42, 0x60, (byte) 0x82 };
			return endsWith(b, iend) ? "png" : null;
		}
		if (n >= 16 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') {
			String tail = new String(b, Math.max(0, n - 1024), Math.min(n, 1024), java.nio.charset.StandardCharsets.ISO_8859_1);
			return tail.contains("%%EOF") ? "pdf" : null;
		}
		return null;
	}

	private static boolean startsWith(byte[] b, byte[] prefix) {
		for (int i = 0; i < prefix.length; i++) {
			if (b[i] != prefix[i]) {
				return false;
			}
		}
		return true;
	}

	private static boolean endsWith(byte[] b, byte[] suffix) {
		int off = b.length - suffix.length;
		for (int i = 0; i < suffix.length; i++) {
			if (b[off + i] != suffix[i]) {
				return false;
			}
		}
		return true;
	}

	/** Sin bytes ni hash completo en trazas. */
	@Override
	public String toString() {
		return "VoucherFile[" + extension + ", " + bytes.length + " bytes]";
	}

}
