-- Miguel aprueba MVP de 25 tablas: contacto y nota_cliente fuera de esta etapa.
-- Mantener V1-V5 intactas. No borrar contenido existente ni dependencias ajenas.
DO $$
BEGIN
 IF current_schema() <> 'keptai' THEN
  RAISE EXCEPTION 'Configurar defaultSchema=keptai antes de V6';
 END IF;
 IF EXISTS (SELECT 1 FROM keptai.contacto)
 OR EXISTS (SELECT 1 FROM keptai.nota_cliente) THEN
  RAISE EXCEPTION 'V6 bloqueada: contacto/nota_cliente contienen datos. Preparar conservacion autorizada antes de retirarlas.';
 END IF;
END $$;
DROP TABLE keptai.nota_cliente; -- sin CASCADE, en la transaccion Flyway.
DROP TABLE keptai.contacto;
