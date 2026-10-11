import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, WarningCircle } from "../components/ui/icons";
import { spring } from "../components/motion/primitives";

const TOAST_IN = { opacity: 0, y: 16, scale: 0.96 };
const TOAST_SHOW = { opacity: 1, y: 0, scale: 1 };
const TOAST_OUT = { opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } };

type Toast = { id: number; ok: boolean; message: string };
const ToastContext = createContext<(ok: boolean, message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((ok: boolean, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, ok, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              role="status"
              initial={TOAST_IN}
              animate={TOAST_SHOW}
              exit={TOAST_OUT}
              transition={spring}
              className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-[var(--shadow-lift)]"
            >
              {t.ok ? <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-[#7fd6a9]" /> : <WarningCircle size={18} weight="fill" className="mt-px shrink-0 text-[#f2a39b]" />}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
