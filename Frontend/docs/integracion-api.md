# Integración del frontend con la API y la BD V6

Estado al 10/10/2026. Contrato: `Backend/docs/openapi.yaml` (MIG-02). Base de datos: `BD/` (V6).

## 0. Panel conectado a Spring (INT-FE-API-001, 11/10/2026, rama `develop`)

En modo `api` todos los módulos usan Spring + PostgreSQL reales, salvo **Carga manual** (`/captura`): subir un voucher necesita el uploader privado de Storage (MIG-04), que aún no tiene endpoint. Las secciones 2.1 y 5 describen el estado anterior (AUTH-FE-03) y quedan como antecedente.

| Endpoint | Estado |
|---|---|
| `/me`, órdenes, crédito (GET/POST), despacho | Conectado |
| Pagos, conciliación, verificación, aplicación | Conectado (ADMIN). La verificación la registra el motor como simulada (`simulated_demo`, sin banco) |
| Cuentas por cobrar, alertas, estado de cuenta, auditoría | Conectado |
| Resultados, margen, centro productivo, caja, CSV | Conectado (GERENTE), cifras de `MotorResultados`/`MotorCaja` |
| Evidencias y borradores | Sin endpoint (404): el panel los muestra vacíos |

Decisiones del adaptador que conviene conocer:
- **Contado:** el panel envía `approved` sin `credit_term_days`; Spring lo trata como contado (orden RETENIDA hasta cobrarse completa). Con plazo es crédito (orden LIBERADA); con `advance_pct_bps` > 0, anticipo (RETENIDA hasta aplicar el anticipo; al aplicarlo pasa sola a LIBERADA).
- **Mora:** si el cliente tiene saldo vencido y no se envía `arrears_notice_acknowledged=true`, Spring responde 422 `ARREARS_NOTICE_NOT_ACKNOWLEDGED`. La mora avisa; no bloquea.
- **Código de pago:** `display_code` = `V-NNN` por orden de llegada en la organización (la tabla `pago` no tiene referencia propia).
- Fechas e instantes llegan con desfase de Lima (`-05:00`).

### Cómo correrlo en local
1. BD: `./BD/local/db.sh up && ./BD/local/db.sh migrate && ./BD/local/db.sh seed` (V1–V10 y semilla). Opcional: `./BD/local/db.sh seed-escenarios` agrega pedidos por decidir, un pedido por despachar y vouchers por verificar.
2. Spring (perfil `local`) con el JWKS de Supabase (`KEPTAI_JWT_*`, ver `Backend/docs/configuracion-supabase-local.md`). Si el 8080 está ocupado: `PORT=8081`; agregar el origen del frontend a `KEPTAI_CORS_ALLOWED_ORIGINS` si no es `localhost:5173`.
3. Frontend `.env.local`: `VITE_API_MODE=api`, `VITE_API_BASE_URL=http://localhost:8081`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del proyecto.
4. Cuentas: crear en Supabase Auth un usuario por rol y vincular cada uno: `./BD/local/db.sh link-auth VENDEDOR <uuid-del-usuario-en-Auth>` (igual con ADMIN, GERENTE, JEFE_TALLER). Sin vínculo, `/me` responde 403.
5. Prueba de contrato en vivo: `KEPTAI_LIVE_API=http://127.0.0.1:8081 KEPTAI_LIVE_TOKEN_ADMIN=… npx vitest run src/api/contract/live.test.ts` (un token por rol).

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
- Sesión (`src/context/AuthContext.tsx` + `src/context/session.ts`, AUTH-FE-02):
  - En modo `api`: `SessionController` (sin React ni Supabase directo) con un adaptador de Supabase. `signInWithPassword`, el JWT como Bearer y `GET /api/v1/me`, que da `user_id` (fila de usuario, no el `sub` de Auth), `organization_id` y `role` (`VENDEDOR` → vendedor, `ADMIN` → administración, `GERENTE` → gerencia, `JEFE_TALLER` → jefe de taller). Identidad y rol salen solo de `/me`; nunca de claims ni de cuentas mock. `useAuth()` expone además `identity`, `error` y `retry`.
  - El Bearer es el del último evento de `onAuthStateChange` (login, `TOKEN_REFRESHED`); el proveedor de token no llama a Auth y los eventos no hacen llamadas Auth dentro del callback (el trabajo se difiere). La suscripción se cancela al desmontar.
  - Estados: `loading`, `signed-out`, `authenticated`, `degraded` (sesión de Supabase válida pero `/me` no disponible por ahora). Errores: credenciales incorrectas; `/me` 401 sesión inválida (cierra la sesión local); 403 sin membresía; 409 varias organizaciones aún no soportadas (no se elige ninguna ni se pide un UUID); 503, 5xx, 408/429 o red caída: temporal, **no cierra la sesión** y permite «Reintentar»; respuesta inválida (Zod estricto, JSON ilegible, otros 4xx): error controlado y reintentable. La pantalla de acceso muestra el aviso.
  - Cada cambio de identidad (logout, desmontaje, otro usuario) invalida las respuestas de `/me` en vuelo: una respuesta antigua, correcta o fallida, no restaura ni cierra la identidad vigente.
  - `Person.since` es `null` en modo `api` (el contrato no expone la fecha de alta); el perfil omite esa línea. Nombre visible: parte local del correo de la sesión. Marca: sin dato.
  - En modo `mock`: cuentas de demostración, sin cambios y explícitas (`VITE_API_MODE=mock`); no se mezclan con la identidad real.

