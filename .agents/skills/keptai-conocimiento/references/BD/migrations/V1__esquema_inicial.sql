-- =============================================================================
-- KeptAI - V1 Esquema inicial (núcleo del demo)
-- Fuente: PROP-FLUJO-DER-001 v1.3.0 (DER fusionado) + PROP-DB-001 (invariantes)
-- Motor: PostgreSQL 15+ (Supabase). Flyway: un solo historial de esquema.
--
-- Convenciones
--   * Toda tabla de negocio lleva organizacion_id (aislamiento por empresa, P-006).
--   * Cada tabla expone UNIQUE (organizacion_id, id) y las FK son compuestas
--     (organizacion_id, x_id): la base impide referencias entre organizaciones.
--   * Importes numeric(18,2) con moneda explícita (ISO 4217). Nunca float.
--   * Fechas de negocio: date (America/Lima). Instantes: timestamptz.
--   * Catálogos de estado como text + CHECK (mapeo simple con JPA @Enumerated STRING).
--   * Fuera de V1 (se agregan en V3+): exportacion_contable, perfil_recompra,
--     precio_transferencia, token_estado_cuenta, config_escenario.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Organización y usuarios
-- ---------------------------------------------------------------------------
CREATE TABLE organizacion (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          text        NOT NULL,
    ruc             varchar(11),
    zona_horaria    text        NOT NULL DEFAULT 'America/Lima',
    moneda_base     char(3)     NOT NULL DEFAULT 'PEN' CHECK (moneda_base ~ '^[A-Z]{3}$'),
    creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
    auth_user_id    uuid        NOT NULL,              -- sub del JWT (Supabase Auth)
    nombre          text        NOT NULL,
    email           text,
    rol             text        NOT NULL CHECK (rol IN ('VENDEDOR', 'ADMIN', 'GERENTE', 'JEFE_TALLER')),
    whatsapp_jid    text,                              -- para reconocer /cerrar y /ok
    activo          boolean     NOT NULL DEFAULT true,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, auth_user_id),
    UNIQUE (organizacion_id, whatsapp_jid)
);

-- ---------------------------------------------------------------------------
-- Clasificación comercial
-- ---------------------------------------------------------------------------
CREATE TABLE marca (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid NOT NULL REFERENCES organizacion (id),
    nombre          text NOT NULL,
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, nombre)
);

CREATE TABLE linea_producto (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid NOT NULL REFERENCES organizacion (id),
    nombre          text NOT NULL,
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, nombre)
);

-- ---------------------------------------------------------------------------
-- Clientes y canal WhatsApp (evidencia de origen)
-- ---------------------------------------------------------------------------
CREATE TABLE cliente (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid          NOT NULL REFERENCES organizacion (id),
    razon_social    text          NOT NULL,
    tipo            text          NOT NULL CHECK (tipo IN ('COLEGIO', 'EMPRESA', 'PERSONA')),
    ruc_dni         varchar(11),
    limite_credito  numeric(18,2) CHECK (limite_credito >= 0),
    creado_en       timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id)
);
CREATE UNIQUE INDEX ux_cliente_ruc_dni ON cliente (organizacion_id, ruc_dni) WHERE ruc_dni IS NOT NULL;

CREATE TABLE contacto (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid NOT NULL REFERENCES organizacion (id),
    cliente_id      uuid NOT NULL,
    nombre          text NOT NULL,
    whatsapp_jid    text,
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, whatsapp_jid),
    FOREIGN KEY (organizacion_id, cliente_id) REFERENCES cliente (organizacion_id, id)
);

CREATE TABLE chat (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
    cliente_id      uuid,                              -- null hasta identificar al cliente
    vendedor_id     uuid,
    instancia       text        NOT NULL,              -- instancia Evolution (ventas-01)
    chat_jid        text        NOT NULL,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, instancia, chat_jid),
    FOREIGN KEY (organizacion_id, cliente_id)  REFERENCES cliente (organizacion_id, id),
    FOREIGN KEY (organizacion_id, vendedor_id) REFERENCES usuario (organizacion_id, id)
);

