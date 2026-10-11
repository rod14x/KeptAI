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
      className={cx("no-scrollbar relative flex max-w-full gap-1 overflow-x-auto rounded-full p-1", solid ? "" : "bg-line-soft ring-1 ring-line/60", className ?? "inline-flex")}
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
            onClick={() => onChange(o.value)}
            className={cx(
              "relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors duration-200",
              size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-10 px-4 text-sm",
              solid && !active && "bg-line-soft",
              active ? (solid ? "text-white" : "text-ink") : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                aria-hidden="true"
                className={cx("absolute inset-0 rounded-full", solid ? "bg-ink" : "bg-card shadow-[0_1px_3px_rgb(23_23_26/0.12)]")}
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
