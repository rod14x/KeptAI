import type { ReactNode } from "react";
import { Check } from "../ui/icons";
import { cx, formatDate } from "../../lib/format";

export interface LifecycleStep {
  key: string;
  title: string;
  status: "completed" | "current" | "pending" | "alert";
  subtitle?: string;
  date?: string | null;
  actor?: string | null;
  icon?: ReactNode;
}

export interface OrderLifecycleBarProps {
  steps: LifecycleStep[];
  className?: string;
}

export function OrderLifecycleBar({ steps, className }: OrderLifecycleBarProps) {
  return (
    <div className={cx("rounded-xl border border-line bg-card p-4 sm:p-5 shadow-soft", className)}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
        Trazabilidad del Pedido (Order-to-Cash)
      </h3>

      <div className="relative">
        {/* Línea conectora */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-line hidden sm:block" />

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {steps.map((step, idx) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";
            const isAlert = step.status === "alert";

            return (
              <div key={step.key} className="relative flex flex-row sm:flex-col items-start gap-3 z-10">
                {/* Círculo indicador */}
                <div
                  className={cx(
                    "size-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all",
                    isCompleted
                      ? "bg-ok text-inverse ring-4 ring-ok-tint"
                      : isCurrent
                        ? "bg-brand-blue text-inverse ring-4 ring-brand-blue/20 animate-pulse"
                        : isAlert
                          ? "bg-bad text-inverse ring-4 ring-bad-tint"
                          : "bg-panel text-muted border border-line"
                  )}
                >
                  {isCompleted ? (
                    <Check size={14} weight="bold" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Textos del paso */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cx(
                      "text-sm font-bold truncate",
                      isCurrent ? "text-brand-blue" : isCompleted ? "text-ink" : "text-muted"
                    )}
                  >
                    {step.title}
                  </p>

                  {step.subtitle && (
                    <p className="text-xs text-muted mt-0.5 leading-snug">
                      {step.subtitle}
                    </p>
                  )}

                  {(step.actor || step.date) && (
                    <p className="text-[11px] text-faint mt-1 tabular">
                      {[step.actor, step.date && formatDate(step.date)].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
