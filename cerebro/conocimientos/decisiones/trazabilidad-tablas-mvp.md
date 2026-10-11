# Trazabilidad y necesidad de tablas — KeptAI

ID: DB-MAP-001. Fecha: 10/10/2026. Elaborado por Miguel/Codex por solicitud de Miguel. Estado: revisión técnica y recomendación de alcance; no modifica el SQL ni constituye validación empresarial de datos/políticas.

## Respuesta a la cantidad

> **D-008, posterior a esta revision:** Miguel aprobo las 25 recomendadas. V6 excluye contacto/nota_cliente si vacias; las 27 entradas siguientes se conservan como trazabilidad del esquema anterior. Las dos opcionales ya no son tablas vigentes. [DER actual V6](../../diagramas/keptai-der-v6.md) y [guia local](../../../BD/local/README.md).

**No es obligatorio tener exactamente 27 tablas.** La empresa describe problemas, datos y resultados; no prescribe tablas. 27 es el número del esquema V5 actual, no una condición del reto ni de la skill. Menos tablas no garantiza simplicidad, y más tablas no acredita cobertura.

Para el recorrido vigente se recomienda mantener separados:
- **16 de núcleo**: identidad/empresa, clasificación, cliente, venta, crédito, obligación, pago/voucher/aplicación, unidad/costos y caja.
- **6 del flujo vigente**: canal, resumen, etapas, despacho, alertas y envíos.
- **3 de soporte técnico**: servicios, auditoría e idempotencia.
- **2 opcionales**: contacto y nota_cliente.

Eso significa **25 tablas recomendadas del esquema actual y 2 opcionales**. No es un mínimo matemático: canal/resumen/despacho podrían integrarse en otras entidades y autenticación de servicios puede implementarse de otra forma. La recomendación conserva trazabilidad, aislamiento y límites del diseño ya escrito, sin una reestructuración improvisada para alcanzar un número.

Las opcionales pueden permanecer vacías en V5 sin desarrollar sus pantallas/endpoints. No borrar tablas ni reescribir migraciones para reducir el conteo: un cambio físico exige migración nueva y revisión de dependencias/contrato.

## Fuentes y nivel de evidencia

La skill es una copia consultable del cerebro; **no una nueva fuente empresarial independiente**. El recorrido de justificación es: fuente original → requisito/decisión vigente → dato necesario → entidad → restricción/consulta/prueba.

- [USR-IDEA-001](../empresa/idea-negocio-replanteada.md): dirección del producto; captura, conciliación, cobranza y margen/caja. Stock, cotización y recompra fase 2.
- [IMG-RETO6-001](reto-6-corpotex-conciliacion-y-rentabilidad.md): ficha empresarial del reto; C-01 separación/consolidación, C-02 exportación, C-03 captura/revisión, C-04 vouchers, C-05 margen, C-06 centro, C-07 caja.
- [Entrevistas A01/A02 y límites](../empresa/descripcion.md), [ventas](../procesos/ventas.md): declaraciones transcritas, no auditadas. A02-Q08/Q21 costos manuales; Q26 ficha productiva; Q32 plazo único; Q24/Q34 clientes.
- [USR-FLUJO-001](../procesos/flujo-cliente-empresa.md): recorrido aportado por el usuario; cifras no verificadas.
- [D-003 a D-007](decisiones-del-proyecto.md): últimas decisiones del equipo prevalecen sobre propuestas viejas. D-004 Spring/sin ERP-CRM; D-005 WhatsApp y obligación única; D-007 solo vouchers como evidencia persistente.
- [Actores/flujos](actores-flujos-y-der-mvp.md), secciones 1/2/4/6: flujo del equipo. Su DER histórico no demuestra tablas vigentes.
- [DB-DEF-001](../../../BD/definicion-base-datos.md), [SQL V1–V5](../../../BD/migrations/) y [diccionario](../../../BD/diccionario-datos.md): diseño y evidencia local, no conocimiento del funcionamiento actual de Corpotex.

Los actores, protocolos, seguridad y decisiones técnicas pueden justificar tablas aunque la entrevista no las nombre. Deben quedar etiquetados como diseño, nunca como hechos de la empresa.

## Mapeo individual de las 27 tablas

