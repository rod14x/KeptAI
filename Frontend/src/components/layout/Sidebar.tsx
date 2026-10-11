import { NavLink } from "react-router";
import { motion } from "motion/react";
import { spring } from "../motion/primitives";
import { ArrowCounterClockwise, Bell, ChartPieSlice, Factory, Kanban, Receipt, SquaresFour, UploadSimple, UsersThree } from "@phosphor-icons/react";
import type { Role } from "../../api/schemas";
import { Logo } from "./Logo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { actions } from "../../api/store";
import { can } from "../../lib/permissions";
import { cx } from "../../lib/format";

export const NAV: Array<{ to: string; label: string; icon: typeof SquaresFour; end: boolean; show?: (r: Role) => boolean }> = [
  { to: "/", label: "Dashboard", icon: SquaresFour, end: true, show: (r) => can(r, "ver_comercial") },
  { to: "/pedidos", label: "Pedidos", icon: Kanban, end: false, show: (r) => can(r, "ver_comercial") },
  { to: "/clientes", label: "Clientes", icon: UsersThree, end: false, show: (r) => can(r, "ver_comercial") },
  { to: "/conciliacion", label: "Conciliación", icon: Receipt, end: false, show: (r) => can(r, "verificar") || can(r, "ver_resultado") },
  { to: "/cobranza", label: "Cobranza", icon: Bell, end: false, show: (r) => can(r, "gestionar_cobranza") || can(r, "ver_resultado") },
  { to: "/taller", label: "Taller", icon: Factory, end: false, show: (r) => can(r, "registrar_despacho") || can(r, "ver_resultado") },
  { to: "/captura", label: "Carga manual", icon: UploadSimple, end: false, show: (r) => can(r, "captura") },
  { to: "/resultado", label: "Resultado", icon: ChartPieSlice, end: false, show: (r) => can(r, "ver_resultado") },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { person } = useAuth();
  const toast = useToast();
  const items = NAV.filter((n) => !n.show || (person && n.show(person.role)));

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      <div className="px-2">
        <Logo />
      </div>

      <nav aria-label="Principal" className="mt-8 flex flex-col gap-1">
        <p className="px-3 pb-2 text-xs font-semibold text-faint">Menú</p>
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
        <button
          onClick={() => {
            const r = actions.reset();
            toast(r.ok, r.message);
          }}
          className="flex h-11 items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink"
        >
          <ArrowCounterClockwise size={18} />
          Reiniciar demo
        </button>
      </div>
    </div>
  );
}
