import type { ReactNode } from "react";
import { X } from "./icons";
import { DialogShell } from "./Dialog";

export function Modal({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <DialogShell open={open} onClose={onClose} labelledBy="modal-title" panelClassName="max-w-lg p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="modal-title" className="text-section font-bold">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-line-soft hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <div className="mt-5">{children}</div>
    </DialogShell>
  );
}

export const inputClass =
  "h-10 w-full rounded-md bg-panel px-3 py-2 text-sm font-medium border border-line outline-none transition-shadow placeholder:text-faint focus:bg-card focus:border-violet focus:ring-1 focus:ring-violet";
