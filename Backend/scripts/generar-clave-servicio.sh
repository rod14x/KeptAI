#!/usr/bin/env bash
# Genera una clave tecnica aleatoria (256 bits) para un servicio n8n y calcula su hash SHA-256.
# La clave se escribe SOLO en el archivo indicado (permisos 600, fuera de Git); por pantalla sale unicamente
# el hash (no secreto). No se conecta a ninguna base de datos ni imprime la clave.
# Uso: Backend/scripts/generar-clave-servicio.sh <archivo-destino-fuera-del-repo>
set -euo pipefail
destino="${1:-}"
if [[ -z "$destino" ]]; then echo "Uso: $0 <archivo-destino-fuera-del-repo>" >&2; exit 2; fi
if [[ -e "$destino" ]]; then echo "Ya existe $destino; no se sobrescribe." >&2; exit 1; fi
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || true)"
absoluto="$(cd -- "$(dirname -- "$destino")" && pwd -P)/$(basename -- "$destino")"
if [[ -n "$repo" && "$absoluto" == "$repo"/* ]]; then echo "El destino debe estar fuera del repositorio." >&2; exit 1; fi
umask 077
python3 -I - "$absoluto" <<'PY'
import hashlib, secrets, sys
clave = secrets.token_hex(32)  # 64 caracteres hex = 256 bits; cumple 32..128 caracteres visibles
with open(sys.argv[1], "x") as f:
    f.write(clave)
print("hash_sha256=" + hashlib.sha256(clave.encode("utf-8")).hexdigest())
PY
chmod 600 "$destino"
echo "Clave guardada en $destino (no mostrada). Use ese archivo para configurar n8n; en la base solo va el hash."
