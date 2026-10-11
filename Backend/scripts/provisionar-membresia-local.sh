#!/usr/bin/env bash
# Provisión LOCAL de una membresía real (organizacion + usuario) para probar Supabase Auth -> Spring /me.
# - Por defecto solo IMPRIME el SQL (dry-run). Escribe en PostgreSQL local únicamente con --apply.
# - No contiene identidades ni claves: todos los datos son parámetros que decide Miguel. No usa semilla demo.
# - Usa el migrador del contenedor local (BD/local/compose.yaml); nunca Supabase remoto.
# - Una sola transacción; falla si el auth_user_id o la organización ya existen (no sobrescribe ni borra nada).
# Uso:
#   Backend/scripts/provisionar-membresia-local.sh --auth-user-id <uuid del usuario en Supabase Auth> \
#       --email <correo> --usuario-nombre <nombre> --rol VENDEDOR|ADMIN|GERENTE|JEFE_TALLER \
#       (--org-nombre <nombre> [--org-ruc <ruc>] | --org-id <uuid de una organización existente>) [--apply]
# Si Docker no está accesible en la sesión: sg docker -c 'Backend/scripts/provisionar-membresia-local.sh ... --apply'
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
auth_id=""; email=""; unombre=""; rol=""; org_id=""; org_nombre=""; org_ruc=""; apply=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --auth-user-id) auth_id="${2:-}"; shift 2;;
    --email) email="${2:-}"; shift 2;;
    --usuario-nombre) unombre="${2:-}"; shift 2;;
    --rol) rol="${2:-}"; shift 2;;
    --org-id) org_id="${2:-}"; shift 2;;
    --org-nombre) org_nombre="${2:-}"; shift 2;;
    --org-ruc) org_ruc="${2:-}"; shift 2;;
    --apply) apply=1; shift;;
    *) echo "Argumento desconocido: $1" >&2; exit 2;;
  esac
done
uuid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
[[ "$auth_id" =~ $uuid ]] || { echo "--auth-user-id debe ser el UUID (sub) del usuario en Supabase Auth." >&2; exit 2; }
[[ -n "$email" && -n "$unombre" ]] || { echo "Faltan --email y --usuario-nombre." >&2; exit 2; }
[[ "$rol" =~ ^(VENDEDOR|ADMIN|GERENTE|JEFE_TALLER)$ ]] || { echo "--rol debe ser VENDEDOR, ADMIN, GERENTE o JEFE_TALLER (rol aprobado por Miguel)." >&2; exit 2; }
if [[ -n "$org_id" ]]; then
  [[ "$org_id" =~ $uuid && -z "$org_nombre" ]] || { echo "Use --org-id (UUID) o --org-nombre, no ambos." >&2; exit 2; }
else
  [[ -n "$org_nombre" ]] || { echo "Falta --org-id o --org-nombre (organización aprobada por Miguel)." >&2; exit 2; }
fi
sql=$(cat <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = keptai, public;
SELECT set_config('keptai_prov.auth_id', :'auth_id', true);
-- Una sola membresía por cuenta: otra fila para el mismo auth_user_id daría varias organizaciones (/me 409).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM usuario WHERE auth_user_id = current_setting('keptai_prov.auth_id')::uuid) THEN
    RAISE EXCEPTION 'Ese auth_user_id ya tiene una membresía local: no se crea otra ni se sobrescribe.';
  END IF;
END $$;
-- Organización: la existente (org_id) o una nueva (org_nombre).
WITH org AS (
  INSERT INTO organizacion (nombre, ruc)
  SELECT :'org_nombre', NULLIF(:'org_ruc', '') WHERE :'org_id' = ''
  RETURNING id
), destino AS (
  SELECT id FROM org UNION ALL SELECT id FROM organizacion WHERE :'org_id' <> '' AND id = NULLIF(:'org_id','')::uuid
)
INSERT INTO usuario (organizacion_id, auth_user_id, nombre, email, rol, activo)
SELECT id, :'auth_id'::uuid, :'unombre', :'email', :'rol', true FROM destino;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuario WHERE auth_user_id = current_setting('keptai_prov.auth_id')::uuid) THEN
    RAISE EXCEPTION 'No se creó la membresía: la organización indicada con --org-id no existe.';
  END IF;
END $$;
-- Evidencia de lo provisionado (sin datos sensibles).
SELECT u.id AS usuario_id, u.organizacion_id, u.rol, u.activo FROM usuario u WHERE u.auth_user_id = :'auth_id'::uuid;
COMMIT;
SQL
)
vars=(-v "auth_id=$auth_id" -v "email=$email" -v "unombre=$unombre" -v "rol=$rol" -v "org_id=$org_id" -v "org_nombre=$org_nombre" -v "org_ruc=$org_ruc")
if [[ $apply -eq 0 ]]; then
  echo "-- DRY-RUN: no se escribió nada. Parámetros (sin secretos): rol=$rol auth_user_id=$auth_id org=${org_id:-nueva:$org_nombre}"
  echo "$sql"
  echo "-- Para aplicar en el PostgreSQL LOCAL, repita el comando con --apply."
  exit 0
fi
env_file="$root/BD/local/.env"
[[ -f "$env_file" ]] || { echo "Falta BD/local/.env (BD/local/db.sh init)." >&2; exit 1; }
printf '%s\n' "$sql" | docker compose --env-file "$env_file" -f "$root/BD/local/compose.yaml" exec -T postgres \
  sh -c 'psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "${vars[@]}"
echo "Membresía local provisionada. Compruebe con GET /api/v1/me tras iniciar sesión con esa cuenta."
