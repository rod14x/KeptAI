#!/usr/bin/env bash
# Provisión LOCAL parametrizada de servicios n8n (integracion_servicio): alta, listar, revocar y rotar.
# - Por defecto solo muestra una VISTA PREVIA (SQL y parámetros); escribe/lee la base únicamente con --apply.
# - La clave vive en un archivo 600 FUERA del repo (Backend/scripts/generar-clave-servicio.sh); aquí solo se calcula
#   su SHA-256 (clave exacta, UTF-8, sin salto de línea final). Nunca se imprime la clave; del hash solo un prefijo.
# - Organización EXISTENTE, instancia y alcance explícitos. Nunca sobrescribe: alta rechaza duplicados; rotar y
#   revocar exigen coincidencia exacta de id, organización (y hash anterior al rotar). Una sola transacción.
# - Destino por defecto: el PostgreSQL local de BD/local (migrador, contenedor Docker). Para otra base (p. ej. una
#   desechable) defina KEPTAI_PSQL_EXEC="docker exec -i <contenedor> psql -X -q -U <usuario> -d <base>".
# Uso:
#   servicio-local.sh alta     --org-id <uuid> --instancia <nombre> --alcance INGESTA|SCHEDULER --key-file <archivo> [--apply]
#   servicio-local.sh listar   --org-id <uuid> [--apply]
#   servicio-local.sh revocar  --org-id <uuid> --servicio-id <uuid> [--apply]
#   servicio-local.sh rotar    --org-id <uuid> --servicio-id <uuid> --old-key-file <archivo> --new-key-file <archivo> [--apply]
# Si Docker no está accesible: sg docker -c 'Backend/scripts/servicio-local.sh ... --apply'
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cmd="${1:-}"; [[ $# -gt 0 ]] && shift
org=""; inst=""; alc=""; keyf=""; sid=""; oldf=""; newf=""; apply=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --org-id) org="${2:-}"; shift 2;;
    --instancia) inst="${2:-}"; shift 2;;
    --alcance) alc="${2:-}"; shift 2;;
    --key-file) keyf="${2:-}"; shift 2;;
    --servicio-id) sid="${2:-}"; shift 2;;
    --old-key-file) oldf="${2:-}"; shift 2;;
    --new-key-file) newf="${2:-}"; shift 2;;
    --apply) apply=1; shift;;
    *) echo "Argumento desconocido: $1" >&2; exit 2;;
  esac
done
uuid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
die() { echo "$*" >&2; exit 2; }
need_org() { [[ "$org" =~ $uuid ]] || die "--org-id debe ser el UUID de una organización existente."; }
need_sid() { [[ "$sid" =~ $uuid ]] || die "--servicio-id debe ser un UUID (use 'listar')."; }
# SHA-256 hex de la clave exacta del archivo. Valida permisos 600, ubicación fuera del repo y formato (32-128 ASCII visibles).
hash_of() {
  python3 -I - "$1" "$root" <<'PY'
import hashlib, os, stat, sys
path, root = sys.argv[1], os.path.realpath(sys.argv[2])
if not os.path.isfile(path):
    sys.exit("No existe el archivo de clave indicado.")
real = os.path.realpath(path)
if real == root or real.startswith(root + os.sep):
    sys.exit("El archivo de clave debe estar fuera del repositorio.")
if stat.S_IMODE(os.stat(path).st_mode) & 0o077:
    sys.exit("El archivo de clave debe tener permisos 600 (sin acceso para grupo u otros).")
key = open(path, "rb").read().rstrip(b"\r\n")
try:
    text = key.decode("ascii")
except UnicodeDecodeError:
    sys.exit("La clave debe ser ASCII.")
if not (32 <= len(text) <= 128) or any(ord(c) < 0x21 or ord(c) > 0x7e for c in text):
    sys.exit("La clave debe tener 32 a 128 caracteres ASCII visibles (use generar-clave-servicio.sh).")
print(hashlib.sha256(text.encode("utf-8")).hexdigest())
PY
}
vars=(); sql=""
case "$cmd" in
  alta)
    need_org
    [[ "$inst" =~ ^[A-Za-z0-9._-]{1,100}$ ]] || die "--instancia: 1-100 caracteres [A-Za-z0-9._-] (la que Evolution/n8n envía en el JSON; confírmela con Isabella)."
    [[ "$alc" =~ ^(INGESTA|SCHEDULER)$ ]] || die "--alcance debe ser INGESTA o SCHEDULER."
    [[ -n "$keyf" ]] || die "Falta --key-file (genérelo con Backend/scripts/generar-clave-servicio.sh)."
    h="$(hash_of "$keyf")" || exit 2
    vars=(-v "org=$org" -v "inst=$inst" -v "alc=$alc" -v "hash=$h")
    sql=$(cat <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = keptai, public;
SELECT set_config('keptai_svc.org', :'org', true), set_config('keptai_svc.inst', :'inst', true),
       set_config('keptai_svc.alc', :'alc', true), set_config('keptai_svc.hash', :'hash', true) \g /dev/null
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizacion WHERE id = current_setting('keptai_svc.org')::uuid) THEN
    RAISE EXCEPTION 'La organización no existe: alta cancelada.';
  END IF;
  IF EXISTS (SELECT 1 FROM integracion_servicio WHERE clave_hash = current_setting('keptai_svc.hash')) THEN
    RAISE EXCEPTION 'Esa clave ya está registrada (el hash es único): genere otra; no se reutiliza.';
  END IF;
  IF EXISTS (SELECT 1 FROM integracion_servicio WHERE organizacion_id = current_setting('keptai_svc.org')::uuid
             AND instancia = current_setting('keptai_svc.inst') AND alcance = current_setting('keptai_svc.alc')) THEN
    RAISE EXCEPTION 'Ya existe un servicio (activo o no) con esa organización, instancia y alcance: use rotar o revocar; no se sobrescribe.';
  END IF;
