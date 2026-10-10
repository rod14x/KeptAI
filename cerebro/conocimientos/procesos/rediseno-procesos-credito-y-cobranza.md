# Rediseño de Procesos: Blindaje de Crédito y Cobranza

> ID documental: `USR-REDISENO-001`.
> Fuente: texto adjunto proporcionado por el usuario, `Texto pegado.txt`.
> Incorporación al cerebro KeptAI: 10 de octubre de 2026.
> Estado: diagnóstico y rediseño propuestos por el equipo, pendientes de validación operativa y aprobación de sus reglas.
> Actualización D-005 (10/10/2026): WhatsApp entra al MVP mediante Evolution API y n8n, como prueba con un número y un contacto; n8n invoca la IA y entrega JSON a Spring, que sigue siendo el único backend con reglas. Plazo de crédito de 15 a 30 días y una sola obligación por orden; el vendedor aprueba el crédito y la mora solo genera un aviso, sin bloqueo. KeptAI no integra el banco: concilia. Detalle en [actores, flujos y DER](../decisiones/actores-flujos-y-der-mvp.md). Lo que este documento diga en contrario queda como antecedente.
> SHA-256 del archivo recibido: `53d34a81d3d2ecce1c568f0239d7660794313afb0fe01969a328cfb26cf3cc34`.

## Procedencia y tratamiento editorial

Archivo original: `C:\Users\migue\.codex\attachments\e1e6aafe-56ff-4f9b-815d-97ea0bf5ad3b\Texto pegado.txt`.

Se conserva completo el contenido recibido a continuación. Se agregaron títulos y saltos de párrafo y se retiraron únicamente tres rótulos intercalados de paginación y encabezado. Las notas posteriores son observaciones editoriales separadas. Los bloqueos, automatizaciones y demás reglas del texto se registran como propuestas, sin ejecutarlas ni atribuirles aprobación empresarial.

Citar como `[USR-REDISENO-001, diagnóstico]` o `[USR-REDISENO-001, macroproceso N]`. La procedencia conserva su independencia respecto de las entrevistas y la ficha del Reto 6.

## Diagnóstico

El negocio no tiene un cuello de botella de ventas ni de producción, sino una hemorragia de liquidez en la cobranza. El 80% de las ventas se otorga a crédito de manera informal por WhatsApp, la deuda no está vinculada a la orden de producción y la morosidad/incobrables llega al 30%. Así, la empresa financia la operación de sus clientes (telas, talleres, operarios) a costa de su propio flujo de caja y de la planilla. Los seis macroprocesos siguientes buscan blindar el crédito, automatizar la cobranza y sincerar el flujo financiero real.

## Macroproceso 1: Captación, perfilamiento crediticio y formalización comercial

Transforma el chat informal de WhatsApp en un contrato comercial estructurado, con validación de riesgo antes de confeccionar.

### 1. Ingesta y estructuración de la orden (WhatsApp + IA)

Extracción multimodal (texto, audios e imágenes) de cantidades, telas, tallas, logos y fechas. Identificación del tipo de cliente (de a pie vs. corporativo) y asignación a la marca correspondiente (Corpotex o Unicrack).

### 2. Evaluación y aprobación de línea de crédito (anti-riesgo)

Bloqueo de crédito automático: el sistema consulta el historial del cliente. Si mantiene saldos vencidos o pagos en disputa, bloquea el crédito e instruye exigir pago contra entrega o anticipo. Aprobación formal: el vendedor ya no aprueba crédito libremente en el chat; el sistema exige ingresar las condiciones (plazo único de 30 o 45 días, límite de crédito o porcentaje de anticipo).

### 3. Ficha técnica y pagaré/compromiso digital

La orden genera un identificador único que ampara tanto las especificaciones de confección como el cronograma de deuda.  Emisión automática de un resumen formal al cliente por WhatsApp/correo, con el detalle del pedido y la fecha exacta de vencimiento del crédito.

## Macroproceso 2: Cuentas por cobrar, estados de cuenta y trazabilidad de pagos

Elimina la cobranza manual esporádica y vincula cada sol pagado con su orden de producción.

### 1. Cronograma y estados de cuenta dinámicos

Cada pedido a crédito genera una cuenta por cobrar con fecha de vencimiento explícita y alertas programadas. Link de estado de cuenta: el cliente corporativo consulta en cualquier momento, desde el móvil, su histórico de pedidos, facturas asociadas, saldos vigentes y abonos aplicados en tiempo real.

### 2. Cadencia automatizada de alertas

Preventivo: aviso de cortesía 3 días antes del vencimiento. Vencimiento: recordatorio el día exacto. Mora temprana: alerta al 3.er día posterior y escalamiento a administración si no hay abono. Si el sistema detecta un pago registrado y verificado, cancela automáticamente las alertas futuras para evitar reclamos.

