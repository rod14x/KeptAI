import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "../motion/primitives";
import { cx } from "../../lib/format";

export type SegmentOption<T extends string> = { value: T; label: ReactNode; count?: number };

/**
 * Control segmentado único para filtros, vistas y pestañas. El indicador activo se desliza
 * con layoutId (transform), así el ojo sigue el cambio sin animar anchos ni márgenes.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  kind = "radio",
  tone = "light",
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  kind?: "radio" | "tab";
  tone?: "light" | "solid";
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const solid = tone === "solid";
  return (
    <div
      role={kind === "tab" ? "tablist" : "radiogroup"}
      aria-label={label}
      className={cx("no-scrollbar relative flex max-w-full gap-1 overflow-x-auto rounded-lg p-1", solid ? "" : "bg-line-soft", className ?? "inline-flex")}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={kind === "tab" ? "tab" : "radio"}
            aria-checked={kind === "radio" ? active : undefined}
            aria-selected={kind === "tab" ? active : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const index = options.indexOf(o);
              const next = e.key === "ArrowRight" ? (index + 1) % options.length : e.key === "ArrowLeft" ? (index - 1 + options.length) % options.length : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : -1;
              if (next < 0) return;
              e.preventDefault();
              onChange(options[next].value);
              (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
            }}
            className={cx(
              "relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors duration-150",
              size === "sm" ? "h-11 px-3.5 text-[13px]" : "h-11 px-4 text-sm",
              solid && !active && "bg-line-soft",
              active ? (solid ? "text-inverse" : "text-ink") : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                aria-hidden="true"
                className={cx("absolute inset-0 rounded-md", solid ? "bg-action" : "bg-card shadow-[var(--shadow-card)]")}
              />
            )}
            <span className="relative z-10">{o.label}</span>
            {o.count !== undefined && (
              <span className={cx("tabular relative z-10 rounded-full px-1.5 text-[11px]", active && solid ? "bg-white/20" : "bg-card")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
