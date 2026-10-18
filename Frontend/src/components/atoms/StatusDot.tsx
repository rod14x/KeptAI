import { cx } from "../../lib/format";

export type StatusDotTone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";

const DOT_TONES: Record<StatusDotTone, { dot: string; ping?: string }> = {
  ok: { dot: "bg-ok", ping: "bg-ok" },
  warn: { dot: "bg-warn", ping: "bg-warn" },
  bad: { dot: "bg-bad", ping: "bg-bad" },
  info: { dot: "bg-info", ping: "bg-info" },
  brand: { dot: "bg-brand-blue", ping: "bg-brand-blue" },
  neutral: { dot: "bg-faint" },
};

export interface StatusDotProps {
  tone?: StatusDotTone;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}

const SIZES = {
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2.5",
};

export function StatusDot({
  tone = "neutral",
  pulse = false,
  size = "md",
  className,
  title,
}: StatusDotProps) {
  const current = DOT_TONES[tone];
  return (
    <span className={cx("relative inline-flex items-center justify-center shrink-0", SIZES[size], className)} title={title}>
      {pulse && current.ping && (
        <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", current.ping)} />
      )}
      <span className={cx("relative inline-flex rounded-full", SIZES[size], current.dot)} />
    </span>
  );
}
