# Validaciones obligatorias antes de desplegar y cerrar el esquema

ID: DB-VAL-001. Fecha: 10/10/2026. Fuente: instrucción de Miguel, USR-DB-VALIDACION-001. Decisión vigente: D-009. Responsables: Andrés (DB/motor), Miguel (API/seguridad/integración), Germán e Isabella (aceptación UI y significado).

Estado: **condiciones de cierre adoptadas**, no pruebas nuevas ejecutadas. V5/V6 siguen como línea base; V6 define 25 tablas de negocio por D-008. No cambia la política de vouchers de D-007 ni agrega ERP/CRM/banco.

## Cómo interpretar «terminado»

Una migración Success, 25 tablas y 141 tests previos no acreditan por sí solos un esquema listo para producción. Separar estructura local migrada, motor/API funcionales y aceptación en Supabase.

Antes de aplicar en el proyecto de destino: evidencia local DB + backend, inventario remoto/roles/historial y plan de aplicación. Después de aplicar en entorno de prueba de Supabase: probar aislamiento, Auth/Storage y recorridos con credenciales runtime reales. Solo después de cerrar las seis validaciones y las diferencias de entorno se puede declarar listo para producción. No modificar producción para «probar si funciona».

Cada resultado registra versión Git o hashes si hay cambios sin commit, versiones Flyway/PostgreSQL, entorno, rol usado, fixture, comando, esperado, observado, fecha, responsable y limitaciones. Estados: pendiente, parcial, probado en local, probado en entorno de destino. Una evidencia local no se convierte automáticamente en evidencia remota.

## VAL-01 — Integridad financiera en PostgreSQL

**Condición:** restricciones, FK y transacciones impiden saldos negativos indebidos, sobreaplicación y referencias cruzadas.

**Casos mínimos:**
- Pago RECIBIDO, duplicado o sin cliente no se aplica; no cambia saldo.
- Aplicaciones vigentes no superan ni pago ni obligación; mismas organización, cliente y moneda.
- Rechazar FK cruzadas aunque el UUID referenciado exista en otra empresa.
- Un fallo después de insertar aplicación revierte también auditoría, cambios de estados y alertas de la operación Spring completa.
- Anulación de obligación, cambio de cliente/importe/moneda con aplicaciones previas y reversos no pueden invalidar saldos silenciosamente; diseñar transiciones del motor y rechazarlas hasta que exista flujo coherente.
- No imponer no-negatividad a métricas donde el negativo es válido: margen/caja pueden ser negativos y deben mostrarse. La deuda exigible y la suma aplicada no se corrigen mediante truncar a cero.

**Evidencia actual:** parcial. V1–V6 y SchemaRlsTests prueban varias FK, moneda, fase y sobreaplicación locales. No prueban toda la operación API/motor ni todos los cambios posteriores de padres.

**Responsable:** Andrés, con pruebas API de Miguel. **Etapas:** motor y MIG-07; regresión MIG-08.

## VAL-02 — Idempotencia real

**Condición:** crear pedido/pago y aplicar/anular pago no producen dos operaciones por reintento.

**Casos mínimos:**
- Misma organización, operación, clave y contenido: mismo resultado/IDs, una sola mutación, aplicación y evento financiero.
- Misma clave con contenido distinto: conflicto estable, sin segunda operación.
- Dos llamadas simultáneas con misma clave: un único efecto; el resultado «en curso» o replay sigue el contrato.
- Timeout del cliente después del commit: replay devuelve el resultado guardado y no vuelve a aplicar.
- Fallo antes del commit: no deja pago/aplicación ni clave bloqueada de manera irreversible; reintento puede completar de forma coherente.
- Misma clave en otra organización no revela ni reutiliza respuesta ajena.
- Duplicación del evento de voucher detectada por instancia/provider_message_id; no confundir deduplicar una foto con idempotencia de la aplicación financiera.