CREATE TABLE mensaje (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id      uuid        NOT NULL REFERENCES organizacion (id),
    chat_id              uuid        NOT NULL,
    provider_msg_id      text        NOT NULL,         -- key.id de Evolution
    from_me              boolean     NOT NULL,
    tipo                 text        NOT NULL CHECK (tipo IN ('TEXTO', 'AUDIO', 'IMAGEN', 'DOCUMENTO', 'OTRO')),
    contenido_texto      text,                         -- texto o transcripción
    archivo_storage_path text,                         -- bucket privado
    archivo_hash         char(64),                     -- sha-256 hex
    enviado_en           timestamptz NOT NULL,
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, chat_id, provider_msg_id),
    FOREIGN KEY (organizacion_id, chat_id) REFERENCES chat (organizacion_id, id)
);
CREATE INDEX ix_mensaje_chat_fecha ON mensaje (organizacion_id, chat_id, enviado_en);

-- ---------------------------------------------------------------------------
-- Órdenes
-- ---------------------------------------------------------------------------
CREATE TABLE orden (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id          uuid          NOT NULL REFERENCES organizacion (id),
    ref                      text          NOT NULL,   -- ORD-123, legible para /ok
    cliente_id               uuid          NOT NULL,
    marca_id                 uuid,
    vendedor_id              uuid,
    chat_id                  uuid,                     -- chat de origen (null si fue manual)
    estado                   text          NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN (
                                 'BORRADOR', 'PENDIENTE_APROBACION', 'RETENIDA', 'LIBERADA',
                                 'EN_PRODUCCION', 'DESPACHADA', 'CERRADA', 'CANCELADA')),
    condicion_pago           text          NOT NULL CHECK (condicion_pago IN ('CONTADO', 'ANTICIPO', 'CREDITO')),
    plazo_dias               integer       CHECK (plazo_dias >= 0),
    anticipo_requerido       numeric(18,2) NOT NULL DEFAULT 0 CHECK (anticipo_requerido >= 0),
    total                    numeric(18,2) NOT NULL CHECK (total >= 0),
    moneda                   char(3)       NOT NULL DEFAULT 'PEN' CHECK (moneda ~ '^[A-Z]{3}$'),
    tipo_produccion          text          NOT NULL DEFAULT 'INTERNA' CHECK (tipo_produccion IN ('INTERNA', 'TERCERIZADA')),
    fecha_entrega_solicitada date,
    fecha_inicio_produccion  date,                     -- la fija Spring al pasar el gatekeeper
    origen                   text          NOT NULL DEFAULT 'MANUAL' CHECK (origen IN ('WHATSAPP', 'MANUAL', 'CSV')),
    idempotency_key          text,
    version                  bigint        NOT NULL DEFAULT 0,   -- JPA @Version
    creado_en                timestamptz   NOT NULL DEFAULT now(),
    actualizado_en           timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, ref),
    UNIQUE (organizacion_id, idempotency_key),
    CHECK (anticipo_requerido <= total),
    CHECK (condicion_pago <> 'CREDITO' OR plazo_dias IS NOT NULL),
    FOREIGN KEY (organizacion_id, cliente_id)  REFERENCES cliente (organizacion_id, id),
    FOREIGN KEY (organizacion_id, marca_id)    REFERENCES marca (organizacion_id, id),
    FOREIGN KEY (organizacion_id, vendedor_id) REFERENCES usuario (organizacion_id, id),
    FOREIGN KEY (organizacion_id, chat_id)     REFERENCES chat (organizacion_id, id)
);
CREATE INDEX ix_orden_cliente ON orden (organizacion_id, cliente_id);
CREATE INDEX ix_orden_estado  ON orden (organizacion_id, estado);

CREATE TABLE orden_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid          NOT NULL REFERENCES organizacion (id),
    orden_id        uuid          NOT NULL,
    linea_id        uuid,
    descripcion     text          NOT NULL,
    tela            text,
    talla           text,
    logo            text,
    cantidad        integer       NOT NULL CHECK (cantidad > 0),
    precio_unit     numeric(18,2) NOT NULL CHECK (precio_unit >= 0),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, orden_id) REFERENCES orden (organizacion_id, id) ON DELETE CASCADE,
    FOREIGN KEY (organizacion_id, linea_id) REFERENCES linea_producto (organizacion_id, id)
);
CREATE INDEX ix_orden_item_orden ON orden_item (organizacion_id, orden_id);

CREATE TABLE hoja_resumen (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid         NOT NULL REFERENCES organizacion (id),
    orden_id            uuid         NOT NULL,
    chat_id             uuid,
    version             integer      NOT NULL CHECK (version >= 1),
    extraccion          jsonb        NOT NULL,         -- JSON propuesto por la IA (WF1)
    campos_ausentes     jsonb        NOT NULL DEFAULT '[]'::jsonb,
    resumen_md          text         NOT NULL,
    confianza           numeric(4,3) CHECK (confianza BETWEEN 0 AND 1),
    mensajes_procesados integer,
    estado              text         NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'CONFIRMADA', 'DESCARTADA')),
    revisado_por        uuid,
    revisado_en         timestamptz,
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, orden_id, version),
    CHECK (estado <> 'CONFIRMADA' OR revisado_por IS NOT NULL),
    FOREIGN KEY (organizacion_id, orden_id)     REFERENCES orden (organizacion_id, id),
    FOREIGN KEY (organizacion_id, chat_id)      REFERENCES chat (organizacion_id, id),
    FOREIGN KEY (organizacion_id, revisado_por) REFERENCES usuario (organizacion_id, id)
);

-- Una sola decisión de crédito por orden; el historial de cambios queda en evento_auditoria.
CREATE TABLE aprobacion_credito (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id       uuid          NOT NULL REFERENCES organizacion (id),
    orden_id              uuid          NOT NULL,
    aprobado_por          uuid,                        -- vendedor que decide
    decision              text          NOT NULL DEFAULT 'PENDIENTE' CHECK (decision IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    aviso_mora_mostrado   boolean       NOT NULL DEFAULT false,
    saldo_referencia      numeric(18,2) NOT NULL DEFAULT 0,   -- saldo vencido del cliente al decidir
    plazo_dias            integer       CHECK (plazo_dias >= 0),
    anticipo_pct          numeric(5,2)  CHECK (anticipo_pct BETWEEN 0 AND 100),
    motivo                text,
    compromiso_digital_id text,
    decidido_en           timestamptz,
    creado_en             timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, orden_id),
    CHECK (decision = 'PENDIENTE' OR (aprobado_por IS NOT NULL AND decidido_en IS NOT NULL)),
    FOREIGN KEY (organizacion_id, orden_id)     REFERENCES orden (organizacion_id, id),
    FOREIGN KEY (organizacion_id, aprobado_por) REFERENCES usuario (organizacion_id, id)
);

-- ---------------------------------------------------------------------------
-- Cobro: una sola obligación por orden (D-005). Sustituye a CUOTA.
-- El saldo NO se guarda: se calcula desde aplicacion_pago (vista v_saldo_obligacion).
-- ---------------------------------------------------------------------------
CREATE TABLE obligacion_cobro (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid          NOT NULL REFERENCES organizacion (id),
    orden_id            uuid          NOT NULL,
    monto               numeric(18,2) NOT NULL CHECK (monto > 0),
    moneda              char(3)       NOT NULL DEFAULT 'PEN' CHECK (moneda ~ '^[A-Z]{3}$'),
    evento_inicio_plazo text          NOT NULL DEFAULT 'DESPACHO' CHECK (evento_inicio_plazo IN ('DESPACHO')),
    plazo_dias          integer       NOT NULL DEFAULT 0 CHECK (plazo_dias >= 0),
    vence_en            date,                          -- null hasta el acta de despacho
    estado              text          NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PARCIAL', 'PAGADA', 'MORA', 'ANULADA')),
    version             bigint        NOT NULL DEFAULT 0,
    creado_en           timestamptz   NOT NULL DEFAULT now(),
    actualizado_en      timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, orden_id),
    FOREIGN KEY (organizacion_id, orden_id) REFERENCES orden (organizacion_id, id)
);
CREATE INDEX ix_obligacion_vence ON obligacion_cobro (organizacion_id, estado, vence_en);

-- ---------------------------------------------------------------------------
-- Pagos y conciliación
-- fase: RECIBIDO -> VERIFICADO_BANCO -> APLICADO. Solo lo aplicado mueve saldo.
-- ---------------------------------------------------------------------------
CREATE TABLE pago (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid          NOT NULL REFERENCES organizacion (id),
    cliente_id          uuid,                          -- null si el remitente no se identifica
    monto               numeric(18,2) NOT NULL CHECK (monto > 0),
    moneda              char(3)       NOT NULL DEFAULT 'PEN' CHECK (moneda ~ '^[A-Z]{3}$'),
    fecha_pago          date          NOT NULL,
    medio               text          NOT NULL CHECK (medio IN ('YAPE', 'PLIN', 'TRANSFERENCIA', 'DEPOSITO', 'EFECTIVO', 'OTRO')),
    banco               text,
    codigo_operacion    text,
    fase                text          NOT NULL DEFAULT 'RECIBIDO' CHECK (fase IN ('RECIBIDO', 'VERIFICADO_BANCO', 'APLICADO')),
    estado_conciliacion text          NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_conciliacion IN (
                            'PENDIENTE', 'APLICADO', 'PARCIAL', 'DUPLICADO', 'SIN_ORDEN', 'NO_CUADRA')),
    verificado_por      uuid,
    verificado_en       timestamptz,
    idempotency_key     text,                          -- p. ej. id del mensaje de WhatsApp
    version             bigint        NOT NULL DEFAULT 0,
    creado_en           timestamptz   NOT NULL DEFAULT now(),
    actualizado_en      timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, idempotency_key),
    CHECK (fase = 'RECIBIDO' OR (verificado_por IS NOT NULL AND verificado_en IS NOT NULL)),
    FOREIGN KEY (organizacion_id, cliente_id)     REFERENCES cliente (organizacion_id, id),
    FOREIGN KEY (organizacion_id, verificado_por) REFERENCES usuario (organizacion_id, id)
);
-- Señal de duplicado (código + monto + fecha). No es UNIQUE: un duplicado se revisa, no se rechaza.
CREATE INDEX ix_pago_duplicado ON pago (organizacion_id, codigo_operacion, monto, fecha_pago);
CREATE INDEX ix_pago_revision  ON pago (organizacion_id, estado_conciliacion);

CREATE TABLE comprobante (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id      uuid         NOT NULL REFERENCES organizacion (id),
    pago_id              uuid         NOT NULL,
    mensaje_id           uuid,                         -- null si se subió manualmente
    banco                text,
    archivo_storage_path text         NOT NULL,        -- bucket privado; nunca URL pública
    archivo_hash         char(64)     NOT NULL,
    ocr_extraccion       jsonb,
    confianza            numeric(4,3) CHECK (confianza BETWEEN 0 AND 1),
    creado_en            timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, pago_id)    REFERENCES pago (organizacion_id, id),
    FOREIGN KEY (organizacion_id, mensaje_id) REFERENCES mensaje (organizacion_id, id)
);
CREATE INDEX ix_comprobante_hash ON comprobante (organizacion_id, archivo_hash);

