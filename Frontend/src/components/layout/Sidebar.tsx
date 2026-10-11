import { NavLink } from "react-router";
import { motion } from "motion/react";
import { spring } from "../motion/primitives";
import { ArrowCounterClockwise, Bell, ChartPieSlice, Kanban, Receipt, SquaresFour, Tray, UsersThree } from "../ui/icons";
import type { Role } from "../../api/model";
import { Logo } from "./Logo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { capabilities, commands } from "../../api/client";
import { cx } from "../../lib/format";

type NavItem = { to: string; label: string; icon: typeof SquaresFour; end: boolean };

const PENDIENTES: NavItem = { to: "/", label: "Pendientes", icon: Tray, end: true };
const INICIO: NavItem = { to: "/", label: "Inicio", icon: SquaresFour, end: true };
const PEDIDOS: NavItem = { to: "/pedidos", label: "Pedidos", icon: Kanban, end: false };
const CLIENTES: NavItem = { to: "/clientes", label: "Clientes", icon: UsersThree, end: false };
const PAGOS: NavItem = { to: "/conciliacion", label: "Pagos", icon: Receipt, end: false };
const COBRANZA: NavItem = { to: "/cobranza", label: "Cobranza", icon: Bell, end: false };
const RESULTADO: NavItem = { to: "/resultado", label: "Resultado", icon: ChartPieSlice, end: false };

/**
 * Menú corto por rol (ley de Hick): solo lo que cada rol usa a diario, máximo cuatro opciones.
 * Las demás rutas siguen existiendo y se abren desde Pendientes o desde un botón dentro de la pantalla.
 * El Jefe de taller tiene una sola pantalla: sin menú.
 */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  vendedor: [PENDIENTES, PEDIDOS, CLIENTES],
  administracion: [PENDIENTES, PAGOS, COBRANZA, PEDIDOS],
  gerencia: [INICIO, RESULTADO, PEDIDOS, CLIENTES],
  jefe_taller: [],
};

const EXTRA_LABELS: Array<[string, string]> = [
  ["/perfil", "Perfil"],
  ["/taller", "Taller"],
  ["/captura", "Subir comprobante"],
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

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      <div className="px-2">
        <Logo />
      </div>

      <nav aria-label="Principal" className="mt-8 flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-200",
                isActive ? "text-ink" : "text-muted hover:bg-line-soft hover:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId={onNavigate ? "nav-active-drawer" : "nav-active"}
                    transition={spring}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-xl bg-card shadow-[0_1px_3px_rgb(23_23_26/0.08)] ring-1 ring-line/70"
                  />
                )}
                <Icon size={20} weight={isActive ? "fill" : "regular"} className={cx("relative z-10", isActive && "text-violet")} />
                <span className="relative z-10">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {capabilities.resetDemo && (
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