Reserva/resultado idempotente y mutación de negocio deben coordinarse transaccionalmente. Hash/JSON de respuesta seguros, sin mensajes ni transcript. No basta que exista solicitud_idempotente o que DTOs documenten Idempotency-Key.

**Evidencia actual:** pendiente en backend. Existen contrato, tabla y restricciones; no están implementadas/probadas estas rutas con motor real.

**Responsables:** Miguel (HTTP/adapters) y Andrés (transacción/motor). **Etapas:** MIG-05/06/07 y MIG-08.

## VAL-03 — Seguridad multiempresa

**Condición:** consultas y escrituras de negocio/archivos no cruzan organizaciones.

**Casos mínimos:**
- Usuario A no lee/actualiza/aplica/exporta datos B cambiando UUID, filtro, cursor, cuerpo, cabecera o claims no confiables.
- JWT inválido/vencido, membresía inactiva y contexto ausente/dual/malformado denegados; selección solo entre membresías autorizadas.
- Reutilizar conexión del pool entre tenants, commit/rollback y errores no hereda GUC.
- Probar roles VENDEDOR/ADMIN/GERENTE/JEFE_TALLER e INGESTA/SCHEDULER, y restricciones por recurso/campo en Spring, no solo tenant.
- Probar SQL como login runtime real no propietario, sin superuser/BYPASSRLS; no sustituirlo por el migrador del test.
- Inventariar grants, políticas, funciones SECURITY DEFINER, search_path y exposición Data API; probar vistas e informes.
- Storage: rutas/URLs firmadas, anon, membresía y accesos cruzados. Las credenciales privilegiadas del uploader omiten RLS: Spring debe comprobar tenant/operación; nunca distribuirlas al navegador.

RLS habilitado sin políticas deniega filas al rol sujeto a RLS, pero **no protege por sí solo a una aplicación conectada como propietario/superuser/BYPASSRLS**. Grants, políticas concretas, identidad validada y credenciales adecuadas forman el control conjunto.

**Evidencia actual:** parcial local. SchemaRlsTests y login runtime local acreditan varios controles DB. Storage fue emulado; falta prueba JWT/API, pool real, uploader y Supabase destino.

**Responsables:** Miguel, revisión DB de Andrés. **Etapas:** MIG-03/04 y MIG-08.

## VAL-04 — Trazabilidad financiera y reversión controlada

**Condición:** reconstruir saldos desde movimientos, sin borrado de historia.

**Casos mínimos:**
- Aplicación confirmada es inmutable; corrección por anulación autorizada con actor, motivo, fecha y nueva aplicación.
- Reintento de anulación no resta dos veces; no reabrir ni editar una aplicación ya anulada.
- Suma de aplicaciones vigentes y eventos explica saldo antes/después de cada corrección.
- Auditoría append-only en la misma transacción de negocio; ningún pago desaparece por DELETE runtime.
- Distinguir anular aplicación de revertir fondos bancarios. El reverso requiere flujo/registro propio coherente con caja/deuda y autorización; no dar por implementado por existir anulada_en.
- No conservar conversaciones en auditoría/idempotencia ni borrar historia como corrección de saldo.

**Evidencia actual:** parcial. Inmutabilidad/anulación y privilegios locales probados; reverso bancario/caja y auditoría transaccional API completos pendientes. No hay integración bancaria en el MVP: la decisión humana no acredita un conector al banco.

**Responsable:** Andrés; Miguel prueba exposición/autorización. **Etapas:** MIG-07/08.

## VAL-05 — Concurrencia

**Condición:** operaciones simultáneas no generan resultados financieros inconsistentes.

**Casos mínimos:**
- Dos aplicaciones del mismo pago que juntas lo exceden: una se confirma, la otra se rechaza, sin sobreaplicar.
- Dos pagos distintos aplicados a la misma obligación: no exceder deuda, aunque ambos la lean pendiente.
- Aplicar vs anular/cambiar obligación, y verificar vs marcar duplicado: estado final permitido y saldo reconstruible.
- Dos reintentos simultáneos de creación/aplicación con misma clave no duplican efectos.
- Locks padre pago→obligación y orden estable en lotes; deadlock/serialization failure con reintento acotado de transacción completa y misma idempotencia.
- Verificar resultado final desde una tercera transacción: aplicaciones, saldo, fases/estados y auditoría. Sin éxito parcial ni deadlock indefinido.

