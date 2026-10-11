-- AND-COBRANZA-001 (Andres, 2026-10-11): el despacho fija el vencimiento (D-005) y el Scheduler mantiene la mora.
-- Mantener V1-V7 intactas. Sin tablas ni columnas nuevas.
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V8'; END IF;
END $$;

-- Estado persistido de la obligacion coherente con el saldo calculado y la fecha local de la organizacion.
-- Interna (sin EXECUTE runtime): la usan el trigger de despacho y el wrapper autorizado de abajo.
CREATE FUNCTION keptai_private.recalcular_obligaciones(p_org uuid, p_orden uuid) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH calculo AS (
  SELECT o.id,
         CASE WHEN s.saldo = 0 THEN 'PAGADA'
              WHEN o.vence_en IS NOT NULL AND o.vence_en < timezone(org.zona_horaria, now())::date THEN 'MORA'
              WHEN s.cobrado > 0 THEN 'PARCIAL'
              ELSE 'PENDIENTE' END AS nuevo
    FROM keptai.obligacion_cobro o
    JOIN keptai.v_saldo_obligacion s ON s.organizacion_id = o.organizacion_id AND s.obligacion_id = o.id
    JOIN keptai.organizacion org ON org.id = o.organizacion_id
   WHERE o.organizacion_id = p_org AND (p_orden IS NULL OR o.orden_id = p_orden) AND o.estado <> 'ANULADA'
 ), cambio AS (
  UPDATE keptai.obligacion_cobro o SET estado = c.nuevo, actualizado_en = now(), version = o.version + 1
    FROM calculo c WHERE o.id = c.id AND o.estado IS DISTINCT FROM c.nuevo
  RETURNING 1
 ) SELECT count(*)::integer FROM cambio
$$;
REVOKE EXECUTE ON FUNCTION keptai_private.recalcular_obligaciones(uuid, uuid) FROM PUBLIC;

-- Wrapper para el job de cobranza: solo ADMIN o SCHEDULER, solo la organizacion del contexto.
CREATE FUNCTION keptai_private.actualizar_estados_cobranza() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a text := keptai_private.actor_actual(); o uuid := keptai.app_organizacion_actual();
BEGIN
 IF o IS NULL OR a IS NULL OR a NOT IN ('ADMIN','SCHEDULER') THEN
  RAISE EXCEPTION 'Recalculo de cobranza no autorizado' USING ERRCODE='42501';
 END IF;
 RETURN keptai_private.recalcular_obligaciones(o, NULL);
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.actualizar_estados_cobranza() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION keptai_private.actualizar_estados_cobranza() TO keptai_runtime;

-- Despacho: orden liberada/en produccion -> DESPACHADA; vence_en = fecha_despacho + plazo de la obligacion.
-- DEFINER porque JEFE_TALLER registra el despacho pero no puede escribir orden ni obligacion (V7).
-- El gate fn_validar_liberacion sigue aplicando al pasar la orden a DESPACHADA.
CREATE FUNCTION keptai_private.aplicar_despacho() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o keptai.orden%ROWTYPE;
BEGIN
 SELECT * INTO o FROM keptai.orden WHERE organizacion_id = NEW.organizacion_id AND id = NEW.orden_id FOR UPDATE;
 IF o.estado NOT IN ('LIBERADA','EN_PRODUCCION') THEN
  RAISE EXCEPTION 'Solo se despacha una orden liberada o en produccion (estado %)', o.estado USING ERRCODE='23514';
 END IF;
 IF o.fecha_inicio_produccion IS NOT NULL AND NEW.fecha_despacho < o.fecha_inicio_produccion THEN
  RAISE EXCEPTION 'La fecha de despacho es anterior al inicio de produccion' USING ERRCODE='23514';
 END IF;
 UPDATE keptai.orden SET estado = 'DESPACHADA', actualizado_en = now(), version = version + 1
  WHERE organizacion_id = NEW.organizacion_id AND id = NEW.orden_id;
 UPDATE keptai.obligacion_cobro SET vence_en = NEW.fecha_despacho + plazo_dias, actualizado_en = now(), version = version + 1
  WHERE organizacion_id = NEW.organizacion_id AND orden_id = NEW.orden_id AND estado <> 'ANULADA';
 PERFORM keptai_private.recalcular_obligaciones(NEW.organizacion_id, NEW.orden_id);
 RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.aplicar_despacho() FROM PUBLIC;
CREATE TRIGGER tg_despacho_vencimiento AFTER INSERT ON despacho FOR EACH ROW EXECUTE FUNCTION keptai_private.aplicar_despacho();

-- El acta es inmutable en lo que fija el plazo: cambiar fecha u orden desincronizaria el vencimiento.
CREATE FUNCTION keptai_private.proteger_despacho() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(NEW.organizacion_id, NEW.orden_id, NEW.fecha_despacho) IS DISTINCT FROM ROW(OLD.organizacion_id, OLD.orden_id, OLD.fecha_despacho) THEN
  RAISE EXCEPTION 'El despacho registrado no cambia de orden ni de fecha; corregir con un flujo explicito' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.proteger_despacho() FROM PUBLIC;
CREATE TRIGGER tg_despacho_proteger BEFORE UPDATE ON despacho FOR EACH ROW EXECUTE FUNCTION keptai_private.proteger_despacho();
