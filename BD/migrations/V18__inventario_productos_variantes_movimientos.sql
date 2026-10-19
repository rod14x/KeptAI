-- V18: Catálogo de productos, variantes con talla obligatoria y movimientos de inventario auditable (Defecto 1)
-- Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
SET search_path = keptai, public;

DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V18'; END IF;
 IF to_regclass('keptai.producto') IS NOT NULL THEN RAISE EXCEPTION 'V18 bloqueada: keptai.producto ya existe; revisar esquema'; END IF;
END $$;

-- 1. Tabla de Productos Maestros
CREATE TABLE producto (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    codigo              varchar(50) NOT NULL,
    nombre              varchar(150) NOT NULL,
    prenda_tipo         varchar(50) NOT NULL,
    tela                varchar(100),
    color               varchar(50),
    categoria           varchar(50) NOT NULL DEFAULT 'PRENDA_BASE',
    unidad_medida       varchar(20) NOT NULL DEFAULT 'prendas',
    activo              boolean NOT NULL DEFAULT true,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, codigo)
);

CREATE INDEX ix_producto_organizacion ON producto (organizacion_id, activo);

-- 2. Tabla de Variantes de Producto (Talla Obligatoria)
CREATE TABLE producto_variante (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    producto_id         uuid NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    talla               varchar(20) NOT NULL,
    sku                 varchar(60),
    stock_actual        integer NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo        integer NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, producto_id, talla),
    FOREIGN KEY (organizacion_id, producto_id) REFERENCES producto(organizacion_id, id)
);

CREATE INDEX ix_variante_producto ON producto_variante (organizacion_id, producto_id);

-- 3. Tabla de Movimientos de Inventario (Kárdex Auditable)
CREATE TABLE movimiento_inventario (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid NOT NULL REFERENCES organizacion(id),
    variante_id         uuid NOT NULL REFERENCES producto_variante(id) ON DELETE RESTRICT,
    tipo                varchar(30) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    cantidad            integer NOT NULL CHECK (cantidad <> 0),
    motivo              varchar(250) NOT NULL,
    usuario_id          uuid NOT NULL REFERENCES usuario(id),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, variante_id) REFERENCES producto_variante(organizacion_id, id),
    FOREIGN KEY (organizacion_id, usuario_id) REFERENCES usuario(organizacion_id, id)
);

CREATE INDEX ix_movimiento_variante ON movimiento_inventario (organizacion_id, variante_id, creado_en DESC);

-- Permisos y RLS
REVOKE ALL ON producto FROM PUBLIC;
REVOKE ALL ON producto_variante FROM PUBLIC;
REVOKE ALL ON movimiento_inventario FROM PUBLIC;

DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON keptai.producto FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.producto_variante FROM %I', r);
   EXECUTE format('REVOKE ALL ON keptai.movimiento_inventario FROM %I', r);
  END IF;
 END LOOP;
END $$;

ALTER TABLE producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_variante ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_inventario ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON producto TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON producto_variante TO keptai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON movimiento_inventario TO keptai_runtime;

-- Políticas de aislamiento por tenant
CREATE POLICY p_producto_organizacion ON producto
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

CREATE POLICY p_variante_organizacion ON producto_variante
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

CREATE POLICY p_movimiento_organizacion ON movimiento_inventario
    USING (organizacion_id = keptai.app_organizacion_actual())
    WITH CHECK (organizacion_id = keptai.app_organizacion_actual());

-- Semilla inicial de demostración si existen organizaciones
DO $$
DECLARE
    org_rec RECORD;
    admin_id uuid;
    prod_polo_id uuid;
    prod_jersey_id uuid;
    var_s uuid; var_m uuid; var_l uuid; var_xl uuid;
BEGIN
    FOR org_rec IN SELECT id FROM keptai.organizacion LOOP
        SELECT id INTO admin_id FROM keptai.usuario WHERE organizacion_id = org_rec.id AND rol = 'ADMIN' LIMIT 1;
        IF admin_id IS NOT NULL THEN
            -- 1. Polo Piqué Blanco
            prod_polo_id := gen_random_uuid();
            INSERT INTO keptai.producto (id, organizacion_id, codigo, nombre, prenda_tipo, tela, color, categoria, unidad_medida)
            VALUES (prod_polo_id, org_rec.id, 'PB-PIQ-WHT', 'Polo Piqué Cuello Camisero Blanco', 'Polo', 'Piqué 24/1 100% Algodón', 'Blanco', 'PRENDA_BASE', 'prendas')
            ON CONFLICT (organizacion_id, codigo) DO NOTHING;

            IF FOUND THEN
                INSERT INTO keptai.producto_variante (id, organizacion_id, producto_id, talla, sku, stock_actual, stock_minimo)
                VALUES 
                    (gen_random_uuid(), org_rec.id, prod_polo_id, 'S', 'PB-PIQ-WHT-S', 45, 10),
                    (gen_random_uuid(), org_rec.id, prod_polo_id, 'M', 'PB-PIQ-WHT-M', 110, 20),
                    (gen_random_uuid(), org_rec.id, prod_polo_id, 'L', 'PB-PIQ-WHT-L', 65, 15),
                    (gen_random_uuid(), org_rec.id, prod_polo_id, 'XL', 'PB-PIQ-WHT-XL', 25, 5);
            END IF;

            -- 2. Polo Jersey Negro
            prod_jersey_id := gen_random_uuid();
            INSERT INTO keptai.producto (id, organizacion_id, codigo, nombre, prenda_tipo, tela, color, categoria, unidad_medida)
            VALUES (prod_jersey_id, org_rec.id, 'PB-JER-BLK', 'Polo Jersey Cuello Redondo Negro', 'Polo', 'Jersey 30/1 Peinado', 'Negro', 'PRENDA_BASE', 'prendas')
            ON CONFLICT (organizacion_id, codigo) DO NOTHING;

            IF FOUND THEN
                INSERT INTO keptai.producto_variante (id, organizacion_id, producto_id, talla, sku, stock_actual, stock_minimo)
                VALUES 
                    (gen_random_uuid(), org_rec.id, prod_jersey_id, 'S', 'PB-JER-BLK-S', 30, 10),
                    (gen_random_uuid(), org_rec.id, prod_jersey_id, 'M', 'PB-JER-BLK-M', 70, 15),
                    (gen_random_uuid(), org_rec.id, prod_jersey_id, 'L', 'PB-JER-BLK-L', 35, 10),
                    (gen_random_uuid(), org_rec.id, prod_jersey_id, 'XL', 'PB-JER-BLK-XL', 14, 5);
            END IF;
        END IF;
    END LOOP;
END $$;
