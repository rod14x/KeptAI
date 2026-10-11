# Integración n8n de Isabella — muestra WF1 y siguientes acuerdos
ID: MIG-N8N-ISA-001. Fecha: 11/10/2026.
Fuente: payload compartido directamente por Miguel, atribuido al entorno de Isabella. Es una muestra de salida con un item, no un export de nodos/conexiones del workflow ni evidencia de aceptación por Spring. No se conserva el original: contiene teléfonos y transcript ajeno a un pedido.

## Responsabilidad y alcance
Isabella desarrolla n8n en su entorno según Miguel. No sobrescribir Middleware/n8n/WF0–WF3 ni desplegar/activar workflows desde la tarea backend. Los JSON versionados son antecedentes hasta contrastarlos con un export actualizado. MIG-03-D3 prepara el contrato, credenciales y pruebas del lado de Spring; seguridad y retención reales del entorno n8n requieren comprobación del responsable.

## Contraste con el contrato vigente
- Operación: POST /api/v1/ordenes/ingesta, body N8nIngestaOrdenRequest. Estado actual (D3): **recepción implementada** (200 VALIDADO_SIN_PERSISTIR, sin crear pedido); la creación de BORRADOR, la persistencia y la idempotencia son MIG-05. Un 200 no acredita ingesta.
- origen whatsapp e instancia isabel tienen formato admitido. El texto de instancia/JID no autentica empresa ni vendedor: la identidad deriva de X-Api-Key resuelta en PostgreSQL.
- generadoEn usa ISO8601 con Z, compatible con OffsetDateTime; mensajesProcesados=4 está dentro del rango del contrato. Esto no prueba la calidad de la extracción.
- extraccion={} incumple los obligatorios faltantes (lista) y confianza (número 0–1). OpenAPI y Bean Validation coinciden. No quitar validación para admitir esta muestra.
- El resumen contiene campos sin datos, pero declara faltantes ninguno. Es inconsistente con el resultado vacío: no tratarlo como pedido listo ni inventar cliente/items/montos/confianza.
- El transcript recibido incluye contenido ajeno al pedido y las cuatro entradas aparecen como VENDEDOR. No se puede determinar aquí si falló el modelo, el parser o la selección del chat; revisar los nodos de Isabella con datos ficticios y sin exportar conversaciones.
- La envoltura [ {...} ] puede representar la vista de items de n8n. Solo si el HTTP Request manda ese array como body existe incompatibilidad adicional: el contrato recibe un objeto por solicitud, no una lista. Comprobar la configuración real antes de atribuir un fallo.
- No hay cabeceras HTTP en la muestra: X-Api-Key e Idempotency-Key no pueden evaluarse por su ausencia en este JSON.

## Normalización propuesta (no cambio aprobado de workflow)
Enviar un objeto por solicitud. Si la extracción no produce datos útiles, informar faltantes reales y confianza sustentada; en una rama explícita de fallo puede usarse confianza=0 y error_parseo seguro según el ejemplo vigente del contrato. No fabricar campos de venta ni declarar faltantes vacíos.
Un objeto ficticio equivalente con extraccion vacía produce dos errores del esquema (faltantes/confianza). Una variante ficticia con faltantes=[datos_pedido], confianza=0 y error_parseo descriptivo cumple el esquema, pero no acredita validez empresarial ni persistencia.
Los datos incompletos solo son candidatos a BORRADOR y revisión; recibir una propuesta no aprueba crédito, libera producción, verifica fondos ni aplica pago.
No autorizar vendedores mediante vendedorJid. La confirmación WhatsApp sigue cerrada hasta el acuerdo MIG-06.

## Persistencia y seguridad
transcript/crudo son transitorios en el contrato y no se guardan en DB, logs, auditoría, idempotencia ni historiales/errores n8n. La documentación describe el requisito D-007, no una retención comprobada en el entorno de Isabella. Persistir solo vouchers privados y proyección estructurada del negocio; no guardar el resumen entrante como contenedor de conversaciones.
X-Api-Key INGESTA debe ser independiente de JWT, SUPABASE_SECRET_KEY y secretos de webhooks. SCHEDULER no puede usar las rutas INGESTA. No copiar claves en este documento.
Reintentos deben conservar la clave de idempotencia para la misma operación; el detalle de generación y conflicto se acuerda antes de implementar MIG-05.

