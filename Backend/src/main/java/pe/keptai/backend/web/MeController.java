package pe.keptai.backend.web;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.CommonDtos.UserContext;
import pe.keptai.backend.contract.ContractEnums.UserRole;
import pe.keptai.backend.security.KeptaiAuthentication;
import pe.keptai.backend.security.Membership;

/** GET /api/v1/me (getMyContext): identidad resuelta por el servidor; sin parámetros del cliente. */
@RestController
public class MeController {

	@GetMapping("/api/v1/me")
	public UserContext me(Authentication authentication) {
		// La regla de seguridad exige acceso SINGLE antes de llegar aquí; membership() falla cerrado si no.
		Membership m = ((KeptaiAuthentication) authentication).membership();
		return new UserContext(m.usuarioId(), m.organizacionId(), UserRole.valueOf(m.rol().name()));
	}

}
