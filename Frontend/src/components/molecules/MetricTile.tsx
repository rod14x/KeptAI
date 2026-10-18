import type { ReactNode } from "react";
import { motion } from "motion/react";
import { MoneyText, type MoneyTextProps } from "../atoms/MoneyText";
import { StatusDot, type StatusDotTone } from "../atoms/StatusDot";
import { itemVariants } from "../motion/primitives";
import { cx } from "../../lib/format";

export interface MetricTileProps {
  label: string;
  amountCents?: number | null;
  count?: number;
  subtext?: ReactNode;
  icon?: ReactNode;
  tone?: MoneyTextProps["tone"];
  dotTone?: StatusDotTone;
  className?: string;
  onClick?: () => void;
}

export function MetricTile({
  label,
  amountCents,
  count,
  subtext,
  icon,
  tone = "default",
  dotTone,
  className,
  onClick,
}: MetricTileProps) {
  return (
    <motion.div
      variants={itemVariants}
      onClick={onClick}
      className={cx(
        "flex flex-col justify-between rounded-xl border border-line bg-card p-5 transition-all shadow-soft",
        onClick && "cursor-pointer hover:border-brand-blue/40 hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          {dotTone && <StatusDot tone={dotTone} pulse={dotTone === "warn" || dotTone === "bad"} />}
          {label}
        </span>
        {icon && <span className="text-muted/70">{icon}</span>}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        {amountCents !== undefined && (
          <MoneyText cents={amountCents} size="2xl" tone={tone} />
        )}
        {count !== undefined && (
          <span className="tabular text-3xl font-extrabold text-ink tracking-tight">
            {count}
          </span>
        )}
      </div>

      {subtext && (
        <div className="mt-2 text-xs text-muted leading-relaxed">
          {subtext}
        </div>
      )}
    </motion.div>
  );
}
