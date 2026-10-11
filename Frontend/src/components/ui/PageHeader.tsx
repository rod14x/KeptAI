import type { ReactNode } from "react";
import { Item } from "../motion/primitives";

/** Encabezado de página: título fluido, contexto en una línea y acciones agrupadas a la derecha. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Item className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-title font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Item>
  );
}
