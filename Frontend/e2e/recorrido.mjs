// Recorrido de aceptación del frontend (PROP-FLUJO-DER-001 + recorrido del cerebro).
// Uso: con `npm run dev` corriendo, `npm run e2e`. Usa el Chrome instalado (sin descargar navegadores).
// Variables: BASE_URL (por defecto http://localhost:5173), SHOTS=1 para guardar capturas en e2e/shots/.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const SHOTS = process.env.SHOTS === "1";
const OUT = fileURLToPath(new URL("./shots/", import.meta.url));
if (SHOTS) mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const flat = (t) => t.replace(/\s+/g, " ").trim();
const toast = async () => {
  await page.waitForTimeout(350);
  return flat(await page.locator("[role=status]").last().innerText());
};
const shot = async (name) => {
  if (!SHOTS) return;
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
};
function check(scenario, name, ok, detail = "") {
  results.push({ scenario, name, ok: Boolean(ok), detail });
}

async function login(email) {
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(300);
  if (!(await page.locator("#email").isVisible())) await page.getByRole("button", { name: "Acceder" }).first().click();
  await page.fill("#email", email);
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForTimeout(600);
}
async function logout() {
  await page.getByRole("button", { name: /Menú de/ }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/login/);
}
async function confirmStep(button, dialogButton) {
  await page.getByRole("button", { name: button }).click();
  await page.locator("[role=dialog]").getByRole("button", { name: dialogButton }).click();
  return toast();
}
const text = async (sel) => flat(await page.locator(sel).first().innerText());

// Semilla limpia
await page.goto(`${BASE}/login`);
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/* 0. Menos opciones: inicio con pendientes y menú corto por rol */
await login("carmen.ramos@keptai.pe");
await page.waitForSelector("text=Pagos por revisar");
check(0, "Administración entra a sus pendientes", /empieza por aquí/i.test(await text("main")));
check(0, "Menú de Administración con 4 opciones", (await page.locator("nav[aria-label=Principal] a").count()) === 4);
await shot("00-pendientes");

/* 1. Recorrido del cerebro (Administración) */
await page.goto(`${BASE}/conciliacion/V-002`);
await page.waitForSelector("text=Llegó por WhatsApp");
await shot("01-conciliacion");
let t = await confirmStep("Sí, llegó al banco", "Sí, llegó");
check(1, "V-002 verificado y descontado: ORD-002 queda en S/ 400", /ORD-002: S\/ 400\.00/.test(t), t);
await page.waitForURL((u) => /\/conciliacion\/V-/.test(u.pathname) && !u.pathname.endsWith("/V-002"));
check(1, "La bandeja pasa sola al siguiente pago", true);
await page.goto(`${BASE}/conciliacion/V-002`);
await page.waitForSelector("text=Pago descontado de la deuda");
await page.getByRole("button", { name: "Más opciones" }).click();
await page.getByRole("button", { name: /Reintentar descuento/ }).click();
t = await toast();
check(1, "Reaplicar no duplica", /ya fue aplicado/i.test(t), t);
await page.goto(`${BASE}/conciliacion/V-003`);
await page.waitForSelector("text=Marcar como duplicado");
t = await confirmStep("Marcar como duplicado", "Marcar duplicado");
check(1, "V-003 duplicado no cambia saldo", /no cambia/i.test(t), t);
await page.goto(`${BASE}/resultado`);
await page.waitForTimeout(600);
check(5, "Administración sin acceso a Resultado (solo GERENTE)", (await text("main")).includes("no tiene acceso"));

/* 3. Anticipo libera la orden retenida */
await page.goto(`${BASE}/conciliacion/V-007`);
await page.waitForSelector("text=Datos del comprobante");
t = await confirmStep("Sí, llegó al banco", "Sí, llegó");
check(3, "Anticipo de ORD-014 libera a producción", /pasa a producción/i.test(t), t);
await page.goto(`${BASE}/pedidos/ORD-014`);
await page.waitForSelector("text=Condición de pago");
check(3, "ORD-014 en producción", (await text("main")).includes("En producción"));

/* 6. Estado de cuenta autenticado (V6 no tiene enlace público) */
await page.goto(`${BASE}/clientes/c-sechura`);
await page.getByRole("link", { name: "Abrir estado de cuenta" }).click();
await page.waitForURL(/\/clientes\/c-sechura\/estado-cuenta$/);
await page.waitForSelector("text=Tus pedidos");
check(6, "Estado de cuenta se abre dentro de la sesión", true);
check(6, "Estado de cuenta sin costos ni márgenes", !/margen|costo/i.test(await text("main")));
await page.goto(`${BASE}/estado-cuenta/cualquier-token`);
await page.waitForTimeout(500);
check(6, "Ya no existe la ruta pública por token", (await text("main")).includes("Esta página no existe"));
await page.goto(`${BASE}/cobranza?vista=mensajes`);
await page.waitForSelector("text=Bitácora de envíos");
check(6, "Bitácora sin texto de mensajes (V6)", !/Hola|estimado/i.test(await text("main")));
await page.getByRole("button", { name: "Reintentar" }).first().click();
t = await toast();
check(6, "Reintento de mensaje con error", /Reintento enviado/i.test(t), t);
await shot("03-cobranza");
await logout();

/* 2. Orden por WhatsApp con aviso de mora (Vendedor Unicrack) */
await login("luis.yarleque@keptai.pe");
check(5, "Vendedor ve solo su marca", (await text("header")).includes("Unicrack"));
check(5, "Vendedor no ve Pagos", (await page.locator("nav[aria-label=Principal] >> text=Pagos").count()) === 0);
check(0, "Vendedor ve sus pedidos por confirmar", (await text("main")).includes("Pedidos por confirmar"));
await page.goto(`${BASE}/pedidos/ORD-013`);
await page.waitForSelector("text=Hoja de resumen");
await shot("04-orden-borrador");
await page.getByRole("button", { name: "Cambiar condición" }).click();
await page.locator("#plazo").selectOption("20");
await page.getByRole("button", { name: "Confirmar orden" }).click();
await page.waitForSelector("text=Este cliente está en mora");
check(2, "Aparece el aviso de mora", true);
await page.getByRole("button", { name: "Sí, darle crédito" }).click();
t = await toast();
check(2, "Confirmada y liberada a producción", /liberada a producción/i.test(t), t);
await page.waitForTimeout(400);
check(2, "Queda registrado que vio el aviso", (await text("main")).includes("Vio el aviso de mora"));
await page.goto(`${BASE}/clientes/c-huanca`);
await page.waitForTimeout(600);
check(5, "Vendedor no abre clientes de otra marca", (await text("main")).includes("no pertenece a tu marca"));
await page.goto(`${BASE}/conciliacion/V-002`);
await page.waitForTimeout(600);
check(5, "Vendedor sin acceso a Conciliación", (await text("main")).includes("no tiene acceso"));
await logout();

/* 2 (cont.). Jefe de taller registra el despacho */
await login("jorge.ipanaque@keptai.pe");
check(5, "Jefe de taller entra directo a /taller", page.url().endsWith("/taller"), page.url());
check(0, "Jefe de taller sin menú: una sola pantalla", (await page.locator("nav[aria-label=Principal]").count()) === 0);
await page.waitForSelector("text=En producción");
const row = page.locator("li", { hasText: "ORD-013" }).first();
await row.getByRole("button", { name: "Registrar despacho" }).click();
await page.fill("#d-acta", "Guía 013-10");
await page.locator("[role=dialog]").getByRole("button", { name: "Registrar despacho" }).click();
t = await toast();
check(2, "Despacho fija vencimiento despacho + 20 (30/10/2026)", /30\/10\/2026/.test(t) && /3 recordatorios/.test(t), t);
await page.goto(`${BASE}/pedidos`);
await page.waitForTimeout(600);
check(5, "Jefe de taller sin acceso a Pedidos", (await text("main")).includes("no tiene acceso"));
await logout();

/* 4. Cierre de cobranza: pago completo cancela recordatorios y alertas */
await login("carmen.ramos@keptai.pe");
await page.goto(`${BASE}/captura`);
await page.waitForSelector("text=Comprobante de pago");
await page.locator("#v-brand").selectOption("unicrack");
await page.locator("#v-order").selectOption("ORD-002");
await page.fill("#v-amount", "400");
await page.fill("#v-ref", "88004411");
await page.fill("#v-payer", "Club Deportivo Tallán");
await page.getByRole("button", { name: "Registrar como recibido" }).click();
await page.waitForURL(/conciliacion\/V-/);
await page.waitForSelector("text=Cargado a mano");
t = await confirmStep("Sí, llegó al banco", "Sí, llegó");
check(4, "Pago completo cancela recordatorios y alertas", /S\/ 0\.00/.test(t) && /cancelan/.test(t), t);
await page.goto(`${BASE}/pedidos/ORD-002`);
await page.getByRole("tab", { name: "Seguimiento" }).click();
await page.waitForSelector("text=Mensajes al cliente");
check(4, "Alerta de ORD-002 cancelada", (await text("main")).includes("Cancelada"));
await logout();

/* 5. Gerencia: lee y configura, no aprueba crédito */
await login("patricia.zapata@keptai.pe");
await page.goto(`${BASE}/pedidos/ORD-015`);
await page.waitForSelector("text=Condición de pago y crédito");
check(5, "Gerencia no confirma órdenes", (await page.getByRole("button", { name: "Confirmar orden" }).count()) === 0);
await page.goto(`${BASE}/perfil?tab=configuracion`);
await page.waitForSelector("text=Supuestos de caja y crédito");
await page.fill("#cobro", "90");
await page.getByRole("button", { name: "Guardar supuestos" }).click();
t = await toast();
check(5, "Gerencia guarda el factor de cobro", /Supuestos guardados/.test(t), t);
await page.goto(`${BASE}/`);
await page.waitForSelector("text=Factor de cobro 90%");
check(5, "Dashboard refleja factor de cobro 90%", true);
await shot("05-dashboard-gerencia");
await page.goto(`${BASE}/resultado`);
await page.waitForSelector("text=Taller como centro de resultados");
await page.waitForTimeout(500);
const r001 = await text("tr:has-text('ORD-001')");
check(1, "ORD-001 margen -S/ 40", r001.includes("-S/ 40.00"), r001);
await shot("02-resultado");

/* 7. Calidad: móvil sin desborde */
await page.setViewportSize({ width: 390, height: 844 });
for (const p of ["/", "/pedidos", "/pedidos/ORD-013", "/clientes/c-tallan", "/cobranza", "/taller", "/resultado"]) {
  await page.goto(`${BASE}${p}`);
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(7, `Móvil ${p} sin desborde`, overflow <= 0, `${overflow}px`);
}
check(7, "Sin errores de consola", errors.length === 0, errors.join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASA" : "FALLA"}  [${r.scenario}] ${r.name}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones pasan.`);
process.exit(failed.length ? 1 : 0);
