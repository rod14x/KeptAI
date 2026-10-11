# Despliegue del backend para pruebas de Isabella

Fecha: 11/10/2026. Preparación autorizada por Miguel; destino previsto `https://keptai.ejesxyz.com`. No declarar desplegado hasta completar las comprobaciones públicas. En esta revisión el nombre no resuelve por DNS y no hay acceso al hosting configurado.

## Requisito previo confirmado después de iniciar la preparación

Miguel exige resolver cliente/contacto por JID, hoja vinculada al cliente y voucher asociado al último pedido del contacto antes del despliegue. Datos y prompt en `cerebro/conocimientos/desarrollo/miguel/prompt-contacto-pedido-voucher.md`. Vendedor aún pendiente por instrucción expresa. La imagen comprobada hoy contiene las rutas anteriores, aún sin esa asociación: no entregarla como implementación de este requisito.

## Artefacto

Desde la raíz del repo:
```bash
docker build -t keptai-backend:n8n -f Backend/Dockerfile Backend
```
Dockerfile de dos etapas, JDK/JRE 21 y usuario 10001. Contexto permitido: wrapper, pom y src/main; .env, credenciales e informes no se envían al build. La imagen usa perfil prod, puerto 8080. Las 321 pruebas previas se ejecutaron aparte; el build empaqueta sin volver a correr Testcontainers. Referencia: https://docs.docker.com/guides/java/.

Para un panel Docker, contexto `/Backend`, Dockerfile `/Backend/Dockerfile` según el formato de rutas de ese panel, puerto interno 8080 y health `/actuator/health`. No escoger un panel ni editar el proxy de n8n sin conocer la infraestructura.

## Entorno del servicio (secretos en el hosting, nunca Git)

- `SPRING_PROFILES_ACTIVE=prod`, `PORT=8080`.
- `SPRING_DATASOURCE_URL`: JDBC del PostgreSQL accesible desde el servidor, esquema `keptai` en `currentSchema`. Usar SSL para conexión remota (por ejemplo `jdbc:postgresql://HOST:5432/DB?currentSchema=keptai&sslmode=require`). No copiar `127.0.0.1:5433` de WSL al servidor.
- `SPRING_DATASOURCE_USERNAME` y `SPRING_DATASOURCE_PASSWORD`: login runtime NOSUPERUSER/NOBYPASSRLS, no owner ni postgres ni migrador.
- `KEPTAI_JWT_ISSUER_URI`, `KEPTAI_JWT_JWK_SET_URI`, `KEPTAI_JWT_AUDIENCES=authenticated`: mismos valores públicos del proyecto de Auth local.
- `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET=keptai-vouchers`, `SUPABASE_SECRET_KEY`: guardar solo en el backend, nunca en frontend ni imagen.
- `KEPTAI_CORS_ALLOWED_ORIGINS`: orígenes del frontend navegador si corresponde. n8n servidor no necesita CORS para autenticarse; usa X-Api-Key.
- WF3 permanece sin configurar si no se entrega su URL y secreto; confirmación/callback conservan su estado cerrado.

`application-prod.yml` conserva ddl-auto validate y Flyway desactivado del archivo base. No aplica ni repara migraciones automáticamente. Andrés debe comprobar historial y migraciones V1–V9, funciones, permisos runtime y tablas antes de elegir Supabase como JDBC. La prueba temporal de Storage no acredita ese esquema remoto ni la provisión de servicios allí.

## Base y credencial

La clave actual `isabel/INGESTA` está registrada SOLO en PostgreSQL local, organización Corpotex. Su archivo privado es `~/.config/keptai/n8n-ingesta-corpotex.env`, campo N8N_API_KEY, permisos 600. El backend autentica por hash en `integracion_servicio`, no por una variable con clave compartida global.

Antes de aceptar tráfico público, escoger la base del despliegue, verificar la organización Corpotex existente (no asumir su UUID local), y provisionar allí el servicio con instancia `isabel` y alcance INGESTA usando el procedimiento de `provision-servicios-local.md`. Si se genera otra clave para el despliegue, entregarle esa a Isabella. No ejecutar alta en remoto sin conexión y organización confirmadas. No abrir BYPASSRLS para resolver errores.

