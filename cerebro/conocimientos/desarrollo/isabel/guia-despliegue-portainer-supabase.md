# Guía de Despliegue en Portainer y Conexión con Supabase

> **Documento de Infraestructura y Operaciones**  
> **Autora:** Isabel  
> **Fecha:** 19 de octubre de 2026  
> **Proyecto:** KeptAI / Corpotex  

---

## 1. Arquitectura del Contenedor All-in-One

KeptAI se despliega mediante una imagen única que agrupa Nginx y Spring Boot para simplificar la gestión en Portainer:

```text
[ Internet / Let's Encrypt SSL ]
               │
               ▼
   [ VPS: Nginx Reverse Proxy ]
               │
               ▼
[ Contenedor Docker: keptai ]
  ├── Nginx (Puerto 80)
  │     ├── SPA React / Vite (Archivos estáticos en /usr/share/nginx/html)
  │     └── Proxy inverso hacia http://127.0.0.1:8080 para /api/ y /actuator/
  └── Backend Spring Boot (Puerto 8080, Java 21)
        ├── Endpoints REST de Clientes, Órdenes, Fichas y Taller
        └── Conexión JDBC a PostgreSQL (Supabase)
```

---

## 2. Diagnóstico: ¿Por qué en Portainer salía "Datos Demo todo el rato"?

Si levantaste el contenedor y la aplicación siempre mostraba la etiqueta `[Demo]` y datos simulados, se debió a dos razones técnicas:

1. **Vite compila las variables en Build Time (no en Runtime):**  
   En aplicaciones React compiladas con Vite, las variables `VITE_*` no se leen del sistema operativo mientras corre el contenedor; se incrustan físicamente en el código JavaScript cuando se ejecuta `npm run build`.  
   Al faltar los `args` en `compose.yaml`, Docker construyó la imagen con el valor por defecto: `VITE_API_MODE="mock"`. En este modo, el frontend ignora la red y carga datos de prueba desde el `localStorage` del navegador.
2. **Spring Boot en perfil `dev` desactiva la base de datos:**  
   En `application-dev.yml`, Spring Boot excluye `DataSourceAutoConfiguration` para permitir arrancar en local sin base de datos. Para que consulte a Supabase, debe correr en perfil `prod` y recibir `SPRING_DATASOURCE_URL`.

---

## 3. Corrección Aplicada en `compose.yaml`

Se configuraron los argumentos de construcción y las variables de conexión en `compose.yaml` y `docker-compose.yml`:

```yaml
name: keptai
services:
  keptai:
    container_name: keptai
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_API_MODE: ${VITE_API_MODE:-mock}
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:-}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY:-}
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-}
    pull_policy: build
    restart: unless-stopped
    ports:
      - "${PORT:-8086}:80"
    environment:
      - SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE:-dev}
      - SPRING_DATASOURCE_URL=${SPRING_DATASOURCE_URL:-}
      - SPRING_DATASOURCE_USERNAME=${SPRING_DATASOURCE_USERNAME:-}
      - SPRING_DATASOURCE_PASSWORD=${SPRING_DATASOURCE_PASSWORD:-}
      - VIRTUAL_HOST=${VIRTUAL_HOST:-}
      - VIRTUAL_PORT=80
      - LETSENCRYPT_HOST=${LETSENCRYPT_HOST:-}
      - LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-}
      - SUPABASE_URL=${SUPABASE_URL:-}
      - SUPABASE_STORAGE_BUCKET=${SUPABASE_STORAGE_BUCKET:-keptai-vouchers}
      - SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY:-}
      - KEPTAI_JWT_ISSUER_URI=${KEPTAI_JWT_ISSUER_URI:-}
      - KEPTAI_JWT_JWK_SET_URI=${KEPTAI_JWT_JWK_SET_URI:-}
      - KEPTAI_JWT_AUDIENCES=${KEPTAI_JWT_AUDIENCES:-authenticated}
      - KEPTAI_CORS_ALLOWED_ORIGINS=${KEPTAI_CORS_ALLOWED_ORIGINS:-}
    networks:
      - default
      - public

networks:
  public:
    external: true
```

---

## 4. Guía de Despliegue en Portainer

### Modo A: Conexión Real con Supabase (Sin Datos Demo)

1. **Ejecutar migraciones en Supabase:**
   - En tu proyecto de Supabase, entra a **SQL Editor**.
   - Pega el archivo `BD/migrations/ejecutar_en_supabase_v15_v16_v17.sql` y haz clic en **Run**.
2. **Configurar el Stack en Portainer:**
   En la sección *Environment variables* del Stack, define:
   ```env
   # Activar modo API real
   VITE_API_MODE=api
   SPRING_PROFILES_ACTIVE=prod

   # Base de datos Supabase (de Project Settings > Database > Connection string URI)
   SPRING_DATASOURCE_URL=jdbc:postgresql://aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
   SPRING_DATASOURCE_USERNAME=postgres.mcgkkoqgsbrjbdlayyww
   SPRING_DATASOURCE_PASSWORD=tu_contraseña_supabase

   # Auth y Storage
   SUPABASE_URL=https://mcgkkoqgsbrjbdlayyww.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   VITE_SUPABASE_URL=https://mcgkkoqgsbrjbdlayyww.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

   # Dominio y SSL
   VIRTUAL_HOST=app.tudominio.com
   LETSENCRYPT_HOST=app.tudominio.com
   LETSENCRYPT_EMAIL=isa.pasco01@gmail.com
   ```
3. **Desplegar:**
   - Haz clic en **Update the stack**.
   - Asegúrate de marcar la opción de reconstruir la imagen para que Vite compile con `VITE_API_MODE=api`.

### Modo B: Modo Demostración Rápido (Sin requerir Base de Datos)
Si solo deseas mostrar las pantallas sin conectar credenciales de base de datos:
- Deja `VITE_API_MODE=mock` y `SPRING_PROFILES_ACTIVE=dev`.
- No necesitas configurar `SPRING_DATASOURCE_URL`.
- El contenedor levantará en segundos usando el almacén simulado del navegador.
