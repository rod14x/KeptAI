# Integración del frontend con la API y la BD V6

Estado al 10/10/2026. Contrato: `Backend/docs/openapi.yaml` (MIG-02). Base de datos: `BD/` (V6).

## 1. Cómo se elige la fuente de datos

| Variable | Valor | Efecto |
|---|---|---|
| `VITE_API_MODE` | `mock` (por defecto) | Semilla local de demostración. No necesita backend. |
| `VITE_API_MODE` | `api` | Spring + Supabase Auth, según el contrato. |
| `VITE_API_BASE_URL` | `https://…` | Base de Spring, sin barra final. Solo en modo `api`. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | | Login con Supabase. Solo la clave publicable, nunca la service role. |

Copia `.env.example` a `.env.local` y ajusta. Todas las `VITE_*` llegan al navegador.

## 2. Arquitectura

```
pantallas ──> src/api/client.ts  (fachada única: capabilities, consultas y commands)
                    │
                    ├── src/api/mock/source.ts      MOCK: semilla + reglas en el navegador
                    └── src/api/contract/source.ts  API: adapta los DTO del contrato a la vista
                              ├── endpoints.ts  un método por operationId del panel
                              ├── http.ts       Bearer de Supabase, Idempotency-Key, ApiError, cursor
                              └── schemas.ts    Zod .strict() de cada DTO (validado contra el YAML)
```

- `src/api/dto.ts` define `DataSource`, el contrato común de las dos fuentes, y los DTO de pantalla. Si un dato no existe en la API, el campo es `null` y la pantalla lo muestra como "—" o lo explica. Nunca se muestra como cero.
- `src/api/model.ts` tiene los tipos de vista: Order, Evidence, etc.
- `src/api/events.ts` es el bus de cambios: cada comando exitoso hace que `useApi` vuelva a pedir los datos.
- `capabilities` indica qué puede hacer la fuente activa. La UI oculta lo que el contrato aún no permite (sección 5).
- Sesión (`src/context/AuthContext.tsx`):
  - En modo `api`: `signInWithPassword`, luego el JWT va como Bearer y `GET /api/v1/me` da el rol (`VENDEDOR` → vendedor, `ADMIN` → administración, `GERENTE` → gerencia, `JEFE_TALLER` → jefe de taller).
  - En modo `mock`: cuentas de demostración.

## 3. Pantalla → endpoints

| Pantalla | Lecturas |
|---|---|
| Login | Supabase Auth, `getMyContext` |
| Dashboard | `listOrders`, `listReceivables`, `listCollectionAlerts`, `listDrafts?status=pending_review`. Si el rol tiene acceso: `listPayments`, `getResultsSummary`, `getCashForecast` y `listAuditEvents`. |
| Pedidos (tablero y lista) | `listOrders`, `listReceivables`, `listDrafts` (los borradores de WhatsApp aparecen en "Por confirmar") |
| Detalle de orden | `getOrder`, `getCreditDecision`, `listReceivables`, `listCollectionAlerts`; para un borrador, `getDraft` (hoja = campos con su estado) |
| Taller | `listOrders` (released/in_production, held, dispatched) |
| Conciliación | `listPayments`, `getPayment`, `getReconciliationCandidates`, `getEvidenceDownloadLink` (imagen firmada) |
| Cobranza | `listReceivables`, `listCollectionAlerts` |
| Clientes y ficha | Se derivan de `listOrders` + `listReceivables`; `getCustomerStatement`; `getCreditDecision` por orden |
| Estado de cuenta (`/clientes/:id/estado-cuenta`) | `getCustomerStatement` (autenticado; V6 no tiene enlace público) |
| Resultado (solo gerencia) | `getMarginReport` (order, brand, product_line), `getProductionCenterResults`, `getResultsSummary`, `exportOrdersCsv` |
| Perfil | `getMyContext`, `listAuditEvents` |
| Búsqueda | órdenes, clientes derivados y pagos ya cargados |

| Acción en la UI | Endpoint |
|---|---|
| Verificar en banco | `POST /payments/{id}/verifications` con `manual_confirmation` |
| Vincular orden | Elige el `receivable_id` entre los candidatos de conciliación (local hasta aplicar) |
| Aplicar pago | `POST /payments/{id}/applications`. El monto es el mínimo entre lo verificado sin aplicar y el saldo del candidato. |
| Confirmar orden (vendedor) | Si es un borrador: `POST /drafts/{id}/confirmation`. Después: `POST /orders/{id}/credit-decision` (approved). |
| Rechazar orden | Si es un borrador: `POST /drafts/{id}/discard`. Si es una orden: `credit-decision` con rejected. |
| Registrar despacho | `POST /orders/{id}/dispatch` con `{dispatch_date, note}` |
| Subir voucher (Carga manual) | `POST /evidences/files` y luego `POST /evidences/{id}/extractions` (`payment_voucher`) |
| Exportar CSV | `GET /reports/orders.csv` |

Todas las escrituras envían `Idempotency-Key`, salvo el `PATCH` de borradores, que es idempotente por `expected_revision`.

Las rutas `/api/v1/ordenes/*`, `/pagos/voucher` y `/mensajes/*` son de n8n (`X-Api-Key`) y el navegador no las llama.

## 4. Validación del contrato

