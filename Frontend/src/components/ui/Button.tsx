import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { CircleNotch } from "./icons";
import { spring } from "../motion/primitives";
import { cx } from "../../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "violet" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-action text-inverse hover:bg-action-hover disabled:opacity-50",
  violet: "bg-action text-inverse hover:bg-action-hover disabled:opacity-50",
  secondary: "bg-card text-ink ring-1 ring-line hover:bg-panel disabled:text-faint",
  ghost: "text-muted hover:bg-line-soft hover:text-ink disabled:text-faint",
  danger: "bg-card text-bad ring-1 ring-bad/30 hover:bg-bad-tint disabled:text-faint",
};

// 2.4. Ergonomía de Componentes: Botones
// sm: Altura 36px (h-9), padding px-3, texto text-sm.
// default / md: Altura 40px (h-10), padding px-4 py-2, texto text-sm.
// lg: Altura 44px (h-11), padding px-8, texto text-base.
// icon: 40px × 40px (h-10 w-10).
const SIZES = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 py-2 text-sm",
  default: "h-10 px-4 py-2 text-sm",
  lg: "h-11 px-8 text-base",
  icon: "size-10 p-0 text-sm",
} as const;

const TAP = { scale: 0.97 };

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: HTMLMotionProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES; icon?: ReactNode; loading?: boolean; children?: ReactNode }) {
  const off = disabled || loading;
  return (
    <motion.button
      {...rest}
      disabled={off}
      aria-busy={loading || undefined}
      whileTap={off ? undefined : TAP}
      transition={spring}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors duration-150 disabled:pointer-events-none",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : icon}
      {children}
    </motion.button>
  );
}
