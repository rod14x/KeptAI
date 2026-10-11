#!/usr/bin/env bash
# Valida Backend/docs/openapi.yaml (OpenAPI 3.1): esquema de la especificacion, $ref, ejemplos contra sus esquemas
# y reglas del contrato. Crea un entorno virtual local ignorado por Git (docs/tools/.venv); no instala nada global.
set -euo pipefail
cd "$(dirname "$0")"
VENV=".venv"
if [ ! -x "$VENV/bin/python" ]; then
  if ! python3 -m venv "$VENV" 2>/dev/null; then
    # Ubuntu sin python3-venv/ensurepip: venv sin pip + bootstrap oficial de pip (requiere red).
    rm -rf "$VENV"
    python3 -m venv --without-pip "$VENV"
    TMP="$(mktemp -d)"
    curl -fsSL -o "$TMP/get-pip.py" https://bootstrap.pypa.io/pip/get-pip.py
    "$VENV/bin/python" -I "$TMP/get-pip.py" -q
    rm -rf "$TMP"
  fi
fi
"$VENV/bin/python" -m pip install -q -r requirements.txt
exec "$VENV/bin/python" -I validate_openapi.py "${1:-../openapi.yaml}"
