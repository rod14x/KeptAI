-- MIG-06: descartar un borrador incompleto sin inventar total ni condición de pago.
ALTER TABLE keptai.orden DROP CONSTRAINT ck_orden_confirmable;
ALTER TABLE keptai.orden ADD CONSTRAINT ck_orden_confirmable CHECK (
 estado IN ('BORRADOR','CANCELADA') OR (cliente_id IS NOT NULL AND total > 0 AND condicion_pago IS NOT NULL));
-- La sustitución de ítems es exclusiva de ADMIN y solo en BORRADOR.
GRANT DELETE ON keptai.orden_item TO keptai_runtime;
CREATE POLICY p_admin_descartar_item ON keptai.orden_item FOR DELETE TO keptai_runtime USING (
 organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN'
 AND EXISTS (SELECT 1 FROM keptai.orden o WHERE o.organizacion_id=orden_item.organizacion_id
 AND o.id=orden_item.orden_id AND o.estado='BORRADOR'));
