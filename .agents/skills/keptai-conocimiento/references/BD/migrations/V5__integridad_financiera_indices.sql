-- Integridad, correcciones append-only y consultas con tenant como primera clave.
ALTER TABLE pago ADD COLUMN duplicado_de_pago_id uuid;
ALTER TABLE pago ADD CONSTRAINT fk_pago_duplicado FOREIGN KEY(organizacion_id,duplicado_de_pago_id) REFERENCES pago(organizacion_id,id);
ALTER TABLE pago ADD CONSTRAINT ck_pago_duplicado CHECK ((estado_conciliacion='DUPLICADO')=(duplicado_de_pago_id IS NOT NULL) AND (estado_conciliacion<>'DUPLICADO' OR (fase='RECIBIDO' AND verificado_por IS NULL AND verificado_en IS NULL)) AND duplicado_de_pago_id IS DISTINCT FROM id);
ALTER TABLE aprobacion_credito ADD CONSTRAINT ck_decision_plazo CHECK (decision<>'APROBADO' OR (plazo_dias IS NOT NULL AND plazo_dias BETWEEN 15 AND 30));
ALTER TABLE aprobacion_credito ADD CONSTRAINT ck_aviso_mora CHECK (decision<>'APROBADO' OR saldo_referencia<=0 OR aviso_mora_mostrado);
ALTER TABLE alerta_cobranza ADD CONSTRAINT ck_alerta_cierre CHECK ((estado='ABIERTA')=(cerrada_en IS NULL));
ALTER TABLE aplicacion_pago ADD CONSTRAINT ck_anulacion_motivo CHECK (anulada_en IS NULL OR (motivo_anulacion IS NOT NULL AND length(btrim(motivo_anulacion))>0));
ALTER TABLE orden ADD COLUMN costos_reales_completos boolean NOT NULL DEFAULT false;
ALTER TABLE orden ADD COLUMN costos_teoricos_completos boolean NOT NULL DEFAULT false;
ALTER TABLE orden ADD CONSTRAINT uq_orden_moneda UNIQUE(organizacion_id,id,moneda);
ALTER TABLE costo_orden ADD CONSTRAINT fk_costo_moneda FOREIGN KEY(organizacion_id,orden_id,moneda) REFERENCES orden(organizacion_id,id,moneda);
ALTER TABLE obligacion_cobro ADD CONSTRAINT fk_obligacion_moneda FOREIGN KEY(organizacion_id,orden_id,moneda) REFERENCES orden(organizacion_id,id,moneda);
CREATE OR REPLACE FUNCTION fn_validar_aplicacion_pago() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,keptai AS $$
DECLARE p keptai.pago%ROWTYPE; o keptai.obligacion_cobro%ROWTYPE; cliente uuid; usado_pago numeric; usado_obl numeric;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.organizacion_id,NEW.pago_id,NEW.obligacion_id,NEW.monto_aplicado,NEW.aplicado_por,NEW.aplicado_en)
     IS DISTINCT FROM ROW(OLD.id,OLD.organizacion_id,OLD.pago_id,OLD.obligacion_id,OLD.monto_aplicado,OLD.aplicado_por,OLD.aplicado_en)
     OR OLD.anulada_en IS NOT NULL THEN RAISE EXCEPTION 'Aplicacion inmutable: anular y registrar nueva' USING ERRCODE='23514'; END IF;
  IF NEW.anulada_en IS NULL THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO p FROM keptai.pago WHERE organizacion_id=NEW.organizacion_id AND id=NEW.pago_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pago inexistente o no autorizado' USING ERRCODE='23514'; END IF;
 SELECT * INTO o FROM keptai.obligacion_cobro WHERE organizacion_id=NEW.organizacion_id AND id=NEW.obligacion_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Obligacion inexistente o no autorizada' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NEW.anulada_en IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.anulada_en IS NOT NULL THEN RAISE EXCEPTION 'No insertar aplicaciones ya anuladas' USING ERRCODE='23514'; END IF;
 SELECT cliente_id INTO cliente FROM keptai.orden WHERE organizacion_id=o.organizacion_id AND id=o.orden_id;
 IF p.fase NOT IN ('VERIFICADO_BANCO','APLICADO') OR p.estado_conciliacion='DUPLICADO' OR o.estado='ANULADA'
    OR p.cliente_id IS NULL OR p.cliente_id IS DISTINCT FROM cliente OR p.moneda<>o.moneda THEN
  RAISE EXCEPTION 'Pago no aplicable: verificar fondos, cliente, moneda y estado' USING ERRCODE='23514';
 END IF;
 SELECT coalesce(sum(monto_aplicado),0) INTO usado_pago FROM keptai.aplicacion_pago WHERE organizacion_id=NEW.organizacion_id AND pago_id=NEW.pago_id AND anulada_en IS NULL;
 SELECT coalesce(sum(monto_aplicado),0) INTO usado_obl FROM keptai.aplicacion_pago WHERE organizacion_id=NEW.organizacion_id AND obligacion_id=NEW.obligacion_id AND anulada_en IS NULL;
 IF usado_pago+NEW.monto_aplicado>p.monto OR usado_obl+NEW.monto_aplicado>o.monto THEN RAISE EXCEPTION 'Sobreaplicacion' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER tg_aplicacion_pago_validar ON aplicacion_pago;
