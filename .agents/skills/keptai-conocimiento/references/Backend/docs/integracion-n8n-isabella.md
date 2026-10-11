# Integración n8n de Isabella — muestra WF1 y siguientes acuerdos
ID: MIG-N8N-ISA-001. Fecha: 11/10/2026.
Fuente: payload compartido directamente por Miguel, atribuido al entorno de Isabella. Es una muestra de salida con un item, no un export de nodos/conexiones del workflow ni evidencia de aceptación por Spring. No se conserva el original: contiene teléfonos y transcript ajeno a un pedido.

## Responsabilidad y alcance
Isabella desarrolla n8n en su entorno según Miguel. No sobrescribir Middleware/n8n/WF0–WF3 ni desplegar/activar workflows desde la tarea backend. Los JSON versionados son antecedentes hasta contrastarlos con un export actualizado. MIG-03-D3 prepara el contrato, credenciales y pruebas del lado de Spring; seguridad y retención reales del entorno n8n requieren comprobación del responsable.

## Contraste con el contrato vigente
- Operación prevista: POST /api/v1/ordenes/ingesta, body N8nIngestaOrdenRequest. D2 autoriza INGESTA; no existe controller de negocio todavía (MIG-05). Un permiso no acredita ingesta.
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
