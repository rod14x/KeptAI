package pe.keptai.backend.n8n;

import java.net.URI;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Límites y Storage de las dos rutas de n8n (MIG-04/05, alcance de ingesta y voucher). Sin secretos en Git: la
 * clave secreta de Storage llega solo por entorno ({@code SUPABASE_SECRET_KEY}) y nunca se imprime.
 *
 * <p>Unidad de todos los límites: <b>bytes</b>. El bucket {@code keptai-vouchers} se define en
 * {@code BD/supabase/vouchers_storage.sql} con {@code file_size_limit = 10485760} (10 MiB); el valor por defecto
 * del archivo coincide con él. El cuerpo HTTP del voucher es JSON con el archivo en Base64 (4/3 del tamaño) más
 * metadatos, por eso su límite se deriva del archivo y no es ilimitado.
 */
@ConfigurationProperties("keptai.n8n")
public record N8nProperties(@DefaultValue Ingesta ingesta, @DefaultValue Voucher voucher, @DefaultValue Storage storage) {

	/** Cuerpo de la ingesta: transcript (máx. 60 000 caracteres) + resumen (20 000) + extracción, con holgura UTF-8. */
	public record Ingesta(@DefaultValue("524288") long maxBodyBytes) {
		public Ingesta {
			if (maxBodyBytes < 4096 || maxBodyBytes > 8_388_608) {
				throw new IllegalArgumentException("keptai.n8n.ingesta.max-body-bytes fuera de rango (4096..8388608)");
			}
		}
	}

	/**
	 * @param maxFileBytes archivo decodificado máximo (bytes); por defecto el del bucket
	 * @param metadataAllowanceBytes holgura del JSON además del Base64 (campos de la extracción)
	 */
	public record Voucher(@DefaultValue("10485760") long maxFileBytes, @DefaultValue("65536") long metadataAllowanceBytes) {
		public Voucher {
			if (maxFileBytes < 1024 || maxFileBytes > 52_428_800) {
				throw new IllegalArgumentException("keptai.n8n.voucher.max-file-bytes fuera de rango (1024..52428800)");
			}
			if (metadataAllowanceBytes < 4096 || metadataAllowanceBytes > 1_048_576) {
				throw new IllegalArgumentException("keptai.n8n.voucher.metadata-allowance-bytes fuera de rango");
			}
		}

		/** Longitud máxima del Base64 de un archivo de {@code maxFileBytes}: 4 · ceil(n / 3). */
		public long maxBase64Chars() {
			return 4 * ((maxFileBytes + 2) / 3);
		}

		/** Cuerpo HTTP máximo: Base64 más metadatos. */
		public long maxBodyBytes() {
			return maxBase64Chars() + metadataAllowanceBytes;
		}
	}

	public record Storage(String url, @DefaultValue("keptai-vouchers") String bucket, String secretKey, @DefaultValue("20s") Duration timeout) {

		public boolean isConfigured() {
			return hasText(url) && hasText(bucket) && hasText(secretKey);
		}

		public Storage {
			if (hasText(url)) {
				URI u = URI.create(url.trim());
				boolean local = "localhost".equals(u.getHost()) || "127.0.0.1".equals(u.getHost());
				if (u.getUserInfo() != null || !("https".equals(u.getScheme()) || ("http".equals(u.getScheme()) && local))) {
					throw new IllegalArgumentException("keptai.n8n.storage.url debe ser https (http solo en localhost) y sin credenciales");
				}
			}
			if (timeout.isNegative() || timeout.isZero() || timeout.compareTo(Duration.ofMinutes(2)) > 0) {
				throw new IllegalArgumentException("keptai.n8n.storage.timeout entre 1 ms y 2 minutos");
			}
		}

		/** Sin la clave: nunca se imprime en logs ni en trazas. */
		@Override
		public String toString() {
			return "Storage[bucket=" + bucket + ", configured=" + isConfigured() + "]";
		}

		private static boolean hasText(String s) {
			return s != null && !s.isBlank();
		}
	}

}
