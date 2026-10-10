# Flujo Cliente-Empresa

> ID documental: `USR-FLUJO-001`.
> Fuente: texto proporcionado por el usuario en esta conversación.
> Incorporación al cerebro KeptAI: 10 de octubre de 2026.
> Estado: descripción aportada por el equipo, pendiente de validación operativa. Se conserva íntegro el texto recibido; las observaciones de contraste están al final.

## Texto proporcionado

### El Flujo desde la Perspectiva del Cliente

1. **Descubrimiento y Contacto:** Veo publicidad de la empresa en redes sociales y me comunico vía WhatsApp para solicitar un pedido de uniformes o ropa deportiva.
2. **Atención y Diseño:** Coordino mis requerimientos con el vendedor asignado y el equipo de diseño personaliza las prendas.
3. **Acuerdo de Crédito:** En lugar de pagar el 100% por adelantado con un voucher, el vendedor me aprueba una línea de crédito para iniciar la producción de mis prendas.
4. **Recepción y Cobranza:** Recibo mis uniformes. Semanas o meses después, recibo mensajes de cobranza manuales y esporádicos por WhatsApp, sin un estado de cuenta formal o automático que me permita visualizar mi saldo exacto o historial de pagos parciales.

### El Flujo desde la Perspectiva de la Empresa (CORPOTEX)

1. **Ventas y Riesgo Crediticio:** El vendedor cierra el trato por WhatsApp. Para asegurar el volumen de operaciones, el 80% de estas ventas se aprueban a crédito.
2. **Coordinación y Producción:** El pedido pasa a la unidad productiva (propia o tercerizada). Las condiciones del crédito y los saldos pendientes quedan registrados informalmente en chats de WhatsApp o apuntes aislados, sin integrarse al sistema de facturación.
3. **Gestión de Cobranzas (El Cuello de Botella Crítico):** El personal administrativo intenta cobrar manualmente. Al no existir un sistema que vincule el pedido original con el saldo pendiente, se pierde la trazabilidad. No hay alertas de vencimiento ni un cronograma de cuentas por cobrar estructurado.
4. **Impacto por Morosidad:** La falta de seguimiento sistemático provoca que el 30% de esa cartera de créditos se quede sin cobrar, convirtiendo el esfuerzo de ventas y producción en una pérdida directa de capital.
5. **Cierre Financiero Ilusorio:** Cuando la gerencia revisa los números, el sistema refleja ventas y márgenes basados en los precios de facturación, pero el flujo de caja real está quebrado. La empresa asume los costos de insumos, terceros y producción, pero no recupera el dinero, imposibilitando proyectar la liquidez de las próximas semanas o medir la rentabilidad real de la operación.

## Observaciones de procedencia y contraste

Esta sección fue añadida al organizar el documento. El texto anterior conserva la descripción del usuario y no sustituye las restricciones de las otras fuentes.

- **80% de ventas a crédito:** es una cifra aportada en este mensaje. Falta período, denominador, alcance por marca o empresa y soporte de cálculo. El tramo de entrevista A02-Q10 tiene reconocimiento discrepante y no corrobora este porcentaje. [A02-Q10] 02_ventas_produccion_cobranza.md, 05:29–05:44.
- **30% de cartera sin cobrar:** es la interpretación aportada en este texto. La entrevista menciona aproximadamente un 30%, sin período ni denominador, y no lo acredita como tasa de morosidad o pérdida definitiva. No equiparar saldo pendiente, saldo vencido e incobrable. [A02-Q11] 02_ventas_produccion_cobranza.md, 05:44–06:25.
- **Ausencia de vínculo o cronograma:** el texto describe falta de trazabilidad efectiva. Según la entrevista, sí existe un módulo de cuentas por cobrar que puede quedar desactualizado; confirmar qué enlaces, vencimientos y reportes conserva antes de afirmar una ausencia técnica absoluta. [A02-Q04] 02_ventas_produccion_cobranza.md, 02:17–02:38.
- **Aprobación de línea de crédito:** el recorrido presenta al vendedor como aprobador. El rol autorizado, los límites, las condiciones y el plazo real requieren validar la política empresarial. La entrevista menciona 30 y 45 días y una confirmación de 30 días, sin resolver todos los casos. [A02-Q32] 02_ventas_produccion_cobranza.md, 17:34–17:44.
- **Pérdida de capital y flujo de caja quebrado:** son conclusiones del texto proporcionado. Para acreditarlas hacen falta saldos vigentes, pagos aplicados, antigüedad de deuda y criterios de incobrabilidad. No se desprenden por sí solas de un porcentaje sin base documentada.

## Uso en el proyecto

El documento aporta un recorrido narrativo de cliente y empresa y permite localizar puntos de validación: acuerdo de crédito, pedido confirmado, producción, entrega, saldo pendiente, seguimiento de cobranza y consulta financiera.

Para convertir el recorrido en requisitos aprobados, acordar actores, registros, estados, evidencia de pago, reglas de vencimiento y criterios de aceptación. La descripción no acredita implementación ni autoriza cobros o decisiones crediticias.

## Relaciones y referencias

- [Índice del cerebro](../INDICE.md).
- [Ventas, producción y cobranza](ventas.md): contiene los registros completos A02-Q04, A02-Q10, A02-Q11 y A02-Q32 y sus limitaciones.
- [Atención al cliente](atencion-cliente.md).
- [Reto 6: conciliación y rentabilidad](../decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md).
- [Decisiones del proyecto](../decisiones/decisiones-del-proyecto.md).

Citar el contenido aportado como `[USR-FLUJO-001, perspectiva del cliente]` o `[USR-FLUJO-001, perspectiva de la empresa]`. Las referencias A01/A02 mantienen su origen de entrevista y no son una verificación independiente de este mensaje.