## Qué se necesita para cerrar D3 y conectar después
1. Export actualizado WF0–WF3 sin credenciales ni datos de ejecuciones, o revisión acotada de configuración por Isabella.
2. Body real del nodo HTTP y cabeceras por nombre, con valores secretos ocultos.
3. Muestra ficticia válida y muestra de extracción vacía/fallida; correspondencia exacta de nombres de campos.
4. Acuerdo del transporte de archivo WF2 para MIG-04/05; la muestra WF1 no contiene voucher.
5. Acuerdo de autenticación entrada Evolution, llamadas WF0→WF1/WF2 y Spring→WF3, más configuración de retención sin chats.
6. Confirmación/callback permanecen cerrados; no abrir por esta muestra.
Integración real pendiente: no se hicieron llamadas a Isabella, n8n, IA, Supabase ni base activa.

## Evidencia local de este contraste
Validación en memoria con JSON Schema 2020-12 contra Backend/docs/openapi.yaml, usando datos ficticios, sin copiar el payload real: objeto vacío rechazado por dos campos requeridos; array rechazado; variante con obligatorios aceptada. No se implementó código ni se ejecutó una prueba HTTP.

## Actualización visual de WF0–WF2 — capturas aportadas por Miguel
Fuente: tres capturas del editor de Isabella (11/10/2026), sin export JSON ni inspección de configuración.
- WF0 conserva Webhook Evolution → Config → Clasificar → Ruta, con ramas cerrar hacia WF1, confirmar hacia backend y voucher hacia WF2. La captura muestra Inactive y una rama cerrar con un item marcado; no acredita webhook de producción activo ni persistencia en Spring. La presencia de la rama confirmar no cambia su autorización cerrada en D2.
- WF1 muestra Normalizar y separación de mensajes con/sin media, descarga base64, Convert to File, ramas de audio (transcripción) e imagen (Analyze an image), textos, Unir mensajes, Armar transcript, Preparar LLM, Message a model, Parsear y hoja resumen, Enviar pedido al backend. La interfaz muestra procesamiento con nodos distintos al antecedente versionado; parámetros, proveedor/modelo y formato de salida no son verificables con esta captura.
- WF2 muestra descarga base64 → Preparar visión → LLM leer voucher → Parsear voucher → ¿Es voucher legible?, con ramas Enviar pago al backend e Ignorar imagen. No se ve una carga a Storage ni la configuración del body; no afirmar que el archivo original se persiste o que no existe transporte dentro de un nodo sin inspeccionarlo.

### Implicaciones para el backend y próxima revisión
La sustitución de nodos/modelos dentro de n8n no exige cambiar el contrato Spring si el nodo final normaliza a los DTO vigentes. Contrastar especialmente Parsear y hoja resumen y Parsear voucher: una respuesta de un nodo modelo diferente puede tener otra estructura. Es una hipótesis a comprobar, no causa demostrada del extraccion vacío recibido antes.
Las capturas no demuestran que se corrigieron faltantes/confianza, el body objeto por solicitud, las credenciales, la idempotencia ni la retención de ejecuciones. Pedir export actualizado WF0–WF3 sin secretos/datos personales y ejemplos ficticios del body final; WF3 no fue aportado visualmente.
Conservar la coordinación con Isabella: no editar ni activar sus workflows desde el backend. D3 documenta y prueba la frontera; MIG-04/05 implementan Storage/ingesta; confirmación y callback siguen sujetos a sus acuerdos.

## Recepción WF1 solicitada posteriormente por Miguel — SUPERADA
Antecedente: tras MIG-03-D3 la ruta solo validaba el JSON y respondía 200 `VALIDADO_SIN_PERSISTIR`. Esa respuesta **ya no existe**: desde MIG-04/05 (ver la última sección) `POST /api/v1/ordenes/ingesta` responde `201` y persiste el `BORRADOR`; sin base de datos responde `503`, nunca un éxito sin guardar.

## MIG-03-D3 y MIG-04/05 — ingesta y voucher implementados; instrucciones definitivas de los nodos — 11/10/2026
Lado Spring de la conexión. **No se editó, activó ni ejecutó ningún workflow de Isabella, no se generó ninguna credencial real de su instancia y no se hicieron llamadas externas.** La instancia (`isabel`) y la organización (Corpotex) están confirmadas por Miguel.

