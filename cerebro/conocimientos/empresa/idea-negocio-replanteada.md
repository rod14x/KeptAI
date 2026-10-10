# Idea de negocio replanteada

> Actualización de alcance del MVP (10/10/2026): [D-004](../decisiones/decisiones-del-proyecto.md) elige Spring Boot y excluye uso de datos ERP/CRM por falta de acceso. El texto original conserva la visión del producto; las integraciones descritas no son tareas ni dependencias del MVP vigente.

> Actualización D-005 (10/10/2026): WhatsApp entra al MVP con Evolution API y n8n en modo prueba; plazo de 15 a 30 días con una sola obligación por orden; el vendedor aprueba el crédito y la mora solo genera un aviso. Ver [actores, flujos y DER](../decisiones/actores-flujos-y-der-mvp.md).

> Fecha de incorporación: 10 de octubre de 2026. Referencia: USR-IDEA-001.
> Fuente: texto aportado por el usuario en esta conversación. Responsable de la dirección: usuario del proyecto.
> Estado: definición principal vigente del producto por indicación expresa del usuario. Las cifras, capacidades de integración y resultados comerciales todavía requieren validación; no son hechos verificados por este documento.

## Qué resolvemos

Corpotex vende mucho, pero **no sabe cuánto de lo que vende cobra, cuánto gana de verdad ni cuánta plata tendrá en las próximas semanas**. El diagnóstico aportado atribuye esta brecha a información dispersa en chats de WhatsApp, vouchers en fotos y apuntes de una persona, sin registro sistemático en sus sistemas.

## Las tres fugas de dinero

1. **Plata que no se cobra:** se afirma que el 80% de las ventas es a crédito, con plazos de 15 a 30 días, y que la cobranza depende de una persona atenta a WhatsApp. Sin alertas, algunos vencimientos quedan sin seguimiento. El **30% aún no está claro**: hay que confirmar si corresponde a cuentas por cobrar o a deuda incobrable.
2. **Plata que no sabes si ganas:** los reportes muestran el precio facturado, pero no el costo real. Los uniformes deportivos se venden en volumen con poco margen y los profesionales con mayor margen; falta medirlo por pedido, línea y marca. También falta separar producción propia y tercerizada.
3. **Plata que no ves venir:** sin un cronograma de cobros no se puede proyectar el flujo de caja.

Estas son declaraciones y diagnósticos de la fuente recibida, pendientes de contraste con registros y responsables de la empresa.

## El producto: una capa de caja, no otro CRM

La dirección es conectarse a los sistemas existentes —Kommo y el ERP mencionados por el usuario— y resolver cuatro funciones:

- **Captura:** convertir chats y fotos de vouchers de Yape, Plin y transferencias en pedidos y pagos ordenados, con confirmación humana.
- **Concilia:** cruzar cada pago con su pedido y distinguir pedidos pagados o parciales y pagos duplicados, huérfanos o con diferencias.
- **Cobra:** cronograma de 15 y 30 días, alertas de vencimiento, estado de cuenta y autorización obligatoria si el cliente ya tiene saldo.
- **Muestra la verdad:** margen real por pedido, línea y marca; producción como centro de resultados; flujo de caja de **4 semanas** y reporte automático.

**Segunda fase:** recordatorios de recompra para el grupo de 40 clientes frecuentes, gestión y alertas de stock, y cotizaciones. Estas funciones no definen el alcance principal de la primera fase.

La identificación del ERP y los mecanismos de acceso a ambos sistemas quedan pendientes. La mención de una integración no acredita que exista una API disponible o una conexión implementada.

## Para quién y cómo crece

El producto se dirige a negocios que venden por WhatsApp a crédito: confección, ferretería, distribución y servicios. Corpotex es el piloto previsto y el futuro caso de éxito; ese éxito aún debe demostrarse.

El crecimiento consiste en repetir el mismo producto en muchas empresas, con configuración e integraciones por empresa.

## Modelo de negocio — hipótesis

Mensualidad por empresa más un porcentaje de lo que se recupera. La hipótesis busca vincular el cobro del producto con el valor percibido por el cliente.

Para Corpotex se propone estimar la recuperación incremental con:

**Ventas al mes × proporción por cobrar × mejora de cobranza.**

No hay cifras suficientes para calcular ese valor. Antes de usar la fórmula hay que definir período, cartera elegible, línea base y significado de la mejora. El porcentaje comercial sobre recuperación, la atribución de resultados y el precio mensual también están pendientes; no constituyen un acuerdo firmado.

## Por qué nosotros

La lectura de vouchers con IA es una capacidad copiable. La diferenciación propuesta se apoya en conocer los formatos peruanos de pago, construir historial de comportamiento de pago por cliente y conectar los sistemas que usa cada empresa.

Esta es una hipótesis de ventaja competitiva, no una exclusividad o capacidad ya demostrada.

## La demo de 3 minutos

Se suben **3 vouchers y un chat**. En pantalla:

1. Se concilian los pagos con los pedidos.
2. Aparece un pedido con **margen negativo**.
3. Se activa una alerta de cobranza.
4. Se actualiza el flujo de caja.

Para demostrar el margen negativo se necesitan costos y precio del pedido previamente cargados; los vouchers y el chat por sí solos no prueban su rentabilidad. Para la proyección se requieren vencimientos y supuestos de entradas y salidas. Si la demo usa datos ficticios, deben identificarse como demostración.

## Pitch en dos frases

> Corpotex ya tiene su CRM y su ERP. Lo que no tiene es lo que pasa entre los dos: la plata que se cobra, la que se gana y la que viene. Nosotros la ponemos a la vista.

## Antes de afirmarlo en el pitch

- Confirmar con el mentor y con registros el **80% a crédito** y el significado del **30%**. No presentar el 30% como pérdida, castigo o incobrabilidad confirmada.
- Confirmar de qué sistema sale el stock y quién mantiene ese dato.
- Confirmar los plazos reales: este replanteamiento menciona 15 y 30 días; las entrevistas previas registran otros plazos. Deben configurarse con una política validada.
- Confirmar sistemas existentes y acceso a costos, pagos, pedidos y vencimientos.

## Precedencia y relación con el cerebro

Esta definición prevalece sobre las prioridades iniciales de stock, fidelización y postventa general. **La conciliación, cobranza, rentabilidad y caja pertenecen a la primera fase; stock, cotizaciones y recompra quedan en segunda fase.** Los documentos anteriores se conservan como antecedentes y fuentes.

La producción permanece dentro del núcleo financiero como centro de resultados, con costos propios y de terceros. Postergar el módulo de stock no elimina la necesidad de obtener costos e insumos consumidos para calcular márgenes.

El [Reto 6](../decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md) también solicita captura de texto, audio e imágenes; ese criterio sigue siendo una referencia de aceptación y debe considerarse junto con la captura descrita aquí.

Consultar [objetivos](objetivos.md), [decisiones del proyecto](../decisiones/decisiones-del-proyecto.md), [Flujo Cliente-Empresa](../procesos/flujo-cliente-empresa.md) y [Rediseño de Procesos](../procesos/rediseno-procesos-credito-y-cobranza.md). Sus propuestas deben interpretarse conforme a esta prioridad vigente.

## Nota sobre el texto recibido

La fuente cerraba ofreciendo agregar una sección o preparar una especificación ejecutable. Esa frase se conserva como contexto de la fuente; no es una instrucción para implementar software. La solicitud atendida es incorporar esta definición al cerebro y publicarla en Git.
