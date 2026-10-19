import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { motion } from "motion/react";
import { spring } from "../motion/primitives";
import { ArrowCounterClockwise, Bell, ChartPieSlice, Factory, Kanban, Receipt, SquaresFour, Tray, UploadSimple, UsersThree } from "../ui/icons";
import type { Role } from "../../api/model";
import { Logo } from "./Logo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { capabilities, commands } from "../../api/client";
import { isModuleAvailable } from "../../lib/availability";
import { cx } from "../../lib/format";
import { ROLE_LABEL } from "../../lib/permissions";
import { IS_MOCK } from "../../config";

export type NavItem = { to: string; label: string; icon: typeof SquaresFour; end: boolean; module: import("../../lib/availability").ModuleKey };

const PENDIENTES: NavItem = { to: "/", label: "Pendientes", icon: Tray, end: true, module: "inicio" };
const INICIO: NavItem = { to: "/", label: "Inicio", icon: SquaresFour, end: true, module: "inicio" };
const PEDIDOS: NavItem = { to: "/pedidos", label: "Pedidos", icon: Kanban, end: false, module: "pedidos" };
const CLIENTES: NavItem = { to: "/clientes", label: "Clientes", icon: UsersThree, end: false, module: "clientes" };
const PAGOS: NavItem = { to: "/conciliacion", label: "Pagos", icon: Receipt, end: false, module: "conciliacion" };
const COBRANZA: NavItem = { to: "/cobranza", label: "Cobranza", icon: Bell, end: false, module: "cobranza" };
const RESULTADO: NavItem = { to: "/resultado", label: "Resultado", icon: ChartPieSlice, end: false, module: "resultado" };
const TALLER: NavItem = { to: "/taller", label: "Taller", icon: Factory, end: false, module: "taller" };
const CAPTURA: NavItem = { to: "/captura", label: "Carga manual", icon: UploadSimple, end: false, module: "captura" };

/**
 * Menú unificado por rol (Fase 0):
 * - /taller visible para jefe_taller, administracion, vendedor, gerencia.
 * - /captura visible para administracion y vendedor.
 */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  vendedor: [PENDIENTES, PEDIDOS, CLIENTES, TALLER, CAPTURA],
  administracion: [PENDIENTES, PAGOS, COBRANZA, PEDIDOS, TALLER, CAPTURA],
  gerencia: [INICIO, RESULTADO, PEDIDOS, CLIENTES, TALLER],
  jefe_taller: [TALLER],
};

const EXTRA_LABELS: Array<[string, string]> = [
  ["/perfil", "Perfil"],
  ["/taller", "Taller"],
  ["/captura", "Carga manual"],
  ["/resumen", "Resumen"],
  ["/conciliacion", "Pagos"],
  ["/cobranza", "Cobranza"],
  ["/clientes", "Clientes"],
  ["/pedidos", "Pedidos"],
  ["/resultado", "Resultado"],
];

/** Nombre de la sección actual para la ruta del encabezado. */
export function sectionLabel(pathname: string, role: Role | undefined) {
  const own = (role ? NAV_BY_ROLE[role] : []).find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  if (own) return own.label;
  return EXTRA_LABELS.find(([p]) => pathname.startsWith(p))?.[1] ?? "Inicio";
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { person } = useAuth();
  const toast = useToast();
  const items = person ? NAV_BY_ROLE[person.role] : [];
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Ajuste de threshold y rootMargin del IntersectionObserver para evitar
  // que "Pedidos" o cualquier otra sección dispare un estado activo falso al hacer scroll vertical.
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const sectionIds = ["pedidos", "clientes", "conciliacion", "cobranza", "resultado", "taller"];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) {
      setActiveSection(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActiveSection(entry.target.id);
          }
        }
      },
      {
        threshold: [0.6],
        rootMargin: "-20% 0px -40% 0px",
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const isItemActive = (to: string, routerActive: boolean) => {
    if (activeSection) {
      return to.replace("/", "") === activeSection;
    }
    return routerActive;
  };

  return (
    <div className="flex min-h-full flex-col px-4 pb-5 pt-5">
      <div className="px-2">
        <Logo subtitle={false} />
      </div>

      <div className="mx-2 mb-5 mt-9 border-b border-line pb-4">
        <p className="text-sm font-semibold">Espacio de trabajo</p>
        <p className="mt-1 text-xs text-muted">{person && ROLE_LABEL[person.role]}</p>
      </div>
      <nav aria-label="Principal" className="mt-8 flex flex-col gap-1">
        <p className="px-3 pb-2 text-xs font-semibold text-faint">Menú</p>
        {items.map(({ to, label, icon: Icon, end, module }) =>
          !isModuleAvailable(module) ? (
            // Módulo pendiente: no es un enlace, no navega ni dispara cargas.
            <span
              key={to}
              aria-disabled="true"
              title="Aún no disponible: depende de un endpoint del backend pendiente"
              className="flex h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-sm font-semibold text-faint"
            >
              <Icon size={20} />
              <span>{label}</span>
              <span className="ml-auto text-[11px] font-semibold">Pronto</span>
            </span>
          ) : (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => {
              const active = isItemActive(to, isActive);
              return cx(
                "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                active ? "font-semibold text-violet-ink" : "text-muted hover:bg-panel hover:text-ink",
              );
            }}
          >
            {({ isActive }) => {
              const active = isItemActive(to, isActive);
              return (
                <>
                  {active && (
                    <motion.span
                      layoutId={onNavigate ? "nav-active-drawer" : "nav-active"}
                      transition={spring}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-lg bg-violet-tint"
                    />
                  )}
                  <Icon size={20} weight={active ? "duotone" : "regular"} className="relative z-10" />
                  <span className="relative z-10">{label}</span>
                </>
              );
            }}
          </NavLink>
          ),
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-12">
        <div className="mx-2 border-t border-line pt-4">
          <p className="text-xs font-semibold text-muted">{IS_MOCK ? "Entorno de demostración" : "KeptAI · Cobros y caja"}</p>
          <p className="mt-1 text-xs leading-relaxed text-faint">{IS_MOCK ? "Los datos son ficticios." : "Cada pago, con su evidencia."}</p>
        </div>
        {IS_MOCK && capabilities.resetDemo && (
          <button
            onClick={async () => {
              const r = await commands.reset();
              toast(r.ok, r.message);
            }}
            className="flex h-11 items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink"
          >
            <ArrowCounterClockwise size={18} />
            Reiniciar demo
          </button>
        )}
      </div>
    </div>
  );
}
