import type { ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ScopeProvider } from "./context/ScopeContext";
import { ToastProvider } from "./context/ToastContext";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PedidosPage } from "./pages/PedidosPage";
import { ConciliacionPage } from "./pages/ConciliacionPage";
import { ResultadoPage } from "./pages/ResultadoPage";
import { ClientesPage } from "./pages/ClientesPage";
import { ClienteDetailPage } from "./pages/ClienteDetailPage";
import { PerfilPage } from "./pages/PerfilPage";
import { EstadoCuentaPage } from "./pages/EstadoCuentaPage";
import { EmptyState } from "./components/ui/States";
import { can, type Permission } from "./lib/permissions";

function RequireSession() {
  const { person, signedOut } = useAuth();
  const location = useLocation();
  if (!person) return <Navigate to="/login" replace state={signedOut ? null : { from: location.pathname + location.search }} />;
  return <Outlet />;
}

function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { person } = useAuth();
  if (!can(person?.role, permission)) {
    return (
      <div className="mx-auto max-w-md py-16">
        <EmptyState title="Tu rol no tiene acceso a esta sección">
          Si lo necesitas, pídelo a gerencia.{" "}
          <Link to="/" className="font-semibold text-violet-ink underline">
            Volver al dashboard
          </Link>
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16">
      <EmptyState title="Esta página no existe">
        <Link to="/" className="font-semibold text-violet-ink underline">
          Volver al dashboard
        </Link>
      </EmptyState>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScopeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/estado-cuenta/:token" element={<EstadoCuentaPage />} />
              <Route element={<RequireSession />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="pedidos" element={<PedidosPage />} />
                  <Route path="clientes" element={<ClientesPage />} />
                  <Route path="clientes/:id" element={<ClienteDetailPage />} />
                  <Route path="conciliacion" element={<ConciliacionPage />} />
                  <Route path="conciliacion/:id" element={<ConciliacionPage />} />
                  <Route
                    path="resultado"
                    element={
                      <RequirePermission permission="ver_resultado">
                        <ResultadoPage />
                      </RequirePermission>
                    }
                  />
                  <Route path="perfil" element={<PerfilPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </ToastProvider>
        </ScopeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
