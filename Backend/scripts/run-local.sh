#!/usr/bin/env bash
set -euo pipefail
backend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$backend_dir"
if [[ -z "${JAVA_HOME:-}" ]]; then
  java_compiler="$(command -v javac || true)"
  if [[ -z "$java_compiler" ]]; then
    echo "Falta javac de Linux: instalar JDK 21 en WSL." >&2
    exit 1
  fi
  export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$java_compiler")")")"
fi
export PATH="$JAVA_HOME/bin:$PATH"
# No source ni echo de secretos: Spring interpreta .env como properties.
# Perfil local conserva BD/local/.env y el rol runtime; no conecta JDBC remoto.
exec ./mvnw spring-boot:run   -Dspring-boot.run.profiles=local   '-Dspring-boot.run.arguments=--spring.config.additional-location=optional:file:./.env[.properties]'
