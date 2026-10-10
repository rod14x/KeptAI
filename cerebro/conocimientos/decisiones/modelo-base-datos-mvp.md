# Modelo de base de datos del MVP — responsable Andrés

> ID: PROP-DB-001. Versión 1.0. Fecha: 10 de octubre de 2026. Dirección USR-EQUIPO-003/D-004; modelo propuesto, aún no implementado. Andrés define la base; Miguel revisa contratos/API, Isabella valida significado y Germán consume DTOs.

> Actualización (10/10/2026): las entidades de este documento se fusionaron con el DER de Isabel en [actores, flujos y DER](actores-flujos-y-der-mvp.md), PROP-FLUJO-DER-001, con tabla de equivalencias. Invariantes, transacción de pago, semilla y aceptación de este documento siguen vigentes.

## Entregable temprano B0/B1

Andrés entrega diagrama entidad-relación, diccionario con PK/FK/nulabilidad/moneda, migración Flyway inicial, restricciones/índices y semilla ficticia reiniciable. Miguel revisa antes de cerrar DTOs. No leer datos del ERP/CRM ni diseñar una migración desde sistemas sin acceso. Fuente operativa del MVP: base propia, entrada manual/CSV y evidencia revisada; no implica sustituir el registro oficial empresarial.

## Entidades y relaciones propuestas

- `organization`: empresa usuaria de KeptAI; aislamiento. `membership`: usuario Auth, organización y rol. `commercial_entity`: unidad comercial/RUC solo si se conoce; `brand` y `product_line`: clasificación, sin inventar RUC de las marcas.
- `customer`: cliente por organización. `order`: cliente, entidad/marca/línea, moneda, venta, modalidad propia/tercerizada y estado. `order_item`: cantidad/prenda/tallas cuando las entradas lo requieran.
- `receivable`: obligación de pedido, monto, evento inicial de plazo y vencimiento; `credit_authorization`: cliente/saldo de referencia, responsable, motivo y decisión pendiente/aprobada/rechazada, sin política automática inventada.
- `evidence`: archivo privado o texto, hash, origen, tipo, autor y hora. `extraction_draft`: campos propuestos/ausentes, procedencia, revisión y estado. `payment`: referencia, canal, monto, moneda y estado de verificación; `payment_evidence`: vínculos N:M si se necesitan varias evidencias por pago.
- `payment_application`: pago → obligación y monto aplicado. Un pago puede cubrir obligaciones; un documento puede tener parciales. Aplicación requiere pago verificado y misma organización/moneda. `audit_event`: quién, operación, fecha, referencias y cambios relevantes.
- `order_cost`: insumos, mano de obra, terceros e indirectos con método/fuente; `internal_charge`: centro origen/destino y precio de transferencia. No convertir transferencia interna en ingreso externo.
- `cash_opening`: fecha, moneda, importe y fuente. `cash_outflow`: fecha prevista, monto y estado; obligaciones pendientes originan cobros esperados y pagos aplicados originan cobros realizados. No duplicar un pago como cobro futuro.
- `scenario_setting`: factor de escenario, plazos/evento inicial y transferencias con permiso, fecha y fuente. `collection_alert`: obligación, regla, responsable, vencimiento y resolución. `job`: estado, intentos, próxima ejecución y error.
- `shared_statement_token`: cliente/organización, hash del token, expiración y revocación; solo consulta de estado de cuenta sin archivos privados. No exponer consultas sin autorización por URL predecible.

Todas las tablas de negocio llevan `organization_id`; claves únicas/FK compuestas o controles equivalentes impiden referencias entre organizaciones. Definir índices por organización + cliente/vencimiento/estado y referencias de pago, no asumir unicidad global de una referencia de billetera incompleta.

## Invariantes y transacción de pago

- Importes PEN `numeric(18,2)`/Java `BigDecimal`; moneda explícita; fechas de negocio locales e instantes `timestamptz`. Límites y redondeo documentados. Contrato frontend propuesto: importes en centavos enteros, con límites dentro del rango seguro de JavaScript; convertir explícitamente desde/hacia BigDecimal, sin confundir soles con centavos.
- DTO no acepta saldo/margen como verdad desde navegador. Calcular saldo de obligación a partir de aplicaciones válidas, no de OCR o promesa.
- Servicio Spring `@Transactional`: verificar usuario/membresía/rol, bloquear obligación/pago, comprobar verificación/moneda/saldo y registrar aplicación + auditoría + cambio de alerta juntos. Una falla revierte todo.
- Clave de idempotencia única por organización/operación; misma clave y contenido devuelve resultado previo, misma clave con contenido distinto se rechaza. Concurrencia no sobreaplica saldo; hash/referencia son señales de duplicación a revisar.
- Estado duplicado/huérfano/diferencia no altera deuda. Si se admite sobrepago o corrección, requiere regla explícita; no inventarla. No borrar aplicaciones/auditoría para corregir historial.
- Rol runtime no dueño/BYPASSRLS, esquema privado no expuesto a Data API, RLS con contexto autorizado por transacción; FK y filtros por organización. JWT Spring no establece contexto JDBC automáticamente. Storage tiene políticas independientes.
- Flyway es único historial de esquema; `ddl-auto=validate`. Credencial migradora separada. Semilla opt-in solo demo, no `clean/reset` de datos reales.

## Datos y aceptación

Semilla: P-001 venta300/costo340/margen-40, P-002 venta500/costo350/margen150; V-001300 y V-002100 aplicados; V-003 duplicado no aplicado. Cobrado400, pendiente400, margen110. Cargo interno320 en P-001: taller-20 y comercial-20, consolidado-40 sin ingreso externo. Añadir fechas, apertura de caja y egresos ficticios explícitos para cuatro semanas, sin llamarlos datos de Corpotex.

Andrés comprueba en PostgreSQL: parcial, concurrencia, reintento, rollback, RLS con organización distinta/contexto ausente y conexión reutilizada, eliminación de cargo interno, cambio futuro→realizado sin doble conteo y token vencido/revocado. Miguel prueba esos servicios mediante API; Germán UI; Isabella significado. H1 exige pedido persistente; H4 esquema/migraciones y aislamiento probados.

Fuentes: [idea](../empresa/idea-negocio-replanteada.md), [roadmap](roadmap-hackathon-equipo.md), [prompt adaptado](roadmap-german-frontend.md), [infraestructura](infraestructura-desarrollo-mvp.md). No hay datos de ERP/CRM en el MVP.
