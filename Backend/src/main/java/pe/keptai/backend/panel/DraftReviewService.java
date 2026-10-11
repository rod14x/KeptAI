package pe.keptai.backend.panel;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.CommonDtos.*;
import pe.keptai.backend.contract.ContractEnums.*;
import pe.keptai.backend.contract.ExtractionDtos.*;
import pe.keptai.backend.n8n.IdempotencyStore;
import pe.keptai.backend.security.ApiKeyAuthenticationFilter;
import pe.keptai.backend.web.RequestIdFilter;

/** MIG-06: hoja_resumen es el borrador, orden es su pedido persistente. ADMIN humano; sin crédito ni fondos. */
@Service
public class DraftReviewService {
    private final PanelContext panel;
    private final tools.jackson.databind.json.JsonMapper json = pe.keptai.backend.contract.ContractJson.newMapper();
    public DraftReviewService(PanelContext panel) { this.panel = panel; }
    private void admin() {
        if (!"ADMIN".equals(panel.jdbc().queryForObject("SELECT keptai_private.actor_actual()",String.class)))
            throw PanelException.forbidden("Revisión reservada a ADMIN hasta definir cartera de vendedores");
    }
    public PageResponse<ExtractionDraft> list(PageRequest page) {
        return panel.read(() -> { admin(); return page.page(panel.jdbc().query("""
          SELECT h.id FROM keptai.hoja_resumen h WHERE h.organizacion_id=keptai.app_organizacion_actual()
          AND h.version=(SELECT max(h2.version) FROM keptai.hoja_resumen h2 WHERE h2.organizacion_id=h.organizacion_id AND h2.orden_id=h.orden_id)
          ORDER BY h.creado_en DESC,h.id LIMIT ? OFFSET ?
          """, (rs,i)->draft(rs.getObject(1,UUID.class)),page.fetch(),page.offset())); });
    }
    public ExtractionDraft get(UUID id) { return panel.read(() -> { admin(); return draft(id); }); }
    private Map<String,Object> row(UUID id) {
        var rows = panel.jdbc().queryForList("""
          SELECT h.*,o.estado AS orden_estado,o.total,o.condicion_pago,o.plazo_dias,o.anticipo_requerido,o.marca_id,
          c.razon_social,m.nombre AS marca FROM keptai.hoja_resumen h
          JOIN keptai.orden o ON o.organizacion_id=h.organizacion_id AND o.id=h.orden_id
          LEFT JOIN keptai.cliente c ON c.organizacion_id=o.organizacion_id AND c.id=o.cliente_id
          LEFT JOIN keptai.marca m ON m.organizacion_id=o.organizacion_id AND m.id=o.marca_id
          WHERE h.id=? AND h.organizacion_id=keptai.app_organizacion_actual()
          """,id);
        if (rows.isEmpty()) throw PanelException.notFound("Borrador no encontrado");
        return rows.getFirst();
    }
    private Map<String,Object> lock(UUID id) {
        Map<String,Object> first=row(id);
        panel.jdbc().queryForObject("SELECT id FROM keptai.orden WHERE id=? AND organizacion_id=keptai.app_organizacion_actual() FOR UPDATE",UUID.class, first.get("orden_id"));
        panel.jdbc().queryForObject("SELECT id FROM keptai.hoja_resumen WHERE id=? FOR UPDATE",UUID.class,id);
        Map<String,Object> h=row(id);
        Integer latest=panel.jdbc().queryForObject("SELECT max(version) FROM keptai.hoja_resumen WHERE orden_id=?",Integer.class,h.get("orden_id"));
        if (!latest.equals(h.get("version"))) throw PanelException.conflict("Existe una revisión posterior del pedido");
        return h;
    }
    private static <T> ExtractedField<T> field(T v, boolean human) { return new ExtractedField<>(v,v==null?FieldStatus.MISSING:FieldStatus.PRESENT,null,human); }
    private ExtractionDraft draft(UUID id) {
        Map<String,Object> h=row(id);UUID order=(UUID)h.get("orden_id");
        var items=panel.jdbc().queryForList("SELECT descripcion,cantidad FROM keptai.orden_item WHERE orden_id=? ORDER BY id",order);
        String description=items.isEmpty()?null:items.stream().map(x->(String)x.get("descripcion")).reduce((a,c)->a+"; "+c).orElse(null);
        Integer quantity=items.isEmpty()?null:items.stream().mapToInt(x->((Number)x.get("cantidad")).intValue()).sum();
        BigDecimal total=(BigDecimal)h.get("total");
        PositiveMoney amount=total==null || total.signum()<=0?null:PositiveMoney.pen(PanelMapping.cents(total));
        boolean human=h.get("revisado_por")!=null;
        String state=(String)h.get("estado");
        DraftStatus status=switch(state) { case "CONFIRMADA"->DraftStatus.CONFIRMED; case "DESCARTADA"->DraftStatus.DISCARDED; default->DraftStatus.PENDING_REVIEW; };
        BigDecimal confidence=(BigDecimal)h.get("confianza");
        OffsetDateTime created=((java.sql.Timestamp)h.get("creado_en")).toInstant().atOffset(java.time.ZoneOffset.UTC);
        OffsetDateTime updated=h.get("revisado_en")==null?created:((java.sql.Timestamp)h.get("revisado_en")).toInstant().atOffset(java.time.ZoneOffset.UTC);
        return new ExtractionDraft(id,null,DraftType.ORDER,status,((Number)h.get("version")).intValue(),
           new OrderDraftFields(field((String)h.get("razon_social"),human),field((String)h.get("marca"),human),field(description,human),field(quantity,human),field(amount,human)),
           null,status==DraftStatus.CONFIRMED?order:null,null,(UUID)h.get("revisado_por"),confidence==null?null:confidence.movePointRight(3).intValue(),created,updated);
    }
    private void pending(Map<String,Object> h,int expected) {
        if (!"BORRADOR".equals(h.get("estado")) || !"BORRADOR".equals(h.get("orden_estado"))) throw PanelException.conflict("El borrador ya fue resuelto");
        if (((Number)h.get("version")).intValue()!=expected) throw new PanelException(org.springframework.http.HttpStatus.CONFLICT,"CONCURRENCY_CONFLICT","La revisión cambió; recarga el borrador");
    }
    public ExtractionDraft correct(UUID id,CorrectDraftRequest req) {
        return panel.write(() -> { admin();var h=lock(id);pending(h,req.expectedRevision()); ExtractionDraft before=draft(id); UUID order=(UUID)h.get("orden_id");var db=panel.jdbc();
            if (req.voucherFields()!=null) throw PanelException.badRequest("Este endpoint revisa hojas de pedido, no modifica pagos");
            var f=req.orderFields();
            if (f!=null && f.customerName()!=null && !f.customerName().equals(h.get("razon_social")))
                throw PanelException.unprocessable("CUSTOMER_CONTACT_MISMATCH","El cliente se identifica por contacto registrado; no por su nombre declarado");
            if (f!=null && f.brand()!=null) {
                var brands=db.queryForList("SELECT id FROM keptai.marca WHERE nombre=? AND organizacion_id=keptai.app_organizacion_actual()",UUID.class,f.brand());
                if (brands.size()!=1) throw PanelException.unprocessable("BRAND_NOT_FOUND","Debe indicar una marca registrada inequívoca");
                db.update("UPDATE keptai.orden SET marca_id=? WHERE id=?",brands.getFirst(),order);
            }
            if (f!=null && (f.quantity()!=null || f.productDescription()!=null) && req.items()==null)
                throw PanelException.badRequest("Para corregir cantidades o productos envíe la lista items completa");
            if (req.items()!=null) {
                db.update("DELETE FROM keptai.orden_item WHERE orden_id=?",order);
                for (ReviewItem item:req.items()) db.update("INSERT INTO keptai.orden_item(organizacion_id,orden_id,descripcion,cantidad,precio_unit) VALUES(keptai.app_organizacion_actual(),?,?,?,?)",
                    order,item.description(),item.quantity(),PanelMapping.soles(item.unitPrice().amountCents()));
                BigDecimal sum=req.items().stream().map(i->PanelMapping.soles(i.unitPrice().amountCents()).multiply(BigDecimal.valueOf(i.quantity()))).reduce(BigDecimal.ZERO,BigDecimal::add);
                if (f!=null && f.saleAmount()!=null && sum.compareTo(PanelMapping.soles(f.saleAmount().amountCents()))!=0) throw PanelException.badRequest("El total debe coincidir con los ítems");
                db.update("UPDATE keptai.orden SET total=? WHERE id=?",sum,order);
            } else if (f!=null && f.saleAmount()!=null) db.update("UPDATE keptai.orden SET total=? WHERE id=?",PanelMapping.soles(f.saleAmount().amountCents()),order);
            if (req.paymentCondition()!=null) db.update("UPDATE keptai.orden SET condicion_pago=?,plazo_dias=?,anticipo_requerido=? WHERE id=?",req.paymentCondition(),req.creditTermDays(),req.downpayment()==null?BigDecimal.ZERO:PanelMapping.soles(req.downpayment().amountCents()),order);
            else if (req.creditTermDays()!=null || req.downpayment()!=null) throw PanelException.badRequest("Indique payment_condition al corregir las condiciones de pago");

            db.update("UPDATE keptai.orden SET version=version+1,actualizado_en=now() WHERE id=?",order);
            // Auditoría estructurada: nunca se acepta transcript, contenido libre del chat ni campos de autor.
            db.update("UPDATE keptai.hoja_resumen SET version=version+1,revisado_por=?,revisado_en=now() WHERE id=?",panel.identity().usuarioId(),id);
            ExtractionDraft after=draft(id);
            var revision = new LinkedHashMap<String,Object>();
            revision.put("revision",after.revision());revision.put("order_fields",after.orderFields());
            revision.put("items",db.queryForList("SELECT descripcion,cantidad,precio_unit FROM keptai.orden_item WHERE orden_id=? ORDER BY id",order));
            var current=row(id);revision.put("payment_condition",current.get("condicion_pago"));revision.put("credit_term_days",current.get("plazo_dias"));revision.put("downpayment",current.get("anticipo_requerido"));
            db.update("UPDATE keptai.hoja_resumen SET extraccion=extraccion || jsonb_build_object('revision_humana',?::jsonb),resumen_md=? WHERE id=?",
                json.writeValueAsString(revision),"# Pedido revisado\nCliente: "+current.get("razon_social")+"\nMarca: "+current.get("marca")+"\nTotal PEN: "+current.get("total")+"\nCondición: "+current.get("condicion_pago"),id);
            audit(id,"BORRADOR_CORREGIDO",json.writeValueAsString(Map.of("expected_revision",req.expectedRevision(),"before",before,"after",after,"changes",req)));
            return after;
        });
    }
    public ConfirmDraftResponse confirm(UUID id,ConfirmDraftRequest req,String key) {
        if (key==null || !key.matches("[A-Za-z0-9._:-]{8,128}")) throw PanelException.badRequest("Falta Idempotency-Key válida");
        return panel.write(() -> { admin();var store=new IdempotencyStore(panel.jdbc());
            String hash=ApiKeyAuthenticationFilter.sha256(id+":"+req.expectedRevision()+":"+panel.identity().usuarioId());
            var reserved=store.reservar("BORRADOR_CONFIRMAR",key,hash);
            if (reserved.resultado()==IdempotencyStore.Resultado.CONFLICTO) throw new PanelException(org.springframework.http.HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","La clave se usó con otro contenido");
            if (reserved.resultado()==IdempotencyStore.Resultado.REPETIDA) return json.readValue(reserved.respuestaJson(),ConfirmDraftResponse.class);
            var h=lock(id);pending(h,req.expectedRevision());UUID order=(UUID)h.get("orden_id");
            BigDecimal total=(BigDecimal)h.get("total");
            BigDecimal sum=panel.jdbc().queryForObject("SELECT coalesce(sum(cantidad*precio_unit),0) FROM keptai.orden_item WHERE orden_id=?",BigDecimal.class,order);
            if (total==null || total.signum()<=0 || sum.compareTo(total)!=0 || h.get("marca_id")==null || h.get("condicion_pago")==null || h.get("razon_social")==null)
                throw PanelException.unprocessable("INCOMPLETE_DRAFT","Revise cliente, marca, condición de pago, ítems y total antes de confirmar");
            panel.jdbc().update("UPDATE keptai.orden SET estado='PENDIENTE_APROBACION',version=version+1,actualizado_en=now() WHERE id=?",order);
            panel.jdbc().update("UPDATE keptai.hoja_resumen SET estado='CONFIRMADA',revisado_por=?,revisado_en=now() WHERE id=?",panel.identity().usuarioId(),id);
            audit(id,"BORRADOR_CONFIRMADO","{\"expected_revision\":"+req.expectedRevision()+"}");
            var result=new ConfirmDraftResponse(draft(id),order,null,false,false);
            store.completar("BORRADOR_CONFIRMAR",key,json.writeValueAsString(result));
            return result;
        });
    }
    public ExtractionDraft discard(UUID id,DiscardDraftRequest req) {
        return panel.write(() -> { admin();var h=lock(id);
            if ("DESCARTADA".equals(h.get("estado"))) return draft(id);
            pending(h,((Number)h.get("version")).intValue());
            panel.jdbc().update("UPDATE keptai.hoja_resumen SET estado='DESCARTADA',revisado_por=?,revisado_en=now() WHERE id=?",panel.identity().usuarioId(),id);
            panel.jdbc().update("UPDATE keptai.orden SET estado='CANCELADA',version=version+1,actualizado_en=now() WHERE id=?",h.get("orden_id"));
            // Motivo libre no se almacena: podría contener historial de chat; registrar solo la decisión y autor.
            audit(id,"BORRADOR_DESCARTADO","{}");return draft(id);
        });
    }
    private void audit(UUID id,String operation,String changes) {
        panel.jdbc().update("INSERT INTO keptai.evento_auditoria(organizacion_id,usuario_id,actor,operacion,entidad,entidad_id,cambios,request_id) VALUES(keptai.app_organizacion_actual(),?,'USUARIO',?,'hoja_resumen',?,?::jsonb,?)",panel.identity().usuarioId(),operation,id,changes,MDC.get(RequestIdFilter.MDC_KEY));
    }
}
