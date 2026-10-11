-- INT-FE-API-001 (11/10/2026): conexion del panel con Spring. Mantener V1-V9 intactas. Sin tablas ni columnas nuevas.
-- Brecha H1 (auditoria-backend-2026-10-11): el vendedor decide el credito (V7) pero obligacion_cobro solo la escribe
-- ADMIN (V4). Sin obligacion no hay despacho que fije vencimiento ni pago que aplicar. Esta funcion la crea cuando la
-- decision ya esta APROBADA, por el total de la orden, sin vencimiento hasta el acta (D-005). Pendiente de revision de Andres.
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V10'; END IF;
END $$;

-- DEFINER porque VENDEDOR no inserta obligacion_cobro por RLS. Solo VENDEDOR/ADMIN de la organizacion del contexto,
-- con credito APROBADO o con la orden confirmada al CONTADO (ck_decision_plazo exige plazo en toda aprobacion: el
-- contado no es credito; queda RETENIDA hasta cobrarse completa, gate V5). Una sola obligacion por orden; idempotente.
CREATE FUNCTION keptai_private.crear_obligacion_orden(p_orden uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a text := keptai_private.actor_actual(); org uuid := keptai.app_organizacion_actual();
        o keptai.orden%ROWTYPE; existente uuid; nueva uuid;
BEGIN
 IF org IS NULL OR a IS NULL OR a NOT IN ('VENDEDOR','ADMIN') THEN
  RAISE EXCEPTION 'Creacion de obligacion no autorizada' USING ERRCODE='42501';
 END IF;
 SELECT * INTO o FROM keptai.orden WHERE organizacion_id = org AND id = p_orden FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Orden inexistente en la organizacion' USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM keptai.aprobacion_credito
                 WHERE organizacion_id = org AND orden_id = p_orden AND decision = 'APROBADO')
    AND NOT (o.condicion_pago = 'CONTADO' AND o.estado = 'RETENIDA') THEN
  RAISE EXCEPTION 'La obligacion nace con el credito aprobado o la orden confirmada al contado' USING ERRCODE='23514';
 END IF;
 IF o.total IS NULL OR o.total <= 0 OR o.estado IN ('BORRADOR','CANCELADA') THEN
  RAISE EXCEPTION 'La orden no tiene un total confirmado' USING ERRCODE='23514';
 END IF;
 SELECT id INTO existente FROM keptai.obligacion_cobro WHERE organizacion_id = org AND orden_id = p_orden;
 IF existente IS NOT NULL THEN RETURN existente; END IF;
 INSERT INTO keptai.obligacion_cobro (organizacion_id, orden_id, monto, moneda, plazo_dias)
 VALUES (org, p_orden, o.total, o.moneda, coalesce(o.plazo_dias, 0)) RETURNING id INTO nueva;
 RETURN nueva;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.crear_obligacion_orden(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION keptai_private.crear_obligacion_orden(uuid) TO keptai_runtime;