### 1. organizacion — Núcleo

- **Fuente/requisito:** C-01; USR-IDEA-001 §Para quién y cómo crece; P-006.
- **Dato y problema que resuelve:** Separar empresas usuarias y sus datos.
- **Alcance de la evidencia:** Es una decisión técnica de tenant; las dos marcas no prueban dos personas jurídicas.
- **Decisión recomendada:** Mantener; no crear tenants/RUC ficticios como hechos de Corpotex.

### 2. usuario — Núcleo

- **Fuente/requisito:** IMG-RETO6-001 §03; D-004; Actores §1.
- **Dato y problema que resuelve:** Identificar vendedor, administración, gerencia y taller; registrar quién decide.
- **Alcance de la evidencia:** La fuente nombra funciones, no una tabla ni permisos SQL exactos.
- **Decisión recomendada:** Mantener como membresía Auth/organización; no duplicar credenciales.

### 3. marca — Núcleo

- **Fuente/requisito:** IMG-RETO6-001 §01 y C-05.
- **Dato y problema que resuelve:** Clasificar ventas y margen por Corpotex/Unicrack.
- **Alcance de la evidencia:** Marcas declaradas; identidad legal pendiente.
- **Decisión recomendada:** Mantener separada del tenant y del RUC.

### 4. linea_producto — Núcleo

- **Fuente/requisito:** IMG-RETO6-001 §01 y C-05; USR-IDEA-001 §Las tres fugas.
- **Dato y problema que resuelve:** Comparar líneas y su margen.
- **Alcance de la evidencia:** Clasificación comercial real; valores finales pendientes.
- **Decisión recomendada:** Mantener por ítem; no asumir que una orden tenga una sola línea.

### 5. cliente — Núcleo

- **Fuente/requisito:** A02-Q24/Q34; USR-IDEA-001 §Cobra; D-005.
- **Dato y problema que resuelve:** Historial de pedidos, saldo y decisiones de crédito por cliente.
- **Alcance de la evidencia:** 40 frecuentes no significa 40 clientes totales.
- **Decisión recomendada:** Mantener; mora derivada, no booleano editable.

### 6. orden — Núcleo

- **Fuente/requisito:** C-03/C-04/C-05; D-005; Actores §2.
- **Dato y problema que resuelve:** Eje que conecta venta, producción, cobro y costos.
- **Alcance de la evidencia:** Requisito funcional; campos/estados son diseño del equipo.
- **Decisión recomendada:** Mantener; BORRADOR incompleto sin inventar importes.

### 7. orden_item — Núcleo

- **Fuente/requisito:** C-03/C-05; Actores §2 y DER histórico.
- **Dato y problema que resuelve:** Guardar prendas, cantidades, especificaciones y línea.
- **Alcance de la evidencia:** La granularidad permite margen por línea, pero no asigna costos por sí sola.
- **Decisión recomendada:** Mantener; validar total/ítems explícitamente en Spring.

### 8. aprobacion_credito — Núcleo

- **Fuente/requisito:** D-005; Actores §4; USR-IDEA-001 §Cobra.
- **Dato y problema que resuelve:** Registrar decisión del vendedor, plazo y aviso de mora.
- **Alcance de la evidencia:** 15–30 y mora no bloqueante son instrucciones del equipo; no política empresarial auditada.
- **Decisión recomendada:** Mantener; no aprobar implícitamente por /ok.

### 9. obligacion_cobro — Núcleo

- **Fuente/requisito:** A02-Q32; D-005; USR-IDEA-001 §Cobra.
- **Dato y problema que resuelve:** Monto exigible, vencimiento y saldo por pedido.
- **Alcance de la evidencia:** La entrevista no usa cuotas; D-005 confirma obligación única y actualiza plazo.
- **Decisión recomendada:** Mantener una por orden, pagos parciales sin tabla cuota.

### 10. pago — Núcleo

- **Fuente/requisito:** C-04; USR-IDEA-001 §Concilia; D-005.
- **Dato y problema que resuelve:** Registrar dinero recibido/verificado y excepciones de conciliación.
- **Alcance de la evidencia:** Voucher no prueba fondos; verificación humana.
- **Decisión recomendada:** Mantener fases distintas de estado de conciliación.

