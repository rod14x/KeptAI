import { useState } from "react";
import {
  CopySimple,
  LinkSimple,
  ArrowRight,
  ShieldCheck,
} from "../ui/icons";
import { Button } from "../atoms/Button";
import { MoneyText } from "../atoms/MoneyText";
import { MatchChip } from "../molecules/StatusChip";
import { DiscrepancyNotice, type DiscrepancyKind } from "../molecules/DiscrepancyNotice";
import type { EvidenceDetailDTO } from "../../api/client";

export interface ReconciliationCardProps {
  detail: EvidenceDetailDTO;
  canVerify: boolean;
  canApply: boolean;
  onVerifyAndApply: (acceptMismatch?: boolean) => void;
  onMarkDuplicate?: () => void;
  onSelectOrder?: (orderId: string) => void;
  isProcessing?: boolean;
}

export function ReconciliationCard({
  detail,
  canVerify,
  canApply,
  onVerifyAndApply,
  onMarkDuplicate,
  onSelectOrder,
  isProcessing = false,
}: ReconciliationCardProps) {
  const ev = detail.evidence;
  const order = detail.order;
  const match = detail.match;
  const [acceptMismatch, setAcceptMismatch] = useState(false);

  const voucherAmount = ev.fields.amountCents ?? 0;
  const orderBalance = order?.balanceCents ?? 0;
  const difference = voucherAmount - orderBalance;

  // Mapeo a DiscrepancyKind
  const discrepancyKind: DiscrepancyKind | null =
    match === "duplicado"
      ? "duplicate"
      : match === "parcial"
        ? "partial"
        : match === "no_cuadra"
          ? "amount_mismatch"
          : match === "excede"
            ? "exceeds"
            : match === "incompleto"
              ? "incomplete"
              : match === "sin_orden"
                ? "orphan"
                : null;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5 sm:p-6 shadow-soft">
      {/* Encabezado del comprobante */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded">
              {ev.ref}
            </span>
            <MatchChip match={match} />
          </div>
          <p className="mt-1 text-sm font-semibold text-ink">
            {ev.fields.payer ?? "Remitente no especificado"}
          </p>
        </div>

        <div className="text-right">
          <span className="block text-xs font-semibold text-muted">Monto Comprobante</span>
          <MoneyText cents={ev.fields.amountCents} size="xl" tone="default" />
        </div>
      </div>

      {/* Discrepancia interactiva si existe */}
      {discrepancyKind && (
        <DiscrepancyNotice
          kind={discrepancyKind}
          voucherAmountCents={voucherAmount}
          expectedAmountCents={orderBalance}
          differenceCents={difference}
          originalRef={detail.duplicateOfRef}
        />
      )}

      {/* Orden asociada y cálculo de impacto en saldo */}
      {order ? (
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
              <LinkSimple size={14} weight="bold" /> Pedido Asociado: {order.ref}
            </span>
            <span className="text-xs font-semibold text-muted">{order.customer}</span>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-line/60">
            <div>
              <span className="block text-xs text-muted">Saldo antes del pago</span>
              <MoneyText cents={order.balanceCents} size="sm" tone="default" />
            </div>
            <div>
              <span className="block text-xs text-muted">Abono a aplicar</span>
              <MoneyText cents={Math.min(voucherAmount, order.balanceCents)} size="sm" tone="ok" />
            </div>
            <div>
              <span className="block text-xs text-muted">Nuevo saldo estimado</span>
              <MoneyText
                cents={Math.max(0, order.balanceCents - voucherAmount)}
                size="sm"
                tone={Math.max(0, order.balanceCents - voucherAmount) === 0 ? "ok" : "warn"}
              />
            </div>
          </div>
        </div>
      ) : detail.openOrders && detail.openOrders.length > 0 ? (
        <div className="rounded-xl border border-line bg-panel p-4">
          <span className="block text-xs font-bold uppercase tracking-wider text-muted">
            Pedidos abiertos disponibles para vincular
          </span>
          <div className="mt-2 flex flex-col gap-2">
            {detail.openOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => onSelectOrder?.(ord.id)}
                className="flex items-center justify-between rounded-lg border border-line bg-card p-3 text-left transition hover:border-brand-blue cursor-pointer"
              >
                <div>
                  <span className="font-bold text-sm text-ink">{ord.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-brand-blue font-semibold">Vincular a esta orden</span>
                  <ArrowRight size={14} className="text-brand-blue" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Acciones principales */}
      <div className="mt-2 flex flex-col gap-3">
        {match === "duplicado" ? (
          <Button
            variant="danger"
            size="lg"
            loading={isProcessing}
            icon={<CopySimple size={18} weight="bold" />}
            onClick={onMarkDuplicate}
          >
            Confirmar comprobante duplicado
          </Button>
        ) : (
          <>
            {match === "no_cuadra" && (
              <label className="flex items-center gap-2 rounded-lg bg-panel p-3 text-xs text-muted ring-1 ring-line cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptMismatch}
                  onChange={(e) => setAcceptMismatch(e.target.checked)}
                  className="rounded border-line text-brand-blue focus:ring-brand-blue size-4"
                />
                <span>Acepto la discrepancia de monto y autorizo aplicar como abono extraordinario.</span>
              </label>
            )}

            <Button
              variant="primary"
              size="lg"
              loading={isProcessing}
              disabled={(!canVerify && !canApply) || (match === "no_cuadra" && !acceptMismatch) || match === "sin_orden"}
              icon={<ShieldCheck size={18} weight="bold" />}
              onClick={() => onVerifyAndApply(acceptMismatch)}
            >
              {canApply
                ? "Verificar en banco y descontar saldo"
                : "Confirmar recepción en banco"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
