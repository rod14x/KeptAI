# KeptAI · Frontend

React + TypeScript + Vite, Tailwind v4, Framer Motion (`motion`), Recharts, Phosphor Icons, React Router, Zod y Supabase Auth.
Alineado con D-005, la BD V11 (`BD/`) y el contrato de la API (`Backend/docs/openapi.yaml`).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build a dist/
npm test           # valida los esquemas del frontend contra los ejemplos de openapi.yaml
npm run e2e        # recorrido de aceptación en modo mock (requiere `npm run dev` y Chrome; SHOTS=1 guarda capturas)
npm run e2e:api       # identidad del modo api con Supabase y Spring simulados (Chrome)
npm run e2e:conectado # recorrido del panel contra Spring + PostgreSQL reales (Vite en modo api, semilla + escenarios)
npm run e2e:real      # login real: Supabase Auth → JWT → Spring /api/v1/me (requiere una cuenta real)
npm run e2e:diseno    # comprobaciones visuales del diseño (Chrome)
```

Requiere Node 22 o superior.

## Fuente de datos: mock o API
`VITE_API_MODE=mock` (por defecto) usa la semilla de demostración. `VITE_API_MODE=api` usa Spring con login de
Supabase (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; ver `.env.example`).

**Estado del modo api (11/10/2026):** el panel está conectado a Spring + PostgreSQL. Tras el login con Supabase Auth,
todos los módulos leen de la API según el rol, y las acciones de crédito, verificación, aplicación y duplicado de
pagos, resolución de alertas y despacho llaman a los motores del backend. Solo **Carga manual** (`/captura`) sigue
como "no disponible": subir un voucher desde el panel requiere el uploader privado de Storage (MIG-04). No hay respaldo
mock ante errores. Verificado con `e2e:conectado` contra Spring y PostgreSQL locales con la semilla demo
(`BD/local/db.sh seed && seed-escenarios`). El login real pasó una aceptación básica con una cuenta; las cuentas
por rol se vinculan con `BD/local/db.sh link-auth`.
Mapa de endpoints, brechas del contrato, supuestos y la lista de archivos mock a eliminar:
[docs/integracion-api.md](docs/integracion-api.md).

## Cuentas de demostración (solo modo mock)
Cualquier contraseña de 6 caracteres o más. En el modal de login hay accesos directos por rol (roles del contrato).

| Rol | Correo | Qué hace |
|---|---|---|
| Vendedor (Corpotex) | rosa.chunga@keptai.pe | Revisa la hoja de resumen, aprueba el crédito de sus clientes y confirma la orden (/ok). Solo su marca. |
| Vendedor (Unicrack) | luis.yarleque@keptai.pe | Igual, para Unicrack. |
| Administración | carmen.ramos@keptai.pe | Verifica pagos en su banca, los aplica, atiende la cobranza y registra despachos. |
| Gerencia | patricia.zapata@keptai.pe | Única con margen, caja, resultados y CSV; edita supuestos. No aprueba crédito. |
| Jefe de taller | jorge.ipanaque@keptai.pe | Ve solo el taller y registra el despacho, que fija el vencimiento. |

La matriz está en `src/lib/permissions.ts` y sigue los roles de `contrato-api.md`. Spring autoriza de verdad; la UI solo oculta.

## Pantallas
- `/login`: landing con modal y cuentas por rol.
- `/`: KPIs, caja a 4 semanas, asistente y actividad.
- `/pedidos`: tablero de órdenes (Por confirmar → Retenida → En producción → Por cobrar → Cobrada) y lista con fechas.
- `/pedidos/:ref`: hoja de resumen (WF1) como campos extraídos con su estado, ítems, condición de pago con aviso de mora, gatekeeper, fechas, pagos, mensajes y margen.
- `/conciliacion/:id`: comprobante junto a lo leído por la IA; fases Recibido → Verificado en banco → Aplicado.
- `/cobranza`: cartera por vencimiento, alertas internas con resolución y bitácora de WhatsApp (WF3).
- `/taller`: órdenes liberadas y registro de despacho.
- `/captura`: carga manual de comprobantes y pedidos (respaldo de WhatsApp).
- `/clientes` y `/clientes/:id`: crédito, historial de pago, decisiones del vendedor, pagos e historial.
- `/clientes/:id/estado-cuenta`: estado de cuenta autenticado, imprimible. V6 no tiene enlace público.
- `/resultado` (solo gerencia): margen por marca, línea y orden (null si el costeo está incompleto); taller como centro de resultados; CSV.
- Perfil (menú del avatar): datos y permisos, actividad, preferencias y configuración.

## Reglas de negocio (D-005)
- Plazo de 15 a 30 días por orden, contado desde el despacho; una sola obligación por orden.
- El vendedor aprueba el crédito. La mora no bloquea: se muestra el aviso y queda registrado que lo vio.
- Gatekeeper: ninguna orden entra a producción sin crédito aprobado o anticipo verificado.
- Un pago pasa por Recibido → Verificado en banco → Aplicado; solo el aplicado mueve el saldo. KeptAI no se conecta al banco.
- Duplicado = mismo código de operación, monto y fecha. Duplicados, sin orden y no cuadra quedan en revisión.
- Cobranza −3, 0 y +3 días por WhatsApp al contacto de prueba; en +3 se abre una alerta interna. Todo se cancela al aplicar el pago completo.

## Datos
La base (V6 en adelante, hoy V11) no guarda chats, transcripciones ni el texto de los mensajes salientes: la UI muestra solo la extracción estructurada,
el voucher y la bitácora de envíos (tipo, estado, fechas).

En modo mock, `src/api/mock/` (marcado `MOCK`) simula a Spring con una semilla ficticia: 6 clientes, 16 órdenes y
8 comprobantes. El estado vive en `localStorage` (compartido entre pestañas); "Reiniciar demo" vuelve a la semilla.
`?demo_error=1` fuerza el estado de error.

Equivalencia con el recorrido del cerebro: **P-001 = ORD-001** y **P-002 = ORD-002**, con las mismas cifras.
Aplicar V-002 deja ORD-002 en S/ 400; V-003 es duplicado; ORD-001 da margen −S/ 40 y taller −S/ 20, sin doble conteo del
cargo interno de S/ 320. Órdenes del flujo nuevo: ORD-013 (borrador de un cliente en mora), ORD-014 (retenida por anticipo),
ORD-015 (borrador al día) y ORD-016 (en producción).

Dirección visual: [DESIGN.md](DESIGN.md).
