// AUTH-FE-03 / INT-FE-API-001 · recorrido en NAVEGADOR REAL (Chrome) del modo api con FIXTURES.
// Levanta su propio Vite en un puerto libre (por defecto 5199) con VITE_API_MODE=api y dominios ficticios; no toca
// el servidor del usuario (5173) ni Frontend/.env.local. Supabase Auth y Spring se SIMULAN con page.route():
// esto prueba la sesión y la navegación de la interfaz, no Supabase Auth real ni el backend real
// (para eso: npm run e2e:conectado contra Spring y PostgreSQL reales).
// Uso: npm run e2e:api
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";

const PORT = process.env.E2E_API_PORT ?? "5199";
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH_HOST = "fixture.supabase.test";
const API_HOST = "api.fixture.test";
const SUB = "a0000000-0000-4000-8000-0000000000a1";
const USER = "c0000000-0000-4000-8000-0000000000a1";
const ORG = "10000000-0000-4000-8000-0000000000a1";
const EMAIL = "persona.prueba@example.test";

const results = [];
const check = (scenario, name, ok, detail = "") => results.push({ scenario, name, ok: Boolean(ok), detail });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeJwt = () => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: SUB, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, email: EMAIL })}.fixture`;

// --- Vite propio, en modo api con valores ficticios (las variables de proceso tienen prioridad sobre .env.local) ---
const WIN = process.platform === "win32";
const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", PORT, "--strictPort"], {
  env: {
    ...process.env, VITE_API_MODE: "api", VITE_API_BASE_URL: `http://${API_HOST}`, VITE_SUPABASE_URL: `https://${AUTH_HOST}`,
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture", VITE_APP_ENV: "e2e-fixture",
  },
  stdio: "ignore",
  detached: !WIN,
  shell: WIN,
});
// npx lanza vite como proceso hijo: se termina todo el árbol para no dejar el puerto 5199 ocupado.
const stopVite = () => {
  try {
    if (WIN) spawn("taskkill", ["/pid", String(vite.pid), "/t", "/f"], { stdio: "ignore" });
    else process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ya terminó */
  }
};
process.on("exit", stopVite);
for (let i = 0; i < 80; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* aún no arranca */
  }
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && consoleErrors.push(m.text()));

