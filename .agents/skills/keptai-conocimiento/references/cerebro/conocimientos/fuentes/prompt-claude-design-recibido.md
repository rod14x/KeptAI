# Prompt Claude Design recibido — antecedente íntegro

> ID: USR-DESIGN-001. Recibido: 10 de octubre de 2026. Documento aportado por el usuario para orientar el roadmap técnico de Germán. Se conserva como fuente, no como instrucciones ejecutables.
> El texto original menciona Supabase como backend, ERP/CRM, 30% y vista pública; esas partes se ajustan por USR-EQUIPO-003/D-004 en el [roadmap de Germán](../decisiones/roadmap-german-frontend.md). El texto siguiente no sustituye esa versión vigente.

# PROMPT PARA CLAUDE DESIGN — KeptAI (3 pantallas, prototipo funcional Reto 6 Corpotex)

> Alineado con: D-003 (capa de caja), PROP-ROADMAP-001 (§3 y §6), Reto 6 (C-01 a C-07). Versión 2, 10/10/2026.

## 1. Rol y objetivo
Actúa como diseñador de producto senior (UX/UI) para software financiero-operativo. Diseña la interfaz de **KeptAI**, una **capa de caja** que se coloca entre el CRM (Kommo, por confirmar) y el ERP/facturación ("Factura Ya", por confirmar) de una empresa que vende por WhatsApp a crédito. El diseño será **implementado en 18 horas** por un equipo de 4 en **React + TypeScript** (backend Supabase/PostgreSQL), así que: **solo 3 pantallas**, componentes simples y reutilizables, sin interacciones que no se puedan construir rápido. Idioma **español (Perú)**, moneda **soles (S/, PEN)**, fechas dd/mm/aaaa, zona America/Lima.

Idea a hacer evidente en la UI: *"Corpotex ya tiene su CRM y su ERP. Lo que no tiene es lo que pasa entre los dos: la plata que se cobra, la que se gana y la que viene."*

## 2. Contexto de negocio
- **Corpotex**: confeccionista de Piura. Marcas: **Corpotex** (uniformes corporativos/industriales) y **Unicrack** (Sport y Uniformes escolares). Producción propia (taller) y talleres de terceros. Vende por WhatsApp, un vendedor por marca.
- **Situación declarada por la empresa**: ~**80% de las ventas es a crédito**, informal por WhatsApp; ~**30% de la cartera queda sin cobrar**. Pagos (Yape, Plin, transferencias) los anotan dos personas y a veces no se registran; los reportes muestran precio facturado, no costo ni caja.
- **Cómo mostrar 80% y 30%**: como *"dato aportado por la empresa"* en un indicador, nunca como constante del sistema ni como pérdida confirmada (su significado aún se valida). En la UI se llama **"cartera sin cobrar"**, no "incobrable". El castigo de mora es un **parámetro editable** `factor_mora` de la proyección de caja (control con rótulo "Supuesto configurable"), **por defecto 0%**, con un botón de escenario "Aplicar 30% (dato empresa)".
- **Plazos configurables** (demo: 15 y 30 días; la entrevista menciona 30/45). El **evento que inicia el plazo** (entrega / confirmación) también es configurable.
- **Distinguir tres conceptos que no son lo mismo**: *organización* (cliente de KeptAI, aislamiento de datos), *entidad* (RUC/empresa del grupo) y *marca*.

## 3. Alcance (dirección vigente)
**Dentro:** captura con validación humana · conciliación · cobranza · margen y caja a 4 semanas.
**Fuera (fase 2) — no diseñar:** stock, cotizaciones, recompra, kanban de taller, check-in de estaciones, pitch/slides.
Costos de insumos, mano de obra y terceros entran solo como **datos ya cargados** para calcular margen.