**Evidencia actual:** parcial. concurrentApplicationsCannotOverApply prueba localmente dos aplicaciones sobre el mismo pago. No acredita pagos distintos, reversos concurrentes, carreras de idempotencia ni concurrencia por HTTP.

**Responsables:** Andrés/Miguel. **Etapas:** MIG-07/08.

## VAL-06 — Aceptación del reto y significado financiero

**Condición:** una prueba integrada demuestra los resultados, no solo tablas o pantallas.

**Casos mínimos:**
- C-01/C-05: agrupación autorizada por marca/línea, con organización y moneda explícitas; sin atribuir dos RUC a marcas no validadas.
- C-05: orden con varias líneas y costos compartidos, método explícito, asignación completa con residuo de centavos controlado. No duplicar costo total en cada línea.
- C-06: taller y comercial con transferencia interna; consolidado elimina ese cargo. Ejemplo ficticio venta300/costo340/transferencia320: taller−20, comercial−20, consolidado−40, sin ingreso externo/caja extra.
- C-05: costo incompleto produce margen null/incompleto; un costo nuevo invalida cierre. Separar margen de venta de resultado sobre cobrado.
- D-005: obligación puede existir para anticipos antes del despacho, pero vencimiento se fija desde fecha de despacho + plazo15–30; un voucher recibido no libera producción.
- C-07: caja a cuatro semanas con apertura/fecha de corte; sin duplicar pago y aplicación, sin repetir cobros ya recibidos como futuros, y egreso previsto→realizado una sola vez. Contemplar pago verificado aún no aplicado.
- C-07: reporte automático reproducible con período, fuentes, supuestos y datos ficticios identificados.
- C-03/C-04: voucher real de prueba, revisión y trazabilidad, sin historial de conversaciones retenido.

**Evidencia actual:** pendiente de aceptación integrada. C-05/C-06 requieren asignación por ítem y transferencia interna definidas en DB-DEF-001 §9, aún sin SQL/motor. Despacho/vencimiento y caja son flujos pendientes; semilla/DTOs/ejemplos no los cierran.

**Responsables:** Andrés (cálculo), Miguel (API), Germán/Isabella (UI/reglas); validación empresarial cuando corresponda. **Etapas:** MIG-07/08 y entregas DB/motor del roadmap.

## Registro de cierre

Registrar cada VAL-01…06 con evidencia y estado en la bitácora; enlazar pruebas/logs sin secretos. Las seis están abiertas actualmente: 01/03/04/05 parciales; 02/06 pendientes. No activar una etiqueta «esquema terminado» por el conteo de tablas.

Un defecto se corrige con migración/servicio/prueba nueva y actualización de diccionario/DER/contrato afectados. Conservar V1–V6 y las fuentes originales. Esta solicitud establece validaciones; no autoriza aplicar SQL remoto, purgar datos ni publicar Git automáticamente.

## Referencias

- [Definición canónica](definicion-base-datos.md), [revisión SQL/RLS](revision-sql-rls.md), [guía local](local/README.md).
- [Decisiones D-007/008/009](../cerebro/conocimientos/decisiones/decisiones-del-proyecto.md).
- [Actores, flujos y DER](../cerebro/conocimientos/decisiones/actores-flujos-y-der-mvp.md).
- [Criterios del reto](../cerebro/conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md), [trazabilidad de tablas](../cerebro/conocimientos/decisiones/trazabilidad-tablas-mvp.md).
- [Tareas Miguel](../cerebro/conocimientos/desarrollo/miguel/tareas.md) y [bitácora](../cerebro/conocimientos/desarrollo/miguel/estado.md).
