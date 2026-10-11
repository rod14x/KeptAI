-- =============================================================================
-- KeptAI - V3 Notas internas sobre clientes
-- Mismas convenciones que V1 (FK compuestas por organización, catálogos text + CHECK,
-- anulación en vez de borrado) y RLS de V2 (app_organizacion_actual()).
-- =============================================================================

CREATE TABLE nota_cliente (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
    cliente_id      uuid        NOT NULL,
    autor_id        uuid        NOT NULL,
    tipo            text        NOT NULL DEFAULT 'GENERAL'
                                CHECK (tipo IN ('GENERAL', 'COBRANZA', 'RECLAMO', 'RECOMPRA')),
    contenido       text        NOT NULL CHECK (length(btrim(contenido)) > 0),
    fijada          boolean     NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    anulada_en      timestamptz,                       -- no se borra: se anula
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, cliente_id) REFERENCES cliente (organizacion_id, id),
    FOREIGN KEY (organizacion_id, autor_id)   REFERENCES usuario (organizacion_id, id)
);

-- Postgres no indexa las FK por su cuenta. Este índice cubre "notas de un cliente, recientes primero"
CREATE INDEX ix_nota_cliente_cliente
    ON nota_cliente (organizacion_id, cliente_id, creado_en DESC)
    WHERE anulada_en IS NULL;

CREATE INDEX ix_nota_cliente_autor ON nota_cliente (organizacion_id, autor_id);

ALTER TABLE nota_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_nota_cliente_organizacion ON nota_cliente
    USING (organizacion_id = app_organizacion_actual())
    WITH CHECK (organizacion_id = app_organizacion_actual());
