-- V10 (Miguel, 11/10/2026): contacto de WhatsApp registrado por cliente y asociación contextual pedido/canal/pago.
-- Dirección de producto: la entrada n8n identifica al CLIENTE por el JID de un CONTACTO previamente registrado (no por
-- nombres, pushName ni la extracción de la IA). NO reescribe V1–V9 ni resucita nota_cliente. Solo metadatos: nunca mensajes.
-- Un contacto NO es vendedor, ni organización (tenant), ni usuario de Auth: no autentica ni autoriza nada.
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V10'; END IF;
 IF to_regclass('keptai.contacto') IS NOT NULL THEN RAISE EXCEPTION 'V10 bloqueada: keptai.contacto ya existe; revisar el esquema antes de migrar'; END IF;
 -- La FK orden -> canal exige que el cliente de una orden con canal coincida con el del canal; no se corrige nada en silencio.
 IF EXISTS (SELECT 1 FROM keptai.orden o JOIN keptai.canal_whatsapp c ON c.organizacion_id = o.organizacion_id AND c.id = o.canal_id
            WHERE o.cliente_id IS NOT NULL AND c.cliente_id IS DISTINCT FROM o.cliente_id) THEN
  RAISE EXCEPTION 'V10 bloqueada: hay ordenes cuyo cliente no coincide con el de su canal_whatsapp; revisar con autorizacion antes de migrar';
 END IF;
END $$;

CREATE TABLE contacto (
 id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
 cliente_id      uuid        NOT NULL,
 nombre          text        NOT NULL CHECK (btrim(nombre) <> ''),
 -- JID canónico: dígitos internacionales + @s.whatsapp.net. Sin dispositivo (:n), sin @lid, sin grupos, sin coincidencias parciales.
 whatsapp_jid    text        NOT NULL CHECK (whatsapp_jid ~ '^[0-9]{5,20}@s\.whatsapp\.net$'),
 activo          boolean     NOT NULL DEFAULT true,
 creado_en       timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organizacion_id, id),
 UNIQUE (organizacion_id, whatsapp_jid),
 UNIQUE (organizacion_id, id, cliente_id, whatsapp_jid),
 FOREIGN KEY (organizacion_id, cliente_id) REFERENCES cliente (organizacion_id, id)
);
CREATE INDEX ix_contacto_cliente ON contacto (organizacion_id, cliente_id);
COMMENT ON TABLE contacto IS 'Contacto de WhatsApp de un cliente (JID canónico). Solo metadatos de enrutamiento; no historial, no vendedor, no identidad autenticada.';

-- Canal: ligado (opcional) a su contacto. La FK compuesta impide un canal con otro cliente o con otro JID que su contacto.
ALTER TABLE canal_whatsapp ADD COLUMN contacto_id uuid;
ALTER TABLE canal_whatsapp ADD CONSTRAINT uq_canal_cliente UNIQUE (organizacion_id, id, cliente_id);
ALTER TABLE canal_whatsapp ADD CONSTRAINT fk_canal_contacto FOREIGN KEY (organizacion_id, contacto_id, cliente_id, chat_jid)
 REFERENCES contacto (organizacion_id, id, cliente_id, whatsapp_jid);
ALTER TABLE canal_whatsapp ADD CONSTRAINT ck_canal_contacto_cliente CHECK (contacto_id IS NULL OR cliente_id IS NOT NULL);

-- Orden: su cliente debe ser el del canal de origen (cuando ambos existen) y puede referenciarse por (org, id, cliente/canal).
ALTER TABLE orden ADD CONSTRAINT uq_orden_cliente UNIQUE (organizacion_id, id, cliente_id);
ALTER TABLE orden ADD CONSTRAINT uq_orden_canal UNIQUE (organizacion_id, id, canal_id);
ALTER TABLE orden ADD CONSTRAINT fk_orden_canal_cliente FOREIGN KEY (organizacion_id, canal_id, cliente_id)
 REFERENCES canal_whatsapp (organizacion_id, id, cliente_id);

-- Pago: asociación CONTEXTUAL con el último pedido del contacto. NO es aplicación (aplicacion_pago), ni verificación bancaria,
-- ni reduce saldo. Las FK compuestas obligan a que la orden sea del mismo cliente y del mismo canal que el pago.
ALTER TABLE pago ADD COLUMN canal_id uuid;
ALTER TABLE pago ADD COLUMN orden_contexto_id uuid;
ALTER TABLE pago ADD CONSTRAINT fk_pago_canal_cliente FOREIGN KEY (organizacion_id, canal_id, cliente_id)
 REFERENCES canal_whatsapp (organizacion_id, id, cliente_id);
ALTER TABLE pago ADD CONSTRAINT fk_pago_orden_cliente FOREIGN KEY (organizacion_id, orden_contexto_id, cliente_id)
 REFERENCES orden (organizacion_id, id, cliente_id);
ALTER TABLE pago ADD CONSTRAINT fk_pago_orden_canal FOREIGN KEY (organizacion_id, orden_contexto_id, canal_id)
 REFERENCES orden (organizacion_id, id, canal_id);
ALTER TABLE pago ADD CONSTRAINT ck_pago_orden_contexto CHECK (orden_contexto_id IS NULL OR (cliente_id IS NOT NULL AND canal_id IS NOT NULL));
CREATE INDEX ix_pago_orden_contexto ON pago (organizacion_id, orden_contexto_id) WHERE orden_contexto_id IS NOT NULL;
CREATE INDEX ix_orden_canal_reciente ON orden (organizacion_id, canal_id, creado_en DESC, id DESC) WHERE canal_id IS NOT NULL;
COMMENT ON COLUMN pago.orden_contexto_id IS 'Último pedido no cancelado del contacto al registrar el voucher (contexto). No es una aplicación del pago.';

-- RLS y grants (como V4/V7/V9): sin DELETE para runtime; sin acceso de la Data API de Supabase.
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
-- Lectura humana de la agenda de su organización.
CREATE POLICY p_lectura ON contacto FOR SELECT TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = ANY (ARRAY['VENDEDOR','ADMIN','GERENTE']));
-- El servicio INGESTA solo resuelve contactos ACTIVOS de SU organización: no los crea ni los modifica.
CREATE POLICY p_lectura_ingesta ON contacto FOR SELECT TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND activo AND (SELECT keptai_private.actor_actual()) = 'INGESTA');
-- Alta y cambios: administración humana (el bootstrap/provisión demo usa el migrador de forma explícita).
CREATE POLICY p_insercion ON contacto FOR INSERT TO keptai_runtime
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = 'ADMIN');
CREATE POLICY p_actualizacion ON contacto FOR UPDATE TO keptai_runtime
 USING (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = 'ADMIN')
 WITH CHECK (organizacion_id = keptai.app_organizacion_actual() AND (SELECT keptai_private.actor_actual()) = 'ADMIN');
