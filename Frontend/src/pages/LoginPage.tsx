import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Item, Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { DialogShell } from "../components/ui/Dialog";

const ERROR_IN = { opacity: 0, y: -4 };
const ERROR_SHOW = { opacity: 1, y: 0 };
import { Navigate, useLocation, useNavigate } from "react-router";
import { Eye, EyeSlash, X } from "../components/ui/icons";
import { Logo } from "../components/layout/Logo";
import { Button } from "../components/ui/Button";
import { DemoBadge } from "../components/ui/States";
import { Skeleton } from "../components/ui/States";
import { prefetch } from "../lib/prefetch";
import { useAuth } from "../context/AuthContext";
import { cx } from "../lib/format";
import { IS_MOCK } from "../config";

const LoginPreviewChart = lazy(() => import("../components/charts/LoginPreviewChart"));

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
  // En modo api el único destino disponible es el inicio de identidad; no se vuelve a rutas de negocio guardadas.
  const from = IS_MOCK ? ((location.state as { from?: string } | null)?.from ?? "/") : "/";
  const [open, setOpen] = useState(Boolean((location.state as { from?: string } | null)?.from));

  // Mientras la persona escribe, se descarga el dashboard: entrar es inmediato.
  useEffect(() => (IS_MOCK ? prefetch(["dashboard"]) : undefined), []);
  // Tras un fallo temporal, dejar accesibles las acciones de la sesión conservada.
  useEffect(() => {
    if (!IS_MOCK && error?.retryable) setOpen(false);
  }, [error]);

  if (person) return <Navigate to={from} replace />;

  return (
    <div className="relative isolate min-h-[100dvh] overflow-hidden bg-[#f6f4fb]">
      {/* Atmósfera de marca: los mismos volúmenes violeta y verde del asistente y de los cobros. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[620px] rounded-full bg-[radial-gradient(circle,#e4dcfa_0%,rgba(228,220,250,0)_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-40 -z-10 size-[560px] rounded-full bg-[radial-gradient(circle,#dcf1e5_0%,rgba(220,241,229,0)_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-[18%] top-[58%] -z-10 size-28 rounded-full bg-white/70" />

      <div className="mx-auto flex max-w-[1280px] flex-col px-4 pt-4 sm:px-6 lg:px-8">
        <nav className="flex h-[72px] items-center justify-between rounded-[22px] bg-white/80 px-4 shadow-[0_1px_2px_rgb(23_23_26/0.04)] ring-1 ring-white sm:px-6">
          <Logo />
          <Button size="sm" onClick={() => setOpen(true)}>
            Acceder
          </Button>
        </nav>

        {error && (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm ring-1 ring-line">
            <p className="min-w-0 flex-1">{error.message}</p>
            {error.retryable && (
              <>
                <Button size="sm" onClick={retry}>
                  Reintentar
                </Button>
                <Button size="sm" variant="secondary" onClick={signOut}>
                  Cerrar sesión
                </Button>
              </>
            )}
          </div>
        )}

        <Stagger className="grid items-center gap-12 py-12 lg:min-h-[calc(100dvh-104px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-16">
          {/* El mensaje entra en orden de lectura: titular, explicación y acción. */}
          <motion.section variants={listVariants} className="max-w-xl">
            <motion.h1 variants={itemVariants} className="text-hero font-extrabold">
              Cobra con evidencia. <span className="text-violet">Proyecta tu caja.</span>
            </motion.h1>
            <motion.p variants={itemVariants} className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
              Convierte los pagos que llegan por WhatsApp en saldos conciliados, margen por pedido y caja a cuatro semanas.
            </motion.p>
            <Item className="mt-8">
              <Button size="lg" onClick={() => setOpen(true)} className="w-full sm:w-auto">
                Acceder
              </Button>
            </Item>
          </motion.section>

          {/* La vista previa usa cifras de demostración: solo en modo mock, nunca junto a un acceso real. */}
          {IS_MOCK && (
          <motion.section variants={itemVariants} aria-label="Vista previa del panel" className="relative">
            <div className="rounded-[28px] bg-white/70 p-2.5 shadow-[var(--shadow-lift)] ring-1 ring-white lg:rotate-[-1.2deg]">
              <div className="rounded-[22px] bg-card p-5 ring-1 ring-line/70 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-violet-ink">Corpotex + Unicrack</p>
                    <p className="text-section font-bold">Caja a 4 semanas</p>
                  </div>
                  <DemoBadge />
                </div>
                <div className="mt-4">
                  <Suspense fallback={<Skeleton className="h-[284px] rounded-2xl" />}>
                    <LoginPreviewChart />
                  </Suspense>
                </div>
              </div>
            </div>
          </motion.section>
          )}
        </Stagger>
      </div>

      <DialogShell open={open} onClose={() => setOpen(false)} labelledBy="login-title" overlayClassName="bg-[#2a2440]/45" panelClassName="max-w-[460px] rounded-[28px] p-6 sm:p-9">
        <LoginForm from={from} onClose={() => setOpen(false)} />
      </DialogShell>
    </div>
  );
}

function LoginForm({ from, onClose }: { from: string; onClose: () => void }) {
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
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink">
          <X size={20} />
        </button>
        <span className="flex size-11 items-center justify-center rounded-[13px] bg-ink text-lg font-extrabold text-white">K</span>
        <h2 id="login-title" className="mt-5 text-title font-extrabold">
          Iniciar sesión
        </h2>
        <p className="mt-1 text-[15px] text-muted">Accede al panel de cobros y caja.</p>

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
              <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="text-[13px] font-semibold text-violet-ink hover:underline">
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
                className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
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
          <fieldset>
            <legend className="text-[13px] font-semibold text-muted">Cuentas de demostración</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setErrors({});
                  }}
                  aria-pressed={email === a.email}
                  className={cx(
                    "min-h-10 rounded-full px-3.5 text-xs font-semibold ring-1 transition-colors",
                    email === a.email ? "bg-ink text-white ring-ink" : "bg-card text-muted ring-line hover:text-ink",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </fieldset>
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
