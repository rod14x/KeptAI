# KeptAI · Frontend

React + TypeScript + Vite, Tailwind v4, Framer Motion (`motion`), Recharts, Phosphor Icons, React Router y Zod.
Alineado con D-005 y el DER fusionado (`cerebro/conocimientos/decisiones/actores-flujos-y-der-mvp.md`).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build a dist/
npm run e2e        # recorrido de aceptación (requiere `npm run dev` y Chrome instalado; SHOTS=1 guarda capturas)
```

## Cuentas de demostración
Cualquier contraseña de 6 caracteres o más. En el modal de login hay accesos directos por rol (roles del DER).

| Rol | Correo | Qué hace |
|---|---|---|
| Vendedor (Corpotex) | rosa.chunga@keptai.pe | Revisa la hoja de resumen, aprueba el crédito de sus clientes y confirma la orden (/ok). Solo su marca. |
| Vendedor (Unicrack) | luis.yarleque@keptai.pe | Igual, para Unicrack. |
| Administración | carmen.ramos@keptai.pe | Verifica pagos en su banca, los aplica, atiende la cobranza y comparte estados de cuenta. |
| Gerencia | patricia.zapata@keptai.pe | Ve margen, caja y reportes; edita supuestos. No aprueba crédito. |
| Jefe de taller | jorge.ipanaque@keptai.pe | Ve solo el taller y registra el despacho, que fija el vencimiento. |

La matriz está en `src/lib/permissions.ts`; el store vuelve a comprobar el permiso en cada acción.

## Pantallas
- `/login`: landing con modal y cuentas por rol.
- `/`: KPIs, caja a 4 semanas, asistente y actividad.
- `/pedidos`: tablero de órdenes (Por confirmar → Retenida → En producción → Por cobrar → Cobrada) y lista con fechas.
- `/pedidos/:ref`: hoja de resumen (WF1), chat de origen, ítems, condición de pago con aviso de mora, gatekeeper, fechas, pagos, mensajes y margen.
- `/conciliacion/:id`: comprobante junto a lo leído por la IA; fases Recibido → Verificado en banco → Aplicado.
- `/cobranza`: cartera por vencimiento, alertas internas con resolución y bitácora de WhatsApp (WF3).
- `/taller`: órdenes liberadas y registro de despacho.
- `/captura`: carga manual de comprobantes y pedidos (respaldo de WhatsApp).
- `/clientes` y `/clientes/:id`: crédito, historial de pago, decisiones del vendedor, pagos, estado de cuenta e historial.
- `/resultado`: margen teórico y percibido por marca, línea y orden; taller como centro de resultados; CSV.
- `/estado-cuenta/:token`: vista del cliente, sin login, solo lectura; vence en 7 días y se puede revocar.
- Perfil (menú del avatar): datos y permisos, actividad, preferencias y configuración.

## Reglas de negocio (D-005)
- Plazo de 15 a 30 días por orden, contado desde el despacho; una sola obligación por orden.
- El vendedor aprueba el crédito. La mora no bloquea: se muestra el aviso y queda registrado que lo vio.
- Gatekeeper: ninguna orden entra a producción sin crédito aprobado o anticipo verificado.
- Un pago pasa por Recibido → Verificado en banco → Aplicado; solo el aplicado mueve el saldo. KeptAI no se conecta al banco.
- Duplicado = mismo código de operación, monto y fecha. Duplicados, sin orden y no cuadra quedan en revisión.
- Cobranza −3, 0 y +3 días por WhatsApp al contacto de prueba; en +3 se abre una alerta interna. Todo se cancela al aplicar el pago completo.

## Datos
`src/api/` simula a Spring con una semilla ficticia: 6 clientes, 16 órdenes, 8 comprobantes. `client.ts` expone los DTO;
al integrar, cada función pasa a ser un `fetch` a `VITE_API_BASE_URL`. El estado vive en `localStorage` (compartido entre
pestañas); "Reiniciar demo" vuelve a la semilla. `?demo_error=1` fuerza el estado de error.

Equivalencia con el recorrido del cerebro: **P-001 = ORD-001** y **P-002 = ORD-002**, con las mismas cifras.
Aplicar V-002 deja ORD-002 en S/ 400; V-003 es duplicado; ORD-001 da margen −S/ 40 y taller −S/ 20, sin doble conteo del
cargo interno de S/ 320. Órdenes del flujo nuevo: ORD-013 (borrador de un cliente en mora), ORD-014 (retenida por anticipo),
ORD-015 (borrador al día) y ORD-016 (en producción).

Dirección visual: [DESIGN.md](DESIGN.md).
