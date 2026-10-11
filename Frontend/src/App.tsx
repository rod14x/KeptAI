import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ScopeProvider } from "./context/ScopeContext";
import { ToastProvider } from "./context/ToastContext";
import { AppLayout } from "./components/layout/AppLayout";
import { EmptyState, Skeleton } from "./components/ui/States";
// El login es la puerta de entrada: va en el bundle inicial para evitar una descarga encadenada.
import { LoginPage } from "./pages/LoginPage";
import { InicioPage } from "./pages/InicioPage";
import { ModuloNoDisponiblePage } from "./pages/ModuloNoDisponiblePage";
import { IS_MOCK } from "./config";
import { isModuleAvailable, type ModuleKey } from "./lib/availability";

// Cada pantalla se descarga al abrirla: el primer render no paga Recharts ni páginas que el rol no usa.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));
const PendientesPage = page(() => import("./pages/PendientesPage"), "PendientesPage");
const DashboardPage = page(() => import("./pages/DashboardPage"), "DashboardPage");
const PedidosPage = page(() => import("./pages/PedidosPage"), "PedidosPage");
const ConciliacionPage = page(() => import("./pages/ConciliacionPage"), "ConciliacionPage");
const ResultadoPage = page(() => import("./pages/ResultadoPage"), "ResultadoPage");
const ClientesPage = page(() => import("./pages/ClientesPage"), "ClientesPage");
const ClienteDetailPage = page(() => import("./pages/ClienteDetailPage"), "ClienteDetailPage");
const PerfilPage = page(() => import("./pages/PerfilPage"), "PerfilPage");
const EstadoCuentaPage = page(() => import("./pages/EstadoCuentaPage"), "EstadoCuentaPage");
const OrdenDetailPage = page(() => import("./pages/OrdenDetailPage"), "OrdenDetailPage");
const TallerPage = page(() => import("./pages/TallerPage"), "TallerPage");
const CobranzaPage = page(() => import("./pages/CobranzaPage"), "CobranzaPage");
const CapturaPage = page(() => import("./pages/CapturaPage"), "CapturaPage");

function PageFallback() {
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-14 w-72 rounded-2xl" />
      <Skeleton className="h-[360px] rounded-[var(--radius-card)]" />
    </div>
  );
}
import { can, type Permission } from "./lib/permissions";

function RequireSession() {
  const { person, ready, signedOut } = useAuth();
  const location = useLocation();
  if (!ready) return <PageFallback />;
  // En modo api no se recuerda la ruta de origen: el único destino disponible es el inicio de identidad.
  if (!person) return <Navigate to="/login" replace state={signedOut || !IS_MOCK ? null : { from: location.pathname + location.search }} />;
  return <Outlet />;
}

function RequirePermission({ permission, children }: { permission: Permission | Permission[]; children: ReactNode }) {
  const { person } = useAuth();
  const list = Array.isArray(permission) ? permission : [permission];
  if (!list.some((p) => can(person?.role, p))) {
    return (
      <div className="mx-auto max-w-md py-16">
        <EmptyState title="Tu rol no tiene acceso a esta sección">
          Si lo necesitas, pídelo a gerencia.{" "}
          <Link to="/" className="font-semibold text-violet-ink underline">
            Volver al inicio
          </Link>
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Inicio por rol: quien opera ve sus pendientes; gerencia, que solo mira, ve los números;
 * el Jefe de taller no ve la parte comercial y entra directo al taller.
 */
function Home() {
  const { person } = useAuth();
  if (!IS_MOCK) return <InicioPage />;
  if (person?.role === "jefe_taller") return <Navigate to="/taller" replace />;
  if (person?.role === "gerencia") return <DashboardPage />;
  return <PendientesPage />;
}

// Una ruta de módulo solo monta su pantalla si el módulo está disponible en el modo actual; en modo api muestra
// "no disponible" y la pantalla de negocio (con sus hooks de datos) nunca se renderiza ni se descarga.
const gate = (module: ModuleKey, permission: Permission | Permission[], el: ReactNode) =>
  isModuleAvailable(module) ? <RequirePermission permission={permission}>{el}</RequirePermission> : <ModuloNoDisponiblePage module={module} />;
const moduleOnly = (module: ModuleKey, el: ReactNode) => (isModuleAvailable(module) ? el : <ModuloNoDisponiblePage module={module} />);

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16">
      <EmptyState title="Esta página no existe">
        <Link to="/" className="font-semibold text-violet-ink underline">
          Volver al inicio
        </Link>
      </EmptyState>
    </div>
  );
}

/** Rutas de la aplicación; se exporta separada de los proveedores para poder probar la navegación. */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireSession />}>
                <Route element={<AppLayout />}>
                  <Route index element={<Home />} />
                  <Route path="resumen" element={gate("resumen", "ver_comercial", <DashboardPage />)} />
                  <Route path="pedidos" element={gate("pedidos", "ver_comercial", <PedidosPage />)} />
                  <Route path="pedidos/:ref" element={gate("pedidos", "ver_comercial", <OrdenDetailPage />)} />
                  <Route path="clientes" element={gate("clientes", "ver_comercial", <ClientesPage />)} />
                  <Route path="clientes/:id" element={gate("clientes", "ver_comercial", <ClienteDetailPage />)} />
                  <Route path="clientes/:id/estado-cuenta" element={gate("clientes", "ver_estado_cuenta", <EstadoCuentaPage />)} />
                  <Route path="conciliacion" element={gate("conciliacion", ["verificar", "ver_pagos"], <ConciliacionPage />)} />
                  <Route path="conciliacion/:id" element={gate("conciliacion", ["verificar", "ver_pagos"], <ConciliacionPage />)} />
                  <Route path="cobranza" element={gate("cobranza", "ver_cobranza", <CobranzaPage />)} />
                  <Route path="taller" element={gate("taller", ["registrar_despacho", "ver_resultado"], <TallerPage />)} />
                  <Route path="captura" element={gate("captura", "captura", <CapturaPage />)} />
                  <Route path="resultado" element={gate("resultado", "ver_resultado", <ResultadoPage />)} />
                  <Route path="perfil" element={moduleOnly("perfil", <PerfilPage />)} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScopeProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </ScopeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
