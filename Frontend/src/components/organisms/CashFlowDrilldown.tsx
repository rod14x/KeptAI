import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, Bank, CalendarBlank, CheckCircle, Factory, Receipt, WarningCircle, X } from "../ui/icons";
import type { OrderRow, WeekPoint } from "../../api/client";
import { formatMoney, formatDate } from "../../lib/format";
import { Avatar } from "../ui/Avatar";
import { FinanceChip } from "../ui/Chip";
import { Button } from "../ui/Button";

interface CashFlowDrilldownProps {
  week: WeekPoint;
  factorCobro: number | null;
  orders: OrderRow[];
  onClose: () => void;
}

export function CashFlowDrilldown({
  week,
  factorCobro,
  orders,
  onClose,
}: CashFlowDrilldownProps) {
  const matchedOrders = orders.filter((o) => {
    if (o.balanceCents <= 0) return false;
    const inInflowList = week.inflows.some((inf) => inf.includes(o.ref));
    return inInflowList;
  });

  const displayOrders = matchedOrders.length > 0 ? matchedOrders : orders.filter((o) => o.balanceCents > 0).slice(0, 4);
  const isDeficit = week.balanceCents < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="rounded-[var(--radius-card)] border-2 border-brand-blue/30 bg-card p-5 sm:p-6 shadow-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-brand-blue px-2.5 py-1 text-xs font-bold text-white uppercase tracking-wider">
              {week.label}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <CalendarBlank size={16} className="text-muted" /> {week.range}
            </span>
          </div>
          <h3 className="mt-1.5 text-lg font-bold text-ink">
            Auditoría y Sustento de Caja Semanal
          </h3>
          <p className="text-xs text-muted">
            Desglose de clientes, pedidos y obligaciones fijas que determinan el saldo al cierre de esta semana.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-muted hover:bg-panel hover:text-ink transition-colors"
          aria-label="Cerrar auditoría de semana"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-line-soft bg-panel/60 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Bank size={15} className="text-ok" /> Cobros esperados
          </span>
          <p className="tabular mt-1 text-xl font-extrabold text-ok">
            {formatMoney(week.inCents)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            Factor de cobro aplicado: {factorCobro != null ? `${Math.round(factorCobro * 100)}%` : "100%"}
          </p>
        </div>

        <div className="rounded-xl border border-line-soft bg-panel/60 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Factory size={15} className="text-warn" /> Obligaciones fijas
          </span>
          <p className="tabular mt-1 text-xl font-extrabold text-ink">
            {formatMoney(week.outCents)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {week.outflows.length} compromisos programados
          </p>
        </div>

        <div
          className={`rounded-xl border p-3.5 ${
            isDeficit
              ? "border-bad/40 bg-bad-tint"
              : "border-line-soft bg-panel/60"
          }`}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            {isDeficit ? (
              <WarningCircle size={15} weight="bold" className="text-bad" />
            ) : (
              <CheckCircle size={15} weight="bold" className="text-ok" />
            )}
            Saldo proyectado al cierre
          </span>
          <p
            className={`tabular mt-1 text-xl font-extrabold ${
              isDeficit ? "text-bad" : "text-ink"
            }`}
          >
            {formatMoney(week.balanceCents)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {isDeficit ? "⚠️ Alerta de liquidez crítica" : "Posición de caja holgada"}
          </p>
        </div>
      </div>

      {isDeficit && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-bad/30 bg-bad-tint p-4 text-bad">
          <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold">Riesgo de quiebre de liquidez: </span>
            Las obligaciones fijas superan los cobros esperados por{" "}
            <span className="font-bold">{formatMoney(Math.abs(week.balanceCents))}</span>.
            Se recomienda activar recordatorios preventivos en Cobranza o negociar ampliación de plazo con proveedores de insumos.
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
            <h4 className="flex items-center gap-2 text-[13px] font-bold text-ink">
              <Receipt size={16} className="text-brand-blue" />
              Sustento de Cobros ({displayOrders.length} pedidos)
            </h4>
            <Link
              to="/cobranza"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue hover:underline"
            >
              Ver Cartera <ArrowRight size={12} weight="bold" />
            </Link>
          </div>

          <ul className="mt-3 divide-y divide-line-soft">
            {displayOrders.map((o) => (
              <li key={o.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={o.customer} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        {o.customer}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        Pedido <span className="font-semibold text-ink">{o.ref}</span>
                        {o.dueDate && ` · Vence ${formatDate(o.dueDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tabular text-xs font-extrabold text-ink">
                      {formatMoney(o.balanceCents)}
                    </p>
                    <FinanceChip finance={o.finance} daysToDue={o.daysToDue ?? undefined} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
            <h4 className="flex items-center gap-2 text-[13px] font-bold text-ink">
              <Factory size={16} className="text-warn" />
              Obligaciones Comprometidas ({week.outflows.length})
            </h4>
            <span className="text-[11px] font-medium text-muted">
              Total: {formatMoney(week.outCents)}
            </span>
          </div>

          {week.outflows.length === 0 ? (
            <p className="mt-4 text-center text-xs text-muted">
              Sin egresos fijos registrados para esta semana.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft">
              {week.outflows.map((outflowStr, idx) => (
                <li key={idx} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-xs">
                  <span className="font-semibold text-ink">{outflowStr}</span>
                  <span className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-muted">
                    Fijo semanal
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-line-soft pt-3">
            <p className="text-[11px] leading-relaxed text-muted">
              ℹ️ Las obligaciones fijas provienen de compromisos de planilla, alquiler de taller y pago a proveedores confeccionistas acordados en el corte.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cerrar auditoría
        </Button>
        <Link to="/cobranza">
          <Button size="sm" icon={<ArrowRight size={14} weight="bold" />}>
            Gestionar Cobranzas
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
