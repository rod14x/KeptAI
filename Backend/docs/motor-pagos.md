# Motor de pagos — guía de integración (AND-MOTOR-001)

Responsable: Andrés (roadmap §2). Consumidor: Miguel, MIG-07. Estado: **implementado y probado contra PostgreSQL real con login runtime**. Todavía no está expuesto por HTTP.

Código: `Backend/src/main/java/pe/keptai/backend/finanzas/`. El bean `MotorPagos` se registra por autoconfiguración solo cuando existe `JdbcTemplate` (perfiles `local`/`prod`); en `dev`/`test` sin base no existe.

## Contrato Java

Todas las operaciones reciben un `ContextoFinanciero` que Spring ya autenticó (MIG-03): organización + exactamente un usuario **o** un servicio. El motor fija `app.organizacion_id`, `app.usuario_id` y `app.servicio_id` como contexto local de **su propia transacción** y comprueba el rol con `keptai_private.actor_actual()`. El adapter no debe tomar esos valores del cuerpo de la petición.

| Método | Rol | Endpoint del contrato | Qué hace |
|---|---|---|---|
| `verificarPago(ctx, pagoId)` | ADMIN | `POST /payments/{id}/verifications` | RECIBIDO → VERIFICADO_BANCO, simulado y rotulado. No aplica ni cambia saldos. Rechaza duplicados y referencias ya usadas. |
| `detectarDuplicado(ctx, pagoId)` | VENDEDOR, ADMIN, GERENTE, INGESTA, SCHEDULER | Clasificación de conciliación | Devuelve el pago anterior con la misma referencia, monto y fecha. Solo consulta. |
| `marcarDuplicado(ctx, pagoId)` | ADMIN | Revisión | Marca DUPLICADO con `duplicado_de_pago_id` y abre la alerta PAGO_EN_REVISION. Es idempotente. |
| `aplicarPago(ctx, pagoId, obligacionId, montoSoles)` | ADMIN | `POST /payments/{id}/applications` | Aplica en una sola transacción: bloquea pago y obligación, valida, inserta la aplicación, recalcula estados, resuelve alertas, cancela envíos si queda saldo 0 y audita. |
| `anularAplicacion(ctx, aplicacionId, motivo)` | ADMIN | Corrección | Anula con autor, motivo y fecha; no borra. Reanular se rechaza. Para corregir se registra una aplicación nueva. |
| `saldo(ctx, obligacionId)` | VENDEDOR, ADMIN, GERENTE, SCHEDULER | `GET /receivables/...` | Saldo calculado desde `v_saldo_obligacion`. |
| `estadoPago(ctx, pagoId)` | lectores de pagos | `GET /payments/{id}` | Fase, conciliación, aplicado y sin aplicar. |

Los importes van en **soles `BigDecimal`** con máximo 2 decimales. El adapter convierte desde y hacia centavos con `MoneyBridge`. El motor nunca recibe un saldo.

## Errores (`MotorFinancieroException.codigo()`)

Coinciden con los códigos de dominio propuestos en `openapi.yaml`:

| Código | HTTP sugerido | Caso |
|---|---|---|
| `NOT_FOUND` | 404 | No existe o es de otra organización (la RLS no distingue ambos casos). |
| `FORBIDDEN` | 403 | Rol no permitido, contexto inactivo o rechazo de la base (42501). |
| `VALIDATION_ERROR` | 400 | Importe ≤ 0 o con más de 2 decimales; motivo vacío. |
| `PAYMENT_NOT_VERIFIED` | 422 | Voucher solo recibido (QA-03). |
| `DUPLICATE_PAYMENT` | 422 | Duplicado o referencia ya usada (QA-04). |
| `ORPHAN_PAYMENT` | 422 | Pago sin cliente (QA-05). |
| `INSUFFICIENT_BALANCE` | 422 | Supera lo verificado sin aplicar o el saldo. También cubre un reintento tras consumir el pago. |
| `CURRENCY_MISMATCH` | 422 | Moneda distinta. |
| `INVALID_STATE` | 409 | Transición no permitida (ya verificado, ya anulada, obligación anulada, otro cliente). |
| `CONCURRENCY_CONFLICT` | 409 | Deadlock o fallo de serialización: reintentar la operación completa con la misma Idempotency-Key. |

## Reglas que implementa

- Solo un pago verificado y no duplicado reduce la deuda. El OCR o el voucher nunca verifican fondos.
- La suma de aplicaciones vigentes nunca supera el pago ni la obligación. Los bloqueos van en orden pago → obligación, el mismo del trigger V5, y la base lo vuelve a validar.
- Estado de la obligación: PAGADA si el saldo es 0; MORA si vence antes de la fecha local de la organización; PARCIAL si hay cobro; PENDIENTE en otro caso.
- Estado del pago: APLICADO si todo lo aplicado salda sus obligaciones; PARCIAL si alguna sigue con saldo; vuelve a VERIFICADO_BANCO/PENDIENTE si se anulan todas sus aplicaciones.
- Auditoría append-only (`PAGO_VERIFICADO`, `PAGO_DUPLICADO`, `PAGO_APLICADO`, `APLICACION_ANULADA`) con `request_id` del MDC, en la misma transacción. Si algo falla, se revierte todo.

## Lo que queda del lado del adapter (MIG-05/07)

- **Idempotencia HTTP (VAL-02):** reservar y responder con `solicitud_idempotente` alrededor de cada llamada. El motor garantiza que no se sobreaplica, pero no devuelve la respuesta anterior.
- **Mapeo a DTOs del contrato** (`PaymentDtos`, `ReceivableDtos`) y paginación.
- **`display_code` de pagos (V-00x):** no hay columna en V7. Hay que acordar dónde guardarlo.

## Motor de cobranza (AND-COBRANZA-001)

`MotorCobranza` usa la misma base transaccional (`TransaccionFinanciera`).

| Método | Rol | Qué hace |
|---|---|---|
| `registrarDespacho(ctx, ordenId, fecha, actaStoragePath)` | ADMIN, JEFE_TALLER | Inserta el acta. El trigger V8 exige orden liberada o en producción, la pasa a DESPACHADA, fija `vence_en = fecha + plazo` y recalcula el estado. `venceEn` llega null al taller, que no lee obligaciones. |
| `evaluarCobranza(ctx, fechaCorte)` | ADMIN, SCHEDULER | Corrida idempotente del job (ver detalle abajo). |

`evaluarCobranza` hace, en este orden:
1. Recalcula estados (MORA, PAGADA…) con `keptai_private.actualizar_estados_cobranza()`.
2. Abre una alerta MORA_TEMPRANA por obligación a los +3 días.
3. Programa recordatorios −3, 0 y +3 en `envio_notificacion`, a las 09:00 hora local y con clave `obligacion:tipo`. Solo programa fechas que aún no pasaron y solo si el cliente tiene `canal_whatsapp`.
4. Cancela los recordatorios pendientes de deudas saldadas o anuladas.

Errores nuevos: un despacho repetido o una orden no liberada devuelven `INVALID_STATE` con el mensaje de la base; una orden inexistente devuelve `NOT_FOUND`. El envío por WhatsApp lo hace WF3 a partir del outbox; el texto se genera al enviar y no se guarda (D-007).

**Para MIG-07:** falta un `@Scheduled`, o un Render Cron, que llame a `evaluarCobranza` con un `ContextoFinanciero.servicio` de alcance SCHEDULER por organización, con la fecha local de Lima.

## Motor de resultados y caja (AND-RESULTADOS-001)

