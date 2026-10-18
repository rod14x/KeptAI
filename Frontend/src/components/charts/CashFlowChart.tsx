import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeekPoint } from "../../api/client";
import { cx, formatMoney } from "../../lib/format";

const IN = "var(--color-series-in)";
const OUT = "var(--color-series-out)";
const Y_AXIS_WIDTH = 64;

type Row = WeekPoint & { in: number; out: number };

function TooltipBox({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="min-w-56 rounded-2xl bg-card p-3.5 text-[13px] shadow-[var(--shadow-lift)] ring-1 ring-line">
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
      <p className="mt-2 text-[11px] font-medium text-brand-blue">Haz clic para ver el desglose detallado</p>
    </div>
  );
}

// Barras de flujo semanal; el saldo acumulado va como fila de cifras debajo para no
// aplastar las barras con una escala mucho mayor en el mismo eje.
export function CashFlowChart({
  weeks,
  compact = false,
  selectedWeek = null,
  onSelectWeek,
}: {
  weeks: WeekPoint[];
  compact?: boolean;
  selectedWeek?: WeekPoint | null;
  onSelectWeek?: (week: WeekPoint) => void;
}) {
  const data: Row[] = weeks.map((w) => ({ ...w, in: w.inCents / 100, out: w.outCents / 100 }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted" aria-hidden="true">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: IN }} /> Cobros esperados
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: OUT }} /> Obligaciones fijas
          </span>
        </div>
        {onSelectWeek && (
          <span className="text-xs font-semibold text-brand-blue">
            💡 Haz clic en una semana para auditar clientes y facturas
          </span>
        )}
      </div>

      <div
        className={cx("w-full cursor-pointer", compact ? "h-[190px]" : "h-[240px]")}
        role="region"
        aria-label="Cobros esperados y obligaciones por semana. El saldo de cada semana figura debajo."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barGap={4}
            barCategoryGap="30%"
            onClick={(state: unknown) => {
              const s = state as { activePayload?: Array<{ payload: Row }> } | null;
              if (onSelectWeek && s?.activePayload && s.activePayload.length) {
                const row = s.activePayload[0].payload;
                const match = weeks.find((w) => w.label === row.label);
                if (match) onSelectWeek(match);
              }
            }}
          >
            <CartesianGrid vertical={false} stroke="var(--color-line-soft)" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted)", fontSize: 12, fontWeight: 600 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={Y_AXIS_WIDTH}
              tick={{ fill: "var(--color-faint)", fontSize: 11 }}
              tickFormatter={(v: number) => formatMoney(v * 100, { short: true })}
            />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-panel)", radius: 6 }} />
            <Bar dataKey="in" name="Cobros esperados" fill={IN} radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar dataKey="out" name="Obligaciones fijas" fill={OUT} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line-soft pr-2 pt-3" style={{ paddingLeft: Y_AXIS_WIDTH }}>
        {weeks.map((w) => {
          const isSelected = selectedWeek?.label === w.label;
          return (
            <button
              key={w.label}
              type="button"
              onClick={() => onSelectWeek?.(w)}
              className={cx(
                "group flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all",
                isSelected
                  ? "bg-brand-blue/10 ring-2 ring-brand-blue shadow-sm"
                  : "hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              )}
            >
              <span className={cx("text-[11px] font-bold uppercase tracking-wider", isSelected ? "text-brand-blue" : "text-muted")}>
                {w.label}
              </span>
              <span
                className={cx(
                  "tabular mt-0.5 text-[13px] font-extrabold sm:text-sm",
                  w.balanceCents < 0 ? "text-bad" : isSelected ? "text-brand-blue" : "text-ink"
                )}
              >
                {formatMoney(w.balanceCents, { short: true })}
              </span>
              {isSelected ? (
                <span className="mt-1 inline-flex items-center rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-bold text-white">
                  Auditoría activa
                </span>
              ) : (
                <span className="mt-1 text-[10px] text-faint group-hover:text-muted">
                  Ver detalle
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
