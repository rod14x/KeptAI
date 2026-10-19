import { Link } from "react-router";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/permissions";
import { NAV_BY_ROLE } from "../components/layout/Sidebar";
import { isModuleAvailable, MODULE_LABEL } from "../lib/availability";

// "Mi sesión" del modo api (/sesion; antes inicio de AUTH-FE-03). Usa SOLO la identidad que el backend resolvió en
// GET /api/v1/me (user_id, organization_id, role) y el correo de la sesión de Supabase Auth, y la disponibilidad de
// cada módulo según la fuente única de navegación por rol.
export function InicioPage() {
  const { identity, person } = useAuth();
  if (!identity || !person) return null;
  const modules = (NAV_BY_ROLE[person.role] ?? []).filter((n) => n.module !== "inicio");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="inicio-identidad">
      <header>
        <h1 className="text-title font-extrabold">Mi sesión</h1>
        <p className="mt-1 text-[15px] text-muted">Tu identidad la resuelve el servidor con tu sesión de Supabase Auth (GET /api/v1/me).</p>
        {person.role === "vendedor" && (
          <p className="mt-3 rounded-xl bg-panel px-4 py-3 text-[13px] text-ink-soft ring-1 ring-line">
            La cartera del vendedor está pendiente de definir (D-014): en esta etapa Administración autoriza el crédito comercial.
          </p>
        )}
      </header>

      <section aria-labelledby="identidad-titulo" className="rounded-[var(--radius-card)] bg-card p-6 ring-1 ring-line">
        <h2 id="identidad-titulo" className="text-base font-bold">
          Identidad
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
          <dt className="text-sm font-semibold text-muted">Nombre</dt>
          <dd className="text-sm">{identity.name || "—"}</dd>
          <dt className="text-sm font-semibold text-muted">Organización</dt>
          <dd className="text-sm">{identity.organizationName || "—"}</dd>
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
          Nombre y organización vienen de la base (usuario y organización); la marca no forma parte del contrato de identidad.
        </p>
      </section>

      <section aria-labelledby="modulos-titulo" className="rounded-[var(--radius-card)] bg-card p-6 ring-1 ring-line">
        <h2 id="modulos-titulo" className="text-base font-bold">
          Módulos
        </h2>
        <p className="mt-1 text-[13px] text-muted">Conexión de tu rol con el backend.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Módulos">
          {modules.map((n) => {
            const ok = isModuleAvailable(n.module);
            return (
              <li key={n.to} className="flex items-center justify-between rounded-xl bg-panel px-4 py-3 text-sm" data-testid={`modulo-${n.module}`}>
                {ok ? (
                  <Link to={n.to} className="font-semibold text-ink hover:underline">
                    {MODULE_LABEL[n.module]}
                  </Link>
                ) : (
                  <span className="font-semibold text-muted">{MODULE_LABEL[n.module]}</span>
                )}
                <span className={ok ? "text-[12px] font-semibold text-ok" : "text-[12px] font-semibold text-faint"}>{ok ? "Conectado" : "Pendiente"}</span>
              </li>
            );
          })}
        </ul>
      </section>
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
