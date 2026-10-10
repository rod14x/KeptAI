import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Eye, EyeSlash, X } from "@phosphor-icons/react";
import { Logo } from "../components/layout/Logo";
import { Button } from "../components/ui/Button";
import { DemoBadge } from "../components/ui/States";
import { CashFlowChart } from "../components/charts/CashFlowChart";
import { buildWeeks } from "../api/client";
import { createSeed } from "../api/seed";
import { useAuth } from "../context/AuthContext";
import { cx } from "../lib/format";

const PREVIEW_WEEKS = buildWeeks(createSeed(), "consolidado");

const DEMO_ACCOUNTS = [
  { label: "Gerencia", email: "patricia.zapata@keptai.pe" },
  { label: "Administración", email: "carmen.ramos@keptai.pe" },
  { label: "Registro de pagos", email: "jorge.ipanaque@keptai.pe" },
  { label: "Vendedora Corpotex", email: "rosa.chunga@keptai.pe" },
  { label: "Vendedor Unicrack", email: "luis.yarleque@keptai.pe" },
];

export function LoginPage() {
  const { person } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [open, setOpen] = useState(Boolean((location.state as { from?: string } | null)?.from));

  if (person) return <Navigate to={from} replace />;

  return (
    <div className="relative isolate min-h-[100dvh] overflow-hidden bg-[#f6f4fb]">
      {/* Atmósfera de marca: los mismos volúmenes violeta y verde del asistente y de los cobros. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[620px] rounded-full bg-[radial-gradient(circle,#e4dcfa_0%,rgba(228,220,250,0)_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-40 -z-10 size-[560px] rounded-full bg-[radial-gradient(circle,#dcf1e5_0%,rgba(220,241,229,0)_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-[18%] top-[58%] -z-10 size-28 rounded-full bg-white/70" />

      <div className="mx-auto flex max-w-[1280px] flex-col px-4 pt-4 sm:px-6 lg:px-8">
        <nav className="flex h-[72px] items-center justify-between rounded-[22px] bg-white/80 px-4 shadow-[0_1px_2px_rgb(23_23_26/0.04)] ring-1 ring-white backdrop-blur sm:px-6">
          <Logo />
          <Button size="sm" onClick={() => setOpen(true)}>
            Acceder
          </Button>
        </nav>

        <main className="grid items-center gap-12 py-12 lg:min-h-[calc(100dvh-104px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-16">
          <section className="animate-rise max-w-xl">
            <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[58px]">
              Cobra con evidencia. <span className="text-violet">Proyecta tu caja.</span>
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
              Convierte los pagos que llegan por WhatsApp en saldos conciliados, margen por pedido y caja a cuatro semanas.
            </p>
            <div className="mt-8">
              <Button size="lg" onClick={() => setOpen(true)}>
                Acceder
              </Button>
            </div>
          </section>

          <section aria-label="Vista previa del panel" className="animate-rise relative" style={{ animationDelay: "120ms" }}>
            <div className="rounded-[28px] bg-white/60 p-2.5 shadow-[var(--shadow-lift)] ring-1 ring-white backdrop-blur lg:rotate-[-1.2deg]">
              <div className="rounded-[22px] bg-card p-5 ring-1 ring-line/70 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-violet-ink">Corpotex + Unicrack</p>
                    <p className="text-lg font-bold tracking-tight">Caja a 4 semanas</p>
                  </div>
                  <DemoBadge />
                </div>
                <div className="mt-4">
                  <CashFlowChart weeks={PREVIEW_WEEKS} compact />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {open && <LoginModal from={from} onClose={() => setOpen(false)} />}
    </div>
  );
}

function LoginModal({ from, onClose }: { from: string; onClose: () => void }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("carmen.ramos@keptai.pe");
  const [password, setPassword] = useState("demo1234");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [help, setHelp] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <button aria-label="Cerrar" className="animate-fade absolute inset-0 bg-[#2a2440]/30 backdrop-blur-md" onClick={onClose} />
      <div className="animate-rise relative w-full max-w-[460px] rounded-[28px] bg-card p-6 shadow-[var(--shadow-lift)] sm:p-9">
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink">
          <X size={20} />
        </button>
        <span className="flex size-11 items-center justify-center rounded-[13px] bg-ink text-lg font-extrabold text-white">K</span>
        <h2 id="login-title" className="mt-5 text-[26px] font-extrabold tracking-tight">
          Iniciar sesión
        </h2>
        <p className="mt-1 text-[15px] text-muted">Accede al panel de cobros y caja.</p>

        <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-semibold">
              Correo electrónico
            </label>
            <input
              ref={emailRef}
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
              <p id="email-error" className="text-[13px] font-medium text-bad">
                {errors.email}
              </p>
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
              <p id="password-error" className="text-[13px] font-medium text-bad">
                {errors.password}
              </p>
            )}
            {help && <p className="animate-fade rounded-xl bg-panel px-3 py-2 text-[13px] text-muted">Pide a administración que restablezca tu acceso.</p>}
          </div>

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
                    "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
                    email === a.email ? "bg-ink text-white ring-ink" : "bg-card text-muted ring-line hover:text-ink",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </fieldset>

          {errors.form && (
            <p role="alert" className="rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
              {errors.form}
            </p>
          )}

          <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
            Iniciar sesión
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Acceso de demostración: elige una cuenta y usa cualquier contraseña de 6 caracteres o más. La autenticación real llega con Supabase.
        </p>
      </div>
    </div>
  );
}