CREATE TRIGGER tg_aplicacion_pago_validar BEFORE INSERT OR UPDATE ON aplicacion_pago FOR EACH ROW EXECUTE FUNCTION fn_validar_aplicacion_pago();
-- Falta de costos no equivale a costo cero. Mantiene columnas originales para lectores.
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
 LEFT JOIN v_saldo_obligacion s ON s.organizacion_id=ord.organizacion_id AND s.orden_id=ord.id WHERE ord.estado<>'CANCELADA';
CREATE INDEX ix_orden_reciente ON orden(organizacion_id,creado_en DESC,id DESC);
CREATE INDEX ix_pago_reciente ON pago(organizacion_id,creado_en DESC,id DESC);
CREATE INDEX ix_obligacion_pendiente_fecha ON obligacion_cobro(organizacion_id,vence_en,id) WHERE estado NOT IN ('PAGADA','ANULADA') AND vence_en IS NOT NULL;
CREATE INDEX ix_envio_pendiente_tenant ON envio_notificacion(organizacion_id,programado_para,id) WHERE estado='PENDIENTE';
DROP INDEX ix_mensaje_saliente_cola;
CREATE INDEX ix_comprobante_pago ON comprobante(organizacion_id,pago_id);
CREATE UNIQUE INDEX ux_comprobante_evento ON comprobante(organizacion_id,instancia_origen,provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX ix_contacto_cliente ON contacto(organizacion_id,cliente_id);
CREATE INDEX ix_orden_vendedor ON orden(organizacion_id,vendedor_id);
CREATE INDEX ix_orden_marca ON orden(organizacion_id,marca_id);
CREATE INDEX ix_orden_canal ON orden(organizacion_id,canal_id);
CREATE INDEX ix_pago_cliente ON pago(organizacion_id,cliente_id);
CREATE INDEX ix_hoja_canal ON hoja_resumen(organizacion_id,canal_id);
CREATE INDEX ix_alerta_obligacion_abierta ON alerta_cobranza(organizacion_id,obligacion_id) WHERE estado='ABIERTA';
CREATE INDEX ix_alerta_pago_abierta ON alerta_cobranza(organizacion_id,pago_id) WHERE estado='ABIERTA';
-- funciones invoker, ningun EXECUTE PUBLIC; usa permisos del runtime.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA keptai FROM PUBLIC;

-- Un nuevo costo invalida el cierre previo; no queda un margen certificado obsoleto.
CREATE FUNCTION keptai_private.invalidar_costeo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o uuid; g uuid; origen_costo text;
BEGIN
 IF TG_OP='DELETE' THEN o:=OLD.orden_id;g:=OLD.organizacion_id;origen_costo:=OLD.origen;
 ELSE o:=NEW.orden_id;g:=NEW.organizacion_id;origen_costo:=NEW.origen; END IF;
 UPDATE keptai.orden SET costos_reales_completos=CASE WHEN origen_costo='REAL' THEN false ELSE costos_reales_completos END,
 costos_teoricos_completos=CASE WHEN origen_costo='TEORICO' THEN false ELSE costos_teoricos_completos END WHERE id=o AND organizacion_id=g;
 IF TG_OP='UPDATE' AND ROW(OLD.orden_id,OLD.organizacion_id,OLD.origen) IS DISTINCT FROM ROW(NEW.orden_id,NEW.organizacion_id,NEW.origen) THEN
  UPDATE keptai.orden SET costos_reales_completos=CASE WHEN OLD.origen='REAL' THEN false ELSE costos_reales_completos END,
  costos_teoricos_completos=CASE WHEN OLD.origen='TEORICO' THEN false ELSE costos_teoricos_completos END WHERE id=OLD.orden_id AND organizacion_id=OLD.organizacion_id;
 END IF;
 RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.invalidar_costeo() FROM PUBLIC;
CREATE TRIGGER tg_invalidar_costeo AFTER INSERT OR UPDATE OR DELETE ON costo_orden FOR EACH ROW EXECUTE FUNCTION keptai_private.invalidar_costeo();

-- Gate de produccion: nunca basta OCR ni una promesa en chat.
CREATE FUNCTION fn_validar_liberacion() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,keptai AS $$
DECLARE credito boolean; cobrado numeric;
BEGIN
 IF NEW.estado NOT IN ('LIBERADA','EN_PRODUCCION','DESPACHADA','CERRADA') THEN RETURN NEW; END IF;
 SELECT EXISTS(SELECT 1 FROM keptai.aprobacion_credito WHERE organizacion_id=NEW.organizacion_id AND orden_id=NEW.id AND decision='APROBADO') INTO credito;
 IF NEW.condicion_pago='CREDITO' AND credito THEN RETURN NEW; END IF;
 SELECT coalesce(sum(a.monto_aplicado),0) INTO cobrado FROM keptai.aplicacion_pago a JOIN keptai.obligacion_cobro o ON o.organizacion_id=a.organizacion_id AND o.id=a.obligacion_id
 JOIN keptai.pago p ON p.organizacion_id=a.organizacion_id AND p.id=a.pago_id
 WHERE o.organizacion_id=NEW.organizacion_id AND o.orden_id=NEW.id AND a.anulada_en IS NULL AND p.fase IN ('VERIFICADO_BANCO','APLICADO') AND p.estado_conciliacion<>'DUPLICADO';
 IF (NEW.condicion_pago='CONTADO' AND cobrado>=NEW.total)
 OR (NEW.condicion_pago='ANTICIPO' AND NEW.anticipo_requerido>0 AND cobrado>=NEW.anticipo_requerido) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Produccion requiere credito aprobado o anticipo/contado verificado y conciliado' USING ERRCODE='23514';
END $$;
CREATE TRIGGER tg_orden_liberacion BEFORE INSERT OR UPDATE OF estado,condicion_pago,anticipo_requerido,total ON orden FOR EACH ROW EXECUTE FUNCTION fn_validar_liberacion();
REVOKE EXECUTE ON FUNCTION fn_validar_liberacion() FROM PUBLIC;

-- Fecha de mora por zona de negocio del tenant, no zona UTC de la sesion JDBC.
CREATE OR REPLACE VIEW v_cliente_mora WITH(security_invoker=true) AS
 SELECT ord.organizacion_id,ord.cliente_id,sum(s.saldo) AS saldo_vencido,min(s.vence_en) AS vencimiento_mas_antiguo
 FROM v_saldo_obligacion s JOIN orden ord ON ord.organizacion_id=s.organizacion_id AND ord.id=s.orden_id
 JOIN organizacion org ON org.id=ord.organizacion_id
 WHERE s.saldo>0 AND s.vence_en<timezone(org.zona_horaria,current_timestamp)::date
 GROUP BY ord.organizacion_id,ord.cliente_id;