### 3. OCR y desacoplamiento de pagos

Lectura automática de vouchers (Yape, Plin, transferencias) mediante IA para extraer banco, monto, fecha y código de operación. Detección de comprobantes duplicados para evitar fraudes. Conciliación en 4 fases: Factura/documento emitido → Comprobante recibido → Pago verificado en banco → Pago aplicado al saldo.

## Macroproceso 3: Control de producción condicionado y despacho trazable

Evita que producción y almacén trabajen a ciegas respecto al estado crediticio del cliente.

### 1. Gatekeeper financiero-operativo (liberación de orden)

Una orden solo avanza a la cola de producción (propia o talleres externos) si cumple su condición comercial: crédito aprobado formalmente o anticipo verificado.

### 2. Ruteo y trazabilidad por etapas

Registro de avances por estación: Corte → Sublimado/Bordado → Confección → Control de Calidad. Separación operativa y de costos entre el taller interno y los proveedores externos.

### 3. Despacho con constancia de entrega y reconocimiento de deuda

Al entregar las prendas se registra el acta/guía de despacho físico. El cierre operativo activa de inmediato el plazo del crédito en el módulo de tesorería, sincronizando la fecha desde la cual corre el vencimiento pactado.

## Macroproceso 4: Inventario físico, disponibilidad y mermas

Asegura que el material usado en pedidos a crédito esté reservado y costeado.

### 1. Disponibilidad y reserva transaccional

Regla de control: Disponible = Existencia física utilizable − Reservas activas. Al aprobarse la ficha se reservan los metros de tela e insumos, para no comprometer el mismo stock en pedidos simultáneos.

### 2. Consumo real vs. consumo teórico

Al iniciar el corte, el taller registra el metraje real consumido y libera el excedente reservado en una sola transacción.

### 3. Desperdicios y devoluciones

Registro formal de mermas e incidencias de calidad con trazabilidad del motivo, sin sobrescribir datos anteriores.

## Macroproceso 5: Costeo dinámico, precios de transferencia y margen real

Elimina la ilusión de rentabilidad al contrastar los costos desembolsados con el dinero efectivamente cobrado.

### 1. Costeo real por orden de trabajo

Imputación de la materia prima realmente consumida. Costo de mano de obra y de servicios de terceros (talleres externos). Prorrateo de costos indirectos de fabricación (CIF) y logística.

### 2. Taller como centro de resultados

El taller interno "vende" el servicio a Corpotex o Unicrack a precios de transferencia preestablecidos, lo que permite medir su eficiencia con independencia del margen comercial.

### 3. Margen percibido vs. margen facturado

Margen teórico/facturado: basado en el precio de venta acordado. Margen real percibido: calculado solo sobre los fondos efectivamente recaudados y conciliados en banco.

## Macroproceso 6: Cierre desacoplado y proyección real de flujo de caja

Sustituye los números "ilusorios" por liquidez proyectada, basada en cobros esperados y castigo por mora.

### 1. Desacoplamiento estricto de cierres

Cierre operativo: pedido confeccionado, entregado conforme y sin reclamos pendientes. Cierre financiero: saldo cobrado al 100% y conciliado en cuentas bancarias. Una orden puede estar cerrada operativamente y seguir abierta financieramente durante semanas.

### 2. Flujo de caja real vs. facturación ilusoria

El flujo de ingresos no se alimenta de ventas facturadas, sino de cuentas por cobrar ponderadas por probabilidad de cobranza. Se aplica un factor de castigo a las carteras morosas (reflejando el 30% histórico) para no proyectar liquidez ficticia. Cruce directo contra egresos fijos: planillas de Corpotex y Unicrack, alquileres, proveedores de insumos y amortizaciones de préstamos.

### 3. Fidelización y recompra condicionada

Seguimiento postventa a los 40 clientes corporativos recurrentes según su ventana de rotación. Condición inquebrantable: no se abren nuevas órdenes a crédito para un cliente con mora activa o saldo pendiente no negociado.

### 4. Interoperabilidad

Exportación de reportes limpios (CSV/Excel) para el software contable/tributario oficial (Factura Ya), sin duplicar la digitación manual.

## Observaciones de contraste y decisiones pendientes

Esta sección fue añadida al organizar el documento; no modifica el rediseño recibido.

### Diagnóstico y porcentajes

La afirmación de que no existen cuellos de botella de ventas o producción es el diagnóstico de este texto. Las entrevistas expresan interés en mejorar la organización productiva; antes de excluirla del diagnóstico hace falta medir retrasos, capacidad y causas. Véase [objetivos](../empresa/objetivos.md), con [A02-Q02] 02_ventas_produccion_cobranza.md, 00:23–01:23.