| Método | Rol | Endpoint del contrato | Qué hace |
|---|---|---|---|
| `MotorResultados.margen(ctx, ORDEN\|MARCA\|LINEA, tipoProduccion?, fechaCorte)` | GERENTE, ADMIN | `GET /results/margins` | Margen por pedido, marca o línea. Línea = ingreso del ítem − costos asignados a ese ítem (V9). |
| `MotorResultados.centroProductivo(ctx, fechaCorte)` | GERENTE, ADMIN | `GET /results/production-center` | Por cada cargo interno activo calcula taller, comercial y consolidado; el cargo se elimina al consolidar. |
| `MotorResultados.resumen(ctx, fechaCorte)` | GERENTE, ADMIN | `GET /results/summary` | Mantiene separados ventas, cobrado aplicado, saldo, costo y margen. |
| `MotorResultados.csvPedidos(ctx, fechaCorte)` | GERENTE, ADMIN | `GET /reports/orders.csv` | Columnas exactas del contrato, centavos con signo, celda vacía para ausente, RFC 4180 y protección contra inyección de fórmulas. |
| `MotorCaja.proyectar(ctx, fechaCorte, riesgoCobroBps)` | GERENTE, ADMIN, SCHEDULER | `GET /results/cash-forecast` | 4 semanas de lunes a domingo; los días entre el corte y el primer lunes entran en la semana 1. |

**Reglas de resultados:**
- **Cuándo un margen está completo:** requiere el costeo cerrado (`costos_reales_completos`). Si está incompleto, `costoTotal` y `margen` son null, nunca 0.
- **Componentes faltantes:** se calculan con los componentes esperados según el tipo de producción. INTERNA espera MATERIA_PRIMA, MANO_OBRA y CIF; TERCERIZADA espera TERCERO.
- **Margen por línea completo:** además, cada costo real debe estar asignado al 100% y todos los ítems deben tener línea.
- **Centro productivo:**
  - taller = cargo interno − costos reales de etapas de esa unidad;
  - comercial = venta − cargos internos − costos no atribuidos a talleres con cargo;
  - consolidado = venta − todos los costos reales.

  Un costo sin etapa deja el resultado incompleto.

**Reglas de caja:**
- **Cobro esperado:** el saldo calculado de cada obligación; si ya venció, cae en la semana 1. Sin vencimiento va a `cobrosSinFecha`; después del horizonte, a `cobrosFueraHorizonte`.
- **Realizado:** pagos verificados no duplicados, por `fecha_pago`.
- **Egresos:** los previstos (vencidos en la semana 1) y los realizados, por `fecha_realizada`.
- **Apertura:** la última con fecha ≤ corte, más el movimiento real hasta el corte.
- **Sin apertura:** los cierres quedan null. Un saldo negativo es válido.
- **Dinero sin asignar:** los pagos verificados aún no aplicados se reportan en `dineroSinAsignar`. No se descuentan del cobro esperado, porque solo lo aplicado lo reduce (DB-DEF-001 §6).
- **Cargo interno:** nunca entra en caja.

**Para el adapter:** `MoneyBridge.solesToCents` rechaza negativos. Margen, resultados y cierres de caja pueden ser negativos; deben mapearse al tipo de monto con signo de `CommonDtos`. Los componentes de costo usan el vocabulario SQL; equivalencias con el contrato:

| SQL | Contrato |
|---|---|
| MATERIA_PRIMA | raw_materials |
| MANO_OBRA | labor |
| CIF | overhead |
| TERCERO | outsourced |
| LOGISTICA | logistics |

## Motor de costos (AND-COSTOS-001)

Lo que alimenta el margen por línea y el centro productivo desde la aplicación, sin SQL manual:

| Método | Rol | Qué hace |
|---|---|---|
| `registrarCosto(ctx, ordenId, etapaId?, concepto, monto, REAL\|TEORICO, fuente)` | ADMIN, JEFE_TALLER | Registra un costo en la moneda de la orden. El taller solo ve órdenes liberadas o posteriores. Reabre el cierre. |
| `asignarCosto(ctx, costoId, itemId, monto, fuente)` | ADMIN, JEFE_TALLER | Asignación manual (alta o corrección) de un costo a un ítem. La base rechaza que la suma supere el costo o que el ítem sea de otra orden. |
| `repartirCostos(ctx, ordenId, UNIDADES\|VALOR_VENTA)` | ADMIN, JEFE_TALLER | Prorratea cada costo REAL entre todos los ítems (ver detalle abajo). |
| `registrarTransferencia(ctx, ordenId, tallerId, monto, criterio, fuente)` | ADMIN | Cargo interno del taller propio; uno activo por taller y orden. |
| `anularTransferencia(ctx, id, motivo)` | ADMIN | Corrección por anulación; reanular se rechaza. |
| `cerrarCosteo(ctx, ordenId, REAL\|TEORICO)` | ADMIN | Cierre explícito y auditado; habilita el margen certificado (ver detalle abajo). |

