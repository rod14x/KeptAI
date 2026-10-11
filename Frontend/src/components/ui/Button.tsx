import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { CircleNotch } from "./icons";
import { spring } from "../motion/primitives";
import { cx } from "../../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "violet" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-[0_1px_2px_rgb(23_23_26/0.2),inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-ink-soft disabled:bg-[#b9b8bd] disabled:shadow-none",
  violet: "bg-violet text-white shadow-[0_6px_16px_-8px_rgb(124_92_219/0.8)] hover:bg-violet-ink disabled:bg-[#c9bdf0] disabled:shadow-none",
  secondary: "bg-card text-ink ring-1 ring-line shadow-[0_1px_2px_rgb(23_23_26/0.04)] hover:bg-panel hover:ring-[#d8d6d0] disabled:text-faint",
  ghost: "text-muted hover:bg-line-soft hover:text-ink disabled:text-faint",
  danger: "bg-card text-bad ring-1 ring-[#f0c9c4] hover:bg-bad-tint disabled:text-faint",
};

// Alturas pensadas para la ley de Fitts: 40px el más pequeño, 48px el principal.
const SIZES = { sm: "h-10 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" } as const;

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
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors duration-200",
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
