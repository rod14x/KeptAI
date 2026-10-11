#!/usr/bin/env bash
# Verificación LOCAL extremo a extremo del lado Spring de la conexión n8n (MIG-03-D3), con procesos PROPIOS y datos FICTICIOS:
#   PostgreSQL 17 DESECHABLE (Docker) con V1–V9 -> login runtime -> provisión de servicios con servicio-local.sh --apply ->
#   Spring propio en el puerto 8082 -> comprobación HTTP de /api/v1/ordenes/ingesta -> revocación y rotación -> limpieza.
# NO toca la base activa (5433), los servidores del usuario (8080/5173), Backend/.env ni ningún workflow/credencial real:
# las claves son aleatorias, viven en un directorio temporal 700 y se borran al terminar. No hay llamadas externas.
# Requiere Docker, JDK 21 y el intérprete de Backend/docs/tools/.venv. Uso: sg docker -c 'Backend/scripts/verificar-n8n-local.sh'
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
PORT="${E2E_N8N_PORT:-8082}"
py="$root/Backend/docs/tools/.venv/bin/python"
[[ -x "$py" ]] || { echo "Falta Backend/docs/tools/.venv (ejecute Backend/docs/tools/validate-openapi.sh una vez)." >&2; exit 1; }
if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then echo "El puerto $PORT está ocupado: no se toca. Use E2E_N8N_PORT." >&2; exit 4; fi
tmp="$(mktemp -d)"; chmod 700 "$tmp"
name="keptai-d3-$$"
dbpw="$(python3 -I -c 'import secrets;print(secrets.token_hex(16))')"
spring_pid=""
cleanup() {
  [[ -n "$spring_pid" ]] && kill -- "-$spring_pid" 2>/dev/null || true
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
echo "== PostgreSQL desechable ($name)"
docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=x -e POSTGRES_DB=k -p 127.0.0.1::5432 postgres:17-alpine >/dev/null
for _ in $(seq 1 40); do docker exec "$name" pg_isready -U postgres -d k >/dev/null 2>&1 && break; sleep 1; done
sleep 2
hostport="$(docker port "$name" 5432/tcp | head -1 | sed 's/.*://')"
psqlx=(docker exec -i "$name" psql -X -q -U postgres -d k)
{ echo "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA keptai; SET search_path=keptai,public;"
  while IFS= read -r f; do cat "$f"; echo; done < <(printf '%s\n' BD/migrations/V*.sql | sort -V)
  echo "CREATE ROLE keptai_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '$dbpw'; GRANT keptai_runtime TO keptai_app;"; } \
  | "${psqlx[@]}" -v ON_ERROR_STOP=1 >/dev/null
org="$("${psqlx[@]}" -t -A -v ON_ERROR_STOP=1 -c "INSERT INTO keptai.organizacion(nombre) VALUES ('Organizacion ficticia D3') RETURNING id" | head -1)"
echo "   migraciones V1–V9 aplicadas; organización ficticia creada"
export KEPTAI_PSQL_EXEC="docker exec -i $name psql -X -q -U postgres -d k"
gen=Backend/scripts/generar-clave-servicio.sh; svc=Backend/scripts/servicio-local.sh
for k in ing sch otra ing2; do "$gen" "$tmp/$k.key" >/dev/null; done
echo "== Provisión con servicio-local.sh (--apply sobre la base DESECHABLE)"
"$svc" alta --org-id "$org" --instancia isabel --alcance INGESTA --key-file "$tmp/ing.key" --apply > "$tmp/alta.log"
"$py" - "$tmp/alta.log" <<'PY'
import pathlib, re, sys
if re.search(r"(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])", pathlib.Path(sys.argv[1]).read_text()):
    sys.exit("FALLA: la provisión imprimió una clave o un hash completo.")
print("   salida de provisión sin claves ni hashes completos")
PY
tail -1 "$tmp/alta.log"
"$svc" alta --org-id "$org" --instancia isabel --alcance SCHEDULER --key-file "$tmp/sch.key" --apply | tail -1
"$svc" alta --org-id "$org" --instancia otra --alcance INGESTA --key-file "$tmp/otra.key" --apply | tail -1
dup=0; "$svc" alta --org-id "$org" --instancia isabel --alcance INGESTA --key-file "$tmp/ing2.key" --apply >/dev/null 2>&1 || dup=1
reuse=0; "$svc" alta --org-id "$org" --instancia otra2 --alcance INGESTA --key-file "$tmp/ing.key" --apply >/dev/null 2>&1 || reuse=1
noorg=0; "$svc" alta --org-id 99999999-9999-4999-8999-999999999999 --instancia x --alcance INGESTA --key-file "$tmp/ing2.key" --apply >/dev/null 2>&1 || noorg=1
echo "   duplicado (org+instancia+alcance) rechazado: $([[ $dup == 1 ]] && echo sí || echo NO) · clave reutilizada rechazada: $([[ $reuse == 1 ]] && echo sí || echo NO) · organización inexistente rechazada: $([[ $noorg == 1 ]] && echo sí || echo NO)"
[[ $dup == 1 && $reuse == 1 && $noorg == 1 ]] || { echo "FALLA: la provisión sobrescribió o aceptó algo indebido." >&2; exit 1; }
echo "== Spring propio en :$PORT (perfil local; base desechable; sin Backend/.env ni JWT)"
logf="$tmp/spring.log"
( cd Backend && KEPTAI_LOCAL_ENV=/nonexistent KEPTAI_DB_PORT="$hostport" KEPTAI_DB_NAME=k KEPTAI_RUNTIME_USER=keptai_app KEPTAI_RUNTIME_PASSWORD="$dbpw" PORT="$PORT" \
    setsid ./mvnw -B -o -q spring-boot:run -Dspring-boot.run.profiles=local > "$logf" 2>&1 & echo $! > "$tmp/pid" )
spring_pid="$(cat "$tmp/pid")"
up=0; for _ in $(seq 1 90); do sleep 2; curl -s -m2 "http://127.0.0.1:$PORT/actuator/health" | grep -q UP && { up=1; break; }; done
[[ $up == 1 ]] || { echo "FALLA: Spring no arrancó (log temporal descartado)." >&2; exit 1; }
base="http://127.0.0.1:$PORT"
echo "== Comprobación HTTP de /api/v1/ordenes/ingesta"
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --key-ingesta "$tmp/ing.key" --key-scheduler "$tmp/sch.key" --key-otra "$tmp/otra.key"
echo "== Sin persistencia (D-007): conteo de filas de negocio en la base desechable"
counts="$("${psqlx[@]}" -t -A -c "select (select count(*) from keptai.orden)+(select count(*) from keptai.orden_item)+(select count(*) from keptai.hoja_resumen)+(select count(*) from keptai.pago)+(select count(*) from keptai.comprobante)+(select count(*) from keptai.solicitud_idempotente)+(select count(*) from keptai.evento_auditoria)+(select count(*) from keptai.envio_notificacion)+(select count(*) from keptai.canal_whatsapp)")"
echo "   filas en orden/orden_item/hoja_resumen/pago/comprobante/solicitud_idempotente/evento_auditoria/envio_notificacion/canal_whatsapp: $counts"
[[ "$counts" == "0" ]] || { echo "FALLA: la recepción dejó filas." >&2; exit 1; }
if grep -q "TRANSCRIPT_FICTICIO_D3" "$logf"; then echo "FALLA: el transcript apareció en el log de Spring." >&2; exit 1; fi
echo "   el log de Spring no contiene el transcript ficticio"
echo "== Rotación y revocación (servicio-local.sh)"
sid="$("${psqlx[@]}" -t -A -c "select id from keptai.integracion_servicio where instancia='isabel' and alcance='INGESTA'" | head -1)"
"$svc" rotar --org-id "$org" --servicio-id "$sid" --old-key-file "$tmp/ing.key" --new-key-file "$tmp/ing2.key" --apply | tail -1
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --solo-estado "$tmp/ing.key" --esperar 401
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --solo-estado "$tmp/ing2.key" --esperar 200
"$svc" revocar --org-id "$org" --servicio-id "$sid" --apply | tail -1
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --solo-estado "$tmp/ing2.key" --esperar 401
echo "== Listado sin secretos"; "$svc" listar --org-id "$org" --apply
echo; echo "VERIFICACIÓN LOCAL D3 COMPLETA (base desechable, procesos propios, datos ficticios; no es n8n real)."