### 11. comprobante — Núcleo

- **Fuente/requisito:** C-04; D-007.
- **Dato y problema que resuelve:** Conservar voucher privado, hash, origen y extracción permitida.
- **Alcance de la evidencia:** La persistencia solo de vouchers es instrucción explícita de Miguel.
- **Decisión recomendada:** Mantener; no almacenar mensajes ni URLs públicas permanentes.

### 12. aplicacion_pago — Núcleo

- **Fuente/requisito:** C-04; USR-IDEA-001 §Concilia; Actores §2 controles.
- **Dato y problema que resuelve:** Vincular pagos parciales con obligaciones sin perder trazabilidad.
- **Alcance de la evidencia:** La tabla puente es diseño técnico que materializa conciliación.
- **Decisión recomendada:** Mantener; anular y registrar nueva, sin borrar ni sobreaplicar.

### 13. unidad_produccion — Núcleo

- **Fuente/requisito:** IMG-RETO6-001 §01/02; C-05/C-06.
- **Dato y problema que resuelve:** Distinguir taller interno y terceros, y centro productivo.
- **Alcance de la evidencia:** Producción propia/tercerizada es fuente empresarial; centros concretos no confirmados.
- **Decisión recomendada:** Mantener; sola no satisface precios de transferencia/resultados.

### 14. costo_orden — Núcleo

- **Fuente/requisito:** A02-Q08/Q21; C-05/C-06; USR-IDEA-001 §Muestra la verdad.
- **Dato y problema que resuelve:** Materiales, mano de obra, terceros e indirectos por pedido.
- **Alcance de la evidencia:** Existen costos manuales declarados; importes reales no entregados.
- **Decisión recomendada:** Mantener fuente/origen/moneda y cierre explícito; no costo cero por ausencia.

### 15. apertura_caja — Núcleo

- **Fuente/requisito:** C-07; USR-IDEA-001 §Muestra la verdad.
- **Dato y problema que resuelve:** Punto inicial verificable para proyectar liquidez.
- **Alcance de la evidencia:** Dato requerido por el cálculo, no evidencia de saldo actual conocido.
- **Decisión recomendada:** Mantener; sin apertura indicar proyección incompleta.

### 16. egreso_caja — Núcleo

- **Fuente/requisito:** C-07; USR-IDEA-001 §Las tres fugas.
- **Dato y problema que resuelve:** Salidas previstas y realizadas de caja.
- **Alcance de la evidencia:** Solo cuentas por cobrar no bastan para proyectar caja.
- **Decisión recomendada:** Mantener; costo devengado no es automáticamente egreso pagado.

### 17. canal_whatsapp — Flujo vigente

- **Fuente/requisito:** A01-Q03/Q04; D-005/D-007; Actores §2 WF1–WF3.
- **Dato y problema que resuelve:** Asociar instancia/JID con origen y vendedor sin guardar contenido.
- **Alcance de la evidencia:** La tabla separada es decisión técnica para integración/prueba.
- **Decisión recomendada:** Mantener en diseño actual; en modelo pequeño podría integrarse como campos de origen.

### 18. hoja_resumen — Flujo vigente

- **Fuente/requisito:** C-03; D-005/D-007; Actores §2 WF1.
- **Dato y problema que resuelve:** Revisar extracción antes de confirmar y conservar versiones de negocio.
- **Alcance de la evidencia:** No equivale a historial del chat; estructura/versión son diseño técnico.
- **Decisión recomendada:** Mantener si la revisión conserva versiones; alternativa simplificada: borrador en orden.

### 19. orden_etapa — Flujo vigente

- **Fuente/requisito:** A02-Q26; IMG-RETO6-001 §01; Actores §2.
- **Dato y problema que resuelve:** Estado de corte/confección/calidad, unidad responsable y costos relacionados.
- **Alcance de la evidencia:** Las etapas operativas existen; lista exacta sigue siendo configuración del equipo.
- **Decisión recomendada:** Mantener para recorrido productivo actual; no construir inventario aquí.

### 20. despacho — Flujo vigente

