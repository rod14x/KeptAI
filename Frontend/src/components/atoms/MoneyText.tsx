import { cx, formatMoney } from "../../lib/format";

export interface MoneyTextProps {
  cents: number | null | undefined;
  className?: string;
  signed?: boolean;
  short?: boolean;
  tone?: "default" | "ok" | "bad" | "warn" | "auto";
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
}

const TONES = {
  default: "text-ink",
  ok: "text-ok",
  bad: "text-bad",
  warn: "text-warn",
};

const SIZES = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg font-bold",
  xl: "text-xl font-extrabold",
  "2xl": "text-2xl font-extrabold tracking-tight",
  "3xl": "text-3xl font-black tracking-tight",
};

export function MoneyText({
  cents,
  className,
  signed,
  short,
  tone = "default",
  size = "base",
}: MoneyTextProps) {
  if (cents == null) {
    return (
      <span
        className={cx("tabular whitespace-nowrap text-faint font-semibold", SIZES[size], className)}
        title="Sin dato: la fuente aún no lo provee o el costeo está incompleto"
      >
        S/ —
      </span>
    );
  }

  const computedTone =
    tone === "auto"
      ? cents > 0
        ? "text-ok"
        : cents < 0
          ? "text-bad"
          : "text-ink"
      : TONES[tone];

  return (
    <span
      className={cx(
        "tabular whitespace-nowrap font-semibold",
        computedTone,
        SIZES[size],
        className
      )}
    >
      {formatMoney(cents, { signed, short })}
    </span>
  );
}