// --- Simulación de Supabase Auth y de Spring ---
let meMode = "ok"; // ok | 503 | 403 | 409 | 401
const apiCalls = []; // toda petición al host de la API
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (status, body) => ({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
// Listas del panel: página vacía (la API real responde con datos; aquí solo importa la sesión y la navegación).
const LISTS = ["/api/v1/orders", "/api/v1/payments", "/api/v1/receivables", "/api/v1/collection-alerts", "/api/v1/audit-events"];
await ctx.route((u) => [AUTH_HOST, API_HOST].includes(u.hostname), async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  if (url.hostname === AUTH_HOST) {
    if (url.pathname.endsWith("/token")) {
      const token = fakeJwt();
      return route.fulfill(json(200, { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "refresh-fixture",
        user: { id: SUB, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
    }
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 404, headers: CORS, body: "{}" });
  }
  apiCalls.push({ method: req.method(), path: url.pathname, bearer: Boolean((await req.allHeaders()).authorization?.startsWith("Bearer ")) });
  if (url.pathname === "/api/v1/me") {
    if (meMode === "ok") return route.fulfill(json(200, { user_id: USER, organization_id: ORG, role: "GERENTE" }));
    const err = { 503: "SERVICE_UNAVAILABLE", 403: "FORBIDDEN", 409: "ORGANIZATION_SELECTION_REQUIRED", 401: "UNAUTHORIZED" }[meMode];
    return route.fulfill(json(Number(meMode), { code: err, message: "x", request_id: "req-1" }));
  }
  if (req.method() === "GET" && LISTS.includes(url.pathname)) return route.fulfill(json(200, { items: [], page: { limit: 100, next_cursor: null } }));
  return route.fulfill(json(404, { code: "NOT_FOUND", message: "x", request_id: null }));
});

const flat = (t) => t.replace(/\s+/g, " ").trim();
async function openLogin() {
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(300);
  if (!(await page.locator("#email").isVisible())) await page.getByRole("button", { name: "Acceder" }).first().click();
}
async function submitLogin() {
  await page.fill("#email", EMAIL);
  await page.fill("#password", "clave-de-prueba");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}
const body = async () => flat(await page.locator("body").innerText());
async function signOutFromMenu() {
  await page.getByRole("button", { name: /Menú de/ }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/login/);
}

await page.goto(`${BASE}/login`);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

/* 1. Login correcto → inicio del rol y "Mi sesión" con la identidad de /me */
await openLogin();
check(1, "pantalla de acceso sin vista previa ni distintivo de demostración", !(await body()).includes("Datos de demostración") && !(await body()).includes("Vista previa"));
meMode = "ok";
await submitLogin();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 8000 }).catch(() => {});
check(1, "el login lleva al inicio del rol (/)", new URL(page.url()).pathname === "/");
check(1, "toda llamada a la API lleva Bearer", apiCalls.length >= 1 && apiCalls.every((c) => c.bearer), JSON.stringify(apiCalls));
await page.waitForSelector('nav[aria-label="Principal"] a[href="/resultado"]', { timeout: 8000 }).catch(() => {});
check(1, "menú: módulos del rol enlazados, ninguno deshabilitado", (await page.locator('nav[aria-label="Principal"] a[href="/resultado"]').count()) >= 1 && (await page.locator('nav[aria-label="Principal"] [aria-disabled="true"]').count()) === 0, await page.locator('nav[aria-label="Principal"]').first().innerHTML().catch(() => "sin nav"));
await page.goto(`${BASE}/sesion`);
await page.waitForSelector('[data-testid="inicio-identidad"]', { timeout: 8000 }).catch(() => {});
let text = await body();
check(1, "/sesion muestra correo de Auth", text.includes(EMAIL));
check(1, "/sesion muestra user_id, organization_id y rol de /me", text.includes(USER) && text.includes(ORG) && text.includes("GERENTE"));

/* 2. Módulo sin endpoint todavía (carga manual): bloqueado también por URL */
await page.goto(`${BASE}/captura`);
await page.waitForSelector('[data-testid="modulo-no-disponible"]', { timeout: 8000 }).catch(() => {});
check(2, "/captura: «no disponible» sin cargar la pantalla", (await page.locator('[data-testid="modulo-no-disponible"]').count()) === 1);

/* 3. Recarga: restauración de sesión */
await page.goto(`${BASE}/sesion`);
await page.waitForSelector('[data-testid="inicio-identidad"]', { timeout: 8000 }).catch(() => {});
check(3, "la recarga restaura la sesión", (await body()).includes(USER));

/* 4. Cierre de sesión */
await signOutFromMenu();
check(4, "cerrar sesión vuelve al acceso", new URL(page.url()).pathname === "/login");
await page.goto(`${BASE}/pedidos`);
await page.waitForURL(/login/);
check(4, "tras cerrar sesión una ruta de módulo redirige al acceso", new URL(page.url()).pathname === "/login");
check(4, "no queda sesión de Supabase en el almacenamiento", await page.evaluate(() => !Object.keys(localStorage).some((k) => k.includes("auth-token"))));

/* 5. Fallo temporal: aviso, sesión conservada y reintento */
await openLogin();
meMode = "503";
await submitLogin();
await page.waitForSelector("text=Reintentar", { timeout: 8000 }).catch(() => {});
text = await body();
check(5, "503 muestra aviso con Reintentar y sin identidad", text.includes("Reintentar") && !text.includes(USER));
check(5, "el formulario explica que la sesión sigue abierta", text.includes("Tu sesión sigue abierta"));
await page.getByRole("dialog").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
check(5, "503 libera el aviso sin pulsar Escape", (await page.getByRole("button", { name: "Reintentar" }).isVisible()) && (await page.getByRole("dialog").count()) === 0);
check(5, "503 conserva la sesión de Supabase", await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes("auth-token"))));
meMode = "ok";
await page.getByRole("button", { name: "Reintentar" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 8000 }).catch(() => {});
check(5, "Reintentar recupera la sesión y vuelve a la ruta pedida antes del acceso", ["/", "/pedidos"].includes(new URL(page.url()).pathname), page.url() + " · " + (await body()).slice(0, 160));
await signOutFromMenu();

/* 6. Sin membresía y varias organizaciones */
for (const [mode, expected] of [["403", "no tiene un rol asignado"], ["409", "varias organizaciones"]]) {
  await openLogin();
  meMode = mode;
  await submitLogin();
  await page.waitForTimeout(1200);
  text = await body();
  check(6, `/me ${mode}: mensaje propio, sin identidad y sin elegir organización`, text.toLowerCase().includes(expected) && !text.includes(ORG) && new URL(page.url()).pathname === "/login", text.slice(0, 160));
}

check(7, "sin errores de consola inesperados", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
stopVite();

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASA" : "FALLA"}  [${r.scenario}] ${r.name}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones pasan (FIXTURES: ni Supabase Auth ni Spring reales).`);
process.exit(failed.length ? 1 : 0);
