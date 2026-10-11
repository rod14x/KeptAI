package pe.keptai.backend.n8n;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Cableado de las rutas de n8n. El adaptador de Storage real solo existe si URL, bucket y clave están configurados. */
@Configuration
@EnableConfigurationProperties(N8nProperties.class)
public class N8nConfiguration {

	@Bean
	@org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean(VoucherStorage.class)
	VoucherStorage voucherStorage(N8nProperties props) {
		return props.storage().isConfigured() ? new SupabaseVoucherStorage(props.storage()) : new UnconfiguredVoucherStorage();
	}

}
