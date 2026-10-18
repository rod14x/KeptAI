import type { ReactNode } from "react";
import { Scales, CopySimple, WarningCircle } from "../ui/icons";
import { MoneyText } from "../atoms/MoneyText";
import { cx, formatMoney } from "../../lib/format";

export type DiscrepancyKind = "amount_mismatch" | "partial" | "duplicate" | "orphan" | "exceeds" | "incomplete";

export interface DiscrepancyNoticeProps {
  kind: DiscrepancyKind;
  voucherAmountCents?: number | null;
  expectedAmountCents?: number | null;
  differenceCents?: number | null;
  originalRef?: string | null;
  message?: string;
  actions?: ReactNode;
  className?: string;
}

export function DiscrepancyNotice({
  kind,
  voucherAmountCents,
  expectedAmountCents,
  differenceCents,
  originalRef,
  message,
  actions,
  className,
}: DiscrepancyNoticeProps) {
  const diff = differenceCents ?? (voucherAmountCents != null && expectedAmountCents != null ? voucherAmountCents - expectedAmountCents : null);

  return (
    <div
      role="alert"
      className={cx(
        "rounded-xl border p-4 transition-all",
        kind === "duplicate"
          ? "border-bad/30 bg-bad-tint text-bad"
          : kind === "amount_mismatch" || kind === "exceeds"
            ? "border-warn/30 bg-warn-tint text-ink"
            : kind === "partial"
              ? "border-info/30 bg-info-tint text-ink"
              : "border-line bg-panel text-ink",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          {kind === "duplicate" ? (
            <CopySimple size={20} weight="bold" className="text-bad" />
          ) : kind === "amount_mismatch" || kind === "exceeds" ? (
            <Scales size={20} weight="bold" className="text-warn" />
          ) : (
            <WarningCircle size={20} weight="bold" className="text-info" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">
              {kind === "duplicate"
                ? "Alerta: Comprobante Duplicado"
                : kind === "partial"
                  ? "Abono Parcial Detectado"
                  : kind === "amount_mismatch"
                    ? "Discrepancia en el Monto a Cobrar"
                    : kind === "exceeds"
                      ? "El Monto Excede el Saldo Pendiente"
                      : "Comprobante Requiere Revisión"}
            </h3>

            {diff != null && diff !== 0 && (
              <span className={cx("text-xs font-bold tabular", diff < 0 ? "text-warn" : "text-ok")}>
                Diferencia: {formatMoney(diff, { signed: true })}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-muted leading-relaxed">
            {message ??
              (kind === "duplicate"
                ? `Mismo monto y referencia que ${originalRef ?? "otro comprobante registrado"}. No se aplicará a la deuda automáticamente para evitar duplicaciones.`
                : kind === "partial"
                  ? "El comprobante no cubre la totalidad de la orden. Se registrará como amortización y quedará saldo pendiente."
                  : kind === "amount_mismatch"
                    ? "El abono en banco difiere del saldo registrado en el pedido. Verifica si hubo un cargo adicional o retención bancaria."
                    : kind === "exceeds"
                      ? "El dinero recibido es mayor al saldo pendiente de la orden. Puedes aplicar el saldo excedente como anticipo a favor."
                      : "Verifica los datos con el área correspondiente antes de aplicar este pago.")}
          </p>

          {voucherAmountCents != null && expectedAmountCents != null && (
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-card/80 p-2.5 text-center text-xs ring-1 ring-line/60">
              <div>
                <span className="block text-[11px] text-muted">Voucher en banco</span>
                <MoneyText cents={voucherAmountCents} size="sm" tone="default" />
              </div>
              <div className="border-x border-line/60">
                <span className="block text-[11px] text-muted">Saldo de orden</span>
                <MoneyText cents={expectedAmountCents} size="sm" tone="default" />
              </div>
              <div>
                <span className="block text-[11px] text-muted">Resultado</span>
                <span className={cx("font-extrabold", diff != null && diff < 0 ? "text-warn" : "text-ok")}>
                  {diff != null && diff < 0 ? "Queda saldo" : "Cubierto"}
                </span>
              </div>
            </div>
          )}

          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
