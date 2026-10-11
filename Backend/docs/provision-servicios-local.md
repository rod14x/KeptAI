# Provisión local de claves de servicio (MIG-03-D1)

Fecha: 11/10/2026 (actualizada en MIG-03-D3). **Guía y scripts preparados; NO ejecutados sobre la base local activa ni sobre Supabase.** Los scripts se validaron únicamente en un PostgreSQL desechable (`Backend/scripts/verificar-n8n-local.sh`). Aplica a las claves `X-Api-Key` con las que n8n se autentica ante Spring. Elección técnica de D1 (no una regla empresarial aprobada): la clave es un secreto aleatorio de 256 bits; en PostgreSQL solo se guarda su **SHA-256 en hex minúsculas** (`integracion_servicio.clave_hash`, 64 hex), calculado sobre la clave exacta en UTF-8.

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

## 3. Configurar n8n (lado Spring listo; los workflows de Isabella no se tocan)
Cada instancia enviará su clave en la cabecera `X-Api-Key` desde una credencial de n8n (nunca en el JSON del workflow ni en el nodo Config). La configuración exacta de los nodos finales de WF1 y WF2, la separación de las cuatro autenticaciones y los datos pendientes de Isabella están en [integracion-n8n-isabella.md](integracion-n8n-isabella.md) (sección MIG-03-D3). Brecha vigente en los antecedentes versionados: WF0–WF2 usan una sola `apiKey` y sus webhooks de entrada no exigen cabecera en los JSON del repo; la configuración real es de Isabella.

## 4. Qué demuestra y qué no
Demuestra (PostgreSQL desechable + login runtime): clave → hash → `resolver_servicio` → principal de servicio → contexto `org + servicio`; y, desde D3, la recepción HTTP de `/api/v1/ordenes/ingesta` con claves reales de prueba, rotación y revocación. No demuestra n8n real, persistencia, el voucher (la ruta no existe: 404) ni la confirmación/callback (cerradas: 403).


### Revisión de provisión (11/10/2026)
Resultados de set_config descartados para no mostrar hash completo; verificador ejecutable comprueba ausencia de64 hex en stdout de alta. Rotación/revocación bloquean la fila antes de validar el estado para serializar cambios concurrentes. Alta, duplicados, rotación y revocación verificados en PostgreSQL desechable; no aprovisionados servicios reales.
