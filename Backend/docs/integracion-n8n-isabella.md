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

## Recepción WF1 solicitada posteriormente por Miguel
Se implementa POST /api/v1/ordenes/ingesta solo para recibir y validar JSON con INGESTA e instancia auténtica. Respuesta200 VALIDADO_SIN_PERSISTIR, persistido=false, procesado=false, request_id; no201 ficticio ni cola. El diagnostico anterior sobre controller ausente queda como antecedente. Configuracion y ejemplo ficticio vigentes en Middleware/n8n/README.md. Persistencia/idempotencia/negocio de MIG-05 y conexión real con Isabella pendientes. No se creó clave real ni URL externa.


## MIG-03-D3 — conexión de los nodos finales con Spring (alcance local) — 11/10/2026
Preparación del lado Spring. **No se editó, activó ni ejecutó ningún workflow de Isabella, no se generó ninguna credencial de su instancia y no se hicieron llamadas externas.** Los valores de la instancia y de la URL alcanzable los confirma Isabella.

### Estado de cada ruta que n8n usa
| Ruta | Estado hoy | Qué devuelve a un servicio |
|---|---|---|
| `POST /api/v1/ordenes/ingesta` | **Implementada solo como recepción** | INGESTA con instancia correcta: 200 `VALIDADO_SIN_PERSISTIR`, `persistido=false`, `procesado=false`, `request_id` |
| `POST /api/v1/pagos/voucher` | **Autorizada para INGESTA pero ausente** (sin controlador) | 404: no valida ni guarda; el transporte del voucher no está definido |
| `POST /api/v1/ordenes/confirmar` | **Cerrada** por decisión pendiente (vendedorJid, MIG-06) | 403 a cualquier servicio |
| `POST /api/v1/mensajes/{id}/estado` | **Cerrada** (alcance SCHEDULER solo propuesto) | 403 a cualquier servicio |

### Cuatro autenticaciones distintas (no mezclar valores)
| Canal | Dirección | Cabecera/mecanismo | Quién la valida | Estado |
|---|---|---|---|---|
| Evolution → WF0 `POST /webhook/evolution` | entrada a n8n | la que Isabella configure en su webhook/Evolution | n8n (Isabella) | fuera de Spring; sin verificar aquí |
| WF0 → WF1 `/webhook/venta-cerrar` y WF2 `/webhook/voucher` | interna de n8n | credencial propia del webhook de n8n (p. ej. Header Auth) | n8n (Isabella) | los JSON versionados no la tienen; Isabella confirma cómo está su entorno |
| n8n → Spring | saliente de n8n | `X-Api-Key` (clave aleatoria por organización + instancia + alcance) | **Spring**: SHA-256 → `resolver_servicio` | implementada; provisión local en `provision-servicios-local.md` |
| Spring → WF3 `/webhook/enviar-mensaje` | saliente de Spring | `X-Api-Secret` | WF3 (Isabella) | propiedades listas; cliente HTTP no implementado |
Cada una usa un valor distinto; `X-Api-Key` no se reutiliza como secreto de webhook ni al revés, ni coincide con `SUPABASE_SECRET_KEY` o el JWT. Ninguna autoriza a un vendedor: la autoría humana no se infiere de `vendedorJid`.

### WF1 · nodo «Enviar pedido al backend»
- **Método y URL:** `POST {apiUrl}/api/v1/ordenes/ingesta` (`apiUrl` sin barra final; debe ser alcanzable desde donde corre n8n: `localhost` apunta al propio n8n, no a la máquina de Miguel, y el Spring de Miguel en 8080 puede ser una versión anterior).
- **Cabeceras (por nombre):** `X-Api-Key` (credencial de n8n tipo Header Auth con la clave INGESTA de esa instancia; nunca en el JSON del workflow ni en el nodo Config) y `Content-Type: application/json`. **No** enviar `Authorization` (credenciales simultáneas = 401) ni repetir `X-Api-Key`. `Idempotency-Key` no se usa todavía.
- **Body:** un único objeto JSON por solicitud, nunca el array `[ {…} ]` de la vista de items. Exactamente estos campos: `origen`, `instancia`, `chatId`, `vendedorJid`, `clienteNombreChat`, `extraccion`, `hojaResumenMd`, `transcript`, `mensajesProcesados`, `generadoEn`. Campos desconocidos (p. ej. `organizacion_id`) o `extraccion` vacía = 400. `instancia` debe ser la registrada para la clave: el servidor la compara con PostgreSQL y no la deduce del JSON.
- **Respuesta actual:** 200 con `{estado:"VALIDADO_SIN_PERSISTIR", persistido:false, procesado:false, request_id}`. **No** es una venta guardada: no avisar al vendedor de que el pedido quedó registrado. No hay 201 ni `ordenId` todavía.
- **Errores:** 400 (cuerpo mal formado/incompleto; corregir el flujo, no reintentar igual y no volcar el cuerpo al log), 401 (clave ausente, inválida, revocada o credencial doble; detener y avisar al responsable), 403 (alcance o instancia incorrectos), 415 (no JSON), 503/timeout/5xx (reintentar con espera y tope pequeño; hoy no hay efectos secundarios y, con MIG-05, la idempotencia se derivará de `instancia + chatId + generadoEn`, así que los reintentos deben conservar `generadoEn`). Usar la salida de error del nodo, no «continuar ignorando».
- **Retención (D-007):** el `transcript` y el resumen no se persisten en Spring ni se escriben en sus logs (comprobado con datos ficticios). Spring **no puede garantizar** lo que n8n retiene: Isabella debe verificar que las ejecuciones no guarden el cuerpo/respuesta de este nodo (ajustes de guardado de ejecuciones) y que el historial de errores no contenga chats.

### WF2 · nodo «Enviar pago al backend»
- **Método y URL previstos:** `POST {apiUrl}/api/v1/pagos/voucher`; mismas cabeceras que WF1.
- **Body previsto (N8nPagoVoucherRequest):** `instancia`, `chatId`, `clienteJid`, `mensajeId`, `pushName`, `recibidoEn` y `extraccion` (es_voucher, tipo, banco, monto, moneda, fecha, hora, codigo_operacion, remitente, destinatario, confianza, error_parseo). **No hay campo para la imagen, su hash ni una ruta de Storage y no se inventan:** el transporte del archivo se define en MIG-04/05 con Isabella.
- **Respuesta actual: 404.** La ruta está autorizada para INGESTA pero no existe controlador: ni valida ni guarda. Tratar el 404 como «no implementado» (sin reintentos en bucle, sin mensaje al cliente) y **no activar este nodo en producción** hasta MIG-05. Idempotencia persistente (`mensajeId`) también es MIG-05.

### Comprobación local ya hecha (Spring de esta rama, base desechable, datos ficticios)
`Backend/scripts/verificar-n8n-local.sh` (Docker, puerto 8082): 20/20 comprobaciones HTTP sobre `/ordenes/ingesta` (recepción válida conforme al esquema OpenAPI; sin clave, clave inexistente o corta = 401; clave SCHEDULER = 403; instancia distinta = 403 en ambos sentidos; `X-Api-Key` más `Authorization` o repetida = 401; JSON truncado, con contenido final, array, `extraccion` vacía, `organizacion_id` forjada y cuerpo vacío = 400; `text/plain` = 415; GET = 403), 0 filas de negocio tras las pruebas, el transcript ficticio ausente del log, y rotación/revocación con `servicio-local.sh` (la clave anterior da 401 y la nueva 200; la revocada 401). Esto **no es n8n real**.

### Datos exactos que necesitamos de Isabella para la conexión real
1. **Nombre exacto de la instancia** que n8n envía en `instancia` (¿`isabel`, `ventas-01`, otra?) y si hay una o varias instancias/organizaciones; con él Miguel registra el servicio INGESTA.
2. **URL de Spring alcanzable desde su n8n** (host/puerto y si es HTTPS) y si n8n corre en la misma máquina; sin túneles ni despliegues improvisados.
3. **Export actualizado de WF0–WF3 sin credenciales ni ejecuciones** (o revisión acotada) y el **body real** del nodo final de WF1 con cabeceras por nombre; una **muestra ficticia válida y otra fallida** con los nombres exactos de campo; si el nodo envía un objeto o el array de items.
4. Cómo autentica su entorno **Evolution → WF0** y **WF0 → WF1/WF2** (sección de autenticaciones) y si el valor del webhook es distinto del `X-Api-Key`.
5. **Retención**: ajustes de guardado de ejecuciones de WF1/WF2 (sin cuerpo ni respuesta de chats) y de logs de error.
6. Para MIG-04/05: **cómo viajará el archivo del voucher** (subida directa a Storage, multipart a Spring u otro) y qué hash calcula, sin que Spring lo adivine.
7. Confirmación de que **no** se activa todavía la rama «Confirmar pedido en backend» (WF0) ni el callback de WF3: siguen cerrados.


### Destinos finales aportados por Miguel (11/10/2026)
Backend previsto https://keptai.ejesxyz.com, n8n https://n8n.ejesxyz.com. Configurar X-Api-Key en el HTTP Request; Bearer sigue reservado a JWT de usuarios del panel. Miguel pide autenticación por clave, sin restricción adicional por dominio/IP. No afirmar dominio desplegado ni usar CORS/Origin como autenticación de servidor. Rutas finales previstas: POST /api/v1/ordenes/ingesta y POST /api/v1/pagos/voucher. Hoy solo la primera recibe sin persistir; la segunda sigue ausente. Clave real e instancia todavía no provisionadas. Transporte del archivo original de WF2 pendiente para MIG-04/05.
