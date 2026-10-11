import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { List, X } from "../ui/icons";
import { overlayVariants, softSpring } from "../motion/primitives";

const DRAWER_IN = { x: "-100%" };
const DRAWER_SHOW = { x: 0 };
import { Sidebar, NAV } from "./Sidebar";
import { ScopeSelector } from "./ScopeSelector";
import { SearchBox } from "./SearchBox";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { useAuth } from "../../context/AuthContext";
import { prefetch } from "../../lib/prefetch";

export function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const { person } = useAuth();

  // Con la sesión abierta, precargar en segundo plano las pantallas que usa este rol.
  useEffect(() => {
    if (!person) return;
    const byRole = {
      vendedor: ["pedidos", "orden", "clientes", "cliente", "captura", "perfil"],
      administracion: ["pedidos", "orden", "conciliacion", "cobranza", "clientes", "cliente", "captura", "resultado", "perfil"],
      gerencia: ["pedidos", "orden", "clientes", "cliente", "resultado", "cobranza", "perfil"],
      jefe_taller: ["taller", "perfil"],
    } as const;
    prefetch([...byRole[person.role]]);
  }, [person?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = [...NAV].reverse().find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {drawer && (
          <motion.div key="drawer" className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú" initial="hidden" animate="show" exit="exit">
            <motion.button variants={overlayVariants} aria-label="Cerrar menú" className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
            <motion.div
              initial={DRAWER_IN}
              animate={DRAWER_SHOW}
              exit={DRAWER_IN}
              transition={softSpring}
              className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-app shadow-[var(--shadow-lift)]"
            >
              <button
                onClick={() => setDrawer(false)}
                aria-label="Cerrar menú"
                className="absolute right-3 top-4 flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft"
              >
                <X size={20} />
              </button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col lg:py-3 lg:pr-3">
        <div className="flex min-h-[100dvh] flex-col bg-panel lg:min-h-[calc(100dvh-24px)] lg:rounded-[24px] lg:ring-1 lg:ring-line/70">
          <header className="sticky top-0 z-20 border-b border-line/80 bg-panel lg:rounded-t-[24px]">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
              <button
                onClick={() => setDrawer(true)}
                aria-label="Abrir menú"
                className="flex size-11 items-center justify-center rounded-full ring-1 ring-line lg:hidden"
              >
                <List size={20} />
              </button>
              <Logo subtitle={false} className="lg:hidden" />
              <nav aria-label="Ruta" className="hidden items-center gap-2 text-sm lg:flex">
                <span className="text-muted">KeptAI</span>
                <span className="text-faint">/</span>
                <span className="font-semibold">{pathname.startsWith("/perfil") ? "Perfil" : (current?.label ?? "Inicio")}</span>
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <SearchBox className="hidden w-64 md:block xl:w-80" />
                <ScopeSelector className="hidden lg:inline-flex" />
                <UserMenu />
              </div>
            </div>
            <div className="flex flex-col gap-2 px-4 pb-3 sm:px-6 lg:hidden">
              <ScopeSelector className="flex w-full" stretch />
              <SearchBox className="md:hidden" />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
