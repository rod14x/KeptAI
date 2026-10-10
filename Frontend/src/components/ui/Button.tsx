import type { ComponentProps, ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cx } from "../../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "violet" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft disabled:bg-[#b9b8bd]",
  violet: "bg-violet text-white hover:bg-violet-ink disabled:bg-[#c9bdf0]",
  secondary: "bg-card text-ink ring-1 ring-line hover:bg-panel hover:ring-[#d8d6d0] disabled:text-faint",
  ghost: "text-muted hover:bg-line-soft hover:text-ink disabled:text-faint",
  danger: "bg-card text-bad ring-1 ring-[#f0c9c4] hover:bg-bad-tint disabled:text-faint",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" | "lg"; icon?: ReactNode; loading?: boolean }) {
  const sizes = size === "sm" ? "h-9 px-3.5 text-[13px]" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-11 px-5 text-sm";
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] disabled:active:scale-100",
        sizes,
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