-- Puente pago <-> obligación. Un pago cubre varias obligaciones; una obligación recibe varios pagos.
-- No se borra: una corrección se registra anulando (anulada_en) y aplicando de nuevo.
CREATE TABLE aplicacion_pago (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id  uuid          NOT NULL REFERENCES organizacion (id),
    pago_id          uuid          NOT NULL,
    obligacion_id    uuid          NOT NULL,
    monto_aplicado   numeric(18,2) NOT NULL CHECK (monto_aplicado > 0),
    aplicado_por     uuid          NOT NULL,
    aplicado_en      timestamptz   NOT NULL DEFAULT now(),
    anulada_en       timestamptz,
    anulada_por      uuid,
    motivo_anulacion text,
    UNIQUE (organizacion_id, id),
    CHECK ((anulada_en IS NULL) = (anulada_por IS NULL)),
    FOREIGN KEY (organizacion_id, pago_id)       REFERENCES pago (organizacion_id, id),
    FOREIGN KEY (organizacion_id, obligacion_id) REFERENCES obligacion_cobro (organizacion_id, id),
    FOREIGN KEY (organizacion_id, aplicado_por)  REFERENCES usuario (organizacion_id, id),
    FOREIGN KEY (organizacion_id, anulada_por)   REFERENCES usuario (organizacion_id, id)
);
CREATE INDEX ix_aplicacion_pago       ON aplicacion_pago (organizacion_id, pago_id)       WHERE anulada_en IS NULL;
CREATE INDEX ix_aplicacion_obligacion ON aplicacion_pago (organizacion_id, obligacion_id) WHERE anulada_en IS NULL;

-- Red de seguridad en base de datos (el servicio Spring ya valida y bloquea):
-- pago verificado, misma moneda y sin sobreaplicar pago ni obligación.
-- Bloquea pago y obligación FOR UPDATE, así dos transacciones concurrentes se serializan.
CREATE FUNCTION fn_validar_aplicacion_pago() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_pago       pago%ROWTYPE;
    v_obligacion obligacion_cobro%ROWTYPE;
    v_usado_pago numeric(18,2);
    v_usado_obl  numeric(18,2);
BEGIN
    IF NEW.anulada_en IS NOT NULL THEN
        RETURN NEW;   -- anular nunca sobreaplica
    END IF;

    SELECT * INTO v_pago FROM pago
     WHERE id = NEW.pago_id AND organizacion_id = NEW.organizacion_id FOR UPDATE;
    SELECT * INTO v_obligacion FROM obligacion_cobro
     WHERE id = NEW.obligacion_id AND organizacion_id = NEW.organizacion_id FOR UPDATE;

    IF v_pago.fase = 'RECIBIDO' THEN
        RAISE EXCEPTION 'El pago % no está verificado en banco', NEW.pago_id USING ERRCODE = 'check_violation';
    END IF;
    IF v_pago.moneda <> v_obligacion.moneda THEN
        RAISE EXCEPTION 'Moneda del pago (%) distinta a la obligación (%)', v_pago.moneda, v_obligacion.moneda
              USING ERRCODE = 'check_violation';
    END IF;

    SELECT coalesce(sum(monto_aplicado), 0) INTO v_usado_pago FROM aplicacion_pago
     WHERE pago_id = NEW.pago_id AND anulada_en IS NULL AND id <> NEW.id;
    SELECT coalesce(sum(monto_aplicado), 0) INTO v_usado_obl FROM aplicacion_pago
     WHERE obligacion_id = NEW.obligacion_id AND anulada_en IS NULL AND id <> NEW.id;

    IF v_usado_pago + NEW.monto_aplicado > v_pago.monto THEN
        RAISE EXCEPTION 'Sobreaplicación del pago %', NEW.pago_id USING ERRCODE = 'check_violation';
    END IF;
    IF v_usado_obl + NEW.monto_aplicado > v_obligacion.monto THEN
        RAISE EXCEPTION 'Sobreaplicación de la obligación %', NEW.obligacion_id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_aplicacion_pago_validar
    BEFORE INSERT OR UPDATE OF monto_aplicado, anulada_en ON aplicacion_pago
    FOR EACH ROW EXECUTE FUNCTION fn_validar_aplicacion_pago();

-- ---------------------------------------------------------------------------
-- Producción y despacho
-- ---------------------------------------------------------------------------
CREATE TABLE unidad_produccion (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid NOT NULL REFERENCES organizacion (id),
    nombre          text NOT NULL,
    tipo            text NOT NULL CHECK (tipo IN ('TALLER_INTERNO', 'TERCERO')),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, nombre)
);

