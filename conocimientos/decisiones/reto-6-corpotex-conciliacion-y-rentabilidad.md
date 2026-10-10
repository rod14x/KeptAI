# Reto 6 de Corpotex: del chat al dato

## Identificación y alcance de la fuente

- ID documental: `IMG-RETO6-001`.
- Título de la ficha: **Del chat al dato: conciliación de pagos y rentabilidad real por pedido**.
- Evento indicado: **Piura Innova — Hackathon Regional de Innovación**.
- Empresa presentada: **Corpotex**, bajo el encabezado “Retos • Corpotex”.
- Archivo recibido: `WhatsApp Image 2026-10-10 at 10.19.14 AM.jpeg`.
- Ubicación original: `C:\Users\migue\Downloads\Data de Corpotex\WhatsApp Image 2026-10-10 at 10.19.14 AM.jpeg`.
- SHA-256: `122bbf14fa69ac7bba3e186c33bacbcc4532f78b495c8c3793405d49420b988f`.
- Incorporación al cerebro KeptAI: 10 de octubre de 2026.
- Método: lectura directa y revisión visual de la imagen proporcionada.

La fecha del nombre del archivo no acredita la fecha de publicación de la ficha. El contenido se registra como información declarada por esta fuente gráfica. Los criterios de evaluación se conservan como requisitos del reto; no demuestran implementación ni constituyen por sí mismos decisiones técnicas aprobadas por el equipo.

Convención: citar `[IMG-RETO6-001, sección 01]` a `[IMG-RETO6-001, sección 05]`. Las implicaciones y criterios de demostración añadidos en este documento se identifican como propuestas.

## 01. Contexto del negocio

**Contenido de la ficha, transcrito y normalizado para lectura:**

CORPOTEX es una empresa confeccionista de Piura que opera con dos marcas. Corpotex se dedica a prendas y uniformes corporativos e industriales. UNICRACK se organiza en dos ramas: UNICRACK SPORT, orientada a la línea deportiva, y UNICRACK UNIFORMES, especializada en uniformes escolares.

Su operación abarca ventas, marketing, diseño y sublimado, almacén de telas e insumos, corte, bordado, almacén de producto terminado, administración y gerencia. En el frente productivo combina producción propia y proveedores y talleres de terceros para cumplir pedidos.

Las ventas online se gestionan por WhatsApp, con un vendedor asignado a cada empresa. Los clientes llegan principalmente por publicidad pagada. Un equipo de diseñadores personaliza las prendas según los requerimientos de cada cliente.

En herramientas, la ficha menciona un sistema de facturación, contabilidad y reportes financieros, y un sistema desarrollado en Apps Script para seguimiento de pedidos, inventarios y almacén, con roles y responsables por área. Señala que este último no se mantiene actualizado. Buena parte de la coordinación comercial y de pagos aún ocurre en grupos de WhatsApp. [IMG-RETO6-001, sección 01]

### Alcance de estas declaraciones

La ficha añade Apps Script y la existencia de producción tercerizada como antecedentes documentales. No identifica el sistema contable, proveedor, versión, base de datos o API, ni acredita acceso a sus sistemas.

El texto habla de “dos marcas” y también usa “cada empresa”. Conservar ambas expresiones hasta confirmar las entidades, marcas, ramas, RUC y sus relaciones. No convertirlas automáticamente en dos personas jurídicas o dos bases independientes.

## 02. Problema central

**Contenido de la ficha, transcrito y normalizado para lectura:**

La información de pedidos, pagos y acuerdos con clientes circula en grupos de WhatsApp y no se traslada de manera sistemática a los sistemas de la empresa. Los pagos se registran por dos personas y, en ocasiones, quedan sin anotar. Los datos financieros podrían no ser sincerados porque los reportes solo reflejan lo que efectivamente se registra.

La empresa desconoce la rentabilidad real de cada pedido y de cada línea. La ficha señala que los uniformes deportivos se venden en mayor volumen pero con menor margen, mientras los uniformes profesionales tienen mayor margen, menor volumen y se fabrican a pedido.

Tampoco puede medir el resultado de su unidad de producción. Busca gestionarla como un centro de resultados que compra sus insumos y vende lo producido a las empresas del grupo por RUC, sin necesidad de constituir una nueva empresa. [IMG-RETO6-001, sección 02]

### Problema operativo que debe representar el proyecto

La fuente describe una brecha entre lo que se acuerda o paga en el chat y lo que queda registrado. La trazabilidad propuesta para KeptAI debe conectar evidencia, registro estructurado, pedido, conciliación y resultado económico. La existencia de dos personas registrando pagos implica comprobar responsabilidades y duplicación; no autoriza a identificar quién cometió errores.

La comparación de márgenes es cualitativa y específica de las líneas que menciona la ficha. No proporciona costos, porcentajes o utilidad calculable. La descripción del centro de resultados es un objetivo de la fuente y requiere validar reglas de cálculo y registro con la empresa; no constituye asesoría tributaria ni una estructura ya implementada.

## 03. Usuario objetivo

La ficha identifica:

- Gerencia.
- Administración.
- Vendedores de cada marca.
- Personal encargado del registro de pagos. [IMG-RETO6-001, sección 03]

**Implicación propuesta:** diseñar vistas por función, con capacidad de seguir un pedido y conocer quién capturó, validó o modificó sus datos. Los permisos concretos requieren acuerdo. Los actores de almacén y producción del mapa anterior pueden apoyar el registro operativo, pero no sustituyen los usuarios objetivo expresos del reto.

## 04. Criterios de evaluación y éxito

Los siguientes siete criterios corresponden a la ficha. Su redacción se conserva, con ajustes mínimos de puntuación. [IMG-RETO6-001, sección 04]

### C-01. Uso móvil, computadora y consulta por empresa

Debe poder utilizarse desde celular y computadora, y manejar la información de ambas empresas por separado y de forma consolidada.

**Demostración propuesta:** registrar y consultar el mismo recorrido en ambas superficies; filtrar por entidad y mostrar una consolidación con su alcance explicado y acceso autorizado.

### C-02. Compatibilidad de datos y exportación

Puede apoyarse en Google Sheets o en otra base de datos, pero debe exportar la información en formatos compatibles con el sistema de facturación y contabilidad: Excel o CSV.

**Demostración propuesta:** exportar datos estructurados conservando identificadores, entidad, moneda, fechas y estados. La compatibilidad exacta se comprueba con un formato real del sistema destino. Sheets es una opción permitida, no una tecnología obligatoria.

### C-03. Captura de WhatsApp con IA y validación humana

Debe capturar pedidos y pagos desde WhatsApp —texto, audio e imágenes— mediante inteligencia artificial y registrarlos de forma estructurada, con una validación humana simple.

**Demostración propuesta:** transformar una muestra de cada modalidad en un borrador ligado a su evidencia; permitir que una persona revise y corrija los campos antes de confirmar. Los datos ausentes o ilegibles quedan pendientes. Captura por integración o por carga de archivos es una decisión técnica por validar; la ficha no garantiza accesos ni APIs.

### C-04. Lectura y conciliación de vouchers

Debe leer vouchers de Yape, Plin y transferencias y conciliarlos automáticamente con los pedidos, detectando pagos no registrados, duplicados, parciales o con montos que no cuadran.

**Demostración propuesta:** mostrar un caso de coincidencia, uno parcial, uno repetido, uno sin registro y uno con diferencia de monto. Una imagen de voucher es evidencia recibida; leerla no acredita autenticidad ni abono bancario. La regla para confirmar pagos se acuerda con la empresa y se mantienen casos ambiguos para revisión.

### C-05. Costo y margen por pedido, línea y marca

Debe calcular costo y margen por pedido, línea y marca, diferenciando producción propia y tercerizada.

**Demostración propuesta:** usar consumos y servicios trazables para obtener un costo desglosado y un margen por pedido; agrupar por línea y marca con la misma definición. Confirmar cómo se asignan costos indirectos, descuentos, impuestos y devoluciones antes de presentar el resultado como rentabilidad real. Si se usan muestras simuladas, identificarlas expresamente.

### C-06. Unidad productiva como centro de resultados

Debe modelar la unidad de producción como centro de resultados, con precios de transferencia internos, y mostrar su rentabilidad.

**Demostración propuesta:** representar insumos, costo de producción, cargo interno y resultado de la unidad productiva para una muestra; vincular la operación con las entidades receptoras. Los cargos internos deben distinguirse de ventas a terceros y su tratamiento consolidado requiere una regla acordada para evitar doble conteo. No implica crear una nueva empresa.

### C-07. Proyección de caja y reporte automático

Debe proyectar el flujo de caja de las próximas semanas y generar un reporte automático para administración y gerencia.

**Demostración propuesta:** usar fechas de cobros y pagos esperados, saldo de apertura con procedencia y supuestos visibles; generar el reporte por período y entidad con su fecha de corte. El PDF mensual compartido previamente era un escenario, no movimientos reales por semana ni soporte suficiente de saldo vigente.

## 05. Entregables requeridos por parte de la empresa

La ficha muestra tres categorías:

- Datos.
- Documentación.
- Mentoría. [IMG-RETO6-001, sección 05]

