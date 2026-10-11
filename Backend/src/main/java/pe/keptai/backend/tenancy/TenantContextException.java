package pe.keptai.backend.tenancy;

/** El contexto de organización/usuario no puede aplicarse: se falla cerrado antes de cualquier consulta de negocio. */
public class TenantContextException extends RuntimeException {

	public TenantContextException(String message) {
		super(message);
	}

	public TenantContextException(String message, Throwable cause) {
		super(message, cause);
	}

}
