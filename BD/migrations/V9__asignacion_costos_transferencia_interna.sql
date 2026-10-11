-- AND-RESULTADOS-001 (Andres, 2026-10-11): C-05 margen por linea y C-06 taller como centro de resultados (DB-DEF-001 §9).
-- Mantener V1-V8 intactas.
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V9'; END IF;
END $$;

-- Reparto de un costo de la orden entre sus items (margen por linea sin replicar el costo total en cada linea).
CREATE TABLE asignacion_costo_item (
 id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id uuid          NOT NULL REFERENCES organizacion (id),
 costo_id        uuid          NOT NULL,
 orden_item_id   uuid          NOT NULL,
 monto           numeric(18,2) NOT NULL CHECK (monto >= 0),
 moneda          char(3)       NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
 metodo          text          NOT NULL CHECK (metodo IN ('MANUAL', 'UNIDADES', 'VALOR_VENTA')),
 fuente          text          NOT NULL,
 registrado_por  uuid,
 creado_en       timestamptz   NOT NULL DEFAULT now(),
 UNIQUE (organizacion_id, id),
 UNIQUE (organizacion_id, costo_id, orden_item_id),
 FOREIGN KEY (organizacion_id, costo_id)       REFERENCES costo_orden (organizacion_id, id),
 FOREIGN KEY (organizacion_id, orden_item_id)  REFERENCES orden_item (organizacion_id, id),
 FOREIGN KEY (organizacion_id, registrado_por) REFERENCES usuario (organizacion_id, id)
);
CREATE INDEX ix_asignacion_item ON asignacion_costo_item (organizacion_id, orden_item_id);

-- Cargo interno del taller propio a la operacion comercial de la orden. No es pago, factura ni ingreso de caja.
CREATE TABLE transferencia_interna (
 id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id  uuid          NOT NULL REFERENCES organizacion (id),
 orden_id         uuid          NOT NULL,
 unidad_origen_id uuid          NOT NULL,
 monto            numeric(18,2) NOT NULL CHECK (monto >= 0),
 moneda           char(3)       NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
 criterio         text          NOT NULL CHECK (length(btrim(criterio)) > 0),
 fuente           text          NOT NULL,
 registrado_por   uuid          NOT NULL,
 creado_en        timestamptz   NOT NULL DEFAULT now(),
 anulada_en       timestamptz,
 anulada_por      uuid,
 motivo_anulacion text,
 UNIQUE (organizacion_id, id),
 CHECK ((anulada_en IS NULL) = (anulada_por IS NULL)),
 CHECK (anulada_en IS NULL OR length(btrim(coalesce(motivo_anulacion, ''))) > 0),
 FOREIGN KEY (organizacion_id, orden_id, moneda)  REFERENCES orden (organizacion_id, id, moneda),
 FOREIGN KEY (organizacion_id, unidad_origen_id)  REFERENCES unidad_produccion (organizacion_id, id),
 FOREIGN KEY (organizacion_id, registrado_por)    REFERENCES usuario (organizacion_id, id),
 FOREIGN KEY (organizacion_id, anulada_por)       REFERENCES usuario (organizacion_id, id)
);
CREATE UNIQUE INDEX ux_transferencia_activa ON transferencia_interna (organizacion_id, orden_id, unidad_origen_id) WHERE anulada_en IS NULL;
CREATE INDEX ix_transferencia_unidad ON transferencia_interna (organizacion_id, unidad_origen_id) WHERE anulada_en IS NULL;

-- Asignacion: costo e item de la misma orden y moneda; la suma nunca supera el costo (bloquea el costo).
CREATE FUNCTION keptai_private.validar_asignacion_costo() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE c keptai.costo_orden%ROWTYPE; v_orden_item uuid; usado numeric;
BEGIN
 SELECT * INTO c FROM keptai.costo_orden WHERE organizacion_id = NEW.organizacion_id AND id = NEW.costo_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Costo inexistente o no autorizado' USING ERRCODE='23514'; END IF;
 SELECT orden_id INTO v_orden_item FROM keptai.orden_item WHERE organizacion_id = NEW.organizacion_id AND id = NEW.orden_item_id;
 IF v_orden_item IS DISTINCT FROM c.orden_id THEN
  RAISE EXCEPTION 'El item y el costo deben pertenecer a la misma orden' USING ERRCODE='23514';
 END IF;
 IF NEW.moneda <> c.moneda THEN RAISE EXCEPTION 'La asignacion debe usar la moneda del costo' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(monto), 0) INTO usado FROM keptai.asignacion_costo_item
  WHERE organizacion_id = NEW.organizacion_id AND costo_id = NEW.costo_id AND id <> NEW.id;
 IF usado + NEW.monto > c.monto THEN
  RAISE EXCEPTION 'La asignacion supera el costo (% asignado de %)', usado + NEW.monto, c.monto USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.validar_asignacion_costo() FROM PUBLIC;
CREATE TRIGGER tg_asignacion_validar BEFORE INSERT OR UPDATE ON asignacion_costo_item FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_asignacion_costo();

