package pe.keptai.backend.web;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.keptai.backend.contract.CommonDtos.UserContext;
import pe.keptai.backend.contract.ContractEnums.UserRole;
import pe.keptai.backend.panel.PanelException;
import pe.keptai.backend.panel.PanelQueries;
import pe.keptai.backend.panel.PanelQueries.IdentityNames;
import pe.keptai.backend.security.KeptaiAuthentication;
import pe.keptai.backend.security.Membership;

/**
 * GET /api/v1/me (getMyContext): identidad resuelta por el servidor; sin parámetros del cliente. Los nombres
 * (INT-FE-API-002) son informativos y se leen con el contexto de la organización; si la base no está disponible la
 * identidad se responde igual, con nombres nulos.
 */
@RestController
public class MeController {

	private final PanelQueries queries;

	public MeController(PanelQueries queries) {
		this.queries = queries;
	}

	@GetMapping("/api/v1/me")
	public UserContext me(Authentication authentication) {
		// La regla de seguridad exige acceso SINGLE antes de llegar aquí; membership() falla cerrado si no.
		Membership m = ((KeptaiAuthentication) authentication).membership();
		IdentityNames names;
		try {
			names = queries.identityNames();
		}
		catch (PanelException | org.springframework.dao.DataAccessException e) {
			// Los nombres son opcionales: un fallo al leerlos no debe negar la identidad ya resuelta.
			names = new IdentityNames(null, null);
		}
		return new UserContext(m.usuarioId(), m.organizacionId(), UserRole.valueOf(m.rol().name()), names.name(),
				names.organizationName());
	}

}
