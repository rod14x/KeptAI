import { NavLink } from "react-router";
import { motion } from "motion/react";
import { spring } from "../motion/primitives";
import { ArrowCounterClockwise } from "../ui/icons";
import { Logo } from "./Logo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { capabilities, commands } from "../../api/client";
import { isModuleAvailable } from "../../lib/availability";
import { NAV } from "./nav";
import { cx } from "../../lib/format";

export { NAV };

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
        {items.map(({ to, label, icon: Icon, end, module }) =>
          !isModuleAvailable(module) ? (
            // Módulo pendiente: no es un enlace, no navega ni dispara cargas.
            <span
              key={to}
              aria-disabled="true"
              title="Aún no disponible: depende de endpoints del backend pendientes"
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
          ),
        )}
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
