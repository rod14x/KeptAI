import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { itemVariants } from "../motion/primitives";
import { ArrowClockwise, CloudSlash, Flask, Tray } from "./icons";
import { Button } from "./Button";
import { cx, formatMoney } from "../../lib/format";

/** Superficie elevada. Hereda la entrada escalonada del Stagger más cercano. */
export function Card({ className, ...rest }: HTMLMotionProps<"div">) {
  return <motion.div variants={itemVariants} {...rest} className={cx("rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)] ring-1 ring-line/70", className)} />;
}

export function Money({ cents, className, signed, short }: { cents: number | null; className?: string; signed?: boolean; short?: boolean }) {
  return (
    <span className={cx("tabular whitespace-nowrap", className)} title={cents == null ? "Sin dato: la fuente aún no lo provee o el costeo está incompleto" : undefined}>
      {formatMoney(cents, { signed, short })}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("skeleton rounded-xl", className)} />;
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
      <span className="text-faint">{icon ?? <Tray size={28} />}</span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <p className="max-w-[34ch] text-[13px] leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-card px-6 py-12 text-center ring-1 ring-line">
      <span className="flex size-12 items-center justify-center rounded-full bg-bad-tint text-bad">
        <CloudSlash size={24} weight="bold" />
      </span>
      <div>
        <p className="font-semibold">No pudimos cargar la información</p>
        <p className="mt-1 text-sm text-muted">{error.message} Tus datos no se modificaron.</p>
      </div>
      <Button variant="secondary" size="sm" icon={<ArrowClockwise size={16} weight="bold" />} onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

export function DemoBadge() {
  return (
    <span
      title="Cifras ficticias de la semilla de demostración. No son datos de Corpotex."
      className="inline-flex items-center gap-1.5 rounded-full bg-warn-tint px-3 py-1 text-xs font-semibold text-warn"
    >
      <Flask size={14} weight="bold" />
      Datos de demostración
    </span>
  );
}
