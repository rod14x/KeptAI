package pe.keptai.backend.web;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.keptai.backend.contract.EvidenceDtos.EvidenceDownloadLink;
import pe.keptai.backend.evidences.PrivateVoucherReader;

@RestController
public class EvidenceController {
    private final PrivateVoucherReader reader;
    private final pe.keptai.backend.evidences.EvidenceService service;
    public EvidenceController(PrivateVoucherReader reader,pe.keptai.backend.evidences.EvidenceService service) { this.reader = reader; this.service=service; }
    @GetMapping("/api/v1/evidences/{evidence_id}")
    public pe.keptai.backend.contract.EvidenceDtos.Evidence get(@PathVariable("evidence_id") UUID id) {return service.get(id);}
    @GetMapping("/api/v1/evidences")
    public pe.keptai.backend.contract.CommonDtos.PageResponse<pe.keptai.backend.contract.EvidenceDtos.Evidence> list(@RequestParam(required=false) Integer limit,@RequestParam(required=false) String cursor,@RequestParam(required=false) String kind) {
        if(kind!=null && !kind.equals("voucher_image"))throw pe.keptai.backend.panel.PanelException.badRequest("Solo vouchers privados disponibles");
        return service.list(pe.keptai.backend.panel.PageRequest.of(limit,cursor));
    }
    @PostMapping(value="/api/v1/evidences/files",consumes="multipart/form-data")
    public ResponseEntity<pe.keptai.backend.contract.EvidenceDtos.Evidence> upload(@RequestPart("file") org.springframework.web.multipart.MultipartFile file,
       @RequestParam("payment_id") UUID payment,@RequestParam("kind") String kind,@RequestParam(required=false) String label,@RequestHeader("Idempotency-Key") String key,jakarta.servlet.http.HttpServletRequest request) throws java.io.IOException,jakarta.servlet.ServletException {
        if(!kind.equals("voucher_image"))throw pe.keptai.backend.panel.PanelException.badRequest("Solo voucher_image disponible");
        for(var part:request.getParts())if(!java.util.Set.of("file","payment_id","kind","label").contains(part.getName()))throw pe.keptai.backend.panel.PanelException.badRequest("Campo multipart desconocido");
        for(String name:request.getParameterMap().keySet())if(!java.util.Set.of("payment_id","kind","label").contains(name))throw pe.keptai.backend.panel.PanelException.badRequest("Campo desconocido");
        if(file.isEmpty() || file.getSize()>10485760)throw new BusinessException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE,"PAYLOAD_TOO_LARGE","Tamaño de voucher no permitido");
        return ResponseEntity.status(201).body(service.upload(payment,label,file.getBytes(),key));
    }
    @GetMapping("/api/v1/evidences/{evidence_id}/download-link")
    public ResponseEntity<EvidenceDownloadLink> link(@PathVariable("evidence_id") UUID id) {
        return ResponseEntity.ok().header("Cache-Control","no-store").header("Referrer-Policy","no-referrer").body(reader.link(id));
    }
}
