import type { ReactNode } from "react";
import { cx } from "../../lib/format";

/**
 * 2.4. Icon Circles:
 * Círculos estándar de 40px × 40px (w-10 h-10 rounded-full flex items-center justify-center).
 */
export function IconCircle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("size-10 rounded-full flex items-center justify-center shrink-0", className)}>
      {children}
    </div>
  );
}
