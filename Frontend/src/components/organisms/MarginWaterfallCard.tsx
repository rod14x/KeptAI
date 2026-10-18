import { MoneyText } from "../atoms/MoneyText";
import { Chip } from "../molecules/StatusChip";
import { WarningCircle, CheckCircle, ArrowDown, ArrowUp } from "../ui/icons";
import { cx, formatMoney } from "../../lib/format";

export interface CostBreakdownData {
  materiales?: number | null;
  manoObra?: number | null;
  terceros?: number | null;
  indirectos?: number | null;
}

export interface MarginWaterfallCardProps {
  orderRef?: string;
  saleCents: number;
  collectedCents?: number;
  costs: CostBreakdownData;
  costComplete?: boolean;
  costOrigin?: "real" | "teorico";
  className?: string;
}

export function MarginWaterfallCard({
  orderRef,
  saleCents,
  collectedCents = 0,
  costs,
  costComplete = true,
  costOrigin = "real",
  className,
}: MarginWaterfallCardProps) {
  const cMat = costs.materiales ?? 0;
  const cMo = costs.manoObra ?? 0;
  const cTer = costs.terceros ?? 0;
  const cInd = costs.indirectos ?? 0;
  const totalCost = cMat + cMo + cTer + cInd;

  const accountingMargin = saleCents - totalCost;
  const accountingMarginPct = saleCents > 0 ? (accountingMargin / saleCents) * 100 : 0;

  // Margen percibido en caja (efectivo cobrado menos costo invertido)
  const perceivedMargin = collectedCents - totalCost;

  return (
    <div className={cx("rounded-2xl border border-line bg-card p-5 sm:p-6 shadow-soft", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">
              {orderRef ? `Cascada de Rentabilidad: ${orderRef}` : "Trazabilidad de Rentabilidad"}
            </h3>
            <Chip tone={costOrigin === "real" ? "ok" : "warn"}>
              Costo {costOrigin === "real" ? "Real" : "Teórico"}
            </Chip>
            {!costComplete && <Chip tone="warn">Costeo en curso</Chip>}
          </div>
          <p className="mt-1 text-xs text-muted">
            Desglose analítico de ingresos, costos directos y recuperación de caja.
          </p>
        </div>

        <div className="text-right">
          <span className="block text-xs font-semibold text-muted">Margen Bruto</span>
          <div className="flex items-baseline gap-2">
            <MoneyText cents={accountingMargin} size="xl" tone={accountingMargin >= 0 ? "ok" : "bad"} />
            <span className={cx("text-xs font-bold", accountingMargin >= 0 ? "text-ok" : "text-bad")}>
              ({accountingMarginPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Cascada visual en 4 pasos */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* 1. Venta Total */}
        <div className="rounded-xl border border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">1. Venta Acordada</span>
            <ArrowUp size={14} className="text-ok" />
          </div>
          <MoneyText cents={saleCents} size="lg" className="mt-1 text-ink" />
          <span className="block text-[11px] text-muted mt-1">Precio acordado en pedido</span>
        </div>

        {/* 2. Costos de Producción */}
        <div className="rounded-xl border border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">2. Costo Incurrido</span>
            <ArrowDown size={14} className="text-bad" />
          </div>
          <MoneyText cents={totalCost} size="lg" className="mt-1 text-bad" />
          <span className="block text-[11px] text-muted mt-1">Materiales, taller y confección</span>
        </div>

        {/* 3. Margen Contable */}
        <div className="rounded-xl border border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">3. Margen en Papel</span>
            <span className="text-xs font-bold text-ink">{accountingMarginPct.toFixed(0)}%</span>
          </div>
          <MoneyText cents={accountingMargin} size="lg" tone={accountingMargin >= 0 ? "ok" : "bad"} className="mt-1" />
          <span className="block text-[11px] text-muted mt-1">Utilidad teórica devengada</span>
        </div>

        {/* 4. Margen Percibido (Caja) */}
        <div className={cx(
          "rounded-xl border p-3.5",
          perceivedMargin < 0 ? "border-bad/30 bg-bad-tint" : "border-ok/30 bg-ok-tint"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">4. Margen en Mano (Caja)</span>
            {perceivedMargin >= 0 ? (
              <CheckCircle size={14} weight="bold" className="text-ok" />
            ) : (
              <WarningCircle size={14} weight="bold" className="text-bad" />
            )}
          </div>
          <MoneyText cents={perceivedMargin} size="lg" tone={perceivedMargin >= 0 ? "ok" : "bad"} className="mt-1" />
          <span className="block text-[11px] text-muted mt-1">Cobrado S/ {(collectedCents / 100).toFixed(2)} − Costo</span>
        </div>
      </div>

      {/* Desglose analítico de los componentes del costo */}
      <div className="mt-5 rounded-xl border border-line/80 bg-panel/60 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
          Composición del Costo Total
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="block text-muted">Materia Prima (Tela, Hilo)</span>
            <MoneyText cents={cMat} size="sm" className="font-bold text-ink" />
          </div>
          <div>
            <span className="block text-muted">Mano de Obra Directa</span>
            <MoneyText cents={cMo} size="sm" className="font-bold text-ink" />
          </div>
          <div>
            <span className="block text-muted">Servicios Terceros (Bordado)</span>
            <MoneyText cents={cTer} size="sm" className="font-bold text-ink" />
          </div>
          <div>
            <span className="block text-muted">Indirectos Asignados</span>
            <MoneyText cents={cInd} size="sm" className="font-bold text-ink" />
          </div>
        </div>

        {perceivedMargin < 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-bad-tint p-3 text-xs text-bad">
            <WarningCircle size={16} weight="bold" className="shrink-0" />
            <span>
              <strong>Alerta de Caja:</strong> La empresa aún tiene invertidos {formatMoney(Math.abs(perceivedMargin))} de su propio bolsillo. El margen real solo se materializa al completar la cobranza.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
