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
  "/cobranza", "/taller", "/captura", "/resultado", "/perfil", "/perfil?tab=actividad",
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
  const [{ AppRoutes }, { AuthContext }, { ScopeProvider }, { ToastProvider }] = await Promise.all([
    import("./App"), import("./context/AuthContext"), import("./context/ScopeContext"), import("./context/ToastContext"),
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
    const tree: ReactNode = h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value }, h(ScopeProvider, null, h(ToastProvider, null, h(AppRoutes)))));
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
  it("en api solo el inicio está disponible; en mock todos", () => {
    for (const key of Object.keys(MODULE_LABEL) as ModuleKey[]) {
      expect(isModuleAvailable(key, true)).toBe(true);
      expect(isModuleAvailable(key, false)).toBe(key === "inicio");
    }
  });
});

describe("modo api: inicio autenticado", () => {
  it.each(Object.keys(ROLES) as ApiRole[])("%s ve su identidad de /me y ninguna cifra ni dato de negocio", async (role) => {
    const { render, calls } = await load(false);
    const html = render("/", role);
    expect(html).toContain('data-testid="inicio-identidad"');
    expect(html).toContain(EMAIL);
    expect(html).toContain(USER);
    expect(html).toContain(ORG);
    expect(html).toContain(`(${role})`);
    expect(html).not.toMatch(/Datos de demostración|Corpotex|Unicrack|S\/ ?\d|Dashboard|En el equipo desde/);
    expect(html).toContain("Cerrar sesión");
    expect(calls).toEqual([]);
  });

  it("el menú marca como no disponibles los módulos del rol y no los enlaza", async () => {
    const { render } = await load(false);
    const nav = await import("./components/layout/nav");
    for (const role of Object.keys(ROLES) as ApiRole[]) {
      const html = render("/", role);
      const { ROLE_FROM_API } = await import("./lib/permissions");
      const pending = nav.NAV.filter((n) => n.module !== "inicio" && n.show?.(ROLE_FROM_API[role]) !== false);
      expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(pending.length);
      expect((html.match(/data-testid="modulo-/g) ?? []).length).toBe(pending.length);
      for (const n of pending) expect(html).not.toContain(`href="${n.to}"`);
      expect(html).toContain('href="/"');
    }
  });

  it("no hay buscador, selector de marca, reinicio de demo ni menú de perfil", async () => {
    const { render } = await load(false);
    const html = render("/", "ADMIN");
    expect(html).not.toContain("Buscar cliente, orden o pago");
    expect(html).not.toContain("Vista de datos");
    expect(html).not.toContain("Reiniciar demo");
    expect(html).not.toContain("/perfil");
  });

  it.each(Object.keys(ROLES) as ApiRole[])("%s: el acceso directo por URL a cada módulo muestra «no disponible» sin cargar nada", async (role) => {
    const { render, calls } = await load(false);
    for (const path of BUSINESS_PATHS) {
      const html = render(path, role);
      expect(html, `${role} ${path}`).toContain('data-testid="modulo-no-disponible"');
      expect(html, `${role} ${path}`).not.toContain('data-testid="inicio-identidad"');
      expect(html).toContain("aún no está disponible");
    }
    expect(calls).toEqual([]);
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
    expect(html).not.toContain("Datos de demostración");
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
    expect(menu).toContain("Dashboard");
    expect(menu).not.toContain("aria-disabled");
    expect(menu).not.toContain("Pronto");
  });

  it("la pantalla de acceso mantiene la vista previa y el distintivo de demostración", async () => {
    const { render } = await load(true);
    const html = render("/login", null);
    expect(html).toContain("Vista previa del panel");
    expect(html).toContain("Datos de demostración");
  });
});