CREATE TABLE orden_etapa (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id    uuid        NOT NULL REFERENCES organizacion (id),
    orden_id           uuid        NOT NULL,
    unidad_id          uuid,
    etapa              text        NOT NULL CHECK (etapa IN ('CORTE', 'SUBLIMADO_BORDADO', 'CONFECCION', 'CALIDAD')),
    estado             text        NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_CURSO', 'TERMINADA', 'BLOQUEADA')),
    responsable_id     uuid,
    cantidad_procesada integer     CHECK (cantidad_procesada >= 0),
    merma              integer     CHECK (merma >= 0),
    inicio             timestamptz,
    fin                timestamptz,
    observaciones      text,
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, orden_id, etapa),
    CHECK (fin IS NULL OR inicio IS NULL OR fin >= inicio),
    FOREIGN KEY (organizacion_id, orden_id)       REFERENCES orden (organizacion_id, id),
    FOREIGN KEY (organizacion_id, unidad_id)      REFERENCES unidad_produccion (organizacion_id, id),
    FOREIGN KEY (organizacion_id, responsable_id) REFERENCES usuario (organizacion_id, id)
);

-- El acta de despacho fija el vencimiento: vence_en = fecha_despacho + plazo_dias (lo calcula Spring).
CREATE TABLE despacho (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id    uuid        NOT NULL REFERENCES organizacion (id),
    orden_id           uuid        NOT NULL,
    fecha_despacho     date        NOT NULL,
    acta_storage_path  text,
    registrado_por     uuid        NOT NULL,
    creado_en          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, orden_id),
    FOREIGN KEY (organizacion_id, orden_id)       REFERENCES orden (organizacion_id, id),
    FOREIGN KEY (organizacion_id, registrado_por) REFERENCES usuario (organizacion_id, id)
);

CREATE TABLE costo_orden (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid          NOT NULL REFERENCES organizacion (id),
    orden_id        uuid          NOT NULL,
    etapa_id        uuid,
    concepto        text          NOT NULL CHECK (concepto IN ('MATERIA_PRIMA', 'MANO_OBRA', 'TERCERO', 'CIF', 'LOGISTICA')),
    monto           numeric(18,2) NOT NULL CHECK (monto >= 0),
    moneda          char(3)       NOT NULL DEFAULT 'PEN' CHECK (moneda ~ '^[A-Z]{3}$'),
    origen          text          NOT NULL CHECK (origen IN ('REAL', 'TEORICO')),
    fuente          text          NOT NULL,             -- de dónde sale el dato (semilla, jefe de taller, CSV...)
    registrado_por  uuid,
    creado_en       timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, orden_id)       REFERENCES orden (organizacion_id, id),
    FOREIGN KEY (organizacion_id, etapa_id)       REFERENCES orden_etapa (organizacion_id, id),
    FOREIGN KEY (organizacion_id, registrado_por) REFERENCES usuario (organizacion_id, id)
);
CREATE INDEX ix_costo_orden ON costo_orden (organizacion_id, orden_id, origen);

-- ---------------------------------------------------------------------------
-- Cobranza y mensajería saliente (WF3)
-- ---------------------------------------------------------------------------
CREATE TABLE mensaje_saliente (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id     uuid        NOT NULL REFERENCES organizacion (id),
    cliente_id          uuid,                          -- destinatario cliente...
    usuario_destino_id  uuid,                          -- ...o vendedor (RESUMEN_VENDEDOR)
    orden_id            uuid,
    obligacion_id       uuid,
    instancia           text        NOT NULL,
    numero_destino      text        NOT NULL,
    tipo                text        NOT NULL CHECK (tipo IN (
                            'COBRANZA_PREVENTIVA', 'COBRANZA_VENCIMIENTO', 'MORA_TEMPRANA', 'RECOMPRA',
                            'ESTADO_CUENTA', 'CONFIRMACION_PAGO', 'RESUMEN_VENDEDOR')),
    texto               text        NOT NULL,
    idempotency_key     text        NOT NULL,          -- p. ej. orden123-m3d
    estado              text        NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'ENVIADO', 'ERROR', 'CANCELADO')),
    intentos            integer     NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    programado_para     timestamptz NOT NULL,
    enviado_en          timestamptz,
    provider_message_id text,
    ultimo_error        text,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, idempotency_key),
    CHECK (cliente_id IS NOT NULL OR usuario_destino_id IS NOT NULL),
    FOREIGN KEY (organizacion_id, cliente_id)         REFERENCES cliente (organizacion_id, id),
    FOREIGN KEY (organizacion_id, usuario_destino_id) REFERENCES usuario (organizacion_id, id),
    FOREIGN KEY (organizacion_id, orden_id)           REFERENCES orden (organizacion_id, id),
    FOREIGN KEY (organizacion_id, obligacion_id)      REFERENCES obligacion_cobro (organizacion_id, id)
);
-- Cola del scheduler: pendientes por fecha.
CREATE INDEX ix_mensaje_saliente_cola ON mensaje_saliente (programado_para) WHERE estado = 'PENDIENTE';

