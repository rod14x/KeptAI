#!/usr/bin/env bash
set -euo pipefail
task_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
task_env="$task_dir/.env"
command_name="${1:-help}"
init_env() {
 python3 - "$task_dir" <<'PY'
from pathlib import Path
import secrets, sys
p=Path(sys.argv[1])
target=p/".env"
if not target.exists():
    content=(p/".env.example").read_text()
    content=content.replace("CAMBIAR_PASSWORD_LOCAL_MIGRADOR", secrets.token_urlsafe(32))
    content=content.replace("CAMBIAR_PASSWORD_LOCAL_APP", secrets.token_urlsafe(32))
    with target.open("x") as f:
        f.write(content)
    target.chmod(0o600)
    print(".env local creado; claves no mostradas.")
else:
    print(".env local existente conservado.")
PY
}
compose() { docker compose --env-file "$task_env" -f "$task_dir/compose.yaml" "$@"; }
case "$command_name" in
 init) init_env ;;
 up) init_env; compose up -d --wait postgres ;;
 migrate)
  [[ -f "$task_env" ]] || { echo "Primero: ./BD/local/db.sh up"; exit 1; }
  compose run --rm flyway migrate
  { printf "%s\n" "SELECT set_config('keptai.local_runtime_user', :'runtime_user', false);"; cat "$task_dir/provisionar-runtime.sql"; } | \
   compose exec -T postgres sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v runtime_user="$KEPTAI_RUNTIME_USER" -v runtime_password="$KEPTAI_RUNTIME_PASSWORD"'
  ;;
 status) compose ps; compose run --rm flyway info ;;
 validate) compose run --rm flyway validate ;;
 psql) compose exec postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB"' ;;
 app-psql) compose exec postgres sh -c 'PGPASSWORD="$KEPTAI_RUNTIME_PASSWORD" psql -X -h 127.0.0.1 -U "$KEPTAI_RUNTIME_USER" -d "$POSTGRES_DB"' ;;
 down) compose down ;; # conserva volumen/datos
 *) echo "Uso: ./BD/local/db.sh {init|up|migrate|status|validate|psql|app-psql|down}";;
esac
