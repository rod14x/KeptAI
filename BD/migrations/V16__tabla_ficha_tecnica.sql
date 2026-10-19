-- V16: Tabla persistente ficha_tecnica y compuerta de confección/stock (Fase 3)
DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V16'; END IF;
 IF to_regclass('keptai.ficha_tecnica') IS NOT NULL THEN RAISE EXCEPTION 'V16 bloqueada: keptai.ficha_tecnica ya existe; revisar esquema'; END IF;
END $$;

CREATE TABLE ficha_tecnica (
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

CREATE INDEX ix_ficha_tecnica_orden ON ficha_tecnica (organizacion_id, orden_id);

-- RLS y permisos
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

CREATE POLICY p_ficha_tecnica_organizacion ON ficha_tecnica
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());
