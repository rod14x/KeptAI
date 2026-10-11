import { Image, Microphone, EyeSlash } from "../ui/icons";
import type { ChatMessage, Evidence } from "../../api/schemas";
import { cx, formatDateTime, formatMoney } from "../../lib/format";

// Representación de la evidencia recibida. En la demo no hay imágenes reales:
// el comprobante se dibuja a partir de lo extraído y se rotula como representación.

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
      <figcaption className="border-t border-line-soft px-5 py-2.5 text-[11px] text-muted">Representación del comprobante (demo)</figcaption>
    </figure>
  );
}

export function ChatThread({ chat }: { chat: ChatMessage[] }) {
  if (chat.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-[#f1efe9] p-3.5" aria-label="Conversación de WhatsApp">
      {chat.map((m, i) => (
        <div key={i} className={cx("flex", m.from === "vendedor" ? "justify-end" : "justify-start")}>
          <div
            className={cx(
              "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-[0_1px_1px_rgb(23_23_26/0.06)]",
              m.from === "vendedor" ? "rounded-br-md bg-[#dcf3e5]" : "rounded-bl-md bg-card",
            )}
          >
            {m.attachment ? (
              <span className="flex items-center gap-2 font-medium text-muted">
                <Image size={16} weight="bold" /> {m.text}
              </span>
            ) : (
              m.text
            )}
            {m.time && <span className="tabular ml-2 inline-block translate-y-0.5 text-[10px] text-faint">{m.time}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const BARS = [6, 12, 18, 10, 22, 16, 8, 20, 14, 24, 12, 18, 9, 15, 21, 11, 17, 7, 13, 19, 10, 16, 8, 12];

export function AudioNote({ ev }: { ev: Evidence }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-[20px] bg-card p-4 ring-1 ring-line">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-tint text-violet-ink">
          <Microphone size={20} weight="bold" />
        </span>
        <div aria-hidden="true" className="flex h-8 flex-1 items-center gap-[3px]">
          {BARS.map((h, i) => (
            <span key={i} className="w-[3px] rounded-full bg-[#c9bdf0]" style={{ height: h }} />
          ))}
        </div>
        <span className="tabular text-xs text-muted">0:14</span>
      </div>
      {ev.transcript && (
        <blockquote className="rounded-[20px] bg-violet-wash p-4 text-sm leading-relaxed text-ink-soft ring-1 ring-violet-tint">
          <p className="mb-1 text-xs font-semibold text-violet-ink">Transcripción automática</p>“{ev.transcript}”
        </blockquote>
      )}
    </div>
  );
}

export function EvidenceViewer({ ev }: { ev: Evidence }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-muted">Evidencia original · recibida {formatDateTime(ev.receivedAt)}</p>
      {ev.kind === "audio" ? <AudioNote ev={ev} /> : <VoucherMock ev={ev} />}
      <ChatThread chat={ev.chat} />
    </div>
  );
}
