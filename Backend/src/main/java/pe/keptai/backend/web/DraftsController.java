package pe.keptai.backend.web;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import pe.keptai.backend.panel.*;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.ExtractionDtos.*;
@RestController
public class DraftsController {
    private final DraftReviewService service;private final PanelRequests requests;
    public DraftsController(DraftReviewService service,PanelRequests requests) { this.service=service;this.requests=requests; }
    @GetMapping("/api/v1/drafts") public PageResponse<ExtractionDraft> list(@RequestParam(required=false) Integer limit,@RequestParam(required=false) String cursor) { return service.list(PageRequest.of(limit,cursor)); }
    @GetMapping("/api/v1/drafts/{draft_id}") public ExtractionDraft get(@PathVariable("draft_id") UUID id) { return service.get(id); }
    @PatchMapping("/api/v1/drafts/{draft_id}") public ExtractionDraft correct(@PathVariable("draft_id") UUID id,@RequestBody String body) { return service.correct(id,requests.body(body,CorrectDraftRequest.class)); }
    @PostMapping("/api/v1/drafts/{draft_id}/confirmation") public ConfirmDraftResponse confirm(@PathVariable("draft_id") UUID id,@RequestBody String body,@RequestHeader("Idempotency-Key") String key) { return service.confirm(id,requests.body(body,ConfirmDraftRequest.class),key); }
    @PostMapping("/api/v1/drafts/{draft_id}/discard") public ExtractionDraft discard(@PathVariable("draft_id") UUID id,@RequestBody String body) { return service.discard(id,requests.body(body,DiscardDraftRequest.class)); }
}
