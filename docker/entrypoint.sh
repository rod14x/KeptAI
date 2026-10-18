#!/bin/sh
set -e

echo "[KeptAI] Iniciando contenedor All-in-One..."

# Puerto interno del backend
export PORT=8080
export SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE:-dev}

echo "[KeptAI] Iniciando Backend Spring Boot (Perfil: ${SPRING_PROFILES_ACTIVE}) en puerto 8080..."
java -jar /app/app.jar &
BACKEND_PID=$!

echo "[KeptAI] Iniciando Nginx en puerto 80..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Manejo de señales para parada limpia
trap "kill -TERM $BACKEND_PID $NGINX_PID" SIGTERM SIGINT

wait -n $BACKEND_PID $NGINX_PID