/**
 * Corpotex KeptAI - Controlador de Artes de Diseño y Curva de Personal (B-03, B-06)
 * Versión: v1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.web;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import pe.keptai.backend.contract.ArtAndCurveDtos.ApproveArtRequest;
import pe.keptai.backend.contract.ArtAndCurveDtos.ArtPiece;
import pe.keptai.backend.contract.ArtAndCurveDtos.CreateArtRequest;
import pe.keptai.backend.contract.ArtAndCurveDtos.ImportPersonnelRequest;
import pe.keptai.backend.contract.ArtAndCurveDtos.ImportPersonnelResult;
import pe.keptai.backend.panel.ArtService;

@RestController
@RequestMapping("/api/v1/orders/{orderId}")
public class ArtController {

	private final ArtService artService;

	public ArtController(ArtService artService) {
		this.artService = artService;
	}

	@GetMapping("/arts")
	public List<ArtPiece> listArts(@PathVariable UUID orderId) {
		return artService.listOrderArts(orderId);
	}

	@PostMapping("/arts")
	@ResponseStatus(HttpStatus.CREATED)
	public ArtPiece createArt(@PathVariable UUID orderId, @RequestBody CreateArtRequest req) {
		return artService.createArt(orderId, req);
	}

	@PostMapping("/arts/{artId}/approval")
	public ArtPiece approveArt(@PathVariable UUID orderId, @PathVariable UUID artId, @RequestBody ApproveArtRequest req) {
		return artService.approveArt(orderId, artId, req);
	}

	@PostMapping("/personnel")
	public ImportPersonnelResult importPersonnel(@PathVariable UUID orderId, @RequestBody ImportPersonnelRequest req) {
		return artService.importPersonnel(orderId, req);
	}

}
