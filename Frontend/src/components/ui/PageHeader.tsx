import type { ReactNode } from "react";
import { Item } from "../motion/primitives";

/** Encabezado de página: título fluido, contexto en una línea y acciones agrupadas a la derecha. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Item className="page-heading flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-title font-extrabold">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions flex min-w-0 flex-wrap items-center gap-2 lg:max-w-[48%] lg:justify-end">{actions}</div>}
    </Item>
  );
}
