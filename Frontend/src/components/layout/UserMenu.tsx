import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CaretDown, ClockCounterClockwise, GearSix, SignOut, SlidersHorizontal, UserCircle } from "@phosphor-icons/react";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABEL } from "../../lib/permissions";
import { cx } from "../../lib/format";

const ITEMS = [
  { to: "/perfil", label: "Mi perfil", icon: UserCircle },
  { to: "/perfil?tab=actividad", label: "Mi actividad", icon: ClockCounterClockwise },
  { to: "/perfil?tab=preferencias", label: "Preferencias", icon: SlidersHorizontal },
  { to: "/perfil?tab=configuracion", label: "Configuración", icon: GearSix },
];

export function UserMenu() {
  const { person, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!person) return null;

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  // Flechas arriba/abajo recorren las opciones del menú.
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = items.current.filter(Boolean) as HTMLButtonElement[];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${person.name}`}
        className={cx(
          "flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition-colors hover:bg-line-soft",
          open && "bg-line-soft",
        )}
      >
        <Avatar name={person.name} size="lg" />
        <CaretDown size={14} weight="bold" className={cx("text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Cuenta"
          onKeyDown={onMenuKey}
          className="animate-fade absolute right-0 top-[calc(100%+8px)] z-40 w-72 overflow-hidden rounded-[20px] bg-card p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-line"
        >
          <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
            <Avatar name={person.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{person.name}</p>
              <p className="truncate text-xs text-muted">{person.email}</p>
              <span className="mt-1 inline-flex rounded-full bg-violet-tint px-2 py-0.5 text-[11px] font-semibold text-violet-ink">{ROLE_LABEL[person.role]}</span>
            </div>
          </div>
          <div className="my-1 h-px bg-line-soft" />
          {ITEMS.map(({ to, label, icon: Icon }, i) => (
            <button
              key={to}
              ref={(el) => {
                items.current[i] = el;
              }}
              role="menuitem"
              onClick={() => go(to)}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-ink-soft outline-none hover:bg-panel focus-visible:bg-violet-wash"
            >
              <Icon size={18} className="text-muted" />
              {label}
            </button>
          ))}
          <div className="my-1 h-px bg-line-soft" />
          <button
            ref={(el) => {
              items.current[ITEMS.length] = el;
            }}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-bad outline-none hover:bg-bad-tint focus-visible:bg-bad-tint"
          >
            <SignOut size={18} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
