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
    environment:
      - PORT=8080
      - SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE:-dev}
      - SPRING_DATASOURCE_URL=${SPRING_DATASOURCE_URL:-}
      - SPRING_DATASOURCE_USERNAME=${SPRING_DATASOURCE_USERNAME:-}
      - SPRING_DATASOURCE_PASSWORD=${SPRING_DATASOURCE_PASSWORD:-}
      - SUPABASE_URL=${SUPABASE_URL:-}
      - SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY:-}
      - KEPTAI_JWT_ISSUER_URI=${KEPTAI_JWT_ISSUER_URI:-}
      - KEPTAI_JWT_JWK_SET_URI=${KEPTAI_JWT_JWK_SET_URI:-}
```

---

## 4. Instrucciones para Actualizar en Portainer

### Modo A: Conexión Real a Supabase y Producción

1. **Entrar a Portainer:**
   - Abre la pila (Stack) del proyecto `keptai`.
   - Dirígete a la pestaña **Editor**.
2. **Configurar las Variables de Entorno en el Editor de la Pila:**
   ```dotenv
   VITE_API_MODE=api
   VITE_SUPABASE_URL=https://mcgkkoqgsbrjbdlayyww.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_HFaBZJFkFB5fRIt-Ffz-aA_CHKX8ScJ
   VITE_API_BASE_URL=https://keptai.ejesxyz.com

   SPRING_PROFILES_ACTIVE=prod
   SPRING_DATASOURCE_URL=jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?currentSchema=keptai&sslmode=require
   SPRING_DATASOURCE_USERNAME=postgres.mcgkkoqgsbrjbdlayyww
   SPRING_DATASOURCE_PASSWORD=tu_contraseña_supabase

   KEPTAI_JWT_ISSUER_URI=https://mcgkkoqgsbrjbdlayyww.supabase.co/auth/v1
   KEPTAI_JWT_JWK_SET_URI=https://mcgkkoqgsbrjbdlayyww.supabase.co/auth/v1/.well-known/jwks.json
   KEPTAI_JWT_AUDIENCES=authenticated
   KEPTAI_CORS_ALLOWED_ORIGINS=https://keptai.ejesxyz.com

   VIRTUAL_HOST=keptai.ejesxyz.com
   VIRTUAL_PORT=80
   LETSENCRYPT_HOST=keptai.ejesxyz.com
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

---

## 5. Cuentas de Acceso y Aprovisionamiento en Supabase Auth

Para autenticarse contra Supabase Auth en modo `api`, los usuarios requieren:
1. Contraseña hasheada con bcrypt a costo 10 (`$2a$10$`), por requisito de seguridad de GoTrue.
2. Identidad registrada en `auth.identities` (`provider = 'email'`).
3. Vínculo del UID en `keptai.usuario.auth_user_id`.

### Credenciales activas:
- **Contraseña:** `demo1234`
- **Usuarios disponibles:**
  - Administración: `admin.demo@keptai.invalid`
  - Vendedora: `vendedora.demo@keptai.invalid`
  - Gerencia: `gerencia.demo@keptai.invalid`
  - Jefe de Taller: `taller.demo@keptai.invalid`
