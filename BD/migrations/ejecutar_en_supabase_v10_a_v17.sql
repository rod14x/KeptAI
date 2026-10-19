-- ============================================================================
-- SCRIPT CONSOLIDADO: MIGRACIONES V10 HASTA V17 (KeptAI / Corpotex)
-- ============================================================================
-- IMPORTANTE: Asegurar esquema keptai
CREATE SCHEMA IF NOT EXISTS keptai;
CREATE SCHEMA IF NOT EXISTS keptai_private;
SET search_path = keptai, public;

-- Asegurar rol keptai_runtime si no existiera
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='keptai_runtime') THEN
  CREATE ROLE keptai_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
END $$;

-- ============================================================================
-- V10: Contacto de WhatsApp y canal/pago contextual
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacto (
 id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
 cliente_id      uuid        NOT NULL,
 nombre          text        NOT NULL CHECK (btrim(nombre) <> ''),
 whatsapp_jid    text        NOT NULL CHECK (whatsapp_jid ~ '^[0-9]{5,20}@s\.whatsapp\.net$'),
 activo          boolean     NOT NULL DEFAULT true,
 creado_en       timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organizacion_id, id),
 UNIQUE (organizacion_id, whatsapp_jid),
 UNIQUE (organizacion_id, id, cliente_id, whatsapp_jid),
 FOREIGN KEY (organizacion_id, cliente_id) REFERENCES cliente (organizacion_id, id)
);

CREATE INDEX IF NOT EXISTS ix_contacto_cliente ON contacto (organizacion_id, cliente_id);

-- Columnas y restricciones en canal_whatsapp
ALTER TABLE canal_whatsapp ADD COLUMN IF NOT EXISTS contacto_id uuid;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_canal_cliente') THEN
  ALTER TABLE canal_whatsapp ADD CONSTRAINT uq_canal_cliente UNIQUE (organizacion_id, id, cliente_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_canal_contacto') THEN
  ALTER TABLE canal_whatsapp ADD CONSTRAINT fk_canal_contacto FOREIGN KEY (organizacion_id, contacto_id, cliente_id, chat_jid)
   REFERENCES contacto (organizacion_id, id, cliente_id, whatsapp_jid);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_canal_contacto_cliente') THEN
  ALTER TABLE canal_whatsapp ADD CONSTRAINT ck_canal_contacto_cliente CHECK (contacto_id IS NULL OR cliente_id IS NOT NULL);
 END IF;
END $$;

-- Restricciones en orden
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orden_cliente') THEN
  ALTER TABLE orden ADD CONSTRAINT uq_orden_cliente UNIQUE (organizacion_id, id, cliente_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orden_canal') THEN
  ALTER TABLE orden ADD CONSTRAINT uq_orden_canal UNIQUE (organizacion_id, id, canal_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orden_canal_cliente') THEN
  ALTER TABLE orden ADD CONSTRAINT fk_orden_canal_cliente FOREIGN KEY (organizacion_id, canal_id, cliente_id)
   REFERENCES canal_whatsapp (organizacion_id, id, cliente_id);
 END IF;
END $$;

-- Columnas y restricciones en pago
ALTER TABLE pago ADD COLUMN IF NOT EXISTS canal_id uuid;
ALTER TABLE pago ADD COLUMN IF NOT EXISTS orden_contexto_id uuid;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pago_canal_cliente') THEN
  ALTER TABLE pago ADD CONSTRAINT fk_pago_canal_cliente FOREIGN KEY (organizacion_id, canal_id, cliente_id)
   REFERENCES canal_whatsapp (organizacion_id, id, cliente_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pago_orden_cliente') THEN
  ALTER TABLE pago ADD CONSTRAINT fk_pago_orden_cliente FOREIGN KEY (organizacion_id, orden_contexto_id, cliente_id)
   REFERENCES orden (organizacion_id, id, cliente_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pago_orden_canal') THEN
  ALTER TABLE pago ADD CONSTRAINT fk_pago_orden_canal FOREIGN KEY (organizacion_id, orden_contexto_id, canal_id)
   REFERENCES orden (organizacion_id, id, canal_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_pago_orden_contexto') THEN
  ALTER TABLE pago ADD CONSTRAINT ck_pago_orden_contexto CHECK (orden_contexto_id IS NULL OR (cliente_id IS NOT NULL AND canal_id IS NOT NULL));
 END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_pago_orden_contexto ON pago (organizacion_id, orden_contexto_id) WHERE orden_contexto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_orden_canal_reciente ON orden (organizacion_id, canal_id, creado_en DESC, id DESC) WHERE canal_id IS NOT NULL;

-- RLS y permisos contacto
REVOKE ALL ON contacto FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.contacto FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE contacto ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON contacto TO keptai_runtime;

DROP POLICY IF EXISTS p_lectura ON contacto;
CREATE POLICY p_lectura ON contacto FOR SELECT TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['VENDEDOR','ADMIN','GERENTE']));

DROP POLICY IF EXISTS p_lectura_ingesta ON contacto;
CREATE POLICY p_lectura_ingesta ON contacto FOR SELECT TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND activo AND (SELECT keptai_private.actor_actual()) = 'INGESTA');

-- ============================================================================
-- V11: Función obligacion_orden al aprobar crédito o contado
-- ============================================================================
CREATE OR REPLACE FUNCTION keptai_private.crear_obligacion_orden(p_orden uuid) RETURNS uuid
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

-- ============================================================================
-- V12: Descartar borradores sin total inventado
-- ============================================================================
ALTER TABLE keptai.orden DROP CONSTRAINT IF EXISTS ck_orden_confirmable;
ALTER TABLE keptai.orden ADD CONSTRAINT ck_orden_confirmable CHECK (
 estado IN ('BORRADOR','CANCELADA') OR (cliente_id IS NOT NULL AND total > 0 AND condicion_pago IS NOT NULL));

GRANT DELETE ON keptai.orden_item TO keptai_runtime;
DROP POLICY IF EXISTS p_admin_descartar_item ON keptai.orden_item;
CREATE POLICY p_admin_descartar_item ON keptai.orden_item FOR DELETE TO keptai_runtime USING (
 organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN'
 AND EXISTS (SELECT 1 FROM keptai.orden o WHERE o.organizacion_id=orden_item.organizacion_id
 AND o.id=orden_item.orden_id AND o.estado='BORRADOR'));

-- ============================================================================
-- V13: Metadatos reales del voucher privado
-- ============================================================================
ALTER TABLE keptai.comprobante ADD COLUMN IF NOT EXISTS archivo_content_type text CHECK(archivo_content_type IN ('image/jpeg','image/png','application/pdf'));
ALTER TABLE keptai.comprobante ADD COLUMN IF NOT EXISTS archivo_size_bytes bigint CHECK(archivo_size_bytes BETWEEN 1 AND 10485760);
ALTER TABLE keptai.comprobante ADD COLUMN IF NOT EXISTS subido_por uuid;
ALTER TABLE keptai.comprobante ADD COLUMN IF NOT EXISTS etiqueta text CHECK(length(etiqueta)<=120);

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comprobante_autor') THEN
  ALTER TABLE keptai.comprobante ADD CONSTRAINT fk_comprobante_autor FOREIGN KEY(organizacion_id,subido_por) REFERENCES keptai.usuario(organizacion_id,id);
 END IF;
END $$;

DROP TRIGGER IF EXISTS tg_autoria_voucher ON keptai.comprobante;
CREATE TRIGGER tg_autoria_voucher BEFORE INSERT OR UPDATE ON keptai.comprobante FOR EACH ROW EXECUTE FUNCTION keptai_private.validar_autoria('subido_por');

-- ============================================================================
-- V14: Crédito administrado en MVP
-- ============================================================================
DROP POLICY IF EXISTS p_insercion ON aprobacion_credito;
DROP POLICY IF EXISTS p_actualizacion ON aprobacion_credito;
CREATE POLICY p_insercion ON aprobacion_credito FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN');
CREATE POLICY p_actualizacion ON aprobacion_credito FOR UPDATE TO keptai_runtime
 USING (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN')
 WITH CHECK (organizacion_id=keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual())='ADMIN');

-- ============================================================================
-- V15: Campos de contacto directo en cliente y permisos comerciales
-- ============================================================================
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS telefono_principal varchar(30);
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS canal_origen varchar(30) NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX IF NOT EXISTS ux_cliente_ruc_dni ON cliente (organizacion_id, ruc_dni) WHERE ruc_dni IS NOT NULL;

DROP POLICY IF EXISTS p_insercion ON contacto;
CREATE POLICY p_insercion ON contacto FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']));

DROP POLICY IF EXISTS p_actualizacion ON contacto;
CREATE POLICY p_actualizacion ON contacto FOR UPDATE TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']))
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['ADMIN', 'VENDEDOR']));

-- ============================================================================
-- V16: Tabla persistente ficha_tecnica y semáforo de taller
-- ============================================================================
CREATE TABLE IF NOT EXISTS ficha_tecnica (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id         uuid NOT NULL REFERENCES organizacion(id),
    orden_id                uuid NOT NULL UNIQUE REFERENCES orden(id) ON DELETE CASCADE,
    estado                  varchar(30) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'COMPLETA')),
    modalidad               varchar(30) NOT NULL DEFAULT 'STOCK_BORDADO' CHECK (modalidad IN ('STOCK_BORDADO', 'CONFECCION_ROLLO')),
    semaforo_tela           varchar(30) DEFAULT 'HABITUAL_VERDE' CHECK (semaforo_tela IN ('HABITUAL_VERDE', 'POR_CONFIRMAR_AMARILLO', 'ESPECIAL_ROJO')),
    consumo_estimado_kg     numeric(10,2) DEFAULT 0,
    validacion_tela         varchar(30) DEFAULT 'NO_APLICA' CHECK (validacion_tela IN ('NO_APLICA', 'PENDIENTE_TALLER', 'CONFIRMADA_TALLER', 'COMPRA_REQUERIDA')),
    tela_validada_por       uuid REFERENCES usuario(id),
    prenda_tipo             varchar(50),
    tela_nombre             varchar(100),
    gramaje                 varchar(50),
    color_principal         varchar(50),
    color_contraste         varchar(50),
    tipo_cuello             varchar(50),
    curva_tallas            jsonb,
    tecnica_personalizacion varchar(50),
    ubicaciones_arte        jsonb,
    instrucciones_costura   text,
    completada_por          uuid REFERENCES usuario(id),
    completada_en           timestamptz,
    creado_en               timestamptz NOT NULL DEFAULT now(),
    actualizado_en          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, orden_id),
    FOREIGN KEY (organizacion_id, tela_validada_por) REFERENCES usuario(organizacion_id, id),
    FOREIGN KEY (organizacion_id, completada_por) REFERENCES usuario(organizacion_id, id)
);

