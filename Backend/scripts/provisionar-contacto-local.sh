#!/usr/bin/env bash
# Provisión LOCAL (demo o inicial) de un CLIENTE y su CONTACTO de WhatsApp para la entrada n8n (V10). Parametrizada:
# - Vista previa por defecto; escribe en PostgreSQL únicamente con --apply, y solo en la base LOCAL (BD/local) o la indicada con
#   KEPTAI_PSQL_EXEC. Nunca se ejecuta al arrancar la aplicación ni en producción.
# - Organización EXISTENTE (--org-id o --org-nombre con exactamente una coincidencia). No crea organizaciones, vendedores, usuarios
#   de Auth, servicios ni pedidos. No inventa RUC, marca, crédito ni correo.
# - Reejecutar no duplica ni modifica: un cliente o un contacto igual se reutiliza; si ya existe uno DISTINTO (otro tipo, otro cliente,
#   otro nombre, inactivo) falla en vez de sobrescribir en silencio.
# - El teléfono se normaliza al JID canónico <dígitos con prefijo de país>@s.whatsapp.net (8 a 15 dígitos). Se muestra enmascarado.
# Uso:
#   provisionar-contacto-local.sh (--org-id <uuid> | --org-nombre <nombre>) --cliente-razon-social <texto> [--cliente-tipo EMPRESA|COLEGIO|PERSONA] \
#       --contacto-nombre <texto> --telefono "+51 ..." [--apply]
# Antes de aplicar a la base local activa debe estar migrada a V10 (la imagen Docker NO migra la base al arrancar).
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
org_id=""; org_nombre=""; cli=""; tipo="EMPRESA"; cn=""; tel=""; apply=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --org-id) org_id="${2:-}"; shift 2;;
    --org-nombre) org_nombre="${2:-}"; shift 2;;
    --cliente-razon-social) cli="${2:-}"; shift 2;;
    --cliente-tipo) tipo="${2:-}"; shift 2;;
    --contacto-nombre) cn="${2:-}"; shift 2;;
    --telefono) tel="${2:-}"; shift 2;;
    --apply) apply=1; shift;;
    *) echo "Argumento desconocido: $1" >&2; exit 2;;
  esac
done
die() { echo "$*" >&2; exit 2; }
uuid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
if [[ -n "$org_id" ]]; then
  [[ "$org_id" =~ $uuid && -z "$org_nombre" ]] || die "Use --org-id (UUID) o --org-nombre, no ambos."
else
  [[ -n "$org_nombre" ]] || die "Falta --org-id o --org-nombre (organización existente)."
fi
[[ -n "$cli" && -n "$cn" ]] || die "Faltan --cliente-razon-social y --contacto-nombre."
[[ "$tipo" =~ ^(EMPRESA|COLEGIO|PERSONA)$ ]] || die "--cliente-tipo debe ser EMPRESA, COLEGIO o PERSONA."
jid="$(python3 -I - "$tel" <<'PY'
import re, sys
raw = sys.argv[1].strip()
if not re.fullmatch(r"\+?[0-9 ()\-]+", raw):
    sys.exit("--telefono solo admite dígitos, espacios, guiones, paréntesis y un + inicial.")
digits = re.sub(r"\D", "", raw)
if not 8 <= len(digits) <= 15:
    sys.exit("--telefono debe incluir el prefijo de país y tener entre 8 y 15 dígitos.")
