import { useEffect, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

export function Modal({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Solo al abrir: enfocar el primer campo y escuchar Escape. Depender de onClose
  // haría que el foco salte en cada render del formulario.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    (panel.current?.querySelector<HTMLElement>("input, select, textarea") ?? panel.current?.querySelector<HTMLElement>("button"))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button aria-label="Cerrar" tabIndex={-1} className="animate-fade absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} className="animate-rise relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-card p-6 shadow-[var(--shadow-lift)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-[var(--radius-block)] bg-panel px-3.5 text-sm font-medium outline-none ring-1 ring-line transition-shadow placeholder:text-faint focus:bg-card focus:ring-2 focus:ring-violet";