-- Alerta interna con responsable y resolución (mora temprana, pago dudoso, revisión de conciliación).
CREATE TABLE alerta_cobranza (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
    obligacion_id   uuid,
    pago_id         uuid,
    responsable_id  uuid,
    regla           text        NOT NULL CHECK (regla IN ('MORA_TEMPRANA', 'PAGO_EN_REVISION', 'ANTICIPO_PENDIENTE')),
    estado          text        NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'RESUELTA', 'CANCELADA')),
    resolucion      text,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    cerrada_en      timestamptz,
    UNIQUE (organizacion_id, id),
    CHECK (obligacion_id IS NOT NULL OR pago_id IS NOT NULL),
    CHECK (estado = 'ABIERTA' OR cerrada_en IS NOT NULL),
    FOREIGN KEY (organizacion_id, obligacion_id)  REFERENCES obligacion_cobro (organizacion_id, id),
    FOREIGN KEY (organizacion_id, pago_id)        REFERENCES pago (organizacion_id, id),
    FOREIGN KEY (organizacion_id, responsable_id) REFERENCES usuario (organizacion_id, id)
);
CREATE INDEX ix_alerta_abierta ON alerta_cobranza (organizacion_id, responsable_id) WHERE estado = 'ABIERTA';

-- ---------------------------------------------------------------------------
-- Caja a 4 semanas
-- Cobros esperados = obligaciones pendientes; cobros realizados = aplicaciones vigentes.
-- ---------------------------------------------------------------------------
CREATE TABLE apertura_caja (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid          NOT NULL REFERENCES organizacion (id),
    fecha           date          NOT NULL,
    moneda          char(3)       NOT NULL DEFAULT 'PEN' CHECK (moneda ~ '^[A-Z]{3}$'),
    importe         numeric(18,2) NOT NULL,
    fuente          text          NOT NULL,
    UNIQUE (organizacion_id, id),
    UNIQUE (organizacion_id, fecha, moneda)
);

CREATE TABLE egreso_caja (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid          NOT NULL REFERENCES organizacion (id),
    concepto        text          NOT NULL,
    fecha_prevista  date          NOT NULL,
    fecha_realizada date,
    monto           numeric(18,2) NOT NULL CHECK (monto > 0),
    moneda          char(3)       NOT NULL DEFAULT 'PEN' CHECK (moneda ~ '^[A-Z]{3}$'),
    estado          text          NOT NULL DEFAULT 'PREVISTO' CHECK (estado IN ('PREVISTO', 'REALIZADO', 'ANULADO')),
    fuente          text          NOT NULL,
    UNIQUE (organizacion_id, id),
    CHECK (estado <> 'REALIZADO' OR fecha_realizada IS NOT NULL)
);
CREATE INDEX ix_egreso_fecha ON egreso_caja (organizacion_id, fecha_prevista) WHERE estado = 'PREVISTO';

