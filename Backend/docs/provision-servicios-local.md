# Provisión local de claves de servicio (MIG-03-D1)

Fecha: 11/10/2026 (actualizada en MIG-03-D3). **Credencial isabel/INGESTA aplicada en Corpotex local; no provisionada en Supabase.** Los scripts también se validaron en un PostgreSQL desechable (`Backend/scripts/verificar-n8n-local.sh`). Aplica a las claves `X-Api-Key` con las que n8n se autentica ante Spring. Elección técnica de D1 (no una regla empresarial aprobada): la clave es un secreto aleatorio de 256 bits; en PostgreSQL solo se guarda su **SHA-256 en hex minúsculas** (`integracion_servicio.clave_hash`, 64 hex), calculado sobre la clave exacta en UTF-8.

## Reglas
- Una clave por organización, instancia y alcance: **dos claves independientes**, una `INGESTA` (WF1/WF2) y otra `SCHEDULER` (callback de WF3/alertas). Nunca reutilizar la misma para ambos alcances.
- Distinta de `SUPABASE_SECRET_KEY`, del JWT de Auth y del `X-Api-Secret` (webhook saliente hacia WF3). Cada una tiene su propia rotación.
- La clave en claro vive solo en el archivo ignorado de quien la configura en n8n (permisos 600, fuera del repositorio). Nunca en Git, logs, chats, tickets ni en `.env.example`.
- Spring no recibe organización, alcance ni instancia del cliente: los lee de la fila (`resolver_servicio`). Formato aceptado de la cabecera: 32 a 128 caracteres ASCII visibles, una sola cabecera, sin `Authorization` simultáneo.
- Solo el migrador/owner inserta o revoca filas; el login runtime no tiene `SELECT` sobre `integracion_servicio` (solo ejecuta `resolver_servicio`).

## 1. Generar la clave (sin base de datos)
```bash
mkdir -p "$HOME/.config/keptai"
chmod 700 "$HOME/.config/keptai"
Backend/scripts/generar-clave-servicio.sh "$HOME/.config/keptai/n8n-ingesta-corpotex.key"
Backend/scripts/generar-clave-servicio.sh "$HOME/.config/keptai/n8n-scheduler-corpotex.key"
```
El script crea cada archivo (600) con 64 caracteres hex aleatorios, rechaza destinos dentro del repositorio o existentes e imprime únicamente `hash_sha256=…` (no secreto). Si prefiere otro generador, debe producir ≥256 bits aleatorios y calcular el hash como `printf %s "$(cat archivo)" | sha256sum` (sin salto de línea).

## 2. Registrar solo el hash con `servicio-local.sh` (vista previa por defecto)
```bash
S=Backend/scripts/servicio-local.sh
# 1) Vista previa (no toca ninguna base): parámetros y SQL, hash solo como prefijo.
$S alta --org-id <uuid de una organización EXISTENTE> --instancia <instancia exacta que envía n8n> \
        --alcance INGESTA --key-file "$HOME/.config/keptai/n8n-ingesta-corpotex.key"
# 2) Aplicar al PostgreSQL local de BD/local (Docker), solo cuando Miguel lo decida:
sg docker -c "$S alta ... --apply"
$S listar  --org-id <uuid> --apply                # servicio_id, instancia, alcance, activo, prefijo de hash
$S revocar --org-id <uuid> --servicio-id <uuid> --apply
$S rotar   --org-id <uuid> --servicio-id <uuid> --old-key-file <actual> --new-key-file <nueva> --apply
```
- Todos los comandos son **vista previa** sin `--apply`. Una sola transacción por comando. Para otra base (p. ej. desechable) defina `KEPTAI_PSQL_EXEC="docker exec -i <contenedor> psql -X -q -U <usuario> -d <base>"`.
- El archivo de clave debe estar **fuera del repositorio, con permisos 600**, y contener 32–128 caracteres ASCII visibles (lo produce `generar-clave-servicio.sh`). El script calcula el SHA-256 de la clave exacta (sin el salto de línea final) y **nunca** imprime la clave; del hash muestra solo 8 caracteres.
- `alta` exige una organización existente y rechaza: clave ya registrada (el hash es único), y un triplete organización + instancia + alcance existente (activo o inactivo): **no hay sobrescritura silenciosa**; para cambiar una clave use `rotar`. `alcance` solo INGESTA o SCHEDULER; la `instancia` debe ser exactamente la que n8n envía en el JSON (`^[A-Za-z0-9._-]{1,100}$`) y la confirma Isabella: no se asume ninguna.
- `revocar` pone `activo=false` en el servicio indicado (id + organización); la siguiente petición con esa clave da 401 (se consulta PostgreSQL en cada petición).
- `rotar` reemplaza el hash de un servicio activo si el hash anterior coincide; **no hay ventana con ambas claves válidas ni historial de versiones** (coordinar el cambio de credencial en n8n). La clave anterior deja de valer al confirmar.
- Reactivar un servicio revocado (`activo=true`) es un `UPDATE` manual con el migrador y solo si está autorizado; no hay comando.
- Nunca ejecutar esto contra la base activa para credenciales de Isabella antes de confirmar su instancia, y nunca imprimir ni pegar claves en chats o tickets.