## 2.1 Inicio autenticado del modo `api` (AUTH-FE-03)

En modo `api` solo hay un módulo conectado: el **inicio de identidad** (`/`, `src/pages/InicioPage.tsx`). Muestra únicamente el correo de la sesión de Supabase Auth y lo que devuelve `GET /api/v1/me` (`user_id`, `organization_id`, `role`), la lista de módulos del rol como «No disponible todavía» y «Cerrar sesión». No inventa nombre de empresa, marca, fechas ni cifras (el contrato no los incluye).

- Disponibilidad: `src/lib/availability.ts` (`isModuleAvailable`): en `mock` todo; en `api` solo `inicio`. Los demás módulos son los que dependen de endpoints de negocio ausentes en Spring (ver `Backend/docs/matriz-acceso.md`). El bloqueo de la UI no sustituye la autorización del backend.
- Rutas: en `api`, `/pedidos*`, `/clientes*` (incl. estado de cuenta), `/conciliacion*`, `/cobranza`, `/taller`, `/captura`, `/resultado` y `/perfil` muestran «no disponible» (`ModuloNoDisponiblePage`) también por URL directa; la pantalla de negocio no se renderiza ni se descarga, y sus hooks de datos nunca corren. Una ruta inexistente sigue siendo 404.
- Menú: las entradas pendientes son elementos deshabilitados («Pronto»), no enlaces. En `api` no hay buscador, selector de marca/vista, «Reiniciar demo», menú de perfil ni precarga de pantallas (`AppLayout`, `UserMenu`, `LoginPage`).
- Acceso: tras login o restauración se va siempre a `/` (no se recuerda la ruta de origen); los errores de sesión, «Reintentar» y «Cerrar sesión» siguen en la pantalla de acceso (AUTH-FE-02). La pantalla de acceso del modo `api` no muestra la vista previa ni el distintivo de demostración.
- `mock` es explícito (`VITE_API_MODE=mock`): conserva el menú, buscador, selector y datos ficticios; no hay respaldo mock cuando falla la API.
- Pruebas: `src/navigation.test.ts` (17; renderiza las rutas reales de `AppRoutes` con una identidad simulada y falla si se llama a la fachada de datos de negocio) y `e2e/identidad-api.mjs` (`npm run e2e:api`, 30 comprobaciones en Chrome con Vite propio en el puerto 5199 y Supabase/Spring SIMULADOS con `page.route`). Ambas son fixtures: **no prueban Supabase Auth real ni el backend real**. `npm run e2e` (mock) sigue pasando 36/36.

## 3. Pantalla → endpoints

| Pantalla | Lecturas |
|---|---|
| Login | Supabase Auth, `getMyContext` |
| Pendientes (inicio de Vendedor y Administración) | Reutiliza las lecturas de Pedidos, Pagos y Cobranza según el rol (sin endpoint propio). "Sí, llegó al banco" llama a `registerPaymentVerification` y luego a `applyPayment`. |
| Inicio de Gerencia y `/resumen` | `listOrders`, `listReceivables`, `listCollectionAlerts`, `listDrafts?status=pending_review`. Si el rol tiene acceso: `listPayments`, `getResultsSummary`, `getCashForecast` y `listAuditEvents`. |
| Pedidos (tablero y lista) | `listOrders`, `listReceivables`, `listDrafts` (los borradores de WhatsApp aparecen en "Por confirmar") |
| Detalle de orden | `getOrder`, `getCreditDecision`, `listReceivables`, `listCollectionAlerts`; para un borrador, `getDraft` (hoja = campos con su estado) |
| Taller | `listOrders` (released/in_production, held, dispatched) |
| Pagos (`/conciliacion`) | `listPayments`, `getPayment`, `getReconciliationCandidates`, `getEvidenceDownloadLink` (imagen firmada) |
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
| Subir comprobante (`/captura`) | `POST /evidences/files` y luego `POST /evidences/{id}/extractions` (`payment_voucher`) |
| Exportar CSV | `GET /reports/orders.csv` |

