package pe.keptai.backend.evidences;
import java.util.*;
import java.time.OffsetDateTime;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import pe.keptai.backend.panel.*;
import pe.keptai.backend.contract.CommonDtos.PageResponse;
import pe.keptai.backend.contract.EvidenceDtos.Evidence;
import pe.keptai.backend.contract.ContractEnums.*;
import pe.keptai.backend.n8n.*;
import pe.keptai.backend.security.ApiKeyAuthenticationFilter;
import pe.keptai.backend.web.*;

@Service
public class EvidenceService {
 private final PanelContext panel;private final VoucherStorage storage;private final N8nProperties properties;
 private final tools.jackson.databind.json.JsonMapper json=pe.keptai.backend.contract.ContractJson.newMapper();
 public EvidenceService(PanelContext panel,VoucherStorage storage,N8nProperties properties) {this.panel=panel;this.storage=storage;this.properties=properties;}
 private void admin(){if(!"ADMIN".equals(panel.jdbc().queryForObject("SELECT keptai_private.actor_actual()",String.class)))throw PanelException.forbidden("Acceso denegado");}
 public Evidence get(UUID id){return panel.read(()->{admin();return inTx(id);});}
 public PageResponse<Evidence> list(PageRequest page){return panel.read(()->{admin();return page.page(panel.jdbc().query("SELECT id FROM keptai.comprobante WHERE organizacion_id=keptai.app_organizacion_actual() ORDER BY creado_en DESC,id LIMIT ? OFFSET ?",(rs,i)->inTx(rs.getObject(1,UUID.class)),page.fetch(),page.offset()));});}
 private Evidence inTx(UUID id) {
  var rows=panel.jdbc().query("""
    SELECT id,archivo_content_type,archivo_size_bytes,archivo_hash,etiqueta,subido_por,creado_en,instancia_origen FROM keptai.comprobante
    WHERE id=? AND organizacion_id=keptai.app_organizacion_actual()
    """,(rs,i)->new Evidence(rs.getObject("id",UUID.class),EvidenceKind.VOUCHER_IMAGE,EvidenceStatus.STORED,
     rs.getString("archivo_content_type"),rs.getObject("archivo_size_bytes",Long.class),rs.getString("archivo_hash").trim(),null,rs.getString("etiqueta"),
     rs.getString("instancia_origen")==null?DataOrigin.MANUAL_ENTRY:DataOrigin.AUTOMATED_EXTRACTION,
     rs.getObject("subido_por",UUID.class),rs.getObject("creado_en",OffsetDateTime.class)),id);
  if(rows.isEmpty())throw PanelException.notFound("Evidencia no encontrada");return rows.getFirst();
 }
 public Evidence upload(UUID paymentId,String label,byte[] bytes,String key) {
  if(key==null || !key.matches("[A-Za-z0-9._:-]{8,128}"))throw PanelException.badRequest("Falta Idempotency-Key válida");
  if(label!=null && label.length()>120)throw PanelException.badRequest("Etiqueta demasiado larga");
  VoucherFile file=VoucherFile.decode(Base64.getEncoder().encodeToString(bytes),properties.voucher().maxFileBytes());
  String[] created={null};boolean[] uploaded={false};
  try{return panel.write(()->{admin();var db=panel.jdbc();
   var store=new IdempotencyStore(db);String hash=ApiKeyAuthenticationFilter.sha256(panel.identity().usuarioId()+":"+paymentId+":"+label+":"+file.sha256());
   var reserved=store.reservar("VOUCHER_MANUAL",key,hash);
   if(reserved.resultado()==IdempotencyStore.Resultado.CONFLICTO)throw new PanelException(HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","La clave se usó con otro contenido o autor");
   if(reserved.resultado()==IdempotencyStore.Resultado.REPETIDA)return json.readValue(reserved.respuestaJson(),Evidence.class);
   var payments=db.queryForList("SELECT fase FROM keptai.pago WHERE id=? AND organizacion_id=keptai.app_organizacion_actual() FOR UPDATE",String.class,paymentId);
   if(payments.isEmpty())throw PanelException.notFound("Pago no encontrado");
   if(!payments.getFirst().equals("RECIBIDO"))throw PanelException.conflict("Solo se adjuntan vouchers a pagos recibidos sin verificar");
   UUID id=UUID.randomUUID();String path=panel.identity().organizacionId()+"/vouchers/"+id+"-"+file.sha256()+"."+file.extension();created[0]=path;
   try{uploaded[0]=true;storage.put(path,file.bytes(),file.contentType());}catch(VoucherStorage.StorageException e){throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STORAGE_UNAVAILABLE","Archivo privado no disponible");}
   db.update("INSERT INTO keptai.comprobante(id,organizacion_id,pago_id,archivo_storage_path,archivo_hash,archivo_content_type,archivo_size_bytes,subido_por,etiqueta) VALUES(?,keptai.app_organizacion_actual(),?,?,?,?,?,?,?)",id,paymentId,path,file.sha256(),file.contentType(),file.bytes().length,panel.identity().usuarioId(),label);
   db.update("INSERT INTO keptai.evento_auditoria(organizacion_id,usuario_id,actor,operacion,entidad,entidad_id,cambios,request_id) VALUES(keptai.app_organizacion_actual(),?,'USUARIO','VOUCHER_MANUAL_SUBIDO','comprobante',?,jsonb_build_object('size_bytes',?::bigint),?)",panel.identity().usuarioId(),id,file.bytes().length,MDC.get(RequestIdFilter.MDC_KEY));
   Evidence result=inTx(id);store.completar("VOUCHER_MANUAL",key,json.writeValueAsString(result));return result;
  });}catch(RuntimeException error){if(uploaded[0]){try{storage.delete(created[0]);}catch(RuntimeException ignored){org.slf4j.LoggerFactory.getLogger(EvidenceService.class).error("Compensación Storage pendiente (sin datos del objeto)");}}throw error;}
 }
}