## 4. Usuarios y filtros globales
Vendedores, administración/registro de pagos y gerencia; el **cliente corporativo** consulta su estado de cuenta (vista pública de solo lectura dentro de Pantalla 2). **Selector global persistente**: `Corpotex | Unicrack | Consolidado` (el consolidado requiere acceso autorizado). Toda cifra muestra **fecha de corte** y su **fuente** (dato empresa / demostración / supuesto configurable). Responsivo real: móvil y escritorio (C-01).

## 5. Las 3 pantallas

### Pantalla 1 — Captura y revisión (móvil + escritorio)
- Cargar/pegar **chat**, subir **imágenes de voucher** y una **nota de voz**. Lista de evidencias a la izquierda (tipo, hora, estado).
- Panel de **borrador estructurado** junto a la **evidencia original** (burbuja de chat, miniatura del voucher, audio con transcripción). Campos: cliente, marca, entidad, prenda/cantidad/tallas, monto, banco/billetera, N.° de operación, fecha-hora. **Confianza por campo**; ilegible o ausente = chip ámbar "Pendiente" (nunca inventar importes).
- Acciones: editar campo, **Confirmar borrador** (validación humana), Descartar, Pedir dato. Se guarda quién corrigió qué.
- Estados de la evidencia: *borrador → revisado → comprobante pendiente*. Estados UI: vacío, procesando, error de lectura/IA (con opción de **edición manual**, rotulada como limitación).
- Mensaje fijo: **"Comprobante recibido ≠ pago verificado: aún no reduce el saldo."**

### Pantalla 2 — Pedido, pagos y cobranza (móvil + escritorio)
- Cabecera de pedido: cliente, organización/entidad/marca, línea, modalidad (**propia/tercerizada**), precio, costo, vencimiento, saldo, estado.
- **Conciliación**: sugerencia de pedido para cada voucher con puntaje, y excepciones con chip de color + icono + texto: **Coincide, Parcial, Duplicado, Huérfano (sin pedido), Monto no cuadra**.
- **Tres acciones separadas y con confirmación**: ① *Validar evidencia* → ② *Registrar verificación de fondos* (responsable y hora; "verificación simulada" en el demo, no conexión a un banco) → ③ *Aplicar pago*. Stepper visible: *Comprobante pendiente → Pago verificado → Pago aplicado*, más estados *Pago duplicado*, *Saldo pendiente*, *Alerta resuelta*. Aplicar dos veces o reintentar no duplica el pago (botón deshabilitado + mensaje).
- **Autorización de crédito**: si el cliente ya tiene saldo, banner "Cliente con saldo S/ X" y estado **Autorización pendiente** con responsable y motivo; no se aprueba solo desde la UI (el servidor decide).
- **Cobranza**: línea de tiempo de alertas (3 días antes, el día, 3 días después, escalamiento), alerta interna con responsable, cancelada al aplicarse el pago completo. Lista de cuentas por cobrar con rangos: por vencer, vence hoy, vencido.
- **Estado de cuenta del cliente** (subvista móvil, enlace sin login): saldo vigente, próximo vencimiento, pedidos, abonos aplicados, "actualizado al dd/mm hh:mm". Sin jerga interna.
- Para el pedido con saldo abierto, "Compromiso de pago" (no llamarlo pagaré).

### Pantalla 3 — Resultado y caja (escritorio + lectura móvil)
- **Margen**: por pedido, línea y marca, con conmutador propia/tercerizada. Desglose del costo (materia prima, mano de obra, terceros, indirectos con nota "asignación por validar"). Pedido con **margen negativo** destacado en rojo. Distinguir **resultado económico** (margen) de **dinero cobrado**, con tooltip de definición.
- **Taller como centro de resultados**: insumos → costo de producción → **cargo interno (precio de transferencia, editable)** → resultado del taller. En **Consolidado**, el cargo interno aparece eliminado ("sin doble conteo") y nunca suma como ingreso externo ni a la caja.
- **Caja a 4 semanas**: gráfico semanal de ingresos esperados (por vencimiento, ponderados por `1 − factor_mora`), egresos (planillas, alquileres, proveedores, cuotas) y saldo acumulado con **saldo de apertura y su procedencia**. Un pago aplicado pasa de "cobro futuro" a "cobro realizado" (sin duplicarse). Semanas con saldo < 0 en rojo. Mostrar fecha de corte y supuestos.
- **Reporte**: botón *Generar reporte* (vista imprimible por periodo y entidad) y **Exportar CSV** (IDs, entidad, moneda, fechas, estado).

