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

// Alturas pensadas para la ley de Fitts: 40px el más pequeño, 48px el principal.
const SIZES = { sm: "h-11 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" } as const;

const HOVER = { y: -1 };
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
      whileHover={off ? undefined : HOVER}
      whileTap={off ? undefined : TAP}
      transition={spring}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150",
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