### Estado de cada ruta que n8n usa (actualizado en MIG-04/05, dentro del alcance de las dos rutas)
| Ruta | Estado hoy | Qué hace |
|---|---|---|
| `POST /api/v1/ordenes/ingesta` | **Implementada** (pruebas locales con PostgreSQL desechable) | 201: orden `BORRADOR` + hoja `BORRADOR` v1 desde la proyección estructurada; idempotente |
| `POST /api/v1/pagos/voucher` | **Implementada** (Storage SIMULADO en las pruebas de negocio; prueba temporal de Supabase real correcta) | 201: pago `RECIBIDO` + comprobante privado con `imagen_base64`; idempotente por `mensajeId` |
| `POST /api/v1/ordenes/confirmar` | **Cerrada** (decisión pendiente: vendedorJid, MIG-06) | 403 a cualquier servicio |
| `POST /api/v1/mensajes/{id}/estado` | **Cerrada** (alcance SCHEDULER solo propuesto) | 403 a cualquier servicio |

Destinos finales **previstos**, aún NO desplegados ni verificados como alcanzables: Spring `https://keptai.ejesxyz.com` y n8n `https://n8n.ejesxyz.com`. No se abrió ningún túnel ni se desplegó nada; hasta que Miguel/Codex lo confirmen no deben anunciarse como operativos. `apiUrl` = `https://keptai.ejesxyz.com` (sin barra final) solo cuando esa dirección responda.

### Cuatro autenticaciones distintas (no mezclar valores)
| Canal | Dirección | Cabecera/mecanismo | Quién la valida | Estado |
|---|---|---|---|---|
| Evolution → WF0 `POST /webhook/evolution` | entrada a n8n | la que Isabella configure en su webhook/Evolution | n8n (Isabella) | fuera de Spring; sin verificar aquí |
| WF0 → WF1 `/webhook/venta-cerrar` y WF2 `/webhook/voucher` | interna de n8n | credencial propia del webhook de n8n (p. ej. Header Auth) | n8n (Isabella) | los JSON versionados no la tienen; Isabella confirma cómo está su entorno |
| n8n → Spring | saliente de n8n | `X-Api-Key` (clave aleatoria por organización + instancia + alcance INGESTA) | **Spring**: SHA-256 → `resolver_servicio` | implementada; la credencial real está pendiente de aplicar (revisión de Codex) |
| Spring → WF3 `/webhook/enviar-mensaje` | saliente de Spring | `X-Api-Secret` | WF3 (Isabella) | propiedades listas; cliente HTTP no implementado |
Cada una usa un valor distinto; `X-Api-Key` no se reutiliza como secreto de webhook ni al revés, ni coincide con `SUPABASE_SECRET_KEY` (que solo vive en el backend y n8n nunca recibe) o con el JWT. Ninguna autoriza a un vendedor: la autoría humana no se infiere de `vendedorJid`. No hay filtros por dominio/IP ni CORS como autenticación: la identidad es la clave.

### Datos confirmados por Miguel (no se vuelven a pedir)
Instancia de Evolution/n8n: **`isabel`**. Organización local: **Corpotex**. WF2 envía el archivo original como `imagen_base64` dentro del JSON. Cada solicitud HTTP lleva **un objeto** (nunca el array `[ {…} ]` de la vista de items de n8n: el nodo HTTP debe enviar el objeto del item). `Content-Type: application/json`. Autenticación n8n → Spring: `X-Api-Key` con alcance INGESTA.

