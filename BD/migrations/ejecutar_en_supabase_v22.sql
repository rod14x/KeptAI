-- V22: Segregación de cartera de clientes y control de edición/historial (Fase 4: B-01, B-02)
-- Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
SET search_path = keptai, public;

DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V22'; END IF;
 IF to_regclass('keptai.cliente_historial') IS NOT NULL THEN RAISE EXCEPTION 'V22 bloqueada: keptai.cliente_historial ya existe; revisar esquema'; END IF;
END $$;

-- 1. Ampliar tabla cliente con vendedor de cartera, contacto extendido y soporte de fusión (B-01, B-02)
ALTER TABLE keptai.cliente
    ADD COLUMN IF NOT EXISTS vendedor_asignado_id uuid REFERENCES usuario(id),
    ADD COLUMN IF NOT EXISTS email_contacto varchar(120),
    ADD COLUMN IF NOT EXISTS direccion text,
    ADD COLUMN IF NOT EXISTS fusionado_con_id uuid REFERENCES cliente(id),
    ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cliente_vendedor_asignado') THEN
    ALTER TABLE keptai.cliente
      ADD CONSTRAINT fk_cliente_vendedor_asignado
      FOREIGN KEY (organizacion_id, vendedor_asignado_id) REFERENCES usuario(organizacion_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cliente_fusionado') THEN
    ALTER TABLE keptai.cliente
      ADD CONSTRAINT fk_cliente_fusionado
      FOREIGN KEY (organizacion_id, fusionado_con_id) REFERENCES cliente(organizacion_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_cliente_vendedor_asignado ON keptai.cliente (organizacion_id, vendedor_asignado_id);

-- 2. Tabla de historial de auditoría de cambios en datos del cliente (B-01)
CREATE TABLE keptai.cliente_historial (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    cliente_id          uuid NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
    modificado_por      uuid NOT NULL REFERENCES usuario(id),
    campo               varchar(50) NOT NULL,
    valor_anterior      text,
    valor_nuevo         text,
    motivo              text,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, cliente_id) REFERENCES cliente(organizacion_id, id),
    FOREIGN KEY (organizacion_id, modificado_por) REFERENCES usuario(organizacion_id, id)
);

CREATE INDEX ix_cliente_historial_cliente ON keptai.cliente_historial (organizacion_id, cliente_id, creado_en DESC);

-- Permisos y RLS
REVOKE ALL ON keptai.cliente_historial FROM PUBLIC;

DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.cliente_historial FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE keptai.cliente_historial ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON keptai.cliente_historial TO keptai_runtime;

CREATE POLICY p_cliente_historial_org ON keptai.cliente_historial
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

-- Semilla: Asignar vendedor de cartera a los clientes existentes
DO $$
DECLARE
    org_rec RECORD;
    vendedor_corpotex uuid;
BEGIN
    FOR org_rec IN SELECT id FROM keptai.organizacion LOOP
        SELECT id INTO vendedor_corpotex FROM keptai.usuario WHERE organizacion_id = org_rec.id AND rol = 'VENDEDOR' ORDER BY creado_en LIMIT 1;
        IF vendedor_corpotex IS NOT NULL THEN
            UPDATE keptai.cliente 
            SET vendedor_asignado_id = vendedor_corpotex 
            WHERE organizacion_id = org_rec.id AND vendedor_asignado_id IS NULL;
        END IF;
    END LOOP;
END $$;


-- 3. Asegurar ON DELETE CASCADE en relaciones dependientes de orden para consistencia de pruebas y borrado
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orden_etapa_organizacion_id_orden_id_fkey') THEN
    ALTER TABLE keptai.orden_etapa
      DROP CONSTRAINT orden_etapa_organizacion_id_orden_id_fkey,
      ADD CONSTRAINT orden_etapa_organizacion_id_orden_id_fkey
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ficha_tecnica_orden') THEN
    ALTER TABLE keptai.ficha_tecnica
      DROP CONSTRAINT fk_ficha_tecnica_orden,
      ADD CONSTRAINT fk_ficha_tecnica_orden
      FOREIGN KEY (organizacion_id, orden_id) REFERENCES keptai.orden (organizacion_id, id) ON DELETE CASCADE;
  END IF;
END $$;