END $$;
INSERT INTO integracion_servicio (organizacion_id, instancia, alcance, clave_hash)
VALUES (:'org'::uuid, :'inst', :'alc', :'hash')
RETURNING id AS servicio_id, organizacion_id, instancia, alcance, activo;
COMMIT;
SQL
)
    summary="alta org=$org instancia=$inst alcance=$alc hash=${h:0:8}…";;
  listar)
    need_org
    vars=(-v "org=$org")
    sql=$(cat <<'SQL'
\set ON_ERROR_STOP on
SELECT id AS servicio_id, instancia, alcance, activo, left(clave_hash, 8) || '…' AS hash_prefijo
FROM keptai.integracion_servicio WHERE organizacion_id = :'org'::uuid ORDER BY instancia, alcance;
SQL
)
    summary="listar org=$org (solo lectura; sin hashes completos)";;
  revocar)
    need_org; need_sid
    vars=(-v "org=$org" -v "sid=$sid")
    sql=$(cat <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = keptai, public;
SELECT set_config('keptai_svc.org', :'org', true), set_config('keptai_svc.sid', :'sid', true) \g /dev/null
DO $$ BEGIN
  PERFORM 1 FROM integracion_servicio WHERE id = current_setting('keptai_svc.sid')::uuid
    AND organizacion_id = current_setting('keptai_svc.org')::uuid FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM integracion_servicio WHERE id = current_setting('keptai_svc.sid')::uuid
                 AND organizacion_id = current_setting('keptai_svc.org')::uuid AND activo) THEN
    RAISE EXCEPTION 'No hay un servicio ACTIVO con ese id en esa organización: revocación cancelada.';
  END IF;
END $$;
UPDATE integracion_servicio SET activo = false
WHERE id = :'sid'::uuid AND organizacion_id = :'org'::uuid
RETURNING id AS servicio_id, instancia, alcance, activo;
COMMIT;
SQL
)
    summary="revocar servicio=$sid org=$org (la siguiente petición con su clave dará 401)";;
  rotar)
    need_org; need_sid
    [[ -n "$oldf" && -n "$newf" ]] || die "Faltan --old-key-file y --new-key-file."
    ho="$(hash_of "$oldf")" || exit 2; hn="$(hash_of "$newf")" || exit 2
    [[ "$ho" != "$hn" ]] || die "La clave nueva debe ser distinta de la anterior."
    vars=(-v "org=$org" -v "sid=$sid" -v "hold=$ho" -v "hnew=$hn")
    sql=$(cat <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = keptai, public;
SELECT set_config('keptai_svc.org', :'org', true), set_config('keptai_svc.sid', :'sid', true),
       set_config('keptai_svc.hold', :'hold', true), set_config('keptai_svc.hnew', :'hnew', true) \g /dev/null
DO $$ BEGIN
  PERFORM 1 FROM integracion_servicio WHERE id = current_setting('keptai_svc.sid')::uuid
    AND organizacion_id = current_setting('keptai_svc.org')::uuid FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM integracion_servicio WHERE id = current_setting('keptai_svc.sid')::uuid
                 AND organizacion_id = current_setting('keptai_svc.org')::uuid AND activo
                 AND clave_hash = current_setting('keptai_svc.hold')) THEN
    RAISE EXCEPTION 'Ningún servicio ACTIVO coincide con ese id, organización y clave anterior: rotación cancelada.';
  END IF;
  IF EXISTS (SELECT 1 FROM integracion_servicio WHERE clave_hash = current_setting('keptai_svc.hnew')) THEN
    RAISE EXCEPTION 'La clave nueva ya está registrada: genere otra.';
  END IF;
END $$;
UPDATE integracion_servicio SET clave_hash = :'hnew'
WHERE id = :'sid'::uuid AND organizacion_id = :'org'::uuid AND clave_hash = :'hold' AND activo
RETURNING id AS servicio_id, instancia, alcance, activo;
COMMIT;
SQL
)
    summary="rotar servicio=$sid org=$org hash ${ho:0:8}… → ${hn:0:8}… (sin ventana con ambas claves)";;
  *) echo "Uso: $0 alta|listar|revocar|rotar [opciones] [--apply]  (ver cabecera del script)" >&2; exit 2;;
esac
if [[ $apply -eq 0 ]]; then
  echo "-- VISTA PREVIA: no se tocó ninguna base. $summary"
  echo "$sql"
  echo "-- Para ejecutarlo en el PostgreSQL LOCAL (BD/local) repita el comando con --apply."
  exit 0
fi
if [[ -n "${KEPTAI_PSQL_EXEC:-}" ]]; then
  read -r -a runner <<< "$KEPTAI_PSQL_EXEC"
  printf '%s\n' "$sql" | "${runner[@]}" "${vars[@]}"
else
  env_file="$root/BD/local/.env"
  [[ -f "$env_file" ]] || { echo "Falta BD/local/.env (BD/local/db.sh init)." >&2; exit 1; }
  printf '%s\n' "$sql" | docker compose --env-file "$env_file" -f "$root/BD/local/compose.yaml" exec -T postgres \
    sh -c 'psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "${vars[@]}"
fi
echo "Aplicado: $summary"