-- Un costo no baja de lo ya asignado ni cambia de orden/moneda con asignaciones.
CREATE FUNCTION keptai_private.proteger_costo_asignado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE asignado numeric;
BEGIN
 SELECT coalesce(sum(monto), 0) INTO asignado FROM keptai.asignacion_costo_item
  WHERE organizacion_id = OLD.organizacion_id AND costo_id = OLD.id;
 IF asignado > 0 AND (NEW.monto < asignado OR ROW(NEW.organizacion_id, NEW.orden_id, NEW.moneda) IS DISTINCT FROM ROW(OLD.organizacion_id, OLD.orden_id, OLD.moneda)) THEN
  RAISE EXCEPTION 'El costo tiene % asignado a items: reasignar antes de reducirlo o moverlo', asignado USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.proteger_costo_asignado() FROM PUBLIC;
CREATE TRIGGER tg_costo_asignado_proteger BEFORE UPDATE ON costo_orden FOR EACH ROW EXECUTE FUNCTION keptai_private.proteger_costo_asignado();

-- Cambiar asignaciones o transferencias invalida el cierre del costeo de la orden (no queda un resultado certificado obsoleto).
CREATE FUNCTION keptai_private.invalidar_costeo_resultado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record; v_orden uuid;
BEGIN
 IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
 IF TG_TABLE_NAME = 'asignacion_costo_item' THEN
  SELECT c.orden_id INTO v_orden FROM keptai.costo_orden c WHERE c.organizacion_id = r.organizacion_id AND c.id = r.costo_id;
 ELSE
  v_orden := r.orden_id;
 END IF;
 UPDATE keptai.orden SET costos_reales_completos = false
  WHERE organizacion_id = r.organizacion_id AND id = v_orden AND costos_reales_completos;
 RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.invalidar_costeo_resultado() FROM PUBLIC;
CREATE TRIGGER tg_asignacion_invalidar AFTER INSERT OR UPDATE OR DELETE ON asignacion_costo_item FOR EACH ROW EXECUTE FUNCTION keptai_private.invalidar_costeo_resultado();
CREATE TRIGGER tg_transferencia_invalidar AFTER INSERT OR UPDATE ON transferencia_interna FOR EACH ROW EXECUTE FUNCTION keptai_private.invalidar_costeo_resultado();

-- Transferencia: origen siempre taller interno; inmutable salvo una anulacion con motivo.
CREATE FUNCTION keptai_private.validar_transferencia() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE v_tipo text;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF OLD.anulada_en IS NOT NULL OR NEW.anulada_en IS NULL
     OR ROW(NEW.id, NEW.organizacion_id, NEW.orden_id, NEW.unidad_origen_id, NEW.monto, NEW.moneda, NEW.criterio, NEW.fuente, NEW.registrado_por, NEW.creado_en)
        IS DISTINCT FROM ROW(OLD.id, OLD.organizacion_id, OLD.orden_id, OLD.unidad_origen_id, OLD.monto, OLD.moneda, OLD.criterio, OLD.fuente, OLD.registrado_por, OLD.creado_en) THEN
   RAISE EXCEPTION 'Transferencia inmutable: anular con motivo y registrar una nueva' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.anulada_en IS NOT NULL THEN RAISE EXCEPTION 'No insertar transferencias ya anuladas' USING ERRCODE='23514'; END IF;
 SELECT u.tipo INTO v_tipo FROM keptai.unidad_produccion u WHERE u.organizacion_id = NEW.organizacion_id AND u.id = NEW.unidad_origen_id;
 IF v_tipo IS DISTINCT FROM 'TALLER_INTERNO' THEN
  RAISE EXCEPTION 'El cargo interno solo sale de un taller interno' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION keptai_private.validar_transferencia() FROM PUBLIC;
CREATE TRIGGER tg_transferencia_validar BEFORE INSERT OR UPDATE ON transferencia_interna FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_transferencia();

CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON asignacion_costo_item FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('registrado_por');
CREATE TRIGGER tg_autoria BEFORE INSERT OR UPDATE ON transferencia_interna FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('registrado_por','anulada_por');

-- RLS y grants como V4/V7: sin DELETE runtime, Data API sin acceso.
REVOKE ALL ON asignacion_costo_item, transferencia_interna FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.asignacion_costo_item, keptai.transferencia_interna FROM %I', r);
  END IF;
 END LOOP;
END $$;
ALTER TABLE asignacion_costo_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencia_interna ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON asignacion_costo_item, transferencia_interna TO keptai_runtime;
CREATE POLICY p_lectura ON asignacion_costo_item FOR SELECT TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN','GERENTE','JEFE_TALLER']));
CREATE POLICY p_insercion ON asignacion_costo_item FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN','JEFE_TALLER']));
CREATE POLICY p_actualizacion ON asignacion_costo_item FOR UPDATE TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN','JEFE_TALLER']))
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN','JEFE_TALLER']));
CREATE POLICY p_lectura ON transferencia_interna FOR SELECT TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN','GERENTE']));
CREATE POLICY p_insercion ON transferencia_interna FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = 'ADMIN');
CREATE POLICY p_actualizacion ON transferencia_interna FOR UPDATE TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = 'ADMIN')
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = 'ADMIN');