## Dominio y HTTPS

El administrador del dominio debe crear el registro DNS que pida el hosting: A/AAAA para VPS o CNAME indicado por el proveedor. El proxy/panel debe emitir certificado para keptai.ejesxyz.com y enviar tráfico a Spring 8080. El límite del proxy debe admitir al menos 14 046 552 bytes de JSON para vouchers de 10 MiB (recomendado 15 MiB o superior; Spring sigue aplicando su límite). No registrar cuerpos ni cabeceras de credenciales. No alterar el dominio o servicio de n8n.

## Aceptación antes de entregar

1. `https://keptai.ejesxyz.com/actuator/health` responde 200 UP, certificado válido.
2. POST de ambas rutas sin X-Api-Key y con clave desconocida responde 401, no 404/502.
3. POST `{}` con la clave provisionada llega a validación 400, no 401/503. No crea filas.
4. Prueba ficticia aprobada desde WF1/WF2 real: ingesta 201 BORRADOR, voucher 201 RECIBIDO, ruta privada y bytes originales correctos. Mismo mensaje reintentado: replay sin duplicar filas/archivos. Sin fondos verificados ni aplicaciones.
5. Verificar por runtime que no consulta/escribe otra empresa y que no guarda transcript ni contenido crudo en BD/logs/ejecuciones n8n; Isabella configura la retención de ejecuciones.

Entrega a Isabella: URL base, las dos rutas, instancia isabel, cabecera X-Api-Key mediante credencial privada n8n y Content-Type application/json. Body: un objeto, no array; WF2 exige mensajeId estable original, chatId/clienteJid completos y imagen_base64 pura completa. No anunciar URL operativa ni compartir secretos en documentación.

## Evidencia de empaquetado
Imagen local keptai-backend:n8n construida correctamente. Contenedor propio 8088/perfilprod contra PostgreSQL runtime: healthUP; ambas rutas con clave activa llegan a validación400 y con desconocida401; runtime uid10001. Contenedor y env temporales eliminados. No es despliegue público ni prueba de la nueva asociación pendiente.

## Hosting propuesto
Render permite servicio Docker y dominio propio con TLS administrado: https://render.com/docs/docker y https://render.com/docs/custom-domains. Propuesta conforme al roadmap previo, no cuenta ni gasto contratado. Primero completar asociación de contacto, escoger base remota compatible y confirmar acceso a DNS; después crear servicio con rootDirectory Backend, rama backend-partefinal y health /actuator/health.


## Actualización 11/10/2026 — contacto registrado y asociación voucher → pedido (V10)
El requisito previo de Miguel quedó **implementado y probado localmente** (PostgreSQL desechable, Storage simulado): cliente por JID de contacto registrado, hoja con la razón social real, voucher asociado al último pedido del contacto. Consecuencias para el despliegue:
- **La base debe estar en V10** antes de ejecutar este código: sin la tabla `contacto` ambas rutas fallarían. La imagen Docker **no migra** la base al arrancar (Flyway desactivado); V10 se aplica aparte con el rol migrador. La base local activa sigue en V7 (faltan V8, V9 y V10) y el esquema remoto/runtime no se ha validado: pendiente de Andrés y de la revisión de Codex.
- Registrar el contacto real (Cloud Technologies / Andrés) en la base del despliegue con `Backend/scripts/provisionar-contacto-local.sh` (`provision-servicios-local.md` §2.2). No se aplica ninguna semilla demo al iniciar `prod`.
- Comprobación de la imagen tras V10: `docker build` correcto (la imagen no contiene migraciones ni datos).
- Siguen pendientes: validar el esquema remoto/runtime, provisionar la credencial en la base del despliegue y DNS/HTTPS. El vendedor y la validación humana de `/cerrar` permanecen pendientes: no está listo para n8n público.
