import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

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
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-rise pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-[var(--shadow-lift)]"
          >
            {t.ok ? <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-[#7fd6a9]" /> : <WarningCircle size={18} weight="fill" className="mt-px shrink-0 text-[#f2a39b]" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
