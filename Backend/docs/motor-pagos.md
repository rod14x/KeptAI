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

## Pruebas

`MotorPagosTests` (10) usa PostgreSQL 17, V1→V7 por Flyway, la semilla demo y el login `motor_app` miembro de `keptai_runtime`. Cubre:
- **QA-03:** recibido sin verificar.
- **QA-04:** reintento y duplicado.
- **QA-06:** pago completo cierra el saldo, resuelve alertas y cancela envíos.
- Pago parcial; detección y marcado de duplicado; anulación y re-aplicación.
- Roles y aislamiento entre organizaciones.
- Reversión total ante un fallo antes del commit (VAL-01/04).
- Concurrencia sobre el mismo pago y sobre dos pagos contra una misma obligación (VAL-05).

`MotorFinancieroAutoConfigurationTests` comprueba que el bean solo existe cuando hay base.
