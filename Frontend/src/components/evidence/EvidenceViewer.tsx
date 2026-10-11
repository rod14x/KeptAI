import { EyeSlash } from "../ui/icons";
import type { Evidence } from "../../api/model";
import { cx, formatDateTime, formatMoney } from "../../lib/format";

// Comprobante recibido. En la API se muestra la imagen original con su URL firmada;
// en la demo (MOCK) no hay imágenes: se dibuja a partir de lo extraído y se rotula como representación.

export function VoucherMock({ ev, compact = false }: { ev: Evidence; compact?: boolean }) {
  const f = ev.fields;
  return (
    <figure className={cx("relative mx-auto w-full overflow-hidden rounded-[20px] bg-card ring-1 ring-line", compact ? "max-w-[220px]" : "max-w-[300px]")}>
      <div className={cx("transition", !ev.legible && "blur-[3px] grayscale")}>
        <div className="bg-[#2a2440] px-5 pb-6 pt-5 text-white">
          <p className="text-xs font-semibold text-white/70">{f.channel ?? "Billetera"}</p>
          <p className="mt-3 text-[13px] text-white/80">Pago exitoso</p>
          <p className={cx("tabular font-extrabold tracking-tight", compact ? "text-2xl" : "text-[34px]")}>
            {f.amountCents != null ? formatMoney(f.amountCents) : "S/ ???"}
          </p>
        </div>
        <dl className={cx("grid gap-2.5 px-5 py-4 text-[13px]", compact && "py-3 text-xs")}>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">De</dt>
            <dd className="truncate text-right font-semibold">{f.payer ?? "No legible"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">N.° operación</dt>
            <dd className="tabular font-semibold">{f.operationRef ?? "No legible"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Fecha</dt>
            <dd className="tabular font-semibold">{f.paidAt ?? "No legible"}</dd>
          </div>
        </dl>
      </div>
      {!ev.legible && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/55 p-4 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-warn-tint text-warn">
            <EyeSlash size={20} weight="bold" />
          </span>
          <p className="text-sm font-bold">Imagen ilegible</p>
          <p className="text-xs text-muted">La IA no pudo leer monto ni operación. Completa los datos a mano o pídelos al cliente.</p>
        </div>
      )}
      <figcaption className="border-t border-line-soft px-5 py-2.5 text-[11px] text-muted">Representación del comprobante a partir de los datos leídos</figcaption>
    </figure>
  );
}

/** Voucher real (URL firmada de getEvidenceDownloadLink) o representación en la demo. Sin chat ni audio: V6 no los guarda. */
export function EvidenceViewer({ ev, imageUrl = null }: { ev: Evidence; imageUrl?: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-muted">Comprobante · recibido {formatDateTime(ev.receivedAt)}</p>
      {imageUrl ? (
        <figure className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[20px] bg-card ring-1 ring-line">
          <img src={imageUrl} alt={`Voucher ${ev.ref}`} className="w-full object-contain" />
          <figcaption className="border-t border-line-soft px-5 py-2.5 text-[11px] text-muted">Imagen original (enlace temporal)</figcaption>
        </figure>
      ) : (
        <VoucherMock ev={ev} />
      )}
    </div>
  );
}
