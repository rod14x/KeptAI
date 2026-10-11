import { cx } from "../../lib/format";

// Marca provisional: nombre del producto en texto con monograma. Pendiente de logo definitivo.
export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-[11px] bg-ink text-[15px] font-extrabold text-white">K</span>
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-tight">KeptAI</span>
        {subtitle && <span className="mt-1 text-[11px] font-medium text-muted">Cobros y caja con evidencia</span>}
      </span>
    </span>
  );
}
