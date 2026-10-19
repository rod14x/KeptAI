#!/bin/sh
set -e

echo "[KeptAI] Iniciando contenedor All-in-One..."

# Puerto interno del backend
export PORT=8080
export SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE:-dev}

# Proteccion: Si se activa prod pero falta la URL de base de datos, advertir y usar dev para no tumbar el contenedor
if [ "$SPRING_PROFILES_ACTIVE" = "prod" ] && [ -z "$SPRING_DATASOURCE_URL" ]; then
    echo "[KeptAI] ALERTA: SPRING_PROFILES_ACTIVE=prod pero falta SPRING_DATASOURCE_URL."
    echo "[KeptAI] Cambiando a perfil dev temporalmente para mantener el contenedor y Nginx activos..."
    export SPRING_PROFILES_ACTIVE=dev
fi

echo "[KeptAI] Iniciando Backend Spring Boot (Perfil: ${SPRING_PROFILES_ACTIVE}) en puerto 8080..."
java -jar /app/app.jar &
BACKEND_PID=$!

echo "[KeptAI] Iniciando Nginx en puerto 80..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Manejo de señales para parada limpia
trap "kill -TERM $BACKEND_PID $NGINX_PID" SIGTERM SIGINT

wait -n $BACKEND_PID $NGINX_PID