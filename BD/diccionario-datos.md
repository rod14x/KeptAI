<!-- Versión 1.0.0 | 2026-10-10 | Autor: Andrés -->
# Diccionario de datos – KeptAI V1

Convenciones comunes a todas las tablas (no se repiten abajo):

- `id uuid PK DEFAULT gen_random_uuid()`.
- `organizacion_id uuid NOT NULL FK → organizacion`, más `UNIQUE (organizacion_id, id)`. Todas las FK de negocio son compuestas `(organizacion_id, x_id)`.
- Importes `numeric(18,2)`. `moneda char(3)` ISO 4217, por defecto `PEN`.
- `date` para fechas de negocio (America/Lima) y `timestamptz` para instantes.
- En la columna **Null**, ✔ significa que admite NULL.

---

## organizacion
Empresa usuaria de KeptAI (tenant). No lleva `organizacion_id`.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| nombre | text | | |
| ruc | varchar(11) | ✔ | |
| zona_horaria | text | | Por defecto `America/Lima`. |
| moneda_base | char(3) | | Por defecto `PEN`. |
| creado_en | timestamptz | | |

## usuario
Persona con acceso al panel o que opera por WhatsApp. La membresía se simplifica a un rol dentro de una sola organización.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| auth_user_id | uuid | | `sub` del JWT de Supabase. UNIQUE por organización. |
| nombre | text | | |
| email | text | ✔ | |
| rol | text | | `VENDEDOR`, `ADMIN`, `GERENTE` o `JEFE_TALLER`. |
| whatsapp_jid | text | ✔ | Reconoce `/cerrar` y `/ok`. UNIQUE por organización. |
| activo | boolean | | |

## marca · linea_producto
Clasificación para medir el margen por marca y por línea. `nombre` es UNIQUE por organización. Ejemplos: CORPOTEX, UNICRACK / DEPORTIVO, PROFESIONAL, ESCOLAR (valores ilustrativos).

## cliente
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| razon_social | text | | |
| tipo | text | | `COLEGIO`, `EMPRESA` o `PERSONA`. |
| ruc_dni | varchar(11) | ✔ | UNIQUE parcial por organización cuando no es nulo. |
| limite_credito | numeric | ✔ | ≥ 0. Es referencia para el vendedor; no bloquea. |

La mora se lee en la vista `v_cliente_mora`, no en una columna.

## contacto
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| cliente_id | uuid FK | | |
| nombre | text | | |
| whatsapp_jid | text | ✔ | UNIQUE por organización. Sirve para identificar al remitente de un voucher. |

## chat
Conversación de WhatsApp en una instancia de Evolution.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| cliente_id | uuid FK | ✔ | NULL mientras no se identifica al cliente. |
| vendedor_id | uuid FK usuario | ✔ | |
| instancia | text | | Por ejemplo `ventas-01`. |
| chat_jid | text | | UNIQUE (organización, instancia, chat_jid). |

## mensaje
Mensaje entrante o propio del chat: es la evidencia de origen.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| chat_id | uuid FK | | |
| provider_msg_id | text | | `key.id` de Evolution. UNIQUE por chat, lo que hace idempotente la reingesta. |
| from_me | boolean | | |
| tipo | text | | `TEXTO`, `AUDIO`, `IMAGEN`, `DOCUMENTO` u `OTRO`. |
| contenido_texto | text | ✔ | Texto o transcripción del audio. |
| archivo_storage_path | text | ✔ | Ruta en el bucket privado. |
| archivo_hash | char(64) | ✔ | SHA-256 en hexadecimal. |
| enviado_en | timestamptz | | |

## orden
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| ref | text | | `ORD-123`. UNIQUE por organización. |
| cliente_id | uuid FK | | |
| marca_id | uuid FK | ✔ | |
| vendedor_id | uuid FK usuario | ✔ | |
| chat_id | uuid FK | ✔ | Chat de origen. NULL si la orden se creó manualmente. |
| estado | text | | `BORRADOR` → `PENDIENTE_APROBACION` → `RETENIDA`/`LIBERADA` → `EN_PRODUCCION` → `DESPACHADA` → `CERRADA`, o bien `CANCELADA`. |
| condicion_pago | text | | `CONTADO`, `ANTICIPO` o `CREDITO`. Si es `CREDITO`, `plazo_dias` es obligatorio. |
| plazo_dias | int | ✔ | ≥ 0. La política vigente es de 15 a 30 días y la valida Spring. |
| anticipo_requerido | numeric | | ≥ 0 y ≤ total. |
| total | numeric | | ≥ 0. |
| moneda | char(3) | | |
| tipo_produccion | text | | `INTERNA` o `TERCERIZADA`. |
| fecha_entrega_solicitada | date | ✔ | |
| fecha_inicio_produccion | date | ✔ | La fija Spring cuando pasa el gatekeeper. |
| origen | text | | `WHATSAPP`, `MANUAL` o `CSV`. |
| idempotency_key | text | ✔ | UNIQUE por organización. |
| version | bigint | | Para JPA `@Version`. |
| creado_en, actualizado_en | timestamptz | | |

## orden_item
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| orden_id | uuid FK | | `ON DELETE CASCADE`, solo aplicable a borradores. |
| linea_id | uuid FK linea_producto | ✔ | |
| descripcion | text | | |
| tela, talla, logo | text | ✔ | |
| cantidad | int | | > 0. |
| precio_unit | numeric | | ≥ 0. |

## hoja_resumen
Versiones del resumen que extrae la IA (WF1). La IA propone y el vendedor confirma.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| orden_id | uuid FK | | |
| chat_id | uuid FK | ✔ | |
| version | int | | ≥ 1. UNIQUE por orden. |
| extraccion | jsonb | | JSON `extraccion` de WF1. |
| campos_ausentes | jsonb | | Array; por defecto `[]`. |
| resumen_md | text | | `hojaResumenMd`. |
| confianza | numeric(4,3) | ✔ | Entre 0 y 1. |
| mensajes_procesados | int | ✔ | |
| estado | text | | `BORRADOR`, `CONFIRMADA` o `DESCARTADA`. `CONFIRMADA` exige `revisado_por`. |
| revisado_por | uuid FK usuario | ✔ | |
| revisado_en | timestamptz | ✔ | |

## aprobacion_credito
Decisión del vendedor. Hay una por orden y el historial queda en `evento_auditoria`.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| orden_id | uuid FK | | UNIQUE. |
| aprobado_por | uuid FK usuario | ✔ | Obligatorio si la decisión no es `PENDIENTE`. |
| decision | text | | `PENDIENTE`, `APROBADO` o `RECHAZADO`. |
| aviso_mora_mostrado | boolean | | Registra que el vendedor vio el aviso de mora antes de decidir. |
| saldo_referencia | numeric | | Saldo vencido del cliente en el momento de decidir. |
| plazo_dias | int | ✔ | |
| anticipo_pct | numeric(5,2) | ✔ | Entre 0 y 100. |
| motivo | text | ✔ | |
| compromiso_digital_id | text | ✔ | |
| decidido_en | timestamptz | ✔ | Obligatorio si la decisión no es `PENDIENTE`. |

## obligacion_cobro (antes CUOTA)
Única obligación de pago por orden (D-005).

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| orden_id | uuid FK | | UNIQUE. |
| monto | numeric | | > 0. |
| moneda | char(3) | | |
| evento_inicio_plazo | text | | `DESPACHO`. |
| plazo_dias | int | | ≥ 0. |
| vence_en | date | ✔ | `fecha_despacho + plazo_dias`. NULL hasta que exista el acta. |
| estado | text | | `PENDIENTE`, `PARCIAL`, `PAGADA`, `MORA` o `ANULADA`. Es un estado operativo; el saldo verdadero está en `v_saldo_obligacion`. |
| version | bigint | | |

## pago
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| cliente_id | uuid FK | ✔ | NULL si no se identifica al remitente (`SIN_ORDEN`). |
| monto | numeric | | > 0. |
| moneda | char(3) | | |
| fecha_pago | date | | |
| medio | text | | `YAPE`, `PLIN`, `TRANSFERENCIA`, `DEPOSITO`, `EFECTIVO` u `OTRO`. |
| banco | text | ✔ | |
| codigo_operacion | text | ✔ | El índice (código, monto, fecha) es una **señal** de duplicado; no es UNIQUE. |
| fase | text | | `RECIBIDO` → `VERIFICADO_BANCO` → `APLICADO`. Desde `VERIFICADO_BANCO` exige `verificado_por` y `verificado_en`. |
| estado_conciliacion | text | | `PENDIENTE`, `APLICADO`, `PARCIAL`, `DUPLICADO`, `SIN_ORDEN` o `NO_CUADRA`. |
| verificado_por | uuid FK usuario | ✔ | |
| verificado_en | timestamptz | ✔ | |
| idempotency_key | text | ✔ | Por ejemplo, el `mensajeId` de WF2. UNIQUE por organización. |
| version | bigint | | |

## comprobante
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| pago_id | uuid FK | | Un pago admite varios comprobantes. |
| mensaje_id | uuid FK | ✔ | Mensaje de WhatsApp de origen. |
| banco | text | ✔ | |
| archivo_storage_path | text | | Bucket privado. |
| archivo_hash | char(64) | | Indexado como señal de imagen repetida. |
| ocr_extraccion | jsonb | ✔ | JSON de WF2 tal como llega. |
| confianza | numeric(4,3) | ✔ | |

## aplicacion_pago
Puente entre pago y obligación. Es lo único que mueve saldo.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| pago_id | uuid FK | | |
| obligacion_id | uuid FK | | |
| monto_aplicado | numeric | | > 0. |
| aplicado_por | uuid FK usuario | | |
| aplicado_en | timestamptz | | |
| anulada_en / anulada_por | timestamptz / uuid | ✔ | Se llenan las dos o ninguna. Una fila anulada no cuenta para el saldo. |
| motivo_anulacion | text | ✔ | |

Trigger `tg_aplicacion_pago_validar`: exige el pago verificado y la misma moneda, y no permite sobreaplicar el pago ni la obligación.

## unidad_produccion
`nombre` es UNIQUE. `tipo` es `TALLER_INTERNO` o `TERCERO`.

## orden_etapa
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| orden_id | uuid FK | | UNIQUE (orden, etapa). |
| unidad_id | uuid FK | ✔ | |
| etapa | text | | `CORTE`, `SUBLIMADO_BORDADO`, `CONFECCION` o `CALIDAD`. |
| estado | text | | `PENDIENTE`, `EN_CURSO`, `TERMINADA` o `BLOQUEADA`. |
| responsable_id | uuid FK usuario | ✔ | |
| cantidad_procesada, merma | int | ✔ | ≥ 0. |
| inicio, fin | timestamptz | ✔ | `fin` ≥ `inicio`. |
| observaciones | text | ✔ | |

## despacho
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| orden_id | uuid FK | | UNIQUE. |
| fecha_despacho | date | | Fija `obligacion_cobro.vence_en`. |
| acta_storage_path | text | ✔ | |
| registrado_por | uuid FK usuario | | |

## costo_orden
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| orden_id | uuid FK | | |
| etapa_id | uuid FK orden_etapa | ✔ | |
| concepto | text | | `MATERIA_PRIMA`, `MANO_OBRA`, `TERCERO`, `CIF` o `LOGISTICA`. |
| monto | numeric | | ≥ 0. |
| moneda | char(3) | | |
| origen | text | | `REAL` o `TEORICO`. Da el margen teórico frente al margen real. |
| fuente | text | | Procedencia del dato. |
| registrado_por | uuid FK usuario | ✔ | |

## mensaje_saliente
Lo que Spring programa y WF3 envía.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| cliente_id / usuario_destino_id | uuid FK | ✔ | Al menos uno de los dos. |
| orden_id, obligacion_id | uuid FK | ✔ | |
| instancia | text | | |
| numero_destino | text | | |
| tipo | text | | `COBRANZA_PREVENTIVA`, `COBRANZA_VENCIMIENTO`, `MORA_TEMPRANA`, `RECOMPRA`, `ESTADO_CUENTA`, `CONFIRMACION_PAGO` o `RESUMEN_VENDEDOR`. |
| texto | text | | |
| idempotency_key | text | | UNIQUE por organización. Por ejemplo `orden123-m3d`. |
| estado | text | | `PENDIENTE`, `ENVIADO`, `ERROR` o `CANCELADO`. |
| intentos | int | | |
| programado_para | timestamptz | | Índice parcial de la cola sobre los `PENDIENTE`. |
| enviado_en | timestamptz | ✔ | |
| provider_message_id | text | ✔ | |
| ultimo_error | text | ✔ | |

## alerta_cobranza
Alerta interna con responsable y resolución.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| obligacion_id / pago_id | uuid FK | ✔ | Al menos uno de los dos. |
| responsable_id | uuid FK usuario | ✔ | |
| regla | text | | `MORA_TEMPRANA`, `PAGO_EN_REVISION` o `ANTICIPO_PENDIENTE`. |
| estado | text | | `ABIERTA`, `RESUELTA` o `CANCELADA`. Si no está abierta, exige `cerrada_en`. |
| resolucion | text | ✔ | |

## apertura_caja · egreso_caja
- `apertura_caja`: `fecha`, `moneda`, `importe` y `fuente`. UNIQUE (organización, fecha, moneda).
- `egreso_caja`: `concepto`, `fecha_prevista`, `fecha_realizada`, `monto` > 0, `moneda`, `estado` (`PREVISTO`, `REALIZADO` o `ANULADO`; `REALIZADO` exige `fecha_realizada`) y `fuente`.

Los cobros esperados salen de las obligaciones con saldo y los realizados, de las aplicaciones vigentes. Un pago no se duplica como cobro futuro.

## evento_auditoria
| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| usuario_id | uuid FK | ✔ | NULL si el actor es el sistema. |
| actor | text | | `USUARIO`, `N8N`, `SCHEDULER` o `SISTEMA`. |
| operacion | text | | Por ejemplo `PAGO_APLICADO` o `CREDITO_APROBADO`. |
| entidad, entidad_id | text, uuid | | |
| cambios | jsonb | ✔ | |
| request_id | text | ✔ | |
| ocurrido_en | timestamptz | | |

## solicitud_idempotente
PK (`organizacion_id`, `operacion`, `clave`). Columnas: `hash_contenido` char(64), `respuesta` jsonb y `creado_en`. Operaciones: `ORDEN_INGESTA`, `ORDEN_CONFIRMAR`, `PAGO_VOUCHER` y `MENSAJE_ESTADO`.

## nota_cliente (V3)
Nota interna del equipo sobre un cliente. No se borra: se anula.

| Columna | Tipo | Null | Regla / descripción |
|---|---|---|---|
| cliente_id | uuid FK cliente | | |
| autor_id | uuid FK usuario | | |
| tipo | text | | `GENERAL`, `COBRANZA`, `RECLAMO` o `RECOMPRA`. Por defecto `GENERAL`. |
| contenido | text | | No puede estar vacío. |
| fijada | boolean | | Por defecto `false`. |
| creado_en | timestamptz | | |
| anulada_en | timestamptz | ✔ | NULL si está vigente. |

---

## Vistas

| Vista | Columnas | Uso |
|---|---|---|
| `v_saldo_obligacion` | obligacion_id, orden_id, monto, moneda, vence_en, cobrado, saldo | Saldo real calculado a partir de las aplicaciones vigentes. |
| `v_cliente_mora` | cliente_id, saldo_vencido, vencimiento_mas_antiguo | Aviso de mora al vendedor (no bloquea). |
| `v_margen_orden` | orden_id, ref, marca_id, venta, costo_teorico, costo_real, cobrado, margen_teorico, margen_real_cobrado | Margen teórico frente al margen real sobre lo cobrado. |

Las vistas usan `security_invoker`, así que respetan el RLS de quien consulta.
