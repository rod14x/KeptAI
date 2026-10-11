// Pruebas del rediseño en Chrome local. Usa datos ficticios y un contexto aislado.
// BASE_URL=http://localhost:5173 npm run e2e:diseno. Capturas en e2e/shots/redesign/.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const base = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const out = fileURLToPath(new URL("./shots/redesign/", import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; console.log(`PASA ${label}`); }
async function ready() {
  await page.locator("h1").first().waitFor();
  await page.waitForTimeout(450);
  await page.evaluate(() => document.fonts.ready);
}
async function capture(name) { await page.screenshot({ path: `${out}${name}.png`, fullPage: true }); }
async function theme(value) {
  if (await page.locator("html").getAttribute("data-theme") !== value) await page.getByRole("button", { name: value === "dark" ? "Usar tema oscuro" : "Usar tema claro" }).click();
}
async function login(email) {
  await page.goto(`${base}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((u) => u.pathname !== "/login");
  await ready();
}
async function logout() {
  await page.getByRole("button", { name: /Menú de/ }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/login/);
}
async function overflow(label) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(extra <= 0, `${label}: sin desborde (${extra}px)`);
}
async function route(path, name, shot = true) {
  await page.goto(`${base}${path}`); await ready();
  check(!await page.getByText("Tu rol no tiene acceso a esta sección", { exact: true }).count(), `${name}: acceso efectivo`);
  await overflow(name);
  if (shot) await capture(name);
}

try {
  await page.goto(`${base}/login`); await ready();
  check(await page.locator("#email").isVisible(), "Acceso directo sin modal");
  await capture("login-light");
  await page.locator("#email").fill("correo-invalido");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  check(await page.getByText("Escribe un correo válido.", { exact: true }).isVisible(), "Validación del formulario");
  await theme("dark"); await page.reload(); await ready();
  check(await page.locator("html").getAttribute("data-theme") === "dark", "Tema persistente tras recarga");
  await capture("login-dark");
  await theme("light");
  await login("carmen.ramos@keptai.pe");
  await capture("jornada-light");
  check(await page.locator('nav[aria-label="Principal"] a').count() === 4, "Cuatro destinos para administración");
  await page.getByRole("button", { name: /Menú de/ }).click();
  check(await page.getByRole("menuitem", { name: "Configuración", exact: true }).count() === 0, "Configuración oculta para administración");
  await page.keyboard.press("Escape");

  await route("/pedidos", "pedidos-light");
  await page.getByRole("textbox", { name: "Buscar pedido", exact: true }).fill("cliente inexistente xyz");
  check(await page.getByText("No hay pedidos que coincidan", { exact: true }).isVisible(), "Estado vacío de búsqueda");
  await page.getByRole("textbox", { name: "Buscar pedido", exact: true }).fill("ORD-001");
  check(await page.locator("tbody tr").count() === 1, "Búsqueda por referencia");
  await page.getByRole("tab", { name: "Por etapa", exact: true }).click();
  await page.getByRole("radio", { name: /En producción/ }).click();
  check(await page.locator('section[aria-label^="En producción"] a').count() > 0, "Pedidos de una etapa a la vez");
  await capture("etapas-light");
  await page.getByRole("radio", { name: /En producción/ }).focus();
  await page.keyboard.press("ArrowRight");
  check((await page.getByRole("radio", { checked: true }).innerText()).includes("Por cobrar"), "Etapas accesibles con flechas");

  await route("/conciliacion/V-002", "pagos-light");
  await page.getByRole("button", { name: "Sí, llegó al banco", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  check(await dialog.evaluate((el) => el.contains(document.activeElement)), "Foco contenido en confirmación");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  check(!await dialog.count(), "Escape cierra confirmación sin aplicar el pago");

  for (const [path, name] of [["/", "jornada"], ["/conciliacion/V-002", "pagos"], ["/captura", "captura"], ["/cobranza", "cobranza"], ["/clientes", "clientes"], ["/clientes/c-tallan", "cliente"], ["/clientes/c-tallan/estado-cuenta", "estado-cuenta"], ["/pedidos/ORD-013", "pedido"], ["/perfil", "perfil"]]) {
    await route(path, `${name}-light`, false);
    await theme("dark"); await capture(`${name}-dark`);
    await page.setViewportSize({ width: 390, height: 844 }); await ready(); await overflow(`${name} móvil oscuro`); await capture(`${name}-mobile-dark`);
    await theme("light"); await overflow(`${name} móvil claro`); await capture(`${name}-mobile-light`);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("dialog", { name: "Menú", exact: true }).waitFor();
  await page.keyboard.press("Shift+Tab");
  check(await page.getByRole("dialog", { name: "Menú", exact: true }).evaluate((el) => el.contains(document.activeElement)), "Foco contenido en menú móvil");
  await page.keyboard.press("Escape");
  check(await page.getByRole("button", { name: "Abrir menú" }).evaluate((el) => el === document.activeElement), "Foco devuelto al cerrar menú");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await logout();
  await login("patricia.zapata@keptai.pe");
  for (const [path, name] of [["/", "resumen"], ["/resultado", "resultado"]]) {
    for (const mode of ["light", "dark"]) {
      await route(path, `${name}-${mode}`, false); await theme(mode); await capture(`${name}-${mode}`);
      await page.setViewportSize({ width: 390, height: 844 }); await ready(); await overflow(`${name} móvil ${mode}`); await capture(`${name}-mobile-${mode}`);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
  await page.goto(`${base}/`); await ready();
  await page.getByRole("button", { name: "Ver como tabla" }).click();
  check(await page.getByRole("columnheader", { name: "Semana", exact: true }).isVisible(), "Gráfico con alternativa en tabla");
  await logout();
  await login("jorge.ipanaque@keptai.pe");
  await theme("light"); await capture("taller-light");
  await theme("dark"); await capture("taller-dark");
  await page.setViewportSize({ width: 360, height: 800 }); await ready(); await overflow("Taller 360px");
  await logout(); await capture("login-mobile-dark");
  check(errors.length === 0, `Sin errores de consola: ${errors.join(" | ")}`);
  console.log(`\n${checks} comprobaciones de diseño pasan. Capturas: ${out}`);
} finally { await browser.close(); }
