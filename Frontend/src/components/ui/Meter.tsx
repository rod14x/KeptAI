import { motion } from "motion/react";
import { softSpring } from "../motion/primitives";
import { cx } from "../../lib/format";

const TONE = { violet: "bg-violet", warn: "bg-brand-yellow", bad: "bg-bad", ok: "bg-series-in" } as const;

/** Barra de proporción. Crece con scaleX desde la izquierda (GPU), nunca animando el ancho. */
export function Meter({ value, tone, label, thick, track = true }: { value: number; tone?: keyof typeof TONE; label?: string; thick?: boolean; track?: boolean }) {
  const v = Math.max(Math.min(value, 1), 0.02);
  const auto = value > 1 ? "bad" : value > 0.75 ? "warn" : "violet";
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cx("block overflow-hidden rounded-full", thick ? "h-3" : "h-1.5", track && "bg-line-soft")}
    >
      <motion.span
        className={cx("block h-full w-full origin-left rounded-full", TONE[tone ?? auto])}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: v }}
        transition={softSpring}
      />
    </span>
  );
}
