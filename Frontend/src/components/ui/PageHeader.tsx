import type { ReactNode } from "react";
import { Item } from "../motion/primitives";

/** Encabezado de página: título fluido, contexto en una línea y acciones agrupadas a la derecha. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Item className="page-heading flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-title font-extrabold">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </Item>
  );
}
