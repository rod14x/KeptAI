-- V19: Bloqueo de edición de Ficha Técnica cuando el pedido está entregado/despachado (Defecto 2)
-- Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
SET search_path = keptai, public;

DO $$ BEGIN
 IF current_schema() <> 'keptai' THEN RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V19'; END IF;
END $$;

-- Trigger de base de datos para garantizar inmutabilidad de la ficha técnica al despachar/entregar el pedido
CREATE OR REPLACE FUNCTION keptai_private.fn_bloquear_ficha_entregada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
    v_estado varchar(30);
BEGIN
    SELECT estado INTO v_estado FROM keptai.orden WHERE id = NEW.orden_id;
    IF v_estado IN ('DESPACHADA', 'CERRADA', 'ENTREGADO') THEN
        RAISE EXCEPTION 'Ficha cerrada: no se puede modificar la ficha tecnica de un pedido en estado %', v_estado
        USING ERRCODE = '23514'; -- check_violation
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION keptai_private.fn_bloquear_ficha_entregada() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_bloquear_ficha_entregada ON keptai.ficha_tecnica;
CREATE TRIGGER tg_bloquear_ficha_entregada
BEFORE UPDATE ON keptai.ficha_tecnica
FOR EACH ROW EXECUTE FUNCTION keptai_private.fn_bloquear_ficha_entregada();
