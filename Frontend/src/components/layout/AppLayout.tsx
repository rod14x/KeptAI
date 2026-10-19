import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { List, X } from "../ui/icons";
import { overlayVariants, softSpring } from "../motion/primitives";

const DRAWER_IN = { x: "-100%" };
const DRAWER_SHOW = { x: 0 };
import { Sidebar, NAV_BY_ROLE, sectionLabel } from "./Sidebar";
import { ScopeSelector } from "./ScopeSelector";
import { SearchBox } from "./SearchBox";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { useAuth } from "../../context/AuthContext";
import { prefetch } from "../../lib/prefetch";
import { cx } from "../../lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { IS_MOCK } from "../../config";

export function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const { person } = useAuth();
  const drawerPanel = useRef<HTMLDivElement>(null);

  // Con la sesión abierta, precargar en segundo plano las pantallas que usa este rol.
  useEffect(() => {
    if (!person) return;
    const byRole = {
      vendedor: ["pendientes", "pedidos", "orden", "clientes", "cliente", "captura", "perfil"],
      administracion: ["pendientes", "pedidos", "orden", "conciliacion", "cobranza", "clientes", "cliente", "captura", "perfil"],
      gerencia: ["dashboard", "pedidos", "orden", "clientes", "cliente", "resultado", "perfil"],
      jefe_taller: ["taller", "perfil"],
      diseno: ["taller", "pedidos", "orden", "perfil"],
    } as const;
    // La carga manual no está conectada en modo api: no se precarga.
    prefetch(byRole[person.role].filter((p) => IS_MOCK || p !== "captura"));
  }, [person?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  // Un rol con una sola pantalla (Jefe de taller) no necesita menú.
  const hasNav = person ? NAV_BY_ROLE[person.role].length > 0 : false;

  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => drawerPanel.current?.querySelector<HTMLElement>("button, a")?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
      if (e.key !== "Tab") return;
      const nodes = drawerPanel.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [drawer]);
  useEffect(() => { setDrawer(false); }, [pathname]);

  return (
    <div className={cx("app-shell", !hasNav && "single-workspace")}>
      <a href="#main-content" className="skip-link">Ir al contenido</a>
      {hasNav && (
        <aside className="app-sidebar sticky top-0 hidden h-[100dvh] overflow-y-auto lg:block">
          <Sidebar />
        </aside>
      )}

      <AnimatePresence>
        {drawer && (
          <motion.div key="drawer" className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú" initial="hidden" animate="show" exit="exit">
            <motion.button tabIndex={-1} variants={overlayVariants} aria-label="Cerrar menú" className="absolute inset-0 bg-navy/50" onClick={() => setDrawer(false)} />
            <motion.div
              ref={drawerPanel}
              initial={DRAWER_IN}
              animate={DRAWER_SHOW}
              exit={DRAWER_IN}
              transition={softSpring}
              className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto rounded-r-lg bg-card shadow-[var(--shadow-lift)]"
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

      <div className="flex min-w-0 flex-col">
        <div className="flex min-h-[100dvh] min-h-screen-dynamic flex-col">
          <header className="app-topbar sticky top-0 z-20">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-9">
              {hasNav && (
                <button
                  onClick={() => setDrawer(true)}
                  aria-label="Abrir menú"
                  aria-expanded={drawer}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-line hover:bg-panel lg:hidden"
                >
                  <List size={20} />
                </button>
              )}
              <Logo subtitle={false} className={hasNav ? "lg:hidden" : undefined} />
              <nav aria-label="Ruta" className="hidden items-center gap-2 text-sm lg:flex">
                <span className="font-semibold">{sectionLabel(pathname, person?.role)}</span>
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
                {person?.role !== "jefe_taller" && <SearchBox className="hidden w-60 md:block xl:w-72" />}
                <ScopeSelector className="hidden lg:inline-flex" />
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 pb-3 sm:px-6 lg:hidden">
              <ScopeSelector className="flex shrink-0" />
              {person?.role !== "jefe_taller" && <SearchBox className="min-w-0 flex-1 md:hidden" />}
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="main-container min-w-0 flex-1 px-4 py-7 sm:px-6 lg:px-9 lg:py-9">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
