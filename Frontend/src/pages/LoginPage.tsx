import { useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";

const ERROR_IN = { opacity: 0, y: -4 };
const ERROR_SHOW = { opacity: 1, y: 0 };
import { Navigate, useLocation, useNavigate } from "react-router";
import { Eye, EyeSlash } from "../components/ui/icons";
import { Logo } from "../components/layout/Logo";
import { Button } from "../components/ui/Button";
import { DemoBadge } from "../components/ui/States";
import { prefetch } from "../lib/prefetch";
import { useAuth } from "../context/AuthContext";
import { cx } from "../lib/format";
import { IS_MOCK } from "../config";
import { ThemeToggle } from "../components/layout/ThemeToggle";

// MOCK: cuentas de la semilla de demostración. En modo api se entra con Supabase Auth.
const DEMO_ACCOUNTS = [
  { label: "Gerencia", email: "patricia.zapata@keptai.pe" },
  { label: "Administración", email: "carmen.ramos@keptai.pe" },
  { label: "Jefe de taller", email: "jorge.ipanaque@keptai.pe" },
  { label: "Vendedora Corpotex", email: "rosa.chunga@keptai.pe" },
  { label: "Vendedor Unicrack", email: "luis.yarleque@keptai.pe" },
];

export function LoginPage() {
  const { person, error, retry, signOut } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  // Mientras la persona escribe, se descarga la pantalla de inicio: entrar es inmediato.
  useEffect(() => prefetch(["pendientes"]), []);

  if (person) return <Navigate to={from} replace />;

  return (
    <div className="login-layout">
      <aside className="login-story">
        <Logo />
        <div className="my-8 max-w-lg md:my-12">
          <h1 className="text-hero font-semibold">Cada cobro,<br />en su lugar.</h1>
          <p className="mt-5 max-w-[36ch] text-base leading-relaxed text-muted">Del comprobante recibido a una visión clara de tu caja.</p>
          <ol className="login-workflow">
            <li><span>01</span><div><p className="font-semibold">Revisa la evidencia</p><p className="mt-1 text-sm text-muted">Pedidos y comprobantes en una sola bandeja.</p></div></li>
            <li><span>02</span><div><p className="font-semibold">Confirma el pago</p><p className="mt-1 text-sm text-muted">Verifica el ingreso antes de descontar la deuda.</p></div></li>
            <li><span>03</span><div><p className="font-semibold">Anticipa tu caja</p><p className="mt-1 text-sm text-muted">Consulta vencimientos y las próximas cuatro semanas.</p></div></li>
          </ol>
        </div>
        <p className="login-story-footer text-xs text-muted">KeptAI · Gestión de cobros y caja</p>
      </aside>
      <main className="login-form-panel">
        <div className="mb-8 flex items-center justify-between gap-3">{IS_MOCK && <DemoBadge />}<ThemeToggle /></div>
        {error && <div role="alert" className="mb-6 rounded-xl bg-card p-4 ring-1 ring-line">
          <p>{error.message}</p>
          {error.retryable && <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={retry}>Reintentar</Button>
            <Button size="sm" variant="secondary" onClick={signOut}>Cerrar sesión</Button>
          </div>}
        </div>}
        <section aria-labelledby="login-title"><LoginForm from={from} /></section>
        <p className="mt-10 text-center text-xs text-muted">Tu espacio de trabajo, según tu rol.</p>
      </main>
    </div>
  );
}

function LoginForm({ from }: { from: string }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(IS_MOCK ? "carmen.ramos@keptai.pe" : "");
  const [password, setPassword] = useState(IS_MOCK ? "demo1234" : "");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [help, setHelp] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Escribe un correo válido.";
    if (password.length < 6) next.password = "La contraseña tiene al menos 6 caracteres.";
    setErrors(next);
    if (next.email || next.password) return;
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "No se pudo iniciar sesión." });
      setLoading(false);
    }
  };

  return (
    <>
        <h2 id="login-title" className="text-title font-bold">
          Iniciar sesión
        </h2>
        <p className="mt-3 text-sm text-muted">Ingresa con tu cuenta para continuar.</p>

        <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-semibold">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={cx(
                "h-12 rounded-[var(--radius-block)] bg-violet-wash px-4 text-[15px] outline-none ring-1 transition-shadow focus:bg-card focus:ring-2 focus:ring-violet",
                errors.email ? "ring-bad" : "ring-violet-tint",
              )}
            />
            {errors.email && (
              <motion.p initial={ERROR_IN} animate={ERROR_SHOW} id="email-error" className="text-[13px] font-medium text-bad">
                {errors.email}
              </motion.p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-semibold">
                Contraseña
              </label>
              <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="min-h-11 text-xs font-semibold text-violet-ink hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={cx(
                  "h-12 w-full rounded-[var(--radius-block)] bg-violet-wash pl-4 pr-12 text-[15px] outline-none ring-1 transition-shadow focus:bg-card focus:ring-2 focus:ring-violet",
                  errors.password ? "ring-bad" : "ring-violet-tint",
                )}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-ink"
              >
                {show ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <motion.p initial={ERROR_IN} animate={ERROR_SHOW} id="password-error" className="text-[13px] font-medium text-bad">
                {errors.password}
              </motion.p>
            )}
            {help && (
              <motion.p initial={ERROR_IN} animate={ERROR_SHOW} className="rounded-xl bg-panel px-3 py-2 text-[13px] text-muted">
                Pide a administración que restablezca tu acceso.
              </motion.p>
            )}
          </div>

          {IS_MOCK && (
          <div className="border-t border-line pt-5">
            <label htmlFor="demo-account" className="text-[13px] font-semibold text-muted">Probar otro rol</label>
            <select id="demo-account" value={DEMO_ACCOUNTS.some((a) => a.email === email) ? email : ""} onChange={(e) => { setEmail(e.target.value); setPassword("demo1234"); setErrors({}); }} className="mt-2 h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm">
              <option value="" disabled>Selecciona una cuenta de demostración</option>
              {DEMO_ACCOUNTS.map((a) => <option key={a.email} value={a.email}>{a.label}</option>)}
            </select>
          </div>
          )}

          {errors.form && (
            <motion.p initial={ERROR_IN} animate={ERROR_SHOW} role="alert" className="rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
              {errors.form}
            </motion.p>
          )}

          <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
            Iniciar sesión
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          {IS_MOCK
            ? "Acceso de demostración: elige una cuenta y usa cualquier contraseña de 6 caracteres o más."
            : "Entra con tu cuenta de KeptAI. Tu rol lo asigna gerencia."}
        </p>
    </>
  );
}
