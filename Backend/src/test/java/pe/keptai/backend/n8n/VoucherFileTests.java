package pe.keptai.backend.n8n;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Base64;

import org.junit.jupiter.api.Test;
import pe.keptai.backend.web.BusinessException;

class VoucherFileTests {

	static final long MAX = 4096;

	private static String b64(byte[] b) {
		return Base64.getEncoder().encodeToString(b);
	}

	private static void rejects(String input, int status, String code) {
		assertThatThrownBy(() -> VoucherFile.decode(input, MAX)).isInstanceOfSatisfying(BusinessException.class,
				e -> {
					assertThat(e.status().value()).isEqualTo(status);
					assertThat(e.code()).isEqualTo(code);
				});
	}

	@Test
	void validPngJpegAndPdfAreRecognisedByContentWithTheShaOfTheDecodedBytes() {
		for (Object[] c : new Object[][] { { Fixtures.png(0), "png", "image/png" }, { Fixtures.jpeg(), "jpg", "image/jpeg" }, { Fixtures.pdf(), "pdf", "application/pdf" } }) {
			byte[] bytes = (byte[]) c[0];
			VoucherFile f = VoucherFile.decode(b64(bytes), MAX);
			assertThat(f.extension()).isEqualTo(c[1]);
			assertThat(f.contentType()).isEqualTo(c[2]);
			assertThat(f.bytes()).isEqualTo(bytes);
			assertThat(f.sha256()).isEqualTo(CanonicalJson.sha256(bytes)).hasSize(64);
			assertThat(f.toString()).doesNotContain(f.sha256());
		}
	}

	@Test
	void invalidTruncatedPrefixedOrWhitespacedBase64IsRejectedStrictly() {
		String ok = b64(Fixtures.png(0));
		rejects(null, 400, "IMAGE_REQUIRED");
		rejects("", 400, "IMAGE_REQUIRED");
		rejects("data:image/png;base64," + ok, 400, "IMAGE_INVALID_BASE64");
		rejects(ok.substring(0, ok.length() - 3), 400, "IMAGE_INVALID_BASE64"); // truncada: longitud no múltiplo de 4
		rejects(ok.substring(0, 40) + "..." + ok.substring(43), 400, "IMAGE_INVALID_BASE64"); // la muestra truncada con "..."
		rejects(ok.substring(0, 8) + "\n" + ok.substring(8), 400, "IMAGE_INVALID_BASE64");
		rejects(ok.substring(0, 8) + " " + ok.substring(9), 400, "IMAGE_INVALID_BASE64");
		rejects("====", 400, "IMAGE_INVALID_BASE64");
		rejects(ok.replace('+', '-').replace('/', '_') + "ñ", 400, "IMAGE_INVALID_BASE64");
	}

	@Test
	void contentThatIsNotACompleteJpegPngOrPdfIsRejectedWhateverItClaims() {
		byte[] png = Fixtures.png(0);
		byte[] cutPng = java.util.Arrays.copyOf(png, png.length - 5);
		byte[] cutJpeg = java.util.Arrays.copyOf(Fixtures.jpeg(), 30);
		byte[] cutPdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n".getBytes();
		for (byte[] bad : new byte[][] { "texto plano que dice ser una imagen".getBytes(), "GIF89a....................".getBytes(), cutPng, cutJpeg, cutPdf, new byte[] { 1, 2, 3 } }) {
			rejects(b64(bad), 422, "IMAGE_UNSUPPORTED_TYPE");
		}
		// Un HTML o un script con extensión .png sigue siendo texto.
		rejects(b64("<html><script>alert(1)</script></html>".getBytes()), 422, "IMAGE_UNSUPPORTED_TYPE");
	}

	@Test
	void forgedHeadersAndEndMarkersDoNotMakeAValidFile() {
		rejects(b64(new byte[] { (byte)255, (byte)216, (byte)255, (byte)217 }), 422, "IMAGE_UNSUPPORTED_TYPE");
		rejects(b64("%PDF-1.4\ntexto inventado\n%%EOF\n".getBytes()), 422, "IMAGE_UNSUPPORTED_TYPE");
		byte[] badPng = Fixtures.png(0);
		java.util.Arrays.fill(badPng, 41, badPng.length - 12, (byte)0); // IDAT corrupto, conserva IHDR e IEND.
		rejects(b64(badPng), 422, "IMAGE_UNSUPPORTED_TYPE");
	}

	@Test
	void theSizeLimitIsAppliedBeforeAndAfterDecodingWithoutDecodingGiants() {
		byte[] exact = Fixtures.pngWithTotalSize((int) MAX);
		assertThat(exact).hasSize((int) MAX);
		assertThat(VoucherFile.decode(b64(exact), MAX).bytes()).hasSize((int) MAX);
		rejects(b64(Fixtures.pngWithTotalSize((int) MAX + 1)), 413, "PAYLOAD_TOO_LARGE");
		// Cadena enorme: se rechaza por longitud sin decodificar (no hay OutOfMemory ni trabajo proporcional).
		rejects("A".repeat(2_000_000), 413, "PAYLOAD_TOO_LARGE");
	}

}
