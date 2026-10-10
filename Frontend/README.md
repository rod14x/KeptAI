# KeptAI · Frontend

React + TypeScript + Vite, Tailwind v4, Recharts, Phosphor Icons, React Router y Zod.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build a dist/
```

## Cuentas de demostración
Cualquier contraseña de 6 caracteres o más. En el modal de login hay accesos directos por rol.

| Rol | Correo | Qué puede hacer |
|---|---|---|
| Gerencia | patricia.zapata@keptai.pe | Consolidado, decide crédito, edita supuestos y precio de transferencia |
| Administración | carmen.ramos@keptai.pe | Valida, verifica fondos y aplica pagos; comparte estados de cuenta |
| Registro de pagos | jorge.ipanaque@keptai.pe | Corrige lo leído por la IA y valida; no verifica ni aplica |
| Vendedora Corpotex | rosa.chunga@keptai.pe | Solo su marca; solicita crédito |
| Vendedor Unicrack | luis.yarleque@keptai.pe | Solo su marca; solicita crédito |

La matriz está en `src/lib/permissions.ts`; el store vuelve a comprobar el permiso en cada acción.

## Pantallas
- `/login`: landing con modal y cuentas por rol.
- `/`: KPIs, caja a 4 semanas, asistente (según rol y preferencias) y actividad.
- `/pedidos`: tablero de cobro y lista de pedidos con fecha de pedido, entrega, vencimiento y último pago.
- `/clientes` y `/clientes/:id`: crédito (línea, usado, vencido, comportamiento de pago), pedidos con alertas -3/0/+3/+7, pagos, solicitudes de crédito, enlace de estado de cuenta e historial con fechas.
- `/conciliacion/:id`: evidencia junto a lo extraído; validar, verificar fondos y aplicar con trazabilidad de fechas y responsables.
- `/resultado`: margen por marca, línea y pedido; taller como centro de resultados; CSV.
- `/estado-cuenta/:token`: vista del cliente, sin login, solo lectura; el enlace vence en 7 días y se puede revocar.
- Perfil (menú del avatar): datos y permisos, mi actividad, preferencias y configuración.

## Datos
`src/api/` simula el backend con una semilla ficticia: 6 clientes, 12 pedidos, 7 evidencias y 3 solicitudes de crédito.
`client.ts` expone los DTO; al integrar Spring, cada función pasa a ser un `fetch` a `VITE_API_BASE_URL`.
El estado se guarda en `localStorage` y se comparte entre pestañas; "Reiniciar demo" vuelve a la semilla.
`?demo_error=1` fuerza el estado de error.

Cifras de la semilla (consolidado, antes de tocar nada): margen conjunto S/ 2,240; saldo por cobrar S/ 4,170
(S/ 1,350 vencido, S/ 700 en disputa fuera de la proyección). El recorrido del cerebro sigue intacto en P-001/P-002:
aplicar V-002 deja P-002 en S/ 400; V-003 es duplicado; P-001 da margen -S/ 40, taller -S/ 20, sin doble conteo del cargo interno de S/ 320.

Dirección visual: [DESIGN.md](DESIGN.md).