`npm test` valida cada ejemplo de respuesta del panel en `openapi.yaml` contra `src/api/contract/schemas.ts`. Hoy pasan 43 pruebas. Si Miguel cambia un DTO, la prueba falla y señala el campo.

## 5. Brechas del contrato (lo que la UI oculta en modo `api`)

| Capacidad (`capabilities`) | Falta en la API | Qué hace la UI |
|---|---|---|
| `messagesLog` | Lectura de `envio_notificacion` (tipo, estado, programado, intentos) | Oculta la pestaña "Mensajes WhatsApp" de Cobranza y la lista del detalle de orden |
| `resolveAlerts` | Resolver una alerta manualmente (solo existe GET) | Muestra la alerta sin el botón Resolver |
| `retryMessages` | Reintentar un envío fallido | Sin botón Reintentar |
| `editPaymentFields` | Corregir un pago ya creado (solo se corrige el borrador antes de confirmar) | Campos de solo lectura |
| `discardPayment` | Marcar duplicado o descartar un pago | Explica que el backend lo clasificó y que queda en revisión |
| `manualOrderCapture` | Alta manual de pedido (`createTextEvidence` está fuera del MVP) | Oculta la pestaña "Pedido" de Carga manual |
| `voucherNeedsFile` | (no es una brecha) | En la API se sube la imagen; los datos los extrae la IA |
| `settings` | Editar supuestos (factor de cobro, plazo por defecto) y precio de transferencia | Configuración solo informativa |
| `orderItems` | Ítems, costos y vendedor en el DTO `Order` | Oculta la tarjeta Ítems; el margen sale de `/results/margins` |
| `customerDirectory` | `GET /customers` con tipo, RUC/DNI, vendedor y línea de referencia | Clientes derivados de órdenes y cuentas por cobrar; los campos que faltan se muestran "por confirmar" |

Otros huecos:
- `Payment` no tiene marca ni `order_id` hasta aplicarse. La cola de Conciliación no se filtra por marca; el backend aísla por organización con RLS.
- `Order.brand` llega como texto libre y se reconoce por nombre ("Corpotex" o "Unicrack").
- No hay margen percibido (aplicado − costo) por orden en el contrato. La vista lo muestra como "Sin dato".
- La caja (`/results/cash-forecast`) es solo de GERENTE. Los demás roles ven "Cobrado y aplicado" en su lugar.

## 6. Supuestos para confirmar con Miguel

1. **Confirmar una orden de WhatsApp.**
   - El borrador (`pending_review`) se confirma con `confirmDraft`, que crea la orden. Luego el vendedor decide el crédito con `submitCreditDecision`.
   - ¿Es ese el orden correcto, o `confirmDraft` ya deja la orden en `pending_approval` esperando la decisión?
2. **Contado y anticipo.**
   - Se envían como `approved`: con `advance_pct_bps` si es anticipo, sin `credit_term_days` si es contado.
   - `payment_condition` no se puede fijar desde el panel. ¿Lo infiere el backend?
3. **Aviso de mora.**
   - El panel calcula la mora con `listReceivables` (overdue) y pide la confirmación antes de enviar `arrears_notice_acknowledged: true`.
   - Si el backend responde con un error específico cuando falta el acuse, conviene mapear ese `code` a `aviso_mora`.
4. **Aplicación.** Se aplica sobre el primer candidato de `getReconciliationCandidates`, salvo que Administración elija otro.

## 7. Identificación del mock (para eliminarlo al integrar)

Todo lo simulado está marcado con un comentario `MOCK` al inicio del archivo o del bloque. No se borra todavía.

**Archivos que se eliminan completos:**

| Archivo | Qué es |
|---|---|
| `src/api/mock/seed.ts` | Semilla ficticia (`data_origin = demo_fixture`): clientes, órdenes, vouchers |
| `src/api/mock/state.ts` | Esquema del estado guardado en `localStorage` (`keptai-demo-v4`) |
| `src/api/mock/store.ts` | Backend simulado: acciones, permisos, persistencia |
| `src/api/mock/domain.ts` | Reglas que en producción calcula Spring (saldo, mora, margen, caja) |
| `src/api/mock/source.ts` | `DataSource` mock |

**Puntos a limpiar después:**

| Archivo | Qué quitar |
|---|---|
| `src/api/client.ts` | El import de `mockSource`; dejar solo `apiSource` |
| `src/context/AuthContext.tsx` | `MockAuthProvider` y el import de `mock/store` |
| `src/pages/LoginPage.tsx` | `DEMO_ACCOUNTS` y la contraseña precargada |
| `src/components/charts/LoginPreviewChart.tsx` | La gráfica decorativa del login sale de la semilla: reemplazarla por una imagen estática o quitarla |
| `src/config.ts` | `IS_MOCK` y `VITE_API_MODE` |
| Páginas con `IS_MOCK && <DemoBadge />` (Pedidos, Clientes, Cobranza, Taller, Captura) | La insignia; en las demás sale del flag `demo` (`data_origin`) |
| `e2e/recorrido.mjs` | Recorre la semilla: rehacerlo contra datos de prueba del backend |

Cuando el backend esté listo y el mock se haya eliminado, `capabilities` queda solo en `contract/source.ts`. Cada brecha que Miguel cubra pasa a `true` y su comando deja de devolver `no_disponible`.