- **Fuente/requisito:** D-005; Actores §2 fechas y §4.
- **Dato y problema que resuelve:** Conservar fecha/autor de entrega que inicia vencimiento.
- **Alcance de la evidencia:** Una acta por orden es simplificación V5; entregas parciales no están cubiertas.
- **Decisión recomendada:** Mantener para trazabilidad; alternativa mínima: fecha/autor en orden.

### 21. alerta_cobranza — Flujo vigente

- **Fuente/requisito:** USR-IDEA-001 §Cobra; USR-FLUJO-001 §Empresa punto 3; Actores §2.
- **Dato y problema que resuelve:** Asignar y resolver mora, anticipo pendiente y pagos dudosos.
- **Alcance de la evidencia:** Necesidad de seguimiento; estados/responsables concretos son diseño.
- **Decisión recomendada:** Mantener; saldo parcial no cancela indiscriminadamente toda cobranza.

### 22. envio_notificacion — Flujo vigente

- **Fuente/requisito:** D-005/D-007; Actores §2 WF3.
- **Dato y problema que resuelve:** Programación y reintentos de avisos de WhatsApp.
- **Alcance de la evidencia:** Outbox es soporte técnico del seguimiento, no demanda de guardar mensajes.
- **Decisión recomendada:** Mantener solo metadatos; texto se genera transitoriamente.

### 23. integracion_servicio — Soporte técnico

- **Fuente/requisito:** D-005; DB-DEF-001 §2/7/8.
- **Dato y problema que resuelve:** Autenticar y limitar servicios n8n/scheduler por tenant.
- **Alcance de la evidencia:** No requisito empresarial explícito; mecanismo técnico elegido.
- **Decisión recomendada:** Mantener para revocación/alcance en DB; alternativa: configuración de secretos servidor equivalente.

### 24. evento_auditoria — Soporte técnico

- **Fuente/requisito:** C-03/C-04 validación; Actores §2 controles; DB-DEF-001 §5.
- **Dato y problema que resuelve:** Quién verificó, aprobó, aplicó o corrigió; reversión y trazabilidad.
- **Alcance de la evidencia:** Auditoría separada es decisión técnica, no un sistema actual declarado.
- **Decisión recomendada:** Mantener append-only con datos de negocio mínimos, sin cuerpos.

### 25. solicitud_idempotente — Soporte técnico

- **Fuente/requisito:** Actores §2 controles; DB-DEF-001 §5.
- **Dato y problema que resuelve:** Evitar duplicar pedidos/pagos en reintentos.
- **Alcance de la evidencia:** Idempotencia deriva de integración confiable; tabla es una implementación posible.
- **Decisión recomendada:** Mantener para respuestas repetidas/conflicto; no guardar transcript.

### 26. contacto — Opcional

- **Fuente/requisito:** IMG-RETO6-001 §01; USR-IDEA-001 §Para quién; DER histórico.
- **Dato y problema que resuelve:** Varios interlocutores asociados a un cliente.
- **Alcance de la evidencia:** Las fuentes mencionan clientes/vendedores; no exigen varios contactos por cliente en el MVP.
- **Decisión recomendada:** Posponer desarrollo específico: prueba usa un contacto; cliente/canal pueden cubrir el recorrido.

### 27. nota_cliente — Opcional

- **Fuente/requisito:** BD/V3; procesos/atencion-cliente.md como contexto general.
- **Dato y problema que resuelve:** Observaciones internas de cobranza o atención.
- **Alcance de la evidencia:** Propuesta de Andrés; no criterio C-01…C-07 ni núcleo explícito de USR-IDEA-001.
- **Decisión recomendada:** Posponer UI/endpoints propios; no confundir con nota de voz ni guardar WhatsApp.

## Cobertura por requisito y brechas
D-009 exige [DB-VAL-001](../../../BD/validaciones-pre-supabase.md): una tabla mapeada a un requisito no prueba el recorrido operativo. Costos compartidos y centro de resultados siguen pendientes; deben cerrar junto con vencimiento desde despacho y caja sin doble conteo.