### WF1 · nodo «Enviar pedido al backend»
- **Método y URL:** `POST {apiUrl}/api/v1/ordenes/ingesta`.
- **Cabeceras (por nombre):** `X-Api-Key` (credencial de n8n tipo Header Auth con la clave INGESTA de `isabel`; nunca en el JSON del workflow ni en el nodo Config) y `Content-Type: application/json`. **No** enviar `Authorization` (credenciales simultáneas = 401) ni repetir `X-Api-Key`.
- **Body:** un único objeto JSON por solicitud, exactamente con: `origen` (`whatsapp`), `instancia` (`isabel`, tal cual la registrada: si no coincide con la clave, 403), `chatId`, `vendedorJid`, `clienteNombreChat`, `extraccion`, `hojaResumenMd`, `transcript`, `mensajesProcesados`, `generadoEn`. Campos desconocidos (p. ej. `organizacion_id`) o `extraccion` incompleta según el esquema = 400.
- **Origen de los identificadores (Evolution/Baileys; Isabella confirma contra su versión):** `chatId` = `key.remoteJid` del chat de la venta; `vendedorJid` = JID de quien escribió `/cerrar`; ambos con formato `<dígitos>@s.whatsapp.net` o `@lid` (con `:dispositivo` opcional). No inventarlos ni dejarlos `null`: sin ellos la solicitud es 400.
- **`generadoEn`:** instante ISO-8601 con desfase, **calculado una sola vez al armar la hoja y reutilizado en todos los reintentos** (no usar `$now` dentro del nodo HTTP). Es parte de la clave de idempotencia.
- **Respuesta:** `201` con `ordenId`, `ref` (`ORD-n`), `estado:"BORRADOR"`, `hojaResumenVersion`, `camposAusentes[]` y `avisos[]`. Un reintento idéntico devuelve el mismo `201` con la cabecera `Idempotency-Replayed: true`. El pedido queda **sin confirmar, sin cliente, marca ni vendedor asociados, sin crédito aprobado y sin producción**; no avisar al vendedor de que está «cerrado».
- **Qué debe conservar n8n en un reintento:** `instancia`, `chatId`, `vendedorJid`, `generadoEn` y la extracción (`transcript`, `hojaResumenMd` y `clienteNombreChat` no cuentan para la identidad). Si cambia el contenido funcional con el mismo `instancia + chatId + generadoEn` → `409 IDEMPOTENCY_CONFLICT` (nuevo `generadoEn` = nuevo pedido).
- **Errores y reintentos:** `400` (cuerpo mal formado, array, campo desconocido; corregir el flujo, no reintentar igual ni volcar el cuerpo al log), `401` (clave ausente, inválida, revocada o credencial doble; detener y avisar), `403` (alcance o instancia incorrectos), `409` (no reintentar), `413` (cuerpo > 524 288 bytes por defecto), `415` (no JSON), `422` (`AMOUNT_INCONSISTENT`: anticipo mayor que el total), `503`/timeout/`5xx` (reintentar hasta 3 veces con espera de 5–10 s; es seguro porque es idempotente). Usar la salida de error del nodo.
- **Qué guarda Spring (D-007):** solo la proyección estructurada (extracción sin `crudo` ni texto de error, un resumen construido por el servidor, ítems completos, canal/JID, auditoría e idempotencia con ids). **No** guarda `transcript`, `hojaResumenMd`, mensajes ni audios, ni los registra en logs. La retención de las ejecuciones de n8n la debe verificar Isabella (ajustes de guardado de ejecuciones de WF1/WF2 sin cuerpo ni respuesta).

