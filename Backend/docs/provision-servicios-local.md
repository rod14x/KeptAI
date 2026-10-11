# Provisión local de claves de servicio (MIG-03-D1)

Fecha: 11/10/2026. **Guía preparada; no ejecutada** en ninguna base (ni la local activa ni Supabase). Aplica a las claves `X-Api-Key` con las que n8n se autentica ante Spring. Elección técnica de D1 (no una regla empresarial aprobada): la clave es un secreto aleatorio de 256 bits; en PostgreSQL solo se guarda su **SHA-256 en hex minúsculas** (`integracion_servicio.clave_hash`, 64 hex), calculado sobre la clave exacta en UTF-8.

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

## 2. Registrar solo el hash (manual, a cargo de Miguel, con el migrador)
Plantilla parametrizada; sustituya las variables y revise antes de ejecutar. No contiene claves ni contraseñas:
```sql
-- psql -v org='<UUID de keptai.organizacion>' -v instancia='<nombre n8n>' \
--      -v alcance='INGESTA' -v hash='<hash_sha256 impreso por el script>' -f registrar.sql
INSERT INTO keptai.integracion_servicio (organizacion_id, instancia, alcance, clave_hash)
VALUES (:'org'::uuid, :'instancia', :'alcance', :'hash');
```
- `alcance` solo admite `INGESTA` o `SCHEDULER` (CHECK de V4); `clave_hash` debe ser único y `^[0-9a-f]{64}$`.
- Revocar: UPDATE de activo=false sobre la fila correcta por id y organizacion; la siguiente peticion da401.
- Rotar: generar una nueva clave fuera del repo, conservar su hash y reemplazar clave_hash en la misma fila, coordinando el cambio de credencial en n8n. La clave anterior deja de funcionar al confirmar el UPDATE. No insertar otra fila con el mismo triplete: UNIQUE(organizacion_id,instancia,alcance) se aplica tambien a filas inactivas. Este procedimiento no ofrece una ventana con ambas claves validas ni historial de versiones; ese soporte requeriria un diseno posterior. Verificar y habilitar activo=true solo si la reactivacion esta autorizada.

Plantilla de rotacion (manual, con migrador, no ejecutada):
```sql
BEGIN;
UPDATE keptai.integracion_servicio
SET clave_hash = :'hash_nuevo'
WHERE id = :'servicio'::uuid
  AND organizacion_id = :'org'::uuid
  AND instancia = :'instancia'
  AND alcance = :'alcance'
  AND clave_hash = :'hash_anterior'
  AND activo = true
RETURNING id;
-- Debe devolver exactamente una fila; si no, ejecutar ROLLBACK y revisar.
-- Solo tras comprobar ese resultado ejecutar COMMIT.
```

- La organización debe existir y ser la correcta: el alcance y la organización quedan fijados por esta fila, no por n8n.

## 3. Configurar n8n (etapa D3, no hecha)
Los workflows actuales no están modificados. Cuando se ejecute D3, cada instancia enviará su clave por la cabecera `X-Api-Key` (credencial de n8n, nunca en el JSON del workflow). Brecha registrada: WF0–WF2 usan hoy una sola `apiKey` y ningún webhook entrante exige cabecera; WF3 valida `X-Api-Secret`. D1 no toca esos flujos.

## 4. Qué demuestra y qué no D1
Demuestra (PostgreSQL desechable + login runtime): clave → hash → `resolver_servicio` → principal de servicio → contexto `org + servicio` (usuario vacío) en la transacción del negocio. No demuestra n8n real, endpoints de negocio ni permisos por ruta (D2): las rutas de servicio siguen devolviendo 403 a un servicio válido.
