import type { ReactNode } from "react";
import { Flask } from "../ui/icons";
import { cx } from "../../lib/format";
import { IS_MOCK } from "../../config";

export interface BadgeProps {
  children: ReactNode;
  variant?: "neutral" | "ok" | "warn" | "bad" | "brand";
  size?: "sm" | "md";
  className?: string;
  icon?: ReactNode;
}

const VARIANTS = {
  neutral: "bg-line-soft text-muted border-line",
  ok: "bg-ok-tint text-ok border-ok/20",
  warn: "bg-warn-tint text-warn border-warn/20",
  bad: "bg-bad-tint text-bad border-bad/20",
  brand: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
};

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className,
  icon,
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold select-none",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        VARIANTS[variant],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function DemoBadge() {
  if (!IS_MOCK) return null;
  return (
    <span
      title="Cifras ficticias de la semilla de demostración. No son datos de Corpotex."
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-muted"
    >
      <Flask size={14} weight="bold" />
      Datos de demostración
    </span>
  );
}
