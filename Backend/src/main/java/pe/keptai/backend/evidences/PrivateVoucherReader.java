package pe.keptai.backend.evidences;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import pe.keptai.backend.contract.EvidenceDtos.EvidenceDownloadLink;
import pe.keptai.backend.n8n.VoucherStorage;
import pe.keptai.backend.tenancy.TenantTransaction;
import pe.keptai.backend.web.BusinessException;
import pe.keptai.backend.web.RequestIdFilter;

/** MIG-04: autorizar en PostgreSQL antes de usar la clave privilegiada de Storage. */
@Service
public class PrivateVoucherReader {
    private final TenantTransaction tenant;
    private final ObjectProvider<JdbcTemplate> jdbc;
    private final VoucherStorage storage;
    public PrivateVoucherReader(TenantTransaction tenant, ObjectProvider<JdbcTemplate> jdbc, VoucherStorage storage) {
        this.tenant = tenant; this.jdbc = jdbc; this.storage = storage;
    }
    public EvidenceDownloadLink link(UUID id) {
        JdbcTemplate db = jdbc.getIfAvailable();
        if (db == null) throw unavailable();
        return tenant.execute(() -> {
            // La cartera de VENDEDOR no está definida: no conceder lectura general por pertenencia a la empresa.
            if (!"ADMIN".equals(db.queryForObject("SELECT keptai_private.actor_actual()", String.class)))
                throw new BusinessException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Acceso denegado");
            var paths = db.queryForList("SELECT archivo_storage_path FROM keptai.comprobante WHERE id=? AND organizacion_id=keptai.app_organizacion_actual()", String.class, id);
            if (paths.isEmpty()) throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Evidencia no encontrada");
            String path = paths.getFirst();
            String org = db.queryForObject("SELECT keptai.app_organizacion_actual()::text", String.class);
            if (path == null || !path.startsWith(org + "/vouchers/")) throw unavailable();
            OffsetDateTime expires = OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(60);
            String url;
            try { url = storage.signedUrl(path, 60); }
            catch (VoucherStorage.StorageException e) { throw unavailable(); }
            db.update("""
                INSERT INTO keptai.evento_auditoria(organizacion_id,usuario_id,actor,operacion,entidad,entidad_id,cambios,request_id)
                VALUES(keptai.app_organizacion_actual(),keptai_private.usuario_actual(),'USUARIO','VOUCHER_ENLACE_EMITIDO','comprobante',?,
                jsonb_build_object('vigencia_segundos',60),?)
                """, id, MDC.get(RequestIdFilter.MDC_KEY));
            return new EvidenceDownloadLink(url, expires);
        });
    }
    private static BusinessException unavailable() { return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STORAGE_UNAVAILABLE","Lectura privada no disponible"); }
}