El 80% de ventas a crédito y el 30% de morosidad/incobrables se mantienen como cifras aportadas por el equipo. No se entregan aquí período, denominador ni registros de cálculo. La entrevista A02-Q10 contiene cifras discrepantes y A02-Q11 no acredita una tasa de morosidad o pérdida definitiva. Consultar [ventas](ventas.md), registros [A02-Q10] 02_ventas_produccion_cobranza.md, 05:29–05:44, y [A02-Q11] 02_ventas_produccion_cobranza.md, 05:44–06:25.

Por tanto, el factor de castigo que el macroproceso 6 denomina “30% histórico” queda como hipótesis de escenario pendiente de soporte. No calibrar probabilidades de cobranza ni pérdidas definitivas a partir de esa cifra sin validar la cartera y la metodología.

### Política crediticia y vencimiento

Definido por Isabel (10/10/2026): no hay bloqueo automático; el sistema avisa de la mora y el vendedor decide si vuelve a dar crédito. Los bloqueos automáticos por mora o disputa y la restricción de nuevas órdenes del texto recibido quedan como antecedente. Falta acordar autoridad de aprobación, excepciones, tratamiento de disputas y condiciones comerciales.

Definido por Isabel (10/10/2026): el plazo es de 15 a 30 días, con una sola obligación por orden. Los plazos de 30 o 45 días del texto recibido quedan como antecedente. La entrevista los menciona con limitaciones: [A02-Q32] 02_ventas_produccion_cobranza.md, 17:34–17:44, en [ventas](ventas.md).

El macroproceso 1 propone comunicar una fecha exacta de vencimiento y el macroproceso 3 propone iniciar el plazo al entregar. Acordar qué evento inicia el plazo y cómo se actualiza o confirma esa fecha, incluidas entregas parciales. No convertir el cierre operativo en disparador universal sin resolverlo.

La mención de pagaré o compromiso digital requiere definir qué documento se necesita y su validación correspondiente. Este registro no establece su efecto legal.

### Conciliación y saldo del cliente

La lectura de un voucher y la detección de duplicados son pasos de captura y control; la propia propuesta diferencia recepción de comprobante, verificación bancaria y aplicación al saldo. No confundir OCR con confirmación de fondos ni duplicado con fraude demostrado.

La consulta “en tiempo real” depende de sincronización y fuentes vigentes. Confirmar acceso a pagos, responsables de validación y controles del enlace de estado de cuenta. La cadencia de tres días antes, vencimiento y tres días después permanece propuesta.

### Costos, resultados internos y flujo de caja

El texto distingue margen facturado y “margen real percibido”. Antes de implementar, definir cada indicador, período, costos incluidos y tratamiento de cobros parciales. La medición sobre recaudación describe un enfoque de caja del documento y no reemplaza por sí sola una definición validada de rentabilidad.

Confirmar precios y reglas de cargos internos del taller y el tratamiento de consolidación, evitando contar un cargo interno como ingreso externo adicional. El centro de resultados es un requisito de la ficha del [Reto 6](../decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md), C-06; no se acredita que esté implementado.

### Proveedor y alcance

El texto llama “Factura Ya” al software oficial. En la entrevista permanece como posible nombre, sin proveedor o API confirmados: [A02-Q05] 02_ventas_produccion_cobranza.md, 02:38–02:51, en [ventas](ventas.md). Conservar esa pendiente al diseñar exportaciones.

El grupo de 40 clientes corresponde a clientes corporativos frecuentes según la entrevista, no al total de clientes: [A02-Q34] 02_ventas_produccion_cobranza.md, 18:10–19:26, en [atención](atencion-cliente.md). Los ciclos de recompra necesitan historial real.

## Relación con el proyecto

Este rediseño detalla una propuesta operativa para el recorrido de [Flujo Cliente-Empresa](flujo-cliente-empresa.md). Complementa los requisitos del [Reto 6](../decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md): captura multimodal, conciliación, costos, centro de resultados, proyección y exportación.

Debe revisarse junto con [decisiones del proyecto](../decisiones/decisiones-del-proyecto.md), especialmente P-007 y el alcance anterior que postergaba rentabilidad integral. Para convertir las propuestas en decisiones, registrar responsable, fecha, reglas acordadas, datos disponibles y criterios de aceptación.

## Referencias internas

- [Índice del cerebro](../INDICE.md).
- [Flujo Cliente-Empresa](flujo-cliente-empresa.md).
- [Ventas, producción, inventario y cobranza](ventas.md).
- [Atención al cliente](atencion-cliente.md).
- [Objetivos](../empresa/objetivos.md).
- [Reto 6](../decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md).
- [Decisiones del proyecto](../decisiones/decisiones-del-proyecto.md).
