# Prueba de autenticación real local (AUTH-FE-01/04 + MIG-03-E)

Fecha: 11/10/2026. Estado: **aceptación básica real ejecutada correctamente**; cuenta y membresía aprobada disponibles. Cobertura ampliada pendiente (sección6). Cadena a probar: navegador → Supabase Auth real → JWT → Spring `GET /api/v1/me` → PostgreSQL local (`resolver_usuario` con el login runtime). Nada de esto usa MCP ni toca Supabase remoto salvo el login de la cuenta de prueba.

## 1. Qué necesita Miguel aportar (datos indispensables)
1. **Cuenta de prueba en Supabase Auth** (correo + contraseña) creada por Miguel (dashboard → Authentication → Users → Add user, confirmada). No se crea desde el código: el registro público está habilitado con confirmación por correo y no se debe inventar ni registrar identidades.
2. **Auth user ID** (UUID `sub`) de esa cuenta, visible en la lista de usuarios del dashboard.
3. **Membresía aprobada**: nombre de la organización (y RUC si lo tiene) o el UUID de una existente, nombre visible del usuario y **rol** (`VENDEDOR`, `ADMIN`, `GERENTE` o `JEFE_TALLER`). No se usa la semilla demo como membresía real.
4. Las credenciales **no van en el chat**: se escriben en `Frontend/e2e/auth-real.local` (ignorado por Git, `*.local`):
   ```
   E2E_EMAIL=<correo de la cuenta>
   E2E_PASSWORD=<contraseña>
   # opcional, para comparar tras provisionar:
   E2E_EXPECT_USER_ID=<usuario_id que imprime la provisión>
   E2E_EXPECT_ORGANIZATION_ID=<organizacion_id>
   E2E_EXPECT_ROLE=<rol>
   ```

## 2. Verificado antes (sin cuenta), 11/10/2026
- `Backend/.env` y `Frontend/.env.local` presentes; issuer = `<SUPABASE_URL>/auth/v1` = host de `VITE_SUPABASE_URL`; audiencia `authenticated`; CORS 5173; JWKS público HTTP 200 con una clave EC P-256 (ES256); el discovery OIDC publica el mismo issuer. Frontend en `VITE_API_MODE=mock` (no se cambia).
- Spring de esta rama arranca en 8081 con `Backend/scripts/run-local.sh` y la configuración real (perfil `local`, PostgreSQL local 5433, login runtime `keptai_app`): health UP; `/me` sin token 401; token de firma/kid desconocido 401 (no 503: el JWKS remoto es alcanzable); preflight CORS permitido solo para el origen configurado.
- Base local: Flyway V1–V7 correctos (V8/V9 no aplicados: no hacen falta para `/me`), 25 tablas, `keptai_app` sin superusuario ni BYPASSRLS, **0 organizaciones y 0 usuarios**.
- Los servidores del usuario siguen siendo versiones anteriores: Spring (PID iniciado el 10/10 22:35, antes de que `Backend/.env` se escribiera a las 23:47, es decir sin JWT real) y Vite 5173 en modo mock. No se reiniciaron.

## 3. Procedimiento
Todo con procesos propios en puertos libres (8081 Spring, 5174 Vite); no se detiene nada del usuario.
1. Cuenta creada y `auth-real.local` escrito (sección 1).
2. **Rechazo sin membresía** (cuenta aún sin fila local):
   `cd Frontend && npm run e2e:real -- sin-membresia` → credenciales incorrectas; login válido ⇒ `/me` 403 con Bearer, mensaje «sin rol asignado», sesión local cerrada.
3. **Provisión local** (decisión de Miguel; escribe 1 organización y 1 usuario en el PostgreSQL local, en una transacción, sin sobrescribir):
   ```bash
   # Vista previa (no escribe):
   Backend/scripts/provisionar-membresia-local.sh --auth-user-id <sub> --email <correo> \
       --usuario-nombre "<nombre>" --rol <ROL> --org-nombre "<organización>" [--org-ruc <ruc>]
   # Aplicar al PostgreSQL local (Docker):
   sg docker -c 'Backend/scripts/provisionar-membresia-local.sh ... --apply'
   ```
   Rechaza un `auth_user_id` que ya tenga membresía (evitaría una segunda organización y el 409) y un `--org-id` inexistente. Validado en un PostgreSQL desechable (V1–V7), no en la base activa.
