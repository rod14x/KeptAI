import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { dialogVariants, overlayVariants } from "../motion/primitives";
import { cx } from "../../lib/format";

/**
 * Base de todos los diálogos: overlay, panel animado (entrada y salida), foco inicial,
 * Escape para cerrar y devolución del foco al elemento que lo abrió.
 */
export function DialogShell({
  open,
  onClose,
  labelledBy,
  children,
  panelClassName,
  overlayClassName,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  panelClassName?: string;
  overlayClassName?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Solo depende de `open`: depender de onClose robaría el foco en cada render del formulario.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const target =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.current?.querySelector<HTMLElement>("input, select, textarea") ??
      panel.current?.querySelector<HTMLElement>("button");
    target?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? [])].filter((node) => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dialog"
          className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.button
            aria-label="Cerrar"
            tabIndex={-1}
            variants={overlayVariants}
            onClick={() => closeRef.current()}
            className={cx("absolute inset-0 bg-navy/60", overlayClassName)}
          />
          <motion.div
            ref={panel}
            variants={dialogVariants}
            className={cx(
              "relative max-h-[92dvh] w-full overflow-y-auto rounded-lg bg-card shadow-[var(--shadow-lift)]",
              panelClassName,
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
