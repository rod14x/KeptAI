package pe.keptai.backend.n8n;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.util.zip.CRC32;
import java.util.zip.Deflater;

/** Archivos FICTICIOS completos y reproducibles para las pruebas (nunca el Base64 truncado de una muestra). */
final class Fixtures {

	private Fixtures() {
	}

	/** PNG sintético válido (firma, IHDR, IDAT, IEND); {@code relleno} bytes extra en un chunk tEXt para fijar el tamaño. */
	static byte[] png(int relleno) {
		ByteArrayOutputStream o = new ByteArrayOutputStream();
		o.writeBytes(new byte[] { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A });
		chunk(o, "IHDR", new byte[] { 0, 0, 0, 4, 0, 0, 0, 4, 8, 2, 0, 0, 0 });
		if (relleno > 0) {
			byte[] texto = new byte[relleno];
			java.util.Arrays.fill(texto, (byte) 'x');
			texto[0] = 'k';
			texto[1] = 0;
			chunk(o, "tEXt", texto);
		}
		byte[] raw = new byte[4 * 13];
		for (int y = 0; y < 4; y++) {
			raw[y * 13 + 1] = (byte) (y * 20);
		}
		Deflater d = new Deflater(9);
		d.setInput(raw);
		d.finish();
		byte[] buf = new byte[256];
		int n = d.deflate(buf);
		chunk(o, "IDAT", java.util.Arrays.copyOf(buf, n));
		chunk(o, "IEND", new byte[0]);
		return o.toByteArray();
	}

	static byte[] pngWithTotalSize(int total) {
		byte[] base = png(0);
		int extra = total - base.length - 12; // un chunk tEXt añade 12 bytes de estructura
		if (extra < 2) {
			throw new IllegalArgumentException("tamaño demasiado pequeño");
		}
		return png(extra);
	}

	/** JPEG decodificable generado por el codec real del JDK. */
	static byte[] jpeg() {
		try {
			var image = new java.awt.image.BufferedImage(4, 4, java.awt.image.BufferedImage.TYPE_INT_RGB);
			var out = new ByteArrayOutputStream();
			javax.imageio.ImageIO.write(image, "jpg", out);
			return out.toByteArray();
		} catch (java.io.IOException e) { throw new IllegalStateException(e); }
	}

	static byte[] pdf() {
		try (var doc = new org.apache.pdfbox.pdmodel.PDDocument()) {
			doc.addPage(new org.apache.pdfbox.pdmodel.PDPage());
			var out = new ByteArrayOutputStream();
			doc.save(out);
			return out.toByteArray();
		} catch (java.io.IOException e) { throw new IllegalStateException(e); }
	}

	private static void chunk(ByteArrayOutputStream o, String type, byte[] data) {
		byte[] t = type.getBytes(StandardCharsets.US_ASCII);
		o.writeBytes(ByteBuffer.allocate(4).putInt(data.length).array());
		o.writeBytes(t);
		o.writeBytes(data);
		CRC32 crc = new CRC32();
		crc.update(t);
		crc.update(data);
		o.writeBytes(ByteBuffer.allocate(4).putInt((int) crc.getValue()).array());
	}

}
