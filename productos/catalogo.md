# Catálogo conocido y datos pendientes

> Corte documental: 10 de octubre de 2026. Versión: 1.0.
> Catálogo descriptivo basado en entrevistas automáticas editadas sin verificación humana por escucha. No se han recibido precios, SKUs o existencias vigentes.

## Familias mencionadas según la entrevista

### Uniformes del sector salud

Producto terminado mencionado como ejemplo. No se especifican modelos, piezas, materiales, tallas, colores, precios o certificaciones. [A02-Q02] 02_ventas_produccion_cobranza.md, 00:23–01:23

### Polos personalizados

Confección según pedido y gusto del cliente. Faltan cantidades mínimas, técnicas por referencia, composición, medidas y plazos estándar. [A02-Q02] 02_ventas_produccion_cobranza.md, 00:23–01:23

### Casacas personalizadas

Confección personalizada. No se han recibido variantes, fichas técnicas o tarifas. [A02-Q02] 02_ventas_produccion_cobranza.md, 00:23–01:23

### Tela colombiana o campaña relacionada

Referencia incompleta usada como ejemplo de campaña para el bot. El nombre reconocido como “camisa Nexo”, “anexo” u otras variantes no está confirmado. No crear una marca o SKU con esa transcripción. [A01-Q07] 01_pedidos_whatsapp_crm.md, 01:32–01:55

### Materias primas e insumos

Se registra un avance de inventariado, sin lista de materiales, proveedores, composiciones, unidades o saldos. “Casi al 100%” refiere avance de registro y no precisión del stock. [A02-Q18] 02_ventas_produccion_cobranza.md, 09:04–09:23

## Información económica disponible

Según la entrevista, confección tiene mayor volumen de ventas y los productos terminados dejan algo más de margen, sin porcentajes. Los costos se estiman manualmente con materia prima, suministros, mano de obra, alquiler y gastos indirectos. También se calcula manualmente el margen, sin confirmar inequívocamente Excel. [A02-Q20] 02_ventas_produccion_cobranza.md, 09:43–10:04 [A02-Q08] 02_ventas_produccion_cobranza.md, 03:53–04:35 [A02-Q21] 02_ventas_produccion_cobranza.md, 10:04–10:17

Faltan precios, costos unitarios, monedas, porcentajes y tratamiento tributario por artículo. La referencia incierta al IGV no permite fijar una fórmula. [A02-Q23] 02_ventas_produccion_cobranza.md, 12:05–13:02

## Modelo propuesto de catálogo operativo

**Estado: diseño futuro, datos pendientes de incorporación.**

- Identificador interno y referencia del sistema de origen.
- Nombre, familia y tipo: material, terminado o fabricación por pedido.
- Variantes reales como talla, color y material cuando correspondan.
- Unidad de medida y conversiones documentadas.
- Estado activo/inactivo y fecha de actualización.
- Ficha técnica, versión aprobada y personalización.
- Lista de materiales y consumo estimado de fabricación.
- Ubicaciones y reglas de reposición acordadas.
- Precio y costo con moneda, vigencia y procedencia.

Las existencias, reservas y movimientos se mantienen en el registro operativo. Lotes y variantes se incorporan cuando puedan identificarse con datos reales.

## Datos necesarios para completar el catálogo

Obtener un export autorizado de artículos, variantes, unidades, ubicaciones y saldos con fecha de corte. Revisar duplicados y unidades, adjuntar fichas y precios vigentes y validar una muestra con ventas y almacén.

Los campos desconocidos permanecen pendientes. No se fabrican códigos, descripciones técnicas o disponibilidad para completar el documento.

## Relaciones

[Ventas e inventario](../procesos/ventas.md) explica movimientos y disponibilidad; [decisiones](../decisiones/decisiones-del-proyecto.md), modelo de datos y autoridad del registro.

## Anexo de evidencia: registros completos

Se conservan las secciones depuradas originales, incluidas sus notas. El tipo y las limitaciones adicionales proceden de la base local. Todos estos registros tienen verificación `transcripcion_automatica_editada_sin_escucha_humana`.

### A01-Q07 — ¿Está entrenado para responder a las personas?

**Fuente:** [A01-Q07] 01_pedidos_whatsapp_crm.md, 01:32–01:55.

**Tipo:** `declaracion_con_incertidumbre`.

**Respuesta:** Sigue entrenándose. Está orientado a campañas. Por ejemplo, si se lanza una campaña de una tela colombiana [nombre o referencia del producto no confirmado], el bot está preparado específicamente para contestar preguntas sobre esa campaña.

**Limitaciones del registro:**

- El nombre de la tela o campaña no está confirmado.

### A02-Q02 — ¿Dónde registran las ventas y los pedidos?

**Fuente:** [A02-Q02] 02_ventas_produccion_cobranza.md, 00:23–01:23.

**Tipo:** `declaracion_entrevista`.

**Respuesta:** Tenemos un sistema de facturación vinculado al inventario. Últimamente implementamos un módulo de producción donde se registran los pedidos y los productos que se confeccionan.

Tenemos productos terminados, como uniformes del sector salud, y productos que se confeccionan de acuerdo con lo que pide el cliente, como polos y casacas personalizados. Sobre todo para estos pedidos de confección queremos ideas que nos ayuden a organizar mejor la producción.

### A02-Q08 — ¿Cómo calculan el costo estimado de un producto antes de cotizarlo?

**Fuente:** [A02-Q08] 02_ventas_produccion_cobranza.md, 03:53–04:35.

**Tipo:** `declaracion_entrevista`.

**Respuesta:** Se consideran la materia prima, los suministros, la mano de obra, el alquiler y los gastos indirectos. No tenemos un sistema que calcule automáticamente ese costo. Se hace de forma manual y empírica, con la experiencia de los dueños y los precios que dan los proveedores.

### A02-Q18 — ¿La cotización de materiales se hace manualmente? ¿Cómo avanza el inventario?

**Fuente:** [A02-Q18] 02_ventas_produccion_cobranza.md, 09:04–09:23.

**Tipo:** `declaracion_con_incertidumbre`.

**Respuesta:** Sí, la cotización es manual. El inventario se está realizando poco a poco. El inventario de insumos ya está casi al 100%.

**Alcance:** “Casi al 100%” se refiere al avance mencionado para el inventario de insumos; no se expresa como una medición de exactitud del stock.

**Limitaciones del registro:**

- Casi al 100% es avance de inventariado de insumos; no exactitud del stock.

### A02-Q20 — ¿Venden más productos terminados o productos de confección?

**Fuente:** [A02-Q20] 02_ventas_produccion_cobranza.md, 09:43–10:04.

**Tipo:** `declaracion_entrevista`.

**Respuesta:** En volumen de ventas, más confección. En margen de ganancia, con los productos ya hechos se gana un poco más.

### A02-Q21 — ¿Cómo miden actualmente el margen de rentabilidad?

**Fuente:** [A02-Q21] 02_ventas_produccion_cobranza.md, 10:04–10:17.

**Tipo:** `declaracion_con_incertidumbre`.

**Respuesta:** Se hace de forma manual.

**Precisión:** La pregunta ofrece como alternativas Excel, cálculo manual o el sistema. La respuesta confirma el trabajo manual. Más adelante un entrevistador lo reformula como trabajo en Excel; en este punto no se especifica inequívocamente la herramienta.

**Limitaciones del registro:**

- Se confirma cálculo manual, no una herramienta Excel inequívocamente.