## 2.1 Credencial de Corpotex · instancia `isabel` · alcance INGESTA (APLICADA SOLO LOCAL)
La organización local existente es `Corpotex`, id `87d1132c-5b6d-4aa3-9c93-e7355dcd99cb`. Codex provisionó un servicio activo para `isabel`/`INGESTA`, según la solicitud previa de Miguel de generar y guardar la API key. Antes había0 servicios; ahora hay1. Clave original: `/home/miguel/.config/keptai/n8n-ingesta-corpotex.key`. Copia en entorno de integración: `/home/miguel/.config/keptai/n8n-ingesta-corpotex.env`, campo `N8N_API_KEY`; ambos fuera de Git, permisos600, directorio700. PostgreSQL solo conserva SHA-256. No se creó otra Corpotex ni SCHEDULER. La credencial está registrada SOLO en Docker local, no en Supabase remoto ni en el servidor del dominio. No ejecutar nuevamente los comandos de alta siguientes: son el procedimiento utilizado; para cambiar la clave usar rotación explícita.
```bash
# 1) Generar la clave real FUERA del repositorio (permisos 600; solo se imprime el hash):
mkdir -p "$HOME/.config/keptai" && chmod 700 "$HOME/.config/keptai"
Backend/scripts/generar-clave-servicio.sh "$HOME/.config/keptai/n8n-ingesta-corpotex-isabel.key"
# 2) Vista previa (no toca ninguna base; muestra el SQL y solo 8 caracteres del hash):
Backend/scripts/servicio-local.sh alta --org-id 87d1132c-5b6d-4aa3-9c93-e7355dcd99cb --instancia isabel --alcance INGESTA \
    --key-file "$HOME/.config/keptai/n8n-ingesta-corpotex-isabel.key"
# 3) Aplicar al PostgreSQL local activo SOLO tras revisar la vista previa:
sg docker -c 'Backend/scripts/servicio-local.sh alta --org-id 87d1132c-5b6d-4aa3-9c93-e7355dcd99cb --instancia isabel --alcance INGESTA \
    --key-file "$HOME/.config/keptai/n8n-ingesta-corpotex-isabel.key" --apply'
# 4) Comprobar sin secretos:
sg docker -c 'Backend/scripts/servicio-local.sh listar --org-id 87d1132c-5b6d-4aa3-9c93-e7355dcd99cb --apply'
```
Entrega: el contenido del archivo `.key` se pasa a Isabella por un canal privado y se pega en una credencial de n8n tipo Header Auth (`X-Api-Key`); nunca en un chat, ticket, workflow ni `VITE_*`. En PostgreSQL queda solo su SHA-256. Para rotar o revocar usar `rotar`/`revocar`. Esta clave no es la de Supabase ni un JWT. Para que Spring suba vouchers, el backend (no n8n) necesita `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET=keptai-vouchers` y `SUPABASE_SECRET_KEY` en su entorno ya existente (`Backend/.env`); su uso real contra Supabase Storage está pendiente de probar.

## 2.2 Cliente y contacto de WhatsApp (V10; demo Cloud Technologies / Andrés) — PREPARADO, NO APLICADO
La entrada n8n exige que el JID sea el de un contacto registrado. `Backend/scripts/provisionar-contacto-local.sh` (vista previa por defecto; `--apply` explícito; solo base local o la indicada con `KEPTAI_PSQL_EXEC`) usa una **organización existente**, crea o reutiliza el cliente (tipo EMPRESA) y el contacto con el JID canónico derivado del teléfono. No crea organizaciones, vendedores, usuarios de Auth, servicios ni pedidos; no inventa RUC, marca, crédito ni correo; reejecutar no duplica y un dato distinto (otro tipo, nombre o cliente) falla sin sobrescribir. Probado en un PostgreSQL desechable (`verificar-n8n-local.sh`); **no se aplicó a la base local activa**, que sigue en V7 (la aplicación exige antes migrar a V10 con el rol migrador: V8 y V9 también faltan allí).
```bash
Backend/scripts/provisionar-contacto-local.sh --org-nombre Corpotex --cliente-razon-social "Cloud Technologies" --cliente-tipo EMPRESA \
    --contacto-nombre "Andrés" --telefono "+51 951 570 191"          # vista previa: JID 51951570191@s.whatsapp.net
sg docker -c 'Backend/scripts/provisionar-contacto-local.sh ... --apply'   # solo tras migrar la base local a V10 y revisar la vista previa
```
No se aplica ninguna semilla demo al iniciar `prod`. La imagen Docker de Spring **no migra** la base al arrancar: V10 se aplica aparte con Flyway/rol migrador.

## 3. Configurar n8n (lado Spring listo; los workflows de Isabella no se tocan)
Cada instancia enviará su clave en la cabecera `X-Api-Key` desde una credencial de n8n (nunca en el JSON del workflow ni en el nodo Config). La configuración exacta de los nodos finales de WF1 y WF2, la separación de las cuatro autenticaciones y los datos pendientes de Isabella están en [integracion-n8n-isabella.md](integracion-n8n-isabella.md) (sección MIG-03-D3). Brecha vigente en los antecedentes versionados: WF0–WF2 usan una sola `apiKey` y sus webhooks de entrada no exigen cabecera en los JSON del repo; la configuración real es de Isabella.

## 4. Qué demuestra y qué no
Demuestra (PostgreSQL desechable + login runtime): clave → hash → `resolver_servicio` → principal de servicio → contexto `org + servicio`; la ingesta (`201` BORRADOR) y el voucher (`201` pago RECIBIDO con comprobante en un Storage simulado) con claves de prueba, más rotación y revocación. No demuestra n8n real ni Supabase Storage real; la confirmación y el callback siguen cerrados (403).


### Revisión de provisión (11/10/2026)
Resultados de set_config descartados para no mostrar hash completo; verificador ejecutable comprueba ausencia de64 hex en stdout de alta. Rotación/revocación bloquean la fila antes de validar el estado para serializar cambios concurrentes. Alta, duplicados, rotación y revocación verificados en PostgreSQL desechable; en esa revisión D3 todavía no se habían aprovisionado servicios reales; la provisión local posterior está en §2.1.