CREATE INDEX IF NOT EXISTS ix_ficha_tecnica_orden ON ficha_tecnica (organizacion_id, orden_id);

REVOKE ALL ON ficha_tecnica FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.ficha_tecnica FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE ficha_tecnica ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON ficha_tecnica TO keptai_runtime;

DROP POLICY IF EXISTS p_ficha_tecnica_organizacion ON ficha_tecnica;
CREATE POLICY p_ficha_tecnica_organizacion ON ficha_tecnica
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

-- ============================================================================
-- V17: Inicializar etapas de fabricación en orden_etapa al liberar pedidos
-- ============================================================================
CREATE OR REPLACE FUNCTION keptai_private.inicializar_etapas_orden() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
    IF NEW.estado = 'LIBERADA' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'LIBERADA') THEN
        INSERT INTO keptai.orden_etapa (organizacion_id, orden_id, etapa, estado)
        VALUES 
            (NEW.organizacion_id, NEW.id, 'CORTE', 'PENDIENTE'),
            (NEW.organizacion_id, NEW.id, 'SUBLIMADO_BORDADO', 'PENDIENTE'),
            (NEW.organizacion_id, NEW.id, 'CONFECCION', 'PENDIENTE'),
            (NEW.organizacion_id, NEW.id, 'CALIDAD', 'PENDIENTE')
        ON CONFLICT (organizacion_id, orden_id, etapa) DO NOTHING;
    END IF;
    RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION keptai_private.inicializar_etapas_orden() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_inicializar_etapas ON orden;
CREATE TRIGGER tg_inicializar_etapas
AFTER INSERT OR UPDATE OF estado ON orden
FOR EACH ROW EXECUTE FUNCTION keptai_private.inicializar_etapas_orden();

INSERT INTO orden_etapa (organizacion_id, orden_id, etapa, estado)
SELECT o.organizacion_id, o.id, e.etapa, 'PENDIENTE'
FROM orden o
CROSS JOIN (VALUES ('CORTE'), ('SUBLIMADO_BORDADO'), ('CONFECCION'), ('CALIDAD')) AS e(etapa)
WHERE o.estado IN ('LIBERADA', 'EN_PRODUCCION', 'DESPACHADA', 'CERRADA')
ON CONFLICT (organizacion_id, orden_id, etapa) DO NOTHING;