print(digits + "@s.whatsapp.net")
PY
)" || exit 2
sql=$(cat <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = keptai, public;
SELECT set_config('keptai_ct.org_id', :'org_id', true), set_config('keptai_ct.org_nombre', :'org_nombre', true),
       set_config('keptai_ct.cli', :'cli', true), set_config('keptai_ct.tipo', :'tipo', true),
       set_config('keptai_ct.cn', :'cn', true), set_config('keptai_ct.jid', :'jid', true)
\g /dev/null
DO $$
DECLARE org uuid; cid uuid; n int; k record;
BEGIN
  IF current_setting('keptai_ct.org_id') <> '' THEN
    org := current_setting('keptai_ct.org_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM organizacion WHERE id = org) THEN RAISE EXCEPTION 'La organización indicada no existe: no se crea.'; END IF;
  ELSE
    SELECT count(*) INTO n FROM organizacion WHERE nombre = current_setting('keptai_ct.org_nombre');
    IF n <> 1 THEN RAISE EXCEPTION 'Se esperaba exactamente una organización con ese nombre y hay %: use --org-id.', n; END IF;
    SELECT id INTO org FROM organizacion WHERE nombre = current_setting('keptai_ct.org_nombre');
  END IF;
  -- Serializar las provisiones de una organización: dos altas simultáneas no duplican el cliente.
  PERFORM pg_advisory_xact_lock(hashtextextended('PROVISION_CONTACTO:' || org::text, 0));
  SELECT count(*) INTO n FROM cliente WHERE organizacion_id = org AND razon_social = current_setting('keptai_ct.cli');
  IF n > 1 THEN RAISE EXCEPTION 'Hay % clientes con esa razón social: resolver manualmente.', n; END IF;
  IF n = 1 THEN
    SELECT id, tipo INTO k FROM cliente WHERE organizacion_id = org AND razon_social = current_setting('keptai_ct.cli');
    IF k.tipo <> current_setting('keptai_ct.tipo') THEN RAISE EXCEPTION 'El cliente existe con otro tipo (%): no se modifica.', k.tipo; END IF;
    cid := k.id;
  ELSE
    INSERT INTO cliente (organizacion_id, razon_social, tipo) VALUES (org, current_setting('keptai_ct.cli'), current_setting('keptai_ct.tipo')) RETURNING id INTO cid;
  END IF;
  SELECT id, cliente_id, nombre, activo INTO k FROM contacto WHERE organizacion_id = org AND whatsapp_jid = current_setting('keptai_ct.jid');
  IF FOUND THEN
    IF k.cliente_id <> cid OR k.nombre <> current_setting('keptai_ct.cn') OR NOT k.activo THEN
      RAISE EXCEPTION 'Ya existe un contacto con ese JID y datos distintos (otro cliente, otro nombre o inactivo): no se modifica.';
    END IF;
  ELSE
    INSERT INTO contacto (organizacion_id, cliente_id, nombre, whatsapp_jid) VALUES (org, cid, current_setting('keptai_ct.cn'), current_setting('keptai_ct.jid'));
  END IF;
  PERFORM set_config('keptai_ct.res_org', org::text, true);
  PERFORM set_config('keptai_ct.res_cliente', cid::text, true);
END $$;
SELECT current_setting('keptai_ct.res_org') AS organizacion_id, cl.id AS cliente_id, cl.razon_social, cl.tipo,
       c.id AS contacto_id, c.nombre AS contacto, left(c.whatsapp_jid, 4) || '…' || right(c.whatsapp_jid, 18) AS jid_enmascarado, c.activo
  FROM contacto c JOIN cliente cl ON cl.organizacion_id = c.organizacion_id AND cl.id = c.cliente_id
 WHERE c.organizacion_id = current_setting('keptai_ct.res_org')::uuid AND c.whatsapp_jid = :'jid';
COMMIT;
SQL
)
vars=(-v "org_id=$org_id" -v "org_nombre=$org_nombre" -v "cli=$cli" -v "tipo=$tipo" -v "cn=$cn" -v "jid=$jid")
resumen="cliente='$cli' tipo=$tipo contacto='$cn' jid=${jid:0:4}…${jid: -18} org=${org_id:-$org_nombre}"
if [[ $apply -eq 0 ]]; then
  echo "-- VISTA PREVIA: no se tocó ninguna base. $resumen"
  echo "$sql"
  echo "-- Para ejecutarlo en el PostgreSQL LOCAL (ya migrado a V10), repita el comando con --apply."
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
echo "Aplicado: $resumen"
