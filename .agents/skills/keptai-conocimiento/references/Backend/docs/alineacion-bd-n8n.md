# Alineación BD, API y n8n — MIG-02

Datos para implementar: [DB-DEF-001](../../BD/definicion-base-datos.md). WF2 requiere uploader servidor y compensacion Storage/DB. Linea/centro siguen sin SQL; no asumirlos disponibles desde DTOs.

Fuentes: `BD/migrations/V1–V6`, `BD/diccionario-datos.md`, `Middleware/n8n/WF0–WF3`, Actores/flujos/DER v1.4 y D-005/D-007. Estado: diseño versionado; no endpoints ni integración remota.

## Fronteras

D-008/V6: 25 tablas; sin entidades contacto/nota_cliente ni endpoints nuevos de esas funcionalidades. Perfil local conecta JDBC; no adelanta JWT/motor. [Guia](../../BD/local/README.md).

Spring es dueño de crédito, fechas, seguridad y saldo; Andrés del motor/DB. n8n extrae transitoriamente y envía propuestas. Ninguna confianza del modelo acredita un pago. La app conserva solo vouchers como evidencia documental y datos estructurados del negocio; no conversaciones.

- WF1 → POST /api/v1/ordenes/ingesta: origen, instancia, chatId, vendedorJid, clienteNombreChat, extraccion, hojaResumenMd, transcript, mensajesProcesados, generadoEn. Transcript y crudo se descartan tras validación; guardar proyección de campos de negocio y resumen, no cuerpo entero.
- WF0 /ok → POST /api/v1/ordenes/confirmar: ref, instancia, chatId, vendedorJid, mensajeId. No aprobar crédito ni verificar fondos implícitamente.
- WF2 → POST /api/v1/pagos/voucher: instancia, chatId, clienteJid, mensajeId, pushName, recibidoEn, extraccion. Fase RECIBIDO; no cambia saldo. Falta transporte de imagen/hash/path.
- WF3 → POST /api/v1/mensajes/{id}/estado: callback de metadatos. UUID ruta/cuerpo deben coincidir. Persiste en envio_notificacion, sin texto. Estados terminales repetidos idempotentes, distintos en conflicto.
- Spring → webhook enviar-mensaje de WF3: texto generado al vuelo, no almacenado. 202 significa aceptado; resultado por callback. El callback no verifica entrega al cliente, solo respuesta del proveedor.

## Mapeos principales

Panel `own/outsourced` → `INTERNA/TERCERIZADA`. Roles idénticos a SQL: VENDEDOR/ADMIN/GERENTE/JEFE_TALLER. `phase` received/bank_verified/applied → RECIBIDO/VERIFICADO_BANCO/APLICADO. `reconciliation_status` pending/applied/partial/duplicate/orphan/amount_mismatch → PENDIENTE/APLICADO/PARCIAL/DUPLICADO/SIN_ORDEN/NO_CUADRA.

Order draft/pending_approval/held/released/in_production/dispatched/closed/cancelled → BORRADOR/PENDIENTE_APROBACION/RETENIDA/LIBERADA/EN_PRODUCCION/DESPACHADA/CERRADA/CANCELADA. Receivable pending/partially_paid/paid/overdue/voided → PENDIENTE/PARCIAL/PAGADA/MORA/ANULADA.

`order.id` = orden.id; display_code = orden.ref. receivable.id = obligacion_cobro.id; no cuota ni número. evidence_id corresponde a comprobante.id solo para voucher. source_evidence de orden no representa un chat almacenado. `canal_id` enlaza metadatos de origen; `provider_message_id` del comprobante deduplica evento sin conservar mensaje. Hoja de resumen tiene versión, revisión y confianza; no historial.

Alertas internas MORA_TEMPRANA/PAGO_EN_REVISION/ANTICIPO_PENDIENTE; recordatorios −3/0/+3 son envíos aparte. `costo_orden` guarda REAL/TEORICO con la misma moneda de orden. `margin` del panel (venta − costo real cerrado) corresponde a v_margen_orden.margen_venta_real, **no** a margen_real_cobrado (cobrado − costo real). Sin cierre de costos ambos quedan null. Cargo interno/centro de resultados no existe todavía como tabla V5: no simularlo como motor entregado.

## Seguridad y persistencia

V4 resuelve membresía desde JWT sub validado y servicio desde hash de clave en función privada. Un usuario activo puede pertenecer a varias empresas; elegir entre membresías del servidor, nunca aceptar organización arbitraria. Contexto local: app.organizacion_id + app.usuario_id o app.servicio_id (exactamente uno); rol runtime sin propiedad ni BYPASSRLS. GET también transaccional. RLS filtra tenant y operaciones; Spring aplica permisos más finos por recurso y campo.

No guardar texto en solicitud_idempotente, evento_auditoria, logs, n8n execution history ni archivo de diagnóstico. SHA del cuerpo no es el cuerpo. Storage requiere su propio SQL y prueba; MCP es administración, no conexión runtime.

## Brechas resueltas y pendientes
D-009 exige [DB-VAL-001](../../BD/validaciones-pre-supabase.md). Un contrato DTO/OpenAPI no prueba idempotencia HTTP, transacciones del motor o aislamiento con credenciales runtime. Registrar las seis validaciones en MIG-03 a MIG-08.


V4 admite campos ausentes únicamente en BORRADOR y retira MENSAJE/texto saliente. V5 refuerza pagos, gate de producción y costos. Pendientes: upload de voucher en WF2, motor/semilla, mapper entidades, cierre de costos, lectura RLS desde Spring y configuración remota. No cerrar MIG-03 ni MIG-07 con DTOs o mocks.

## Muestra recibida del entorno de Isabella — 11/10/2026
Ver [MIG-N8N-ISA-001](integracion-n8n-isabella.md): payload WF1, no export de workflow. Extraccion vacia incumple faltantes/confianza; envoltura de items no acredita body HTTP. Isabella mantiene n8n; D3 backend no sobrescribe sus workflows. Sin llamadas externas ni ingesta implementada.