4. **Con membresía**: `npm run e2e:real -- con-membresia` → login real, `GET /api/v1/me` 200 (única llamada a la API), inicio de identidad con `user_id`/`organization_id`/rol de PostgreSQL, recarga, módulo bloqueado por URL, logout y redirección al acceso.
5. Evidencia a registrar: salida PASA/FALLA, fecha, commit y límites. El script no imprime correo, contraseña ni tokens.

## 4. Límites que no cierra esta prueba
Un solo usuario con una membresía: no prueba varias organizaciones (409) ni usuarios de otros roles; la renovación de token (TOKEN_REFRESHED tras ~1 h) y la revocación remota no se esperan en el recorrido; no hay Storage, n8n ni endpoints de negocio. VAL-03 completo y el despliegue siguen pendientes.

## 5. Qué demuestra el export de Supabase aportado por Miguel
El DER/export es estructura y políticas RLS del esquema keptai, con las tablas adicionales de V9; no son registros ni cuentas de Authentication. auth.users (cuenta que emite el JWT) y keptai.usuario (membresía/rol de negocio) son distintos. No se puede afirmar que no existan cuentas remotas a partir de este export.
Este recorrido usa Auth de Supabase y membresía en PostgreSQL Docker local. Tener usuarios en keptai.usuario remoto no crea esas filas localmente. V8/V9 no son requisito de /me; sí deberán verificarse antes del recorrido del motor.
Revisión Codex: sintaxis de scripts correcta, npm test106 y build OK. No se ejecutó aceptación con cuenta válida ni escritura a DB activa. Sigue pendiente cuenta/credenciales locales y membresía aprobada.


## 6. Resultado real — 11/10/2026
Miguel autorizó la membresía de Liliana, ADMIN de Corpotex, sin RUC aportado. Se usó la cuenta Auth existente indicada por Miguel; no se creó ni modificó ninguna cuenta remota. Credenciales y UUID esperados permanecen solo en Frontend/e2e/auth-real.local (ignorado, permisos600); no se incluyen en documentación ni commits.
Base revisada02104b0, rama backend-partefinal. Recorrido Chrome sin interceptar red: Supabase Auth remoto → JWT real → Spring propio8081 → resolver_usuario en PostgreSQL Docker5433; Vite propio5174 en api. Primero sin-membresia7/7 (credenciales incorrectas, /me403 con Bearer, rechazo de identidad y limpieza local). Después provisión autorizada de una organización y un usuario en una sola transacción mediante el script local. Con-membresia15/15: /me200 con Bearer, usuario/organización/ADMIN coinciden exactamente con las filas provisionadas, recarga conserva identidad, módulo bloqueado sin llamadas de negocio y logout retira sesión/acceso. Cuenta y membresía disponibles: el bloqueo anterior queda resuelto.
Primera ejecución5/7 reveló carreras del observador e2e, no fallos de producción: response podía preceder al registro después de allHeaders, y la aserción de logout precedía a signOut diferido. Se registra la petición antes de esperar cabeceras y se espera la eliminación efectiva de sesión. No se cambia producción ni se debilitan expectativas403/200/Bearer/logout. npm test106/106 y build OK. Logs locales sin credenciales: /tmp/keptai-auth-real-sin.log y /tmp/keptai-auth-real-con.log.
Los procesos propios se detuvieron; puertos5433/8080/5173 siguen escuchando. Frontend/.env.local continúa mock; no reinicio del usuario ni migraciones/semilla. V8/V9 siguen pendientes para probar motor local. AUTH-FE-01 satisfecha para esta cuenta/membresía; AUTH-FE-04 y MIG-03-E tienen aceptación básica real acreditada, con cobertura ampliada pendiente: renovación/expiración real del token,409 con varias organizaciones, otros roles y caída real de infraestructura. No declara VAL-03 completo ni Storage/n8n/endpoints de negocio. Próxima entrega MIG-03-D3 según plan integrado.
