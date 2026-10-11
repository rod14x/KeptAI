-- DB-REV-003 (Andres, 2026-10-10): correcciones criticas de autorizacion sobre V6.
-- Mantener V1-V6 intactas. Cada rol solo hace lo que le asigna D-005/actores; la IA propone.
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V7'; END IF;
END $$;

-- Usuario de la transaccion; solo es valido junto con actor_actual() no nulo (usuario activo).
CREATE FUNCTION keptai_private.usuario_actual() RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
BEGIN RETURN nullif(current_setting('app.usuario_id',true),'')::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.usuario_actual() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION keptai_private.usuario_actual() TO keptai_runtime;

-- S1. Credito: decide el vendedor (D-005). Ni n8n ni administracion fabrican aprobaciones.
DROP POLICY p_insercion ON aprobacion_credito;
DROP POLICY p_actualizacion ON aprobacion_credito;
CREATE POLICY p_insercion ON aprobacion_credito FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='VENDEDOR');
CREATE POLICY p_actualizacion ON aprobacion_credito FOR UPDATE TO keptai_runtime
 USING (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='VENDEDOR')
 WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='VENDEDOR');

-- S2. Autoria: *_por siempre es el usuario autenticado; servicios no firman como personas.
-- Sin actor (migrador/semilla) no aplica: el runtime sin contexto ya queda bloqueado por RLS.
CREATE FUNCTION keptai_private.validar_autoria() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE c text; nuevo text; previo text; u text;
BEGIN
 IF keptai_private.actor_actual() IS NULL THEN RETURN NEW; END IF;
 u:=keptai_private.usuario_actual()::text;
 FOREACH c IN ARRAY TG_ARGV LOOP
  nuevo:=to_jsonb(NEW)->>c;
  previo:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD)->>c END;
  IF nuevo IS NOT NULL AND nuevo IS DISTINCT FROM previo AND nuevo IS DISTINCT FROM u THEN
   RAISE EXCEPTION 'La autoria % debe ser el usuario autenticado', c USING ERRCODE='42501';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.validar_autoria() FROM PUBLIC;
CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON aprobacion_credito FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('aprobado_por');
CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON pago FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('verificado_por');
CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON aplicacion_pago FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('aplicado_por','anulada_por');
CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON hoja_resumen FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('revisado_por');
CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON despacho FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('registrado_por');
CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON costo_orden FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('registrado_por');
-- Actor de auditoria coherente con la identidad (AuditDtos: USUARIO exige usuario; el resto no lo lleva).
CREATE POLICY p_auditoria_actor ON evento_auditoria AS RESTRICTIVE FOR INSERT TO keptai_runtime WITH CHECK (
 CASE (SELECT keptai_private.actor_actual())
  WHEN 'INGESTA' THEN actor='N8N' AND usuario_id IS NULL
  WHEN 'SCHEDULER' THEN actor='SCHEDULER' AND usuario_id IS NULL
  ELSE (actor='USUARIO' AND usuario_id=(SELECT keptai_private.usuario_actual())) OR (actor='SISTEMA' AND usuario_id IS NULL)
 END);

-- S3. Padres financieros: con aplicaciones vigentes se anula primero; nunca desaparece saldo.
-- DEFINER para comprobar todas las aplicaciones aunque el actor no pueda leerlas por RLS.
-- Sin STABLE: cada consulta toma snapshot nuevo tras esperar el lock de la fila padre.
CREATE FUNCTION keptai_private.proteger_pago() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF (ROW(NEW.organizacion_id,NEW.monto,NEW.moneda,NEW.cliente_id) IS DISTINCT FROM ROW(OLD.organizacion_id,OLD.monto,OLD.moneda,OLD.cliente_id)
     OR (NEW.fase='RECIBIDO' AND OLD.fase<>'RECIBIDO')
     OR (NEW.estado_conciliacion='DUPLICADO' AND OLD.estado_conciliacion<>'DUPLICADO'))
    AND EXISTS (SELECT 1 FROM keptai.aplicacion_pago a WHERE a.organizacion_id=OLD.organizacion_id AND a.pago_id=OLD.id AND a.anulada_en IS NULL) THEN
  RAISE EXCEPTION 'Pago con aplicaciones vigentes: anularlas antes de modificar importe, cliente, moneda, fase o duplicado' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION keptai_private.proteger_obligacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF (ROW(NEW.organizacion_id,NEW.orden_id,NEW.monto,NEW.moneda) IS DISTINCT FROM ROW(OLD.organizacion_id,OLD.orden_id,OLD.monto,OLD.moneda)
     OR (NEW.estado='ANULADA' AND OLD.estado<>'ANULADA'))
    AND EXISTS (SELECT 1 FROM keptai.aplicacion_pago a WHERE a.organizacion_id=OLD.organizacion_id AND a.obligacion_id=OLD.id AND a.anulada_en IS NULL) THEN
  RAISE EXCEPTION 'Obligacion con aplicaciones vigentes: anularlas antes de modificarla o anularla' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
-- Cierre de costeo: lo certifica administracion o produccion; desmarcar (invalidar_costeo) sigue libre.
CREATE FUNCTION keptai_private.proteger_orden() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a text;
BEGIN
 IF ROW(NEW.organizacion_id,NEW.total,NEW.cliente_id,NEW.condicion_pago,NEW.moneda) IS DISTINCT FROM ROW(OLD.organizacion_id,OLD.total,OLD.cliente_id,OLD.condicion_pago,OLD.moneda)
    AND EXISTS (SELECT 1 FROM keptai.aplicacion_pago ap JOIN keptai.obligacion_cobro o ON o.organizacion_id=ap.organizacion_id AND o.id=ap.obligacion_id
                WHERE o.organizacion_id=OLD.organizacion_id AND o.orden_id=OLD.id AND ap.anulada_en IS NULL) THEN
  RAISE EXCEPTION 'Orden con pagos aplicados: anular aplicaciones antes de cambiar total, cliente, condicion o moneda' USING ERRCODE='23514';
 END IF;
 IF (NEW.costos_reales_completos AND NOT OLD.costos_reales_completos) OR (NEW.costos_teoricos_completos AND NOT OLD.costos_teoricos_completos) THEN
  a:=keptai_private.actor_actual();
  IF a IS NOT NULL AND a NOT IN ('ADMIN','JEFE_TALLER') THEN
   RAISE EXCEPTION 'Solo administracion o produccion certifican el cierre de costos' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.proteger_pago(),keptai_private.proteger_obligacion(),keptai_private.proteger_orden() FROM PUBLIC;
CREATE TRIGGER tg_pago_proteger BEFORE UPDATE ON pago FOR EACH ROW EXECUTE FUNCTION keptai_private.proteger_pago();
CREATE TRIGGER tg_obligacion_proteger BEFORE UPDATE ON obligacion_cobro FOR EACH ROW EXECUTE FUNCTION keptai_private.proteger_obligacion();
CREATE TRIGGER tg_orden_proteger BEFORE UPDATE ON orden FOR EACH ROW EXECUTE FUNCTION keptai_private.proteger_orden();

-- INGESTA no reabre ni edita pedidos confirmados: V4 solo limitaba el estado resultante.
CREATE POLICY p_ingesta_orden_actualizacion ON orden AS RESTRICTIVE FOR UPDATE TO keptai_runtime
 USING ((SELECT keptai_private.actor_actual()) <> 'INGESTA' OR estado='BORRADOR');
DO $$ DECLARE t text; borrador text; BEGIN
 FOREACH t IN ARRAY ARRAY['orden_item','hoja_resumen'] LOOP
  borrador:=format('(SELECT keptai_private.actor_actual()) <> ''INGESTA'' OR EXISTS (SELECT 1 FROM keptai.orden o WHERE o.organizacion_id=%1$I.organizacion_id AND o.id=%1$I.orden_id AND o.estado=''BORRADOR'')',t);
  EXECUTE format('CREATE POLICY p_ingesta_borrador_insercion ON keptai.%I AS RESTRICTIVE FOR INSERT TO keptai_runtime WITH CHECK (%s)',t,borrador);
  EXECUTE format('CREATE POLICY p_ingesta_borrador_actualizacion ON keptai.%I AS RESTRICTIVE FOR UPDATE TO keptai_runtime USING (%s) WITH CHECK (%s)',t,borrador,borrador);
 END LOOP;
END $$;

-- S4. Minimo privilegio en lecturas.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM (VALUES
  ('aprobacion_credito', ARRAY['VENDEDOR','ADMIN','GERENTE','SCHEDULER']),
  ('aplicacion_pago',    ARRAY['VENDEDOR','ADMIN','GERENTE','SCHEDULER']),
  ('obligacion_cobro',   ARRAY['VENDEDOR','ADMIN','GERENTE','SCHEDULER']),
  ('apertura_caja',      ARRAY['ADMIN','GERENTE','SCHEDULER']),
  ('egreso_caja',        ARRAY['ADMIN','GERENTE','SCHEDULER']),
  ('hoja_resumen',       ARRAY['VENDEDOR','ADMIN','GERENTE','INGESTA','SCHEDULER']),
  ('cliente',            ARRAY['VENDEDOR','ADMIN','GERENTE','INGESTA','SCHEDULER']),
  ('canal_whatsapp',     ARRAY['VENDEDOR','ADMIN','GERENTE','INGESTA','SCHEDULER']),
  ('envio_notificacion', ARRAY['VENDEDOR','ADMIN','GERENTE','INGESTA','SCHEDULER'])
 ) v(tabla, actores) LOOP
  EXECUTE format('DROP POLICY p_lectura ON keptai.%I',r.tabla);
  EXECUTE format('CREATE POLICY p_lectura ON keptai.%I FOR SELECT TO keptai_runtime USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (%L::text[]))',r.tabla,r.actores);
 END LOOP;
END $$;
-- Produccion recibe solo ordenes liberadas (actores l.19) y auditoria de su ambito (entidad = nombre de tabla).
DROP POLICY p_lectura ON orden;
CREATE POLICY p_lectura ON orden FOR SELECT TO keptai_runtime USING (organizacion_id=keptai.app_organizacion_actual() AND (
 (SELECT keptai_private.actor_actual()) = ANY (ARRAY['VENDEDOR','ADMIN','GERENTE','INGESTA','SCHEDULER'])
 OR ((SELECT keptai_private.actor_actual())='JEFE_TALLER' AND estado IN ('LIBERADA','EN_PRODUCCION','DESPACHADA','CERRADA'))));
DROP POLICY p_lectura ON evento_auditoria;
CREATE POLICY p_lectura ON evento_auditoria FOR SELECT TO keptai_runtime USING (organizacion_id=keptai.app_organizacion_actual() AND (
 (SELECT keptai_private.actor_actual()) = ANY (ARRAY['VENDEDOR','ADMIN','GERENTE','INGESTA','SCHEDULER'])
 OR ((SELECT keptai_private.actor_actual())='JEFE_TALLER' AND entidad IN ('orden','orden_etapa','costo_orden','despacho'))));
-- Margen: comercial y gerencia. Mismas columnas que V5; produccion veia cobrado=0 engañoso.
CREATE OR REPLACE VIEW v_margen_orden WITH(security_invoker=true) AS
 SELECT ord.organizacion_id,ord.id AS orden_id,ord.ref,ord.marca_id,ord.total AS venta,
 CASE WHEN ord.costos_teoricos_completos THEN coalesce(c.teorico,0) END AS costo_teorico,
 CASE WHEN ord.costos_reales_completos THEN coalesce(c.real,0) END AS costo_real,
 coalesce(s.cobrado,0) AS cobrado,
 CASE WHEN ord.costos_teoricos_completos THEN ord.total-coalesce(c.teorico,0) END AS margen_teorico,
 CASE WHEN ord.costos_reales_completos THEN coalesce(s.cobrado,0)-coalesce(c.real,0) END AS margen_real_cobrado,
 CASE WHEN ord.costos_reales_completos THEN ord.total-coalesce(c.real,0) END AS margen_venta_real,
 ord.costos_reales_completos, ord.costos_teoricos_completos
 FROM orden ord LEFT JOIN (SELECT organizacion_id,orden_id,sum(monto) FILTER(WHERE origen='TEORICO') AS teorico,sum(monto) FILTER(WHERE origen='REAL') AS real FROM costo_orden GROUP BY organizacion_id,orden_id) c
 ON c.organizacion_id=ord.organizacion_id AND c.orden_id=ord.id
 LEFT JOIN v_saldo_obligacion s ON s.organizacion_id=ord.organizacion_id AND s.orden_id=ord.id
 WHERE ord.estado<>'CANCELADA' AND (SELECT keptai_private.actor_actual()) IN ('VENDEDOR','ADMIN','GERENTE');
