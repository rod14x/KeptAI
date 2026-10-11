import { cx } from "../../lib/format";

// Marca oficial: isotipo de assets/ (copias web en public/brand) y nombre en texto para que se adapte al tema.
export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <img src="/brand/isotipo-128.png" alt="" width={36} height={36} className="size-9 shrink-0" decoding="async" />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-extrabold tracking-tight" aria-label="KeptAI">
          <span className="text-brand-word">Kept</span><span className="text-brand-yellow">AI</span>
        </span>
        {subtitle && <span className="mt-1 text-[11px] font-medium text-muted">Cobros y caja con evidencia</span>}
      </span>
    </span>
  );
}
