/**
 * navigation.test.ts
 * Versión: 2.1 | Fecha: 2026-10-19 | Autora: Isabelita
 */
import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isModuleAvailable, MODULE_LABEL, type ModuleKey } from "./lib/availability";

// AUTH-FE-03. Pruebas de COMPONENTES con FIXTURES: renderizan las rutas reales (AppRoutes) con react-dom/server
// y una identidad simulada. No son pruebas de navegador ni de Supabase Auth/Spring reales (ver e2e/identidad-api.mjs
// para el recorrido en navegador, también con fixtures).

const ORG = "10000000-0000-4000-8000-0000000000a1";
const USER = "c0000000-0000-4000-8000-0000000000a1";
const EMAIL = "persona.prueba@example.test";
type ApiRole = "VENDEDOR" | "ADMIN" | "GERENTE" | "JEFE_TALLER";
const ROLES: Record<ApiRole, string> = { VENDEDOR: "vendedor", ADMIN: "administracion", GERENTE: "gerencia", JEFE_TALLER: "jefe_taller" };
const BUSINESS_PATHS = [
  "/pedidos", "/pedidos/ref-1", "/clientes", "/clientes/c-1", "/clientes/c-1/estado-cuenta", "/conciliacion", "/conciliacion/p-1",
  "/resumen", "/cobranza", "/taller", "/captura", "/resultado", "/perfil", "/perfil?tab=actividad",
];

async function load(mock: boolean) {
  vi.resetModules();
  vi.doMock("./config", () => ({ IS_MOCK: mock, API_MODE: mock ? "mock" : "api", API_BASE_URL: "", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "" }));
  const calls: string[] = [];
  if (!mock) {
    // En modo api ninguna llamada a la fachada de datos de negocio debe ocurrir al renderizar.
    const boom = (name: string) => (...a: unknown[]) => {
      calls.push(name + JSON.stringify(a));
      throw new Error("Llamada de negocio en modo api: " + name);
    };
    vi.doMock("./api/client", () => ({
      capabilities: { resetDemo: false },
      commands: {},
      search: boom("search"), getDashboard: boom("getDashboard"), getOrders: boom("getOrders"), getProfile: boom("getProfile"),
    }));
  }
  const [{ AppRoutes }, { AuthContext }, { ScopeProvider }, { ToastProvider }, { ThemeProvider }] = await Promise.all([
    import("./App"), import("./context/AuthContext"), import("./context/ScopeContext"), import("./context/ToastContext"), import("./context/ThemeContext"),
  ]);
  const { ROLE_FROM_API, ROLE_LABEL } = await import("./lib/permissions");
  type Value = import("./context/AuthContext").AuthValue;
  const render = (path: string, role: ApiRole | null, over: Partial<Value> = {}) => {
    const person = role
      ? { id: USER, name: "persona.prueba", email: EMAIL, role: ROLE_FROM_API[role], title: ROLE_LABEL[ROLE_FROM_API[role]], brand: null, since: null }
      : null;
    const value: Value = {
      person, identity: role ? { userId: USER, organizationId: ORG, role, email: EMAIL } : null, ready: true, signedOut: false, error: null,
      signIn: async () => { throw new Error("no usado"); }, signOut: () => undefined, retry: () => undefined, ...over,
    };
    const tree: ReactNode = h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value }, h(ScopeProvider, null, h(ThemeProvider, null, h(ToastProvider, null, h(AppRoutes))))));
    return renderToStaticMarkup(tree);
  };
  return { render, calls };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./config");
  vi.doUnmock("./api/client");
});

describe("disponibilidad de módulos", () => {
  it("en api y mock todos los módulos están habilitados según el plan operativo", () => {
    for (const key of Object.keys(MODULE_LABEL) as ModuleKey[]) {
      expect(isModuleAvailable(key, true)).toBe(true);
      expect(isModuleAvailable(key, false)).toBe(true);
    }
  });
});

describe("modo api: módulos conectados (INT-FE-API-001)", () => {
  it.each(Object.keys(ROLES) as ApiRole[])("%s ve en /sesion su identidad de /me sin cargar datos de negocio", async (role) => {
    const { render, calls } = await load(false);
    const html = render("/sesion", role);
    expect(html).toContain('data-testid="inicio-identidad"');
    expect(html).toContain(EMAIL);
    expect(html).toContain(USER);
    expect(html).toContain(ORG);
    expect(html).toContain(`(${role})`);
    // Las marcas aparecen solo como opciones del selector de vista; no hay cifras ni datos ficticios.
    expect(html).not.toMatch(/Datos de demostración|S\/ ?\d/);
    expect(html).toContain("Cerrar sesión");
    expect(calls).toEqual([]);
  });

  it("el menú de cada rol enlaza sus módulos conectados, como en la demostración", async () => {
    const { render } = await load(false);
    // Paso 0 & B-07: Vendedora tiene acceso operativo a pedidos y clientes; no ve /taller en navegación
    const vendedor = render("/sesion", "VENDEDOR");
    for (const to of ["/pedidos", "/clientes"]) expect(vendedor).toContain(`href="${to}"`);
    expect(vendedor).not.toContain('href="/taller"');
    const admin = render("/sesion", "ADMIN");
    for (const to of ["/conciliacion", "/cobranza", "/pedidos"]) expect(admin).toContain(`href="${to}"`);
    const gerencia = render("/sesion", "GERENTE");
    expect(gerencia).toContain('href="/resultado"');
    for (const html of [vendedor, admin, gerencia]) expect(html).not.toContain('aria-disabled="true"');
  });

  it("hay buscador y selector de marca; no hay reinicio de demo", async () => {
    const { render } = await load(false);
    const html = render("/sesion", "ADMIN");
    expect(html).toContain('placeholder="Buscar…"');
    expect(html).toContain("Vista de datos");
    expect(html).not.toContain("Reiniciar demo");
  });

  it.each(["VENDEDOR", "ADMIN"] as ApiRole[])("%s: la carga manual por URL está habilitada en el flujo operativo", async (role) => {
    const { render, calls } = await load(false);
    const html = render("/captura", role);
    expect(html).not.toContain('data-testid="modulo-no-disponible"');
    expect(calls).toEqual([]);
  });

  it.each(Object.keys(ROLES) as ApiRole[])("%s: las rutas de módulos conectados no muestran el aviso de no disponible", async (role) => {
    const { render } = await load(false);
    for (const path of BUSINESS_PATHS.filter((p) => p !== "/captura")) {
      expect(render(path, role), `${role} ${path}`).not.toContain('data-testid="modulo-no-disponible"');
    }
  });

  it("una ruta inexistente sigue siendo 404 y no el aviso de módulo", async () => {
    const { render } = await load(false);
    const html = render("/no-existe", "GERENTE");
    expect(html).toContain("Esta página no existe");
    expect(html).not.toContain('data-testid="modulo-no-disponible"');
  });

  it("sin sesión no se muestra identidad ni módulos", async () => {
    const { render } = await load(false);
    const html = render("/", null);
    expect(html).not.toContain(USER);
    expect(html).not.toContain("data-testid");
  });
});

describe("modo api: acceso y errores de sesión", () => {
  it("la pantalla de acceso no mezcla la demostración: sin vista previa, cuentas demo ni distintivo", async () => {
    const { render } = await load(false);
    const html = render("/login", null);
    expect(html).not.toContain("Vista previa del panel");
    expect(html).not.toContain("Acceso de demostración");
    expect(html).not.toContain("carmen.ramos@keptai.pe");
  });

  it("un fallo temporal muestra el aviso con Reintentar y Cerrar sesión; uno permanente no ofrece reintento", async () => {
    const { render } = await load(false);
    const temporal = render("/login", null, { error: { kind: "unavailable", message: "Sin servicio por ahora.", retryable: true } });
    expect(temporal).toContain('role="alert"');
    expect(temporal).toContain("Sin servicio por ahora.");
    expect(temporal).toContain("Reintentar");
    expect(temporal).toContain("Cerrar sesión");
    const permanente = render("/login", null, { error: { kind: "no-membership", message: "Sin rol asignado.", retryable: false } });
    expect(permanente).toContain("Sin rol asignado.");
    expect(permanente).not.toContain("Reintentar");
  });
});

describe("modo mock explícito", () => {
  it("conserva la demostración: menú con enlaces a todos los módulos del rol, sin módulos bloqueados ni identidad real", async () => {
    await load(true);
    // Las pantallas lazy suspenden el SSR: el menú del modo mock se renderiza directamente.
    const [{ Sidebar }, { AuthContext }, { ToastProvider }, { ROLE_FROM_API, ROLE_LABEL }] = await Promise.all([
      import("./components/layout/Sidebar"), import("./context/AuthContext"), import("./context/ToastContext"), import("./lib/permissions"),
    ]);
    const role = ROLE_FROM_API.GERENTE;
    const person = { id: USER, name: "x", email: EMAIL, role, title: ROLE_LABEL[role], brand: null, since: "2026-01-01" };
    const value = { person, identity: null, ready: true, signedOut: false, error: null, signIn: async () => person, signOut: () => undefined, retry: () => undefined };
    const menu = renderToStaticMarkup(h(MemoryRouter, null, h(AuthContext.Provider, { value }, h(ToastProvider, null, h(Sidebar)))));
    expect(menu).toContain('href="/pedidos"');
    expect(menu).toContain('href="/resultado"');
    expect(menu).toContain("Inicio");
    expect(menu).not.toContain("aria-disabled");
    expect(menu).not.toContain("Pronto");
  });

  it("la pantalla de acceso conserva el formulario y el distintivo de demostración", async () => {
    const { render } = await load(true);
    const html = render("/login", null);
    expect(html).toContain("Iniciar sesión");
    expect(html).toContain("Acceso de demostración");
  });
});
