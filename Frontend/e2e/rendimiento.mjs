// Mide la carga del login: tiempo al titular, peso descargado, apertura del modal y paso al dashboard.
// Uso: node e2e/rendimiento.mjs http://localhost:5173  (o la URL de `npm run preview`).
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");

const reqs = [];
page.on("requestfinished", async (r) => {
  const t = r.timing();
  let size = 0;
  try {
    size = (await r.sizes()).responseBodySize;
  } catch {}
  reqs.push({ url: r.url().replace(BASE, ""), ms: Math.round(t.responseEnd), size });
});

// Long tasks
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true });
});

const t0 = Date.now();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
const t1 = Date.now();
await page.goto(`${BASE}/login`);
await page.waitForSelector("text=Cobra con evidencia");
const tHero = Date.now() - t1;
await page.waitForLoadState("networkidle");
const tIdle = Date.now() - t1;

const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType("navigation")[0];
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null };
});

// Click Acceder -> modal visible
const c0 = Date.now();
await page.getByRole("button", { name: "Acceder" }).first().click();
await page.waitForSelector("#email", { state: "visible" });
const tModal = Date.now() - c0;
// Frame rate while modal animates
const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - start < 1000) requestAnimationFrame(tick);
        else res(frames);
      };
      requestAnimationFrame(tick);
    }),
);

// Login -> dashboard
const l0 = Date.now();
await page.getByRole("button", { name: "Iniciar sesión" }).click();
await page.waitForSelector("text=Ingresos esperados");
const tLogin = Date.now() - l0;

const long = await page.evaluate(() => window.__long);
const totalKB = Math.round(reqs.reduce((s, r) => s + r.size, 0) / 1024);
const big = [...reqs].sort((a, b) => b.size - a.size).slice(0, 8);
console.log(JSON.stringify({ BASE, tHeroVisible: tHero, tNetworkIdle: tIdle, nav, tModalOpen: tModal, fpsDuringModal: fps, tLoginToDashboard: tLogin, requests: reqs.length, totalKB, longTasks: long, biggest: big.map((b) => `${Math.round(b.size / 1024)}KB ${b.ms}ms ${b.url.slice(0, 90)}`) }, null, 1));
await browser.close();