-- ---------------------------------------------------------------------------
-- Auditoría e idempotencia
-- ---------------------------------------------------------------------------
CREATE TABLE evento_auditoria (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
    usuario_id      uuid,                              -- null cuando actúa el sistema
    actor           text        NOT NULL CHECK (actor IN ('USUARIO', 'N8N', 'SCHEDULER', 'SISTEMA')),
    operacion       text        NOT NULL,              -- p. ej. PAGO_APLICADO, CREDITO_APROBADO
    entidad         text        NOT NULL,
    entidad_id      uuid        NOT NULL,
    cambios         jsonb,
    request_id      text,
    ocurrido_en     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizacion_id, id),
    FOREIGN KEY (organizacion_id, usuario_id) REFERENCES usuario (organizacion_id, id)
);
CREATE INDEX ix_auditoria_entidad ON evento_auditoria (organizacion_id, entidad, entidad_id, ocurrido_en);

-- Misma clave + mismo contenido => devolver respuesta previa; misma clave + otro contenido => rechazar.
CREATE TABLE solicitud_idempotente (
    organizacion_id uuid        NOT NULL REFERENCES organizacion (id),
    operacion       text        NOT NULL,              -- ORDEN_INGESTA, PAGO_VOUCHER, ORDEN_CONFIRMAR...
    clave           text        NOT NULL,
    hash_contenido  char(64)    NOT NULL,
    respuesta       jsonb,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organizacion_id, operacion, clave)
);

-- ---------------------------------------------------------------------------
-- Vistas de cálculo (el saldo y el margen nunca se aceptan desde fuera)
-- ---------------------------------------------------------------------------
CREATE VIEW v_saldo_obligacion WITH (security_invoker = true) AS
SELECT o.organizacion_id,
       o.id                                    AS obligacion_id,
       o.orden_id,
       o.monto,
       o.moneda,
       o.vence_en,
       coalesce(sum(a.monto_aplicado), 0)      AS cobrado,
       o.monto - coalesce(sum(a.monto_aplicado), 0) AS saldo
  FROM obligacion_cobro o
  LEFT JOIN aplicacion_pago a
         ON a.obligacion_id = o.id AND a.organizacion_id = o.organizacion_id AND a.anulada_en IS NULL
 WHERE o.estado <> 'ANULADA'
 GROUP BY o.organizacion_id, o.id;

-- Mora = saldo > 0 con vencimiento pasado. Solo avisa al vendedor; no bloquea (D-005).
CREATE VIEW v_cliente_mora WITH (security_invoker = true) AS
SELECT ord.organizacion_id,
       ord.cliente_id,
       sum(s.saldo)        AS saldo_vencido,
       min(s.vence_en)     AS vencimiento_mas_antiguo
  FROM v_saldo_obligacion s
  JOIN orden ord ON ord.id = s.orden_id AND ord.organizacion_id = s.organizacion_id
 WHERE s.saldo > 0 AND s.vence_en < current_date
 GROUP BY ord.organizacion_id, ord.cliente_id;

-- Margen teórico (venta - costo TEORICO) y margen real (cobrado - costo REAL).
CREATE VIEW v_margen_orden WITH (security_invoker = true) AS
SELECT ord.organizacion_id,
       ord.id   AS orden_id,
       ord.ref,
       ord.marca_id,
       ord.total AS venta,
       coalesce(c.costo_teorico, 0)                AS costo_teorico,
       coalesce(c.costo_real, 0)                   AS costo_real,
       coalesce(s.cobrado, 0)                      AS cobrado,
       ord.total - coalesce(c.costo_teorico, 0)    AS margen_teorico,
       coalesce(s.cobrado, 0) - coalesce(c.costo_real, 0) AS margen_real_cobrado
  FROM orden ord
  LEFT JOIN (SELECT organizacion_id, orden_id,
                    sum(monto) FILTER (WHERE origen = 'TEORICO') AS costo_teorico,
                    sum(monto) FILTER (WHERE origen = 'REAL')    AS costo_real
               FROM costo_orden GROUP BY organizacion_id, orden_id) c
         ON c.orden_id = ord.id AND c.organizacion_id = ord.organizacion_id
  LEFT JOIN v_saldo_obligacion s
         ON s.orden_id = ord.id AND s.organizacion_id = ord.organizacion_id
 WHERE ord.estado <> 'CANCELADA';
