package pe.keptai.backend.n8n;

import java.io.IOException;

/** El cuerpo HTTP superó el límite configurado: se corta la lectura sin decodificar ni retener el resto. */
public class PayloadTooLargeException extends IOException {

	public PayloadTooLargeException(long limit) {
		super("Cuerpo superior al límite de " + limit + " bytes");
	}

}
