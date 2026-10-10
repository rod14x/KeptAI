import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeekPoint } from "../../api/client";
import { cx, formatMoney } from "../../lib/format";

const IN = "#2e9e6b";
const OUT = "#8466dd";
const Y_AXIS_WIDTH = 64;

type Row = WeekPoint & { in: number; out: number };

function TooltipBox({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="min-w-52 rounded-2xl bg-card p-3.5 text-[13px] shadow-[var(--shadow-lift)] ring-1 ring-line">
      <p className="font-semibold">
        {r.label} <span className="font-normal text-muted">· {r.range}</span>
      </p>
      <dl className="tabular mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="flex items-center gap-2 text-muted">
          <span className="size-2.5 rounded-full" style={{ background: IN }} /> Cobros esperados
        </dt>
        <dd className="text-right font-semibold">{formatMoney(r.inCents)}</dd>
        <dt className="flex items-center gap-2 text-muted">
          <span className="size-2.5 rounded-full" style={{ background: OUT }} /> Obligaciones
        </dt>
        <dd className="text-right font-semibold">{formatMoney(r.outCents)}</dd>
        <dt className="text-muted">Saldo al cierre</dt>
        <dd className={cx("text-right font-bold", r.balanceCents < 0 && "text-bad")}>{formatMoney(r.balanceCents)}</dd>
      </dl>
      {r.outflows.length > 0 && <p className="mt-2 border-t border-line-soft pt-2 text-xs text-muted">{r.outflows.join(" · ")}</p>}
    </div>
  );
}

// Barras de flujo semanal; el saldo acumulado va como fila de cifras debajo para no
// aplastar las barras con una escala mucho mayor en el mismo eje.
export function CashFlowChart({ weeks, compact = false }: { weeks: WeekPoint[]; compact?: boolean }) {
  const data: Row[] = weeks.map((w) => ({ ...w, in: w.inCents / 100, out: w.outCents / 100 }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: IN }} /> Cobros esperados
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: OUT }} /> Obligaciones fijas
        </span>
      </div>
      <div className={cx("w-full", compact ? "h-[190px]" : "h-[240px]")} role="img" aria-label="Cobros esperados y obligaciones por semana. El saldo de cada semana figura debajo.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#efede9" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#5f5f67", fontSize: 12, fontWeight: 600 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={Y_AXIS_WIDTH}
              tick={{ fill: "#8a8a92", fontSize: 11 }}
              tickFormatter={(v: number) => formatMoney(v * 100, { short: true })}
            />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "rgb(124 92 219 / 0.06)", radius: 12 }} />
            <Bar dataKey="in" name="Cobros esperados" fill={IN} radius={[10, 10, 10, 10]} maxBarSize={30} />
            <Bar dataKey="out" name="Obligaciones fijas" fill={OUT} radius={[10, 10, 10, 10]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-1 border-t border-line-soft pr-2 pt-3" style={{ paddingLeft: Y_AXIS_WIDTH }}>
        {weeks.map((w) => (
          <div key={w.label} className="text-center">
            <dt className="text-[11px] font-semibold text-faint">Saldo</dt>
            <dd className={cx("tabular text-[13px] font-bold sm:text-sm", w.balanceCents < 0 ? "text-bad" : "text-ink")}>{formatMoney(w.balanceCents, { short: true })}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