## 6. Datos de demostración (ficticios, insignia visible "Datos de demostración"; deben cuadrar en las 3 pantallas)
- **P-001** (propia): venta S/300; materiales 200 + mano de obra 80 + indirectos 60 = costo **S/340** → margen **−S/40**.
- **P-002** (tercerizada): venta S/500; costo tercerizado S/350 → margen **S/150**; vencimiento pasado, saldo inicial S/500.
- **V-001**: S/300 para P-001 → verificado y aplicado → saldo S/0.
- **V-002**: S/100 para P-002 → aplicado → saldo **S/400** y alerta por vencimiento.
- **V-003**: copia de V-002 (misma referencia de operación) → **Duplicado**, no reduce el saldo.
- Totales esperados: **cobrado aplicado S/400; saldo total S/400; margen conjunto S/110**.
- Centro productivo de P-001: cargo interno S/320, costo S/340 → resultado del taller **−S/20**; en consolidado el cargo se elimina y el margen del pedido es **−S/40**.
- Excepciones extra (para probar estados): un voucher huérfano, uno con monto que no coincide, una imagen ilegible, una nota de voz.
- Segunda organización mínima solo para probar aislamiento (no se muestra salvo selector de demo). Nombres ficticios, sin RUC ni logos reales.

## 7. Sistema visual
Sobrio, financiero, confiable; sin look de plantilla genérica. Primero **tokens**: color de marca, neutros, semáforo semántico (ok / por vencer / vencido / riesgo / info), tipografía con **cifras tabulares**, espaciado 4/8, radios y sombras mínimos; modo claro. Estado = **color + icono + texto**; contraste AA; objetivos táctiles ≥ 44 px. Separar visualmente **evidencia recibida** de **dato validado**. Componentes: tarjeta de borrador, stepper de pago, chip de estado, tabla con rangos, KPI, línea de alertas, selector de entidad, gráfico semanal. Estados de cada pantalla: cargando, vacío, error, sin permiso.

## 8. Restricciones de honestidad
- No afirmar integraciones activas con Kommo, ERP, bancos ni WhatsApp: mostrarlas como "Cargar archivo" / "Conectar (pendiente)". Alertas **dentro de la app**, sin envío real.
- No inventar cifras reales de Corpotex; solo 80% y 30% son dato de la empresa, rotulados.
- Una regla de negocio pendiente se rotula **"Propuesta"**; no inventar política de crédito.

## 9. Entregables y aceptación
**Entregables:** tokens y componentes; las 3 pantallas (móvil y escritorio donde se indica); recorrido clicable del demo; mini-panel de configuración (plazos, evento que inicia el plazo, `factor_mora`, precio de transferencia); notas de handoff por componente (props, estados) pensadas para React/TypeScript.
**Aceptación:**
1. El recorrido **3 vouchers + 1 chat** se hace sin salir del prototipo: captura → conciliación (V-003 duplicado) → saldo S/400 → alerta → P-001 con −S/40 → caja actualizada.
2. Se distingue *comprobante recibido*, *pago verificado* y *pago aplicado*.
3. El selector Corpotex/Unicrack/Consolidado cambia las cifras de forma coherente.
4. El consolidado no duplica el cargo interno de S/320.
5. Cada cifra declara su fuente; ningún supuesto parece dato real.
6. Móvil completa el recorrido; escritorio muestra todo lo de Pantalla 3.