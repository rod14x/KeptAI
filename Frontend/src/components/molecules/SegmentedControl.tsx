import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "../motion/primitives";
import { cx } from "../../lib/format";

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (val: T) => void;
  options: Array<Option<T>>;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "inline-flex items-center rounded-lg bg-panel p-1 ring-1 ring-line/80",
        size === "sm" ? "h-9 text-xs" : "h-11 text-sm",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-md px-3 font-semibold transition-colors select-none cursor-pointer",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
              active ? "text-ink" : "text-muted hover:text-ink"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className="absolute inset-0 z-[-1] rounded-md bg-card shadow-sm ring-1 ring-line"
              />
            )}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cx(
                  "tabular ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  active ? "bg-brand-blue/10 text-brand-blue" : "bg-line text-muted"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