### WF2 · nodo «Enviar pago al backend»
- **Método y URL:** `POST {apiUrl}/api/v1/pagos/voucher`; mismas cabeceras que WF1.
- **Body (un objeto):** `instancia` (`isabel`), `chatId`, `clienteJid`, `mensajeId`, `pushName`, `recibidoEn`, `extraccion` e `imagen_base64`. `extraccion`: `es_voucher`, `tipo`, `banco`, `monto`, `moneda`, `fecha`, `hora`, `codigo_operacion`, `remitente`, `destinatario`, `confianza`.
- **Identificadores de Evolution (obligatorios; Isabella confirma contra su versión):** `mensajeId` = `key.id` del **mensaje de la imagen** (identificador original y estable; `null`, vacío o inventado por reintento = 400/duplicados: nunca generar un UUID nuevo ni usar `recibidoEn` como sustituto); `chatId` = `key.remoteJid`; `clienteJid` = JID de quien envió la imagen (en un chat 1:1 coincide con `remoteJid`); `recibidoEn` = `messageTimestamp` (segundos) convertido a ISO-8601 con `Z`; `pushName` = nombre visible, **dato no confiable**: Spring no lo guarda ni lo usa para identificar a nadie. Sin cliente identificado el pago se registra sin cliente (no se inventa ni se asocia).
- **Tipos JSON:** `monto` es un **número** JSON (`3.5` se registra exactamente como `3.50` PEN; una cadena `"3.5"` o más de 2 decimales = 400), `fecha` `YYYY-MM-DD`, `hora` `HH:MM`, `moneda` `PEN` (otra = 422 `CURRENCY_NOT_SUPPORTED`). Sin `monto`, `fecha` o `moneda` legibles = 422 `VOUCHER_INCOMPLETE`. `es_voucher:false` (o `error_parseo`) = `200 IGNORADO_NO_VOUCHER` sin archivo ni pago, y entonces no hace falta `imagen_base64`.
- **`imagen_base64`:** los bytes ORIGINALES del archivo (los mismos que leyó el modelo, sin recomprimir) en **Base64 puro**: alfabeto estándar, longitud múltiplo de 4, sin saltos de línea, **sin prefijo `data:`**. Cómo obtenerlo dentro de n8n sin cambiar su entorno: en el nodo Code que prepara el body, `const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); return [{ json: { ...$json, imagen_base64: buf.toString('base64') } }];` (sirve con almacenamiento de binarios en memoria o en disco; `'data'` es el nombre de la propiedad binaria del item). Si el nodo de descarga ya entrega `base64` como texto, usar ese valor tras quitar un posible prefijo `data:…;base64,`. No enviar URLs: el backend **no descarga** nada.
- **Límites:** archivo decodificado ≤ **10 485 760 bytes** (10 MiB, el límite del bucket `keptai-vouchers`; configurable `keptai.n8n.voucher.max-file-bytes`, unidad: bytes); el cuerpo HTTP con el Base64 (≈ 4/3 del archivo) ≤ 14 046 552 bytes (Base64 máximo de 13 981 016 caracteres + 65 536 de metadatos). Un cuerpo mayor se rechaza con `413` sin decodificarlo. Solo JPEG, PNG o PDF **completos** (se reconocen por su contenido, no por extensión ni MIME).
- **Respuestas:** `201` `REGISTRADO` con `pagoId`, `fase:"RECIBIDO"`, `estadoConciliacion` (`PENDIENTE`, o `DUPLICADO` con `duplicadoDePagoId` si ya existía un pago con la misma referencia de operación, monto y fecha: se clasifica, **no se verifica ni se aplica**; no es un error ni un reintento), `fondosVerificados:false`, `saldoModificado:false`, `ordenRef:null`, `alertaId:null`. Repetición idéntica = mismo `201` con `Idempotency-Replayed: true` y sin volver a subir el archivo. Un `mensajeId` repetido con otro archivo o contenido = `409`. La lectura de la IA no acredita fondos: Administración verifica después en el panel.
- **Errores y reintentos:** `400` (`IMAGE_REQUIRED`, `IMAGE_INVALID_BASE64`, JSON/identificadores inválidos), `401`/`403`, `409`, `413`, `415`, `422` (`IMAGE_UNSUPPORTED_TYPE`, `VOUCHER_INCOMPLETE`, `CURRENCY_NOT_SUPPORTED`), `502 STORAGE_REJECTED` (no reintentar igual), `503 STORAGE_UNAVAILABLE`/timeout/`5xx` (reintentar hasta 3 veces con espera; se conserva `mensajeId`). Tras un fallo de Storage o de base no queda pago, comprobante ni objeto referenciado; si el objeto subido no pudo eliminarse se registra en el log de Spring `VOUCHER_COMPENSACION_FALLIDA` con su ruta para conciliarlo.
- **Qué guarda Spring:** `pago` (RECIBIDO) y `comprobante` con ruta generada por el servidor (`<organización>/vouchers/<hash de clave>-<hash del archivo>.<ext>`), SHA-256 de los bytes y los datos estructurados de la lectura; el archivo va al bucket privado `keptai-vouchers` con la clave secreta solo en el backend. **El Base64, `pushName`, mensajes y audios no se guardan** en JSON, auditoría, idempotencia ni logs.

### Ejemplo ficticio COMPLETO para WF2 (archivo reproducible de 86 bytes)
Generado por `python3 Backend/scripts/generar-ejemplo-voucher.py` (salida determinista; guardado en `Backend/docs/ejemplos/wf2-voucher-ficticio.json`). El PNG es sintético (no un comprobante), el Base64 es puro y está completo; los JID son ficticios. **No** es el Base64 truncado de una muestra anterior.
```json
{
  "instancia": "isabel",
  "chatId": "51900000001@s.whatsapp.net",
  "clienteJid": "51900000001@s.whatsapp.net",
  "mensajeId": "3EB0C767D0A5C7F2A9B1",
  "pushName": "Cliente ficticio",
  "recibidoEn": "2026-10-11T15:04:05Z",
  "extraccion": {
    "es_voucher": true,
    "tipo": "YAPE",
    "banco": null,
    "monto": 3.5,
    "moneda": "PEN",
    "fecha": "2026-10-11",
    "hora": "10:04",
    "codigo_operacion": "DEMO-000001",
    "remitente": null,
    "destinatario": null,
    "confianza": 0.9
  },
  "imagen_base64": "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAHUlEQVR42mNgiPqPQCJR/+GIQSPqPxwx2ET9hyMAP1IXcWid5YsAAAAASUVORK5CYII="
}
```
Prueba manual contra una instancia propia (la clave nunca va en la línea de comandos): `printf 'X-Api-Key: %s\n' "$(cat "$HOME/.config/keptai/<archivo>.key")" > "$TMP/cab" && chmod 600 "$TMP/cab" && curl -sS -X POST "$APIURL/api/v1/pagos/voucher" -H @"$TMP/cab" -H 'Content-Type: application/json' --data @Backend/docs/ejemplos/wf2-voucher-ficticio.json`.