Todas las escrituras envían `Idempotency-Key`, salvo el `PATCH` de borradores, que es idempotente por `expected_revision`.

Las rutas `/api/v1/ordenes/*`, `/pagos/voucher` y `/mensajes/*` son de n8n (`X-Api-Key`) y el navegador no las llama.

## 4. Validación del contrato

`npm test` valida cada ejemplo de respuesta del panel en `openapi.yaml` contra `src/api/contract/schemas.ts`. Hoy pasan 106 pruebas (43 de contrato, sesión con fixtures en `session.test.ts` y `supabase-auth.test.ts`, y 17 de navegación; ninguna prueba Supabase Auth real). Si Miguel cambia un DTO, la prueba falla y señala el campo.

## 5. Brechas del contrato (lo que la UI oculta en modo `api`)

| Capacidad (`capabilities`) | Falta en la API | Qué hace la UI |
|---|---|---|
| `messagesLog` | Lectura de `envio_notificacion` (tipo, estado, programado, intentos) | Oculta la pestaña "Mensajes WhatsApp" de Cobranza y la lista del detalle de orden |
| `resolveAlerts` | Resolver una alerta manualmente (solo existe GET) | Muestra la alerta sin el botón Resolver |
| `retryMessages` | Reintentar un envío fallido | Sin botón Reintentar |
| `editPaymentFields` | Corregir un pago ya creado (solo se corrige el borrador antes de confirmar) | Campos de solo lectura |
| `discardPayment` | Marcar duplicado o descartar un pago | Explica que el backend lo clasificó y que queda en revisión |
| `manualOrderCapture` | Alta manual de pedido (`createTextEvidence` está fuera del MVP) | Oculta la pestaña "Pedido" de Subir comprobante |
| `voucherNeedsFile` | (no es una brecha) | En la API se sube la imagen; los datos los extrae la IA |
| `settings` | Editar supuestos (factor de cobro, plazo por defecto) y precio de transferencia | Configuración solo informativa |
| `orderItems` | Ítems, costos y vendedor en el DTO `Order` | Oculta la tarjeta Ítems; el margen sale de `/results/margins` |
| `customerDirectory` | `GET /customers` con tipo, RUC/DNI, vendedor y línea de referencia | Clientes derivados de órdenes y cuentas por cobrar; los campos que faltan se muestran "por confirmar" |

Otros huecos:
- `Payment` no tiene marca ni `order_id` hasta aplicarse. La lista de Pagos no se filtra por marca; el backend aísla por organización con RLS.
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

### AUTH-FE-02: revisión final (11/10/2026)
SessionController obtiene user_id, organization_id y role exclusivamente de /me. El adaptador supabase-auth.ts propaga los errores del SDK; red, 429 y 5xx no se anuncian como credenciales incorrectas. signOut usa scope: local.
Se probaron carreras de restauración, renovación, logout diferido, cambio de usuario y nuevo login; el Bearer anterior se retira al comenzar otro login y al desmontar. El reintento inicial vuelve a restaurar Auth.
npm test: 89 pruebas sin fallos (43 contrato + 39 sesión + 7 adaptador). npm run build: OK con Node 22.23.3 Linux. No es evidencia de Auth real ni navegador. El modo continúa mock; AUTH-FE-03 debe impedir solicitudes a APIs de negocio pendientes antes de habilitar api.

### Revisión AUTH-FE-03 (11/10/2026)
Pruebas finales: 106 tests, build OK, e2e api 31/31 con fixtures en Chrome. Se cierra automáticamente el diálogo ante fallo reintentable en api para acceder al aviso sin Escape. El e2e espera la animación y prueba el botón directamente.
Configuración Supabase local existente/coherente y JWKS público accesible, pero el modo sigue mock y PostgreSQL local no tiene organizaciones ni usuarios. Auth real, membresía y recorrido contra Spring real siguen pendientes. No confundir claves configuradas con login o Storage operativo.