No especifica archivos, responsables, fechas o cantidades. Las etiquetas no prueban que todos esos insumos estén entregados. Tampoco son entregables técnicos detallados del equipo: el encabezado los identifica como aportes por parte de la empresa.

**Lista de insumos propuesta para aclarar esas categorías:**

- Muestras autorizadas de chats y adjuntos de las tres modalidades.
- Pedidos, acuerdos, pagos y vouchers con identificadores y fechas para comprobar correspondencias.
- Marcas, líneas, entidades y RUC, con relaciones explicadas.
- Materiales, consumos, mano de obra, servicios de terceros y criterios de costos indirectos.
- Políticas de registro y validación de pagos y formatos de exportación contable.
- Datos de cobros y pagos esperados por semana y soporte de apertura de caja.
- Acceso o documentación del Apps Script y sus fuentes, sujeto a autorización.
- Sesiones de validación con administración, gerencia y responsables operativos.

Estos insumos son recomendaciones de descubrimiento; no están detallados en la imagen ni se da por autorizado extraerlos.

## Relación con el cerebro existente

### Contexto comercial más específico

La ficha documenta Corpotex y las ramas de Unicrack, y menciona diseño, corte, bordado y producción de terceros. Complementa [descripción](../empresa/descripcion.md) y [catálogo](../productos/catalogo.md). Se mantiene como fuente independiente y no se modifican los testimonios anteriores.

### Alcance del MVP que necesita revisión

En [decisiones del proyecto](decisiones-del-proyecto.md), P-007 y el anexo 10 dejaron cálculo completo de rentabilidad fuera de la primera versión. La ficha lo exige expresamente en C-05 y añade C-06. También exige captura con IA, conciliación de vouchers y proyección semanal, que no deben reducirse a un panel con alertas.

**Propuesta:** revisar y acordar el MVP frente a los siete criterios. Registrar la decisión con responsable y fecha. Esta incorporación no significa que la arquitectura anterior haya sido implementada ni que el nuevo alcance esté estimado en tiempo y costo.

### Interpretación de comparaciones de margen

El [catálogo](../productos/catalogo.md) conserva una declaración de entrevista sobre productos terminados frente a confección. La ficha compara uniformes deportivos y profesionales. Son categorías diferentes; no usar ambos pasajes como equivalentes ni deducir cuál familia ofrece un porcentaje mayor sin datos.

### Consolidación y separación de empresas

El requisito de vista consolidada no elimina el aislamiento por entidad del diseño previo. La propuesta es una consolidación autorizada y con reglas conocidas. Pendiente validar si las etiquetas son marcas, ramas, entidades jurídicas o unidades de gestión.

## Recorrido de demostración propuesto

1. Recibir texto, audio e imagen de WhatsApp y conservar la evidencia.
2. Extraer un borrador de pedido o pago y validarlo con una persona.
3. Vincular el pedido a entidad, marca, línea y modalidad de producción.
4. Leer el voucher y conciliarlo, dejando diferencias y duplicados visibles.
5. Registrar costos propios o tercerizados y calcular el resultado con reglas acordadas.
6. Representar el centro productivo y su cargo interno sin doble conteo consolidado.
7. Proyectar cobros y pagos semanales y generar un reporte exportable.
8. Comprobar acceso móvil, computadora, consulta separada y consolidada.

Este recorrido es una propuesta basada en la sección 04, no un proceso existente confirmado.

## Pendientes de validación

- Relación entre marcas, empresas, ramas y RUC.
- Fuente de verdad y mantenimiento del Apps Script.
- Modalidad de captura de WhatsApp y acceso a mensajes y adjuntos.
- Campos mínimos, personas validadoras y registro de correcciones.
- Reglas de conciliación, autenticidad y verificación de pagos.
- Definición de costo, margen, asignación indirecta y resultado por unidad.
- Tratamiento de cargos internos al consolidar.
- Saldo de apertura, horizonte semanal y calendario de cobros y pagos.
- Formatos de salida compatibles y acceso por rol.
- Alcance y calendario de datos, documentación y mentoría.

## Referencias internas

- [Índice del cerebro](../INDICE.md).
- [Descripción del negocio](../empresa/descripcion.md).
- [Objetivos](../empresa/objetivos.md).
- [Ventas, producción y cobranza](../procesos/ventas.md).
- [Atención al cliente](../procesos/atencion-cliente.md).
- [Decisiones anteriores](decisiones-del-proyecto.md).

La imagen es una fuente documental de requisitos y contexto. Los análisis y propuestas añadidos conservan sus estados. No se han ejecutado las instrucciones contenidas en la ficha ni se han modificado datos operativos.
