// AUTH-FE-01/04 + MIG-03-E · recorrido REAL: navegador (Chrome) → Supabase Auth real → JWT → Spring /api/v1/me → PostgreSQL local.
// SIN simulaciones: no intercepta ninguna red. Requiere una cuenta real de Supabase Auth y, en la fase "con-membresia",
// su membresía local provisionada (Backend/scripts/provisionar-membresia-local.sh).
//
// Aísla todo en procesos PROPIOS (no toca 5173/8080 del usuario ni Frontend/.env.local):
//   - Spring de esta rama en el puerto 8081 (Backend/scripts/run-local.sh: Backend/.env real + PostgreSQL local 5433)
//   - Vite en el puerto 5174 con VITE_API_MODE=api (las claves públicas de Supabase salen de Frontend/.env.local)
//
// Credenciales: archivo ignorado por Git Frontend/e2e/auth-real.local (formato KEY=VALUE, ver Backend/docs/prueba-auth-real-local.md)
//   E2E_EMAIL, E2E_PASSWORD  (cuenta de Supabase Auth creada por Miguel)
//   E2E_EXPECT_USER_ID, E2E_EXPECT_ORGANIZATION_ID, E2E_EXPECT_ROLE  (opcional: valores que imprimió la provisión local)
// Uso:  npm run e2e:real -- sin-membresia      (la cuenta aún NO tiene fila local: /me debe dar 403)
//       npm run e2e:real -- con-membresia      (tras provisionar: login, /me 200, recarga, logout)
// Nunca imprime correo, contraseña ni tokens.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PHASE = process.argv[2] ?? "con-membresia";
if (!["sin-membresia", "con-membresia"].includes(PHASE)) {
  console.error("Fase desconocida. Use sin-membresia o con-membresia.");
  process.exit(2);
}
const credsPath = process.env.E2E_CREDS ?? fileURLToPath(new URL("./auth-real.local", import.meta.url));
if (!existsSync(credsPath)) {
  console.error("BLOQUEADO: falta Frontend/e2e/auth-real.local (E2E_EMAIL, E2E_PASSWORD de una cuenta real de Supabase Auth). Ver Backend/docs/prueba-auth-real-local.md.");
  process.exit(3);
}
const cfg = Object.fromEntries(
  readFileSync(credsPath, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!cfg.E2E_EMAIL || !cfg.E2E_PASSWORD) {
  console.error("BLOQUEADO: auth-real.local necesita E2E_EMAIL y E2E_PASSWORD.");
  process.exit(3);
}

const API_PORT = process.env.E2E_API_PORT ?? "8081";
const WEB_PORT = process.env.E2E_WEB_PORT ?? "5174";
const API = `http://127.0.0.1:${API_PORT}`;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const results = [];
const check = (scenario, name, ok, detail = "") => results.push({ scenario, name, ok: Boolean(ok), detail });

const children = [];
const spawnGroup = (cmd, args, opts) => {
  const c = spawn(cmd, args, { stdio: "ignore", detached: true, ...opts });
  children.push(c);
  return c;
};
const stopAll = () => {
  for (const c of children) {
    try {
      process.kill(-c.pid, "SIGTERM");
    } catch {
      /* ya terminó */
    }
  }
};
process.on("exit", stopAll);
const waitFor = async (url, ok, tries = 120) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (await ok(r)) return true;
    } catch {
      /* aún no */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

// 1) Spring propio (8081) con la configuración real de Backend/.env; CORS solo para el Vite propio.
for (const port of [API_PORT, WEB_PORT]) {
  try {
    await fetch(`http://127.0.0.1:${port}`);
    console.error(`El puerto ${port} ya está en uso: no se toca. Indique otro con E2E_API_PORT / E2E_WEB_PORT.`);
    process.exit(4);
  } catch {
    /* libre */
  }
}
spawnGroup("bash", ["Backend/scripts/run-local.sh"], { cwd: repoRoot, env: { ...process.env, PORT: API_PORT, KEPTAI_CORS_ALLOWED_ORIGINS: WEB } });
const apiUp = await waitFor(`${API}/actuator/health`, async (r) => r.ok && (await r.text()).includes("UP"), 180);
check(0, "Spring (esta rama) arranca con Backend/.env real y PostgreSQL local", apiUp);
// 2) Vite propio (5174) en modo api; la URL y la clave publicable de Supabase vienen de Frontend/.env.local.
spawnGroup("npx", ["vite", "--host", "127.0.0.1", "--port", WEB_PORT, "--strictPort"], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env, VITE_API_MODE: "api", VITE_API_BASE_URL: API } });
const webUp = await waitFor(WEB, async (r) => r.ok);
check(0, "Vite propio en modo api", webUp);
if (!apiUp || !webUp) {
  for (const r of results) console.log(`${r.ok ? "PASA" : "FALLA"}  [${r.scenario}] ${r.name}`);
  process.exit(1);
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && consoleErrors.push(m.text()));
const apiCalls = [];
page.on("request", async (req) => {
  const u = new URL(req.url());
  if (u.origin === API) apiCalls.push({ method: req.method(), path: u.pathname, bearer: Boolean((await req.allHeaders()).authorization?.startsWith("Bearer ")), status: null, req });
});
page.on("response", (res) => {
  const c = apiCalls.find((x) => x.req === res.request());
  if (c) c.status = res.status();
});
const flat = (t) => t.replace(/\s+/g, " ").trim();
const body = async () => flat(await page.locator("body").innerText());
const hasSupabaseSession = () => page.evaluate(() => Object.keys(localStorage).some((k) => k.includes("auth-token")));
async function openLogin() {
  await page.goto(`${WEB}/login`);
  await page.waitForTimeout(400);
  if (!(await page.locator("#email").isVisible())) await page.getByRole("button", { name: "Acceder" }).first().click();
}
async function submit(email, password) {
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

await page.goto(`${WEB}/login`);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

// Credenciales incorrectas contra Supabase Auth real (un intento).
await openLogin();
await submit(cfg.E2E_EMAIL, `${cfg.E2E_PASSWORD}-incorrecta`);
await page.waitForSelector("text=Correo o contraseña incorrectos", { timeout: 20000 }).catch(() => {});
check(1, "credenciales incorrectas: mensaje propio, sin sesión ni llamada a /me", (await body()).includes("Correo o contraseña incorrectos") && !(await hasSupabaseSession()) && apiCalls.length === 0);

if (PHASE === "sin-membresia") {
  await openLogin();
  await submit(cfg.E2E_EMAIL, cfg.E2E_PASSWORD);
  await page.waitForSelector("text=no tiene un rol asignado", { timeout: 25000 }).catch(() => {});
  const t = await body();
  const me = apiCalls.filter((c) => c.path === "/api/v1/me");
  check(2, "login real válido pero sin membresía local: /me responde 403", me.length >= 1 && me.every((c) => c.status === 403 && c.bearer), JSON.stringify(me.map((c) => [c.status, c.bearer])));
  check(2, "la interfaz muestra «sin rol asignado» y no concede identidad", t.includes("no tiene un rol asignado") && !t.includes("organization_id") && new URL(page.url()).pathname === "/login");
  check(2, "la sesión local de Supabase se cierra tras el 403", !(await hasSupabaseSession()));
} else {
  await openLogin();
  await submit(cfg.E2E_EMAIL, cfg.E2E_PASSWORD);
  await page.waitForSelector('[data-testid="inicio-identidad"]', { timeout: 25000 }).catch(() => {});
  let t = await body();
  const ok = await page.locator('[data-testid="inicio-identidad"]').count();
  check(2, "login real y /me 200: aparece el inicio de identidad en /", ok === 1 && new URL(page.url()).pathname === "/");
  const userId = ok ? flat(await page.locator('[data-testid="user-id"]').innerText()) : "";
  const orgId = ok ? flat(await page.locator('[data-testid="organization-id"]').innerText()) : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  check(2, "user_id y organization_id son UUID devueltos por el backend", uuid.test(userId) && uuid.test(orgId));
  if (cfg.E2E_EXPECT_USER_ID) check(2, "user_id coincide con la fila local provisionada", userId === cfg.E2E_EXPECT_USER_ID);
  if (cfg.E2E_EXPECT_ORGANIZATION_ID) check(2, "organization_id coincide con la fila local", orgId === cfg.E2E_EXPECT_ORGANIZATION_ID);
  if (cfg.E2E_EXPECT_ROLE) check(2, "el rol mostrado es el de la fila local", t.includes(`(${cfg.E2E_EXPECT_ROLE})`));
  check(2, "solo GET /api/v1/me, con Bearer, respondió 200", apiCalls.length >= 1 && apiCalls.every((c) => c.path === "/api/v1/me" && c.method === "GET" && c.bearer && c.status === 200), JSON.stringify(apiCalls.map((c) => [c.path, c.bearer, c.status])));
  check(2, "no se muestran marca, empresa ni cifras", !/Corpotex|Unicrack|S\/ ?\d|Datos de demostración/.test(t));

  const before = apiCalls.length;
  await page.reload();
  await page.waitForSelector('[data-testid="inicio-identidad"]', { timeout: 25000 }).catch(() => {});
  check(3, "recarga: la sesión se restaura y /me vuelve a responder con la misma identidad", (await page.locator('[data-testid="user-id"]').count()) === 1 && flat(await page.locator('[data-testid="user-id"]').innerText()) === userId && apiCalls.slice(before).some((c) => c.path === "/api/v1/me" && c.status === 200));

  await page.goto(`${WEB}/pedidos`);
  await page.waitForSelector('[data-testid="modulo-no-disponible"]', { timeout: 15000 }).catch(() => {});
  check(3, "módulo de negocio por URL: «no disponible» y sin llamadas de negocio", (await page.locator('[data-testid="modulo-no-disponible"]').count()) === 1 && apiCalls.every((c) => c.path === "/api/v1/me"));

  await page.goto(`${WEB}/`);
  await page.waitForSelector('[data-testid="inicio-identidad"]', { timeout: 25000 }).catch(() => {});
  await page.getByRole("button", { name: /Menú de/ }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/login/, { timeout: 15000 }).catch(() => {});
  check(4, "logout: vuelve al acceso y no queda sesión de Supabase", new URL(page.url()).pathname === "/login" && !(await hasSupabaseSession()));
  await page.goto(`${WEB}/`);
  await page.waitForURL(/login/, { timeout: 15000 }).catch(() => {});
  check(4, "tras cerrar sesión, / redirige al acceso (identidad no recuperable)", new URL(page.url()).pathname === "/login" && (await page.locator('[data-testid="inicio-identidad"]').count()) === 0);
}
check(9, "sin errores de consola inesperados", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
stopAll();
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASA" : "FALLA"}  [${r.scenario}] ${r.name}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones pasan (fase ${PHASE}; Supabase Auth, Spring y PostgreSQL locales REALES).`);
process.exit(failed.length ? 1 : 0);