### Qué está hecho y qué falta (no declarar «listo para Isabella» antes de cerrar lo pendiente)
- **Terminado y probado localmente:** ambas rutas con PostgreSQL desechable y login runtime sin BYPASSRLS (`N8nIngestaVoucherPersistenceTests`, 18 pruebas), adaptador de Storage contra un servidor HTTP simulado (`SupabaseVoucherStorageTests`), verificación de proceso completo `Backend/scripts/verificar-n8n-local.sh` (Spring propio + Storage simulado + PostgreSQL desechable).
- **Pendiente:** flujo completo del endpoint con **Supabase Storage real** y acceso privado del panel (subida/lectura/eliminación temporal ya comprobadas; políticas por usuario pendientes) · prueba con **n8n real** (archivo original desde su Evolution) · **provisión de la credencial en la base del despliegue** y entrega privada a Isabella (ya provisionada solo en Docker local; comandos en `provision-servicios-local.md`) · **despliegue HTTPS** y accesibilidad de `https://keptai.ejesxyz.com` desde su n8n.
- **Sin cambio:** confirmación por `vendedorJid` y callback SCHEDULER siguen cerrados; MIG-04 (lectura/URLs firmadas del panel) y MIG-05/06/07 restantes, y VAL-03, no se declaran cerrados.

### Datos que aún necesitamos de Isabella
1. **Export actualizado de WF0–WF3** sin credenciales ni ejecuciones (o el body real de los dos nodos finales con cabeceras por nombre) para contrastar nombres de campo.
2. De dónde toma `chatId`, `vendedorJid`, `clienteJid`, `mensajeId` y `messageTimestamp` en su versión de Evolution, y si algún evento los entrega `null`.
3. Cómo obtiene el binario original del voucher en WF2 y si lo guarda en memoria o en disco (para elegir `getBinaryDataBuffer` o su campo `base64`).
4. Cómo autentica su entorno Evolution → WF0 y WF0 → WF1/WF2, y los ajustes de retención de ejecuciones de WF1/WF2.
5. Confirmar que no activa todavía la rama «Confirmar pedido» de WF0 ni el callback de WF3.


### Revisión de archivos y seguridad concurrente (Codex,11/10/2026)
La comprobación inicial por firma/marcador no acreditaba archivos decodificables. Ahora JPEG/PNG se decodifican con ImageIO; se rechazan errores/avisos y dimensiones de más de25 millones de píxeles antes de asignar la imagen. PDF se analiza con Apache PDFBox3.0.8 en modo estricto, exige páginas y rechaza cifrado; no ejecuta ni renderiza contenido del PDF. Esto valida estructura/decodificación, no acredita autenticidad financiera del voucher. Fixtures JPEG/PDF reales generados sintéticamente sustituyen los antiguos marcadores ficticios. Fuente de dependencia: https://pdfbox.apache.org/download.html y guía https://pdfbox.apache.org/3.0/migration.html.
Dos ingestas distintas concurrentes en el mismo chat ahora serializan la creación del canal junto con la referencia de la orden. Vouchers de mensajes distintos con la misma operación/monto/fecha se serializan antes de clasificar: solo uno PENDIENTE, resto DUPLICADO. No fondos verificados ni aplicaciones. Tres pruebas nuevas de regresión.
Credencial isabel/INGESTA de Corpotex provisionada SOLO en Docker local; env/key fuera del repo con permisos600. Supabase Storage real comprobado con PNG sintético: bucket privado, límite10485760bytes, subida/lectura HTTP200, SHA-256 igual y eliminación HTTP200. No filas remotas modificadas ni archivo empresarial subido; no acredita n8n real, lectura autorizada del panel ni flujo completo de negocio contra Storage real. Dominios previstos aún no desplegados por esta tarea.
