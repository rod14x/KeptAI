-- =============================================================================
-- KeptAI - V2 Row Level Security por organización (PROP-DB-001)
--
-- Spring abre cada transacción con:
--     SELECT set_config('app.organizacion_id', :orgId, true);   -- true = local a la transacción
-- El JWT no fija este contexto por sí solo: lo hace el servicio tras validar membresía.
-- Sin contexto, current_setting(..., true) devuelve NULL y la política no deja ver ninguna fila.
--
-- Las políticas aplican al rol runtime (no dueño, sin BYPASSRLS). El rol migrador es
-- dueño de las tablas y no queda restringido (sin FORCE), así Flyway y la semilla funcionan.
-- =============================================================================

CREATE FUNCTION app_organizacion_actual() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.organizacion_id', true), '')::uuid
$$;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'usuario', 'marca', 'linea_producto', 'cliente', 'contacto', 'chat', 'mensaje',
        'orden', 'orden_item', 'hoja_resumen', 'aprobacion_credito', 'obligacion_cobro',
        'pago', 'comprobante', 'aplicacion_pago', 'unidad_produccion', 'orden_etapa',
        'despacho', 'costo_orden', 'mensaje_saliente', 'alerta_cobranza', 'apertura_caja',
        'egreso_caja', 'evento_auditoria', 'solicitud_idempotente'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY p_%s_organizacion ON %I
                 USING (organizacion_id = app_organizacion_actual())
                 WITH CHECK (organizacion_id = app_organizacion_actual())', t, t);
    END LOOP;
END;
$$;

ALTER TABLE organizacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_organizacion_propia ON organizacion
    USING (id = app_organizacion_actual())
    WITH CHECK (id = app_organizacion_actual());