`repartirCostos` reparte los centavos por mayor residuo, con desempate por id del ítem: es determinista y no pierde ni crea centavos. Por ejemplo, 100 entre 3 da 33.34 / 33.33 / 33.33. Primero pone en cero las asignaciones existentes, así que una corrección nunca supera el costo a mitad de camino.

`cerrarCosteo` exige al menos un costo del origen. Devuelve avisos, sin bloquear: componentes faltantes según el tipo de producción y si la asignación por ítem está completa. Cualquier costo, asignación o cargo posterior reabre el cierre (V5/V9).

El cierre es solo de ADMIN porque el taller no puede escribir la orden por RLS (V7). Todas las operaciones quedan auditadas en la misma transacción: `COSTO_REGISTRADO`, `COSTO_ASIGNADO`, `COSTOS_REPARTIDOS`, `CARGO_INTERNO_*` y `COSTEO_CERRADO`.

## Pruebas

`MotorCostosTests` (5) cubre:
- reparto exacto por unidades y por valor de venta;
- asignación manual con límite y bloqueo de ítems de otra orden;
- cargo interno: uno activo por taller, solo de taller interno, anulación y reregistro;
- cierre con avisos y reapertura ante cambios;
- roles, validaciones y alcance del taller.

`MotorResultadosCajaTests` (11) cubre:
- **QA-08:** margen −40 / 150 / 110 por pedido, marca y línea.
- **Costos incompletos:** margen null y componentes faltantes.
- **Línea:** sin asignación completa queda incompleta.
- **QA-09:** taller −20, comercial −20, consolidado −40; un costo sin etapa lo deja incompleto.
- **Invariantes V9:** el cargo solo sale de un taller interno, la transferencia es inmutable, costo e ítem deben ser de la misma orden y un costo no baja de lo ya asignado.
- **Resumen:** 800 / 400 / 400 / 690 / 110.
- **QA-12:** filas exactas del CSV y protección contra inyección de fórmulas.
- **QA-10:** caja con cierres 250 / 250 / −50 / −50 y riesgo de cobro.
- **Sin apertura:** cierres null.
- **Sin doble conteo:** un pago verificado y luego aplicado no se cuenta dos veces.
- **Roles.**

`MotorCobranzaTests` (7) verifica:
- despacho del taller → vencimiento y orden despachada;
- despacho antiguo → MORA;
- reglas: roles, acta, fecha previa al inicio de producción, orden inexistente, repetido, borrador y acta inmutable;
- job idempotente con horarios exactos;
- mora temprana a los +3 días;
- corrección de estados y cancelación de recordatorios.

`MotorPagosTests` (10) usa PostgreSQL 17, V1→V7 por Flyway, la semilla demo y el login `motor_app` miembro de `keptai_runtime`. Cubre:
- **QA-03:** recibido sin verificar.
- **QA-04:** reintento y duplicado.
- **QA-06:** pago completo cierra el saldo, resuelve alertas y cancela envíos.
- Pago parcial; detección y marcado de duplicado; anulación y re-aplicación.
- Roles y aislamiento entre organizaciones.
- Reversión total ante un fallo antes del commit (VAL-01/04).
- Concurrencia sobre el mismo pago y sobre dos pagos contra una misma obligación (VAL-05).

`MotorFinancieroAutoConfigurationTests` comprueba que el bean solo existe cuando hay base.