- **C-01:** organizacion/usuario separan tenants; marca distingue marcas. La consolidación debe ser autorizada. Falta confirmar entidades jurídicas, RUC y relación entre marcas/empresas; no presentar marcas como personas jurídicas ni acceso global entre tenants.
- **C-02:** orden/ítems/pagos/costos proveen datos exportables. CSV/Excel puede generarse sin tabla exportacion_contable; formato del sistema destino y ejecución siguen pendientes.
- **C-03:** orden/ítems/hoja_resumen/usuario y canal soportan revisión. Audio/texto se procesan transitoriamente por D-007; no añadir mensaje/transcript por conservar el criterio original.
- **C-04:** pago/comprobante/obligacion/aplicacion/auditoria/idempotencia soportan conciliación. No sustituir verificación bancaria por OCR; uploader WF2 y motor/API operativos pendientes.
- **C-05:** orden/marca/ítems/línea/unidad/costo permiten datos base. **V5 no completa margen por línea con costos compartidos**: requiere asignacion_costo_item o mecanismo equivalente explícito. Definido en DB-DEF-001 §9, sin migración.
- **C-06:** unidad/etapas/costos identifican producción. **V5 no modela aún cargo interno y resultado consolidado**: transferencia_interna definida en DB-DEF-001 §9, sin migración. Es parte del núcleo requerido, no fase 2.
- **C-07:** obligación/pago/aplicación/apertura/egreso proveen caja. Calendario de cuatro semanas/reporte pueden calcularse sin tablas calendario/reporte; consultas/motor y envío automático siguen pendientes. Pago verificado sin aplicar existe en caja, sin reducir deuda.

Las dos extensiones C-05/C-06 pueden elevar el número físico. Añadirlas tiene una razón funcional; no tiene como objetivo volver a alcanzar 27. El total final depende del diseño implementado y de qué opcionales se activen.

No crear ahora tablas de stock/movimientos, CRM/ERP, recompra, catálogo detallado de variantes, embeddings, historial de chat o archivos generales. Las tablas financieras guardan negocio; «solo vouchers» se refiere a evidencia documental, no a prohibir pedidos/clientes/pagos.

## Cómo debe leerlo un agente

1. Leer índice, idea y decisiones; identificar la prioridad vigente y distinguir hecho, declaración y diseño.
2. Leer DB-MAP-001 y DB-DEF-001; para cada entidad justificar fuente + dato + operación.
3. Consultar SQL/diccionario/DER V5 para lo realmente implementado. No construir entidades de fases futuras por verlas en un diagrama viejo.
4. Formular la operación transaccional y su rol/tenant; mapear al contrato MIG-02. RLS no reemplaza autorización de campo/recurso en Spring.
5. Probar el caso de negocio: pago parcial, duplicado, mora avisada, anticipo, costo incompleto, centro consolidado, caja sin doble conteo.
6. Al agregar o fusionar tabla, actualizar este mapeo, definición, SQL, diccionario, DER, contrato y pruebas afectadas; regenerar skill. Un hash válido confirma equivalencia documental, no verdad empresarial ni cobertura funcional.

## Decisión de trabajo resultante

Mantener V5 como base física local; priorizar las 25 recomendadas, sin ampliar contacto/notas por rutina. Completar C-05/C-06 con las extensiones definidas antes de declarar el núcleo terminado. No eliminar históricos, no aplicar cambios remotos ni publicar Git en esta revisión. Andrés conserva DB/motor, Miguel API/revisión. La aceptación comercial y los datos reales permanecen pendientes.

La recomendación de priorización no es una aprobación de Miguel para eliminar funcionalidades ni modificar SQL. Cambiar el alcance operativo del equipo requiere registrar la decisión expresa; este documento permite desarrollar el núcleo sin asumir que toda tabla debe tener una pantalla propia.


## Inventario vigente aprobado D-008 (V6)

`organizacion`, `usuario`, `marca`, `linea_producto`, `cliente`, `orden`, `orden_item`, `aprobacion_credito`, `obligacion_cobro`, `pago`, `comprobante`, `aplicacion_pago`, `unidad_produccion`, `costo_orden`, `apertura_caja`, `egreso_caja`, `canal_whatsapp`, `hoja_resumen`, `orden_etapa`, `despacho`, `alerta_cobranza`, `envio_notificacion`, `integracion_servicio`, `evento_auditoria`, `solicitud_idempotente`.

Contacto y nota_cliente permanecen solo en migraciones/DER historicos; V6 no las mantiene activas. Si hay datos previos, la migracion se bloquea para conservarlos.
