#!/usr/bin/env bash
# Verificación LOCAL extremo a extremo del lado Spring de la conexión n8n (MIG-03-D3 + MIG-04/05), con procesos PROPIOS y datos FICTICIOS:
#   PostgreSQL 17 DESECHABLE (Docker) con V1–V9 -> login runtime -> provisión de servicios con servicio-local.sh --apply ->
#   Storage SIMULADO (storage_simulado.py, no es Supabase) -> Spring propio en el puerto 8082 -> comprobación HTTP de /api/v1/ordenes/ingesta
#   y /api/v1/pagos/voucher -> caída del Storage -> revocación y rotación -> limpieza.
# NO toca la base activa (5433), los servidores del usuario (8080/5173), Backend/.env ni ningún workflow/credencial real:
# las claves son aleatorias, viven en un directorio temporal 700 y se borran al terminar. No hay llamadas externas.
# Requiere Docker, JDK 21 y el intérprete de Backend/docs/tools/.venv. Uso: sg docker -c 'Backend/scripts/verificar-n8n-local.sh'
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
PORT="${E2E_N8N_PORT:-8082}"
SPORT="${E2E_N8N_STORAGE_PORT:-8083}"
py="$root/Backend/docs/tools/.venv/bin/python"
[[ -x "$py" ]] || { echo "Falta Backend/docs/tools/.venv (ejecute Backend/docs/tools/validate-openapi.sh una vez)." >&2; exit 1; }
for p in "$PORT" "$SPORT"; do if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then echo "El puerto $p está ocupado: no se toca. Use E2E_N8N_PORT / E2E_N8N_STORAGE_PORT." >&2; exit 4; fi; done
tmp="$(mktemp -d)"; chmod 700 "$tmp"
name="keptai-d3-$$"
dbpw="$(python3 -I -c 'import secrets;print(secrets.token_hex(16))')"
spring_pid=""
storage_pid=""
cleanup() {
  [[ -n "$spring_pid" ]] && kill -- "-$spring_pid" 2>/dev/null || true
  [[ -n "$storage_pid" ]] && kill -- "-$storage_pid" 2>/dev/null || true
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
echo "== PostgreSQL desechable ($name)"
docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=x -e POSTGRES_DB=k -p 127.0.0.1::5432 postgres:17-alpine >/dev/null
# El entrypoint arranca un servidor temporal, lo detiene y arranca el definitivo: se exigen 3 consultas reales seguidas.
ok=0; for _ in $(seq 1 90); do
  if docker exec "$name" psql -X -q -U postgres -d k -c 'select 1' >/dev/null 2>&1; then ok=$((ok+1)); [[ $ok -ge 3 ]] && break; else ok=0; fi
  sleep 1
done
[[ $ok -ge 3 ]] || { echo "FALLA: PostgreSQL desechable no quedó disponible." >&2; exit 1; }
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
echo "== Contacto registrado con provisionar-contacto-local.sh (--apply sobre la base DESECHABLE; datos ficticios)"
pct=Backend/scripts/provisionar-contacto-local.sh
"$pct" --org-id "$org" --cliente-razon-social "Cloud Technologies" --contacto-nombre "Andrés" --telefono "+51 900 000 001" --apply | tail -1
"$pct" --org-id "$org" --cliente-razon-social "Cloud Technologies" --contacto-nombre "Andrés" --telefono "+51 900 000 001" --apply >/dev/null   # reejecución idempotente
conflicto=0; "$pct" --org-id "$org" --cliente-razon-social "Cloud Technologies" --contacto-nombre "Otro nombre" --telefono "+51 900 000 001" --apply >/dev/null 2>&1 || conflicto=1
tipo=0; "$pct" --org-id "$org" --cliente-razon-social "Cloud Technologies" --cliente-tipo PERSONA --contacto-nombre "Andrés" --telefono "+51 900 000 001" --apply >/dev/null 2>&1 || tipo=1
cuenta="$("${psqlx[@]}" -t -A -c "select (select count(*) from keptai.cliente)||','||(select count(*) from keptai.contacto)")"
echo "   reejecución sin duplicar (clientes,contactos = $cuenta, esperado 1,1) · datos distintos rechazados: nombre $([[ $conflicto == 1 ]] && echo sí || echo NO), tipo $([[ $tipo == 1 ]] && echo sí || echo NO)"
[[ "$cuenta" == "1,1" && $conflicto == 1 && $tipo == 1 ]] || { echo "FALLA: la provisión de contacto duplicó o sobrescribió." >&2; exit 1; }
echo "== Storage SIMULADO en :$SPORT (storage_simulado.py; no es Supabase)"
skey="sb_secret_$(python3 -I -c 'import secrets;print(secrets.token_hex(24))')"
# Cada proceso propio arranca en su propia sesión y escribe SU pid (= id de grupo) antes de exec: la limpieza lo termina entero.
( STORAGE_SIM_KEY="$skey" setsid bash -c 'echo $$ > "$0"; exec python3 -I Backend/scripts/storage_simulado.py "$1"' "$tmp/spid" "$SPORT" > /dev/null 2>&1 & )
for _ in $(seq 1 20); do [[ -s "$tmp/spid" ]] && break; sleep 0.2; done
storage_pid="$(cat "$tmp/spid")"
for _ in $(seq 1 20); do curl -s -m1 "http://127.0.0.1:$SPORT/_objetos" >/dev/null 2>&1 && break; sleep 0.5; done
echo "== Spring propio en :$PORT (perfil local; base desechable; Storage simulado; sin Backend/.env ni JWT)"
logf="$tmp/spring.log"
( cd Backend && KEPTAI_LOCAL_ENV=/nonexistent KEPTAI_DB_PORT="$hostport" KEPTAI_DB_NAME=k KEPTAI_RUNTIME_USER=keptai_app KEPTAI_RUNTIME_PASSWORD="$dbpw" PORT="$PORT" SUPABASE_URL="http://127.0.0.1:$SPORT" SUPABASE_SECRET_KEY="$skey" SUPABASE_STORAGE_BUCKET=keptai-vouchers \
    setsid bash -c 'echo $$ > "$0"; exec ./mvnw -B -o -q spring-boot:run -Dspring-boot.run.profiles=local' "$tmp/pid" > "$logf" 2>&1 & )
for _ in $(seq 1 20); do [[ -s "$tmp/pid" ]] && break; sleep 0.2; done
spring_pid="$(cat "$tmp/pid")"
up=0; for _ in $(seq 1 90); do sleep 2; curl -s -m2 "http://127.0.0.1:$PORT/actuator/health" | grep -q UP && { up=1; break; }; done
[[ $up == 1 ]] || { echo "FALLA: Spring no arrancó (log temporal descartado)." >&2; exit 1; }
base="http://127.0.0.1:$PORT"
echo "== Comprobación HTTP de /api/v1/ordenes/ingesta y /api/v1/pagos/voucher"
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --key-ingesta "$tmp/ing.key" --key-scheduler "$tmp/sch.key" --key-otra "$tmp/otra.key" --storage-url "http://127.0.0.1:$SPORT"
echo "== Persistencia permitida y nada sensible (D-007)"
q() { "${psqlx[@]}" -t -A -c "$1"; }
fila="$(q "select (select count(*) from keptai.orden)||','||(select count(*) from keptai.hoja_resumen)||','||(select count(*) from keptai.orden where estado<>'BORRADOR')||','||(select count(*) from keptai.pago)||','||(select count(*) from keptai.comprobante)||','||(select count(*) from keptai.aplicacion_pago)||','||(select count(*) from keptai.pago where fase<>'RECIBIDO' or verificado_por is not null)")"
echo "   orden,hoja,orden_no_borrador,pago,comprobante,aplicaciones,pagos_no_recibidos = $fila (esperado 1,1,0,1,1,0,0)"
asoc="$(q "select (o.cliente_id = cl.id)||','||(p.orden_contexto_id = o.id)||','||(p.cliente_id = cl.id)||','||(cl.razon_social = 'Cloud Technologies') from keptai.pago p join keptai.orden o on o.organizacion_id=p.organizacion_id and o.id=p.orden_contexto_id join keptai.cliente cl on cl.organizacion_id=o.organizacion_id and cl.id=o.cliente_id")"
echo "   cliente del pedido = cliente del contacto, pago asociado por contexto al pedido, razón social real: $asoc (esperado true,true,true,true)"
[[ "$asoc" == "true,true,true,true" ]] || { echo "FALLA: la asociación pedido/pago/contacto es incoherente." >&2; exit 1; }
[[ "$fila" == "1,1,0,1,1,0,0" ]] || { echo "FALLA: filas inesperadas tras la comprobación." >&2; exit 1; }
volcado="$(q "select coalesce((select string_agg(t::text,' ') from keptai.hoja_resumen t),'')||coalesce((select string_agg(t::text,' ') from keptai.orden t),'')||coalesce((select string_agg(t::text,' ') from keptai.solicitud_idempotente t),'')||coalesce((select string_agg(t::text,' ') from keptai.evento_auditoria t),'')||coalesce((select string_agg(t::text,' ') from keptai.canal_whatsapp t),'')||coalesce((select string_agg(t::text,' ') from keptai.pago t),'')||coalesce((select string_agg(t::text,' ') from keptai.comprobante t),'')")"
imagen="$(python3 -I -c 'import json;print(json.load(open("Backend/docs/ejemplos/wf2-voucher-ficticio.json"))["imagen_base64"])')"
for marca in TRANSCRIPT_FICTICIO_D3 HOJA_ENTRANTE_FICTICIA CRUDO_FICTICIO "${imagen:0:40}"; do
  if [[ "$volcado" == *"$marca"* ]] || grep -q "$marca" "$logf"; then echo "FALLA: contenido sensible ($marca) en la base o en el log de Spring." >&2; exit 1; fi
done
echo "   ni la base ni el log de Spring contienen transcript, hoja entrante, crudo ni Base64"
cobj="$(q "select archivo_storage_path||' '||archivo_hash from keptai.comprobante")"
sobj="$(curl -s "http://127.0.0.1:$SPORT/_objetos" | python3 -I -c 'import json,sys;d=json.load(sys.stdin);print(" ".join(p+" "+v["sha256"] for p,v in d.items()))')"
[[ "$cobj" == "$sobj" ]] || { echo "FALLA: el comprobante no coincide con el objeto del Storage (ruta/hash)." >&2; exit 1; }
echo "   la ruta y el SHA-256 del comprobante coinciden con el objeto en el Storage simulado"
echo "== Storage caído: el voucher responde 503 y no deja filas ni referencias"
kill -- "-$storage_pid" 2>/dev/null || true; storage_pid=""; sleep 1
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --fase storage-caido --key-ingesta "$tmp/ing.key"
[[ "$(q 'select count(*) from keptai.pago')" == "1" && "$(q 'select count(*) from keptai.comprobante')" == "1" ]] || { echo "FALLA: el fallo de Storage dejó filas." >&2; exit 1; }
echo "== Rotación y revocación (servicio-local.sh)"
sid="$("${psqlx[@]}" -t -A -c "select id from keptai.integracion_servicio where instancia='isabel' and alcance='INGESTA'" | head -1)"
"$svc" rotar --org-id "$org" --servicio-id "$sid" --old-key-file "$tmp/ing.key" --new-key-file "$tmp/ing2.key" --apply | tail -1
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --solo-estado "$tmp/ing.key" --esperar 401
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --solo-estado "$tmp/ing2.key" --esperar 201
"$svc" revocar --org-id "$org" --servicio-id "$sid" --apply | tail -1
"$py" Backend/scripts/verificar-ingesta-local.py --base-url "$base" --instancia isabel --solo-estado "$tmp/ing2.key" --esperar 401
echo "== Listado sin secretos"; "$svc" listar --org-id "$org" --apply
echo; echo "VERIFICACIÓN LOCAL D3 COMPLETA (base desechable, procesos propios, datos ficticios; no es n8n real)."
