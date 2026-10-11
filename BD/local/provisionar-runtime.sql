-- Solo entorno local. Variables recibidas por psql; no guardar claves reales.
SELECT format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L',
 :'runtime_user', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'runtime_user')
\gexec
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_setting('keptai.local_runtime_user')
   AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) THEN
  RAISE EXCEPTION 'Login local tiene privilegios incompatibles con runtime';
 END IF;
END $$;
SELECT format('GRANT keptai_runtime TO %I', :'runtime_user')
\gexec
SELECT format('ALTER ROLE %I IN DATABASE %I SET search_path=keptai,pg_catalog',
 :'runtime_user', current_database())
\gexec
