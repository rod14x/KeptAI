-- MIG-04: metadatos reales del archivo y autor humano; histórico desconocido permanece NULL.
ALTER TABLE keptai.comprobante ADD COLUMN archivo_content_type text CHECK(archivo_content_type IN ('image/jpeg','image/png','application/pdf'));
ALTER TABLE keptai.comprobante ADD COLUMN archivo_size_bytes bigint CHECK(archivo_size_bytes BETWEEN 1 AND 10485760);
ALTER TABLE keptai.comprobante ADD COLUMN subido_por uuid;
ALTER TABLE keptai.comprobante ADD COLUMN etiqueta text CHECK(length(etiqueta)<=120);
ALTER TABLE keptai.comprobante ADD CONSTRAINT fk_comprobante_autor FOREIGN KEY(organizacion_id,subido_por) REFERENCES keptai.usuario(organizacion_id,id);
CREATE TRIGGER tg_autoria_voucher BEFORE INSERT OR UPDATE ON keptai.comprobante FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('subido_por');
