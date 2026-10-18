import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { CircleNotch } from "../ui/icons";
import { spring } from "../motion/primitives";
import { cx } from "../../lib/format";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "violet" | "danger";
export type ButtonSize = "sm" | "md" | "default" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-action text-inverse hover:bg-action-hover disabled:opacity-50 shadow-sm",
  violet: "bg-action text-inverse hover:bg-action-hover disabled:opacity-50 shadow-sm",
  secondary: "bg-card text-ink ring-1 ring-line hover:bg-panel disabled:text-faint",
  ghost: "text-muted hover:bg-line-soft hover:text-ink disabled:text-faint",
  danger: "bg-card text-bad ring-1 ring-bad/30 hover:bg-bad-tint disabled:text-faint",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 py-2 text-sm",
  default: "h-10 px-4 py-2 text-sm",
  lg: "h-11 px-8 text-base",
  icon: "size-10 p-0 text-sm pointer-coarse:min-w-11",
};

const TAP = { scale: 0.97 };

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const off = disabled || loading;
  return (
    <motion.button
      {...rest}
      disabled={off}
      aria-busy={loading || undefined}
      whileTap={off ? undefined : TAP}
      transition={spring}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors duration-150 disabled:pointer-events-none pointer-coarse:min-h-11 cursor-pointer",
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
