# Despliegue del backend completo — 11/10/2026

Estado: backend MVP verificado localmente; no desplegado. Rama de entrega backend-partefinal. Incluye Auth, ingesta/contacto, vouchers privados, revisión ADMIN, crédito ADMIN (D-014), motores financieros y consultas/reportes. Evidencia detallada en entrega-backend-final-local.md y plan-cierre-backend.md.

## Imagen Docker

Desde la raíz del repo:

```sh
docker build -t keptai-backend:predeploy -f Backend/Dockerfile Backend
sg docker -c 'python3 -B Backend/scripts/verificar-docker-local.py --image keptai-backend:predeploy'
```

Dockerfile de dos etapas JDK/JRE21, perfil prod y usuario10001. El contexto permite solamente wrapper/pom/src/main; secretos, pruebas, .env y artefactos locales no entran en la imagen. Las357 pruebas se ejecutan aparte. Build Docker y humo prod comprobados: healthUP, runtime sin bypass en PostgreSQL desechable con V1–V14, ambas rutas n8n devuelven401 sin clave/desconocida y400 con clave válida/cuerpo incompleto, /me sin JWT401, ninguna fila de negocio creada. Imagen funciona con raíz de solo lectura, /tmp temporal, capabilities retiradas y no-new-privileges. Recursos temporales eliminados.

## Ejecución mediante Compose en un servidor propio

La imagen contiene todo Spring. Supabase Auth/PostgreSQL/Storage son servicios externos y el frontend se despliega por separado.

```sh
cp Backend/deploy/.env.example Backend/deploy/.env.production
chmod 600 Backend/deploy/.env.production
# Completar el archivo privado con los valores reales del destino.
docker compose --env-file Backend/deploy/.env.production -f Backend/compose.yaml config --quiet
docker compose --env-file Backend/deploy/.env.production -f Backend/compose.yaml up -d --build
```

Compose publica en127.0.0.1:8080 para el proxy HTTPS del mismo servidor. BACKEND_HTTP_PORT permite elegir otro puerto libre. No ejecutar estos comandos sobre los procesos locales existentes por accidente. Health: /actuator/health. Para parar esta instalación: mismo comando Compose con down. No mostrar `config` sin --quiet porque interpolaría secretos.

## Servicio Docker en hosting

Usar Backend/ como contexto/root, Dockerfile dentro de ese directorio, perfil prod, PORT configurado por el hosting y health /actuator/health. Elegir el commit publicado de backend-partefinal para esta entrega. Main tiene cambios de otros miembros: no asumir que publicar esta rama modifica main ni usar una imagen anterior. El hosting construye Dockerfile; Compose es opcional para servidor propio.

## Variables del backend

Consultar Backend/deploy/.env.example. JDBC apunta a la base remota con currentSchema=keptai y SSL; nunca localhost de WSL. Usuario/password corresponden al login runtime NOSUPERUSER/NOBYPASSRLS, no owner/postgres/migrador. Issuer/JWKS/audiencia corresponden al proyecto Supabase Auth. SUPABASE_SECRET_KEY solo vive en el servidor; SUPABASE_STORAGE_BUCKET debe ser privado. CORS contiene el origen del navegador; n8n servidor se autentica con X-Api-Key y no con CORS.

La API key de Isabella se autentica por hash en integracion_servicio de la base destino. No se configura como clave global de Spring ni se incorpora a la imagen. Provisionar organización/instancia isabel/alcance INGESTA mediante el procedimiento de provision-servicios-local.md y entregar la clave por canal privado.

## Migraciones antes del arranque de negocio

Flyway permanece desactivado y Hibernate usa validate: la imagen no cambia el esquema. Aplicar migraciones por separado con rol migrador después de leer keptai.flyway_schema_history remoto. Código local requiere V1–V14.

Al revisar origin/main418dc65 se confirmó que el equipo ya conserva V10 contacto y V11 obligación de crédito. Esta entrega usa V10/V11 exactamente iguales a main, evitando diferencias de checksum. Esto resuelve la divergencia de numeración del código; no acredita qué migraciones están aplicadas en Supabase. V12 revisión de borradores, V13 metadatos privados y V14 crédito ADMIN son nuevas de esta entrega. No hacer repair ni editar históricos aplicados.

Registrar las membresías/contactos autorizados en destino; no copiar UUID locales ni ejecutar semilla demo en prod automáticamente. Para volver a una imagen previa, revisar primero compatibilidad con el esquema; nunca borrar tablas como rollback.

## Dominio y aceptación pública

Destino solicitado: https://keptai.ejesxyz.com. El DNS debe apuntar al hosting/proxy elegido; un registro A existente no acredita que Spring esté desplegado. Configurar TLS y proxy /api/v1/* y /actuator/health al backend; si el frontend comparte dominio, sus rutas SPA deben quedar en el frontend. El proxy debe admitir el JSON con Base64 (al menos15MiB), sin registrar cuerpos ni credenciales.

Antes de entregar a Isabella:

1. Health HTTPS200UP y /api/v1/me sin token401; JWT real devuelve identidad esperada.
2. Ambas rutas n8n sin clave/desconocida401; clave del destino con {} devuelve400.
3. WF1/WF2 originales crean BORRADOR/RECIBIDO y el replay no duplica filas ni archivos. Voucher original descargable solo por enlace autorizado, bytes/hash iguales.
4. Recorrido frontend: corrección/confirmación ADMIN, crédito ADMIN, verificación ADMIN A y aplicación ADMIN B, despacho/consultas/reportes.
5. Aislamiento entre organizaciones y retención n8n sin chats/transcript. No cerrar MIG-03-D3/MIG-05/MIG-08 globales hasta acreditar estos pasos.

Entrega a Isabella: URL base, POST /api/v1/ordenes/ingesta y POST /api/v1/pagos/voucher, instancia isabel, X-Api-Key en credencial privada y Content-Type application/json. Enviar un objeto, no array; WF2 exige mensajeId estable, chatId/clienteJid y imagen_base64 completa. Confirmación WhatsApp y callback SCHEDULER siguen cerrados; aprobación humana ocurre en panel.
