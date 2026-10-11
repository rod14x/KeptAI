import { Link } from "react-router";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/permissions";
import { NAV } from "../components/layout/nav";
import { MODULE_LABEL } from "../lib/availability";

// Inicio autenticado del modo api (AUTH-FE-03). Usa SOLO la identidad que el backend resolvió en GET /api/v1/me
// (user_id, organization_id, role) y el correo de la sesión de Supabase Auth. No consulta módulos de negocio ni
// muestra nombre de empresa, marca, fechas o cifras: el contrato /me no los expone.
export function InicioPage() {
  const { identity, person } = useAuth();
  if (!identity || !person) return null;
  const pending = NAV.filter((n) => n.module !== "inicio" && n.show?.(person.role) !== false);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="inicio-identidad">
      <header>
        <h1 className="text-title font-extrabold">Sesión conectada</h1>
        <p className="mt-1 text-[15px] text-muted">Tu identidad la resuelve el servidor con tu sesión de Supabase Auth (GET /api/v1/me).</p>
      </header>

      <section aria-labelledby="identidad-titulo" className="rounded-[var(--radius-card)] bg-card p-6 ring-1 ring-line">
        <h2 id="identidad-titulo" className="text-base font-bold">
          Identidad
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
          <dt className="text-sm font-semibold text-muted">Correo (Auth)</dt>
          <dd className="break-all text-sm">{identity.email || "—"}</dd>
          <dt className="text-sm font-semibold text-muted">Rol</dt>
          <dd className="text-sm">
            {ROLE_LABEL[person.role]} <span className="tabular text-muted">({identity.role})</span>
          </dd>
          <dt className="text-sm font-semibold text-muted">user_id</dt>
          <dd className="tabular break-all text-sm" data-testid="user-id">
            {identity.userId}
          </dd>
          <dt className="text-sm font-semibold text-muted">organization_id</dt>
          <dd className="tabular break-all text-sm" data-testid="organization-id">
            {identity.organizationId}
          </dd>
        </dl>
        <p className="mt-4 text-[13px] text-muted">
          El nombre de la organización, la marca y los datos de negocio no se muestran: el contrato de identidad no los incluye.
        </p>
      </section>

      <section aria-labelledby="modulos-titulo" className="rounded-[var(--radius-card)] bg-card p-6 ring-1 ring-line">
        <h2 id="modulos-titulo" className="text-base font-bold">
          Módulos
        </h2>
        <p className="mt-1 text-[13px] text-muted">Aún no están conectados al backend; no se consultan ni se abren.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Módulos pendientes">
          {pending.map((n) => (
            <li key={n.to} className="flex items-center justify-between rounded-xl bg-panel px-4 py-3 text-sm" data-testid={`modulo-${n.module}`}>
              <span className="font-semibold text-muted">{MODULE_LABEL[n.module]}</span>
              <span className="text-[12px] font-semibold text-faint">No disponible todavía</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[13px] text-muted">
        ¿Quieres ver la demostración con datos ficticios? Corre la aplicación en modo mock (<code>VITE_API_MODE=mock</code>); no se mezcla con esta sesión.{" "}
        <Link to="/" className="sr-only">
          Inicio
        </Link>
      </p>
      <div>
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button variant="secondary" onClick={signOut}>
      Cerrar sesión
    </Button>
  );
}
