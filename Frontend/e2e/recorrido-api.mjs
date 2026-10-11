// INT-FE-API-001/002 · recorrido en NAVEGADOR REAL (Chrome) del panel conectado a Spring + PostgreSQL REALES.
// No levanta servidores: requiere Vite en modo api (E2E_BASE), Spring y la base con semilla + escenarios
// (BD/local/db.sh seed && seed-escenarios). El login usa el Supabase Auth configurado en Vite; las cuentas por rol
// vienen de E2E_EMAIL_<ROL> / E2E_PASSWORD (por defecto, las de la semilla demo).
// Uso: E2E_BASE=http://127.0.0.1:5174 npm run e2e:conectado
// Falla ante errores de consola, respuestas 5xx o 4xx fuera de las rutas aún sin endpoint (borradores, evidencias).
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5174";
const PASSWORD = process.env.E2E_PASSWORD ?? "demo1234";
const ACCOUNTS = {
  vendedor: process.env.E2E_EMAIL_VENDEDOR ?? "vendedora.demo@keptai.invalid",
  // Segundo vendedor (Luis, Unicrack): vincular con db.sh link-auth VENDEDOR2 si se usa Supabase Auth real.
  vendedor2: process.env.E2E_EMAIL_VENDEDOR2 ?? "luis.demo@keptai.invalid",
  administracion: process.env.E2E_EMAIL_ADMIN ?? "admin.demo@keptai.invalid",
  gerencia: process.env.E2E_EMAIL_GERENTE ?? "gerencia.demo@keptai.invalid",
  jefe_taller: process.env.E2E_EMAIL_JEFE_TALLER ?? "taller.demo@keptai.invalid",
};
// Rutas del contrato todavía sin controlador: el panel las degrada a vacío (404 esperado).
const PENDING = [/\/api\/v1\/drafts/, /\/api\/v1\/evidences/];

const results = [];
const check = (scenario, name, ok, detail = "") => results.push({ scenario, name, ok: Boolean(ok), detail });
const flat = (t) => t.replace(/\s+/g, " ").trim();

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome" });

async function session(role, visits) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  const denied = [];
  const api = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/v1/")) return;
    api.push(`${r.request().method()} ${u.pathname} ${r.status()}`);
    const expected404 = r.status() === 404 && PENDING.some((p) => p.test(u.pathname));
    if (r.status() === 403) denied.push(`${r.request().method()} ${u.pathname}`);
    else if (r.status() >= 400 && !expected404) bad.push(`${r.request().method()} ${u.pathname}${u.search} -> ${r.status()}`);
  });

  await page.goto(`${BASE}/login`);
  await page.fill("#email", ACCOUNTS[role]);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  check(role, "inicia sesión y sale del acceso", !new URL(page.url()).pathname.startsWith("/login"), flat(await page.locator("body").innerText()).slice(0, 160));
  check(role, "GET /api/v1/me respondió 200", api.some((a) => a.startsWith("GET /api/v1/me 200")), api.join(" | "));

  for (const [path, expect] of visits) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(600);
    const text = flat(await page.locator("body").innerText());
    const missing = expect.filter((s) => !text.includes(s));
    check(role, `${path} muestra ${expect.join(", ") || "la pantalla"}`, missing.length === 0 && !/no está disponible|Algo salió mal|No se pudo cargar/.test(text), missing.length ? `falta: ${missing.join(", ")} · ${text.slice(0, 200)}` : text.slice(0, 200));
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/${role}${path.replace(/[^\w-]+/g, "_") || "_inicio"}.png`, fullPage: true });
  }
  check(role, "sin respuestas de error inesperadas de la API", bad.length === 0, bad.join(" | "));
  // El panel no pide lo que el rol no puede leer (READS en contract/source.ts): ningún 403 en el recorrido.
  check(role, "sin 403: solo pide lo que su rol puede leer", denied.length === 0, denied.join(" | "));
  check(role, "sin errores de consola", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// Semilla base (P-001/P-002, V-001..V-003) + escenarios (P-003..P-016, V-004..V-014): BD/semilla/semilla_escenarios.sql.
const ORDER = (n) => `/pedidos/a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// D-014: en modo api la cartera del vendedor sigue sin definir; solo ve su sesión (Spring responde 403 a su cartera).
await session("vendedor", [["/", ["Mi sesión", "pendiente de definir"]]]);
await session("administracion", [
  ["/", []],
  ["/conciliacion", ["V-014", "V-013"]],
  ["/conciliacion/c0000000-0000-4000-8000-000000000014", ["V-014", "P-014"]],
  ["/conciliacion/c0000000-0000-4000-8000-000000000003", ["Marcado como duplicado"]],
  ["/cobranza", ["P-002", "P-007"]],
  ["/cobranza?vista=mensajes", ["Bitácora de envíos", "Evolution API no confirmó"]],
  ["/cobranza?vista=alertas", ["Carmen Ramos"]],
  [`${ORDER(4)}?tab=pagos`, ["Pedido P-004", "Transferencia", "V-005", "Carmen Ramos"]],
  // D-014: ADMIN decide el crédito; ve el aviso de mora del cliente.
  [ORDER(13), ["Pedido P-013", "Este cliente está en mora", "Confirmar orden"]],
]);
await session("gerencia", [
  ["/", ["Margen conjunto", "pedidos con costeo cerrado"]],
  ["/resultado", ["P-003", "Margen por marca", "sin costeo cerrado"]],
  ["/pedidos", ["16 pedidos", "P-015"]],
  ["/clientes/22222222-2222-4222-8222-222222222222", ["Club Deportivo Tallán"]],
]);
await session("jefe_taller", [["/taller", ["P-016", "Chaleco reflectivo con bordado"]]]);

await browser.close();
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASA" : "FALLA"}  [${r.scenario}] ${r.name}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones pasan (Spring y PostgreSQL reales; Auth: ${process.env.E2E_AUTH ?? "el configurado en Vite"}).`);
process.exit(failed.length ? 1 : 0);
