import { motion } from "motion/react";
import { Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { useParams } from "react-router";
import { CalendarBlank, CheckCircle, Clock, LinkBreak, WarningCircle } from "../components/ui/icons";
import { getStatement, type StatementDTO } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Chip, type Tone } from "../components/ui/Chip";
import { ErrorState, Skeleton } from "../components/ui/States";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

// Vista del cliente corporativo: solo lectura, sin costos, márgenes, comprobantes ni datos de otros clientes.

export function EstadoCuentaPage() {
  const { token = "" } = useParams();
  const { data, loading, error, reload } = useApi(() => getStatement(token), [token]);

  return (
    <div className="min-h-[100dvh] bg-[#f6f4fb]">
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading || !data ? (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-48 rounded-[24px]" />
            <Skeleton className="h-72 rounded-[24px]" />
          </div>
        ) : data.ok ? (
          <Stagger className="flex flex-col gap-5">
            <Statement d={data} />
          </Stagger>
        ) : (
          <Invalid reason={data.reason} />
        )}
      </div>
    </div>
  );
}

function Invalid({ reason }: { reason: "no_existe" | "revocado" | "vencido" }) {
  const text =
    reason === "vencido"
      ? "Este enlace ya venció. Pide uno nuevo a tu vendedor."
      : reason === "revocado"
        ? "Este enlace fue desactivado. Pide uno nuevo a tu vendedor."
        : "No encontramos este estado de cuenta. Revisa que el enlace esté completo.";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-16 flex flex-col items-center gap-3 rounded-[24px] bg-card px-6 py-12 text-center shadow-[var(--shadow-card)]">
      <span className="flex size-12 items-center justify-center rounded-full bg-warn-tint text-warn">
        <LinkBreak size={24} weight="bold" />
      </span>
      <h1 className="text-lg font-bold">Enlace no disponible</h1>
      <p className="max-w-[34ch] text-sm text-muted">{text}</p>
    </motion.div>
  );
}

const STATE_TONE: Record<string, Tone> = { Pagado: "ok", Vencido: "bad", "Por pagar": "neutral", "En revisión": "warn" };

function Statement({ d }: { d: Extract<StatementDTO, { ok: true }> }) {
  const brand = d.brand === "corpotex" ? "Corpotex" : "Unicrack";
  return (
    <>
      <motion.header variants={itemVariants} className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-ink">{brand}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Estado de cuenta</h1>
        </div>
        <p className="tabular text-right text-xs text-muted">
          Actualizado al
          <br />
          <span className="font-semibold text-ink">{formatDateTime(d.generatedAt)}</span>
        </p>
      </motion.header>

      <motion.section variants={itemVariants} className="rounded-[24px] bg-ink p-6 text-white shadow-[var(--shadow-lift)]">
        <p className="text-sm text-white/70">{d.customer}</p>
        <p className="mt-4 text-sm text-white/70">Saldo pendiente</p>
        <p className="tabular text-4xl font-extrabold tracking-tight">{formatMoney(d.balanceCents)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/70">Vencido</p>
            <p className={cx("tabular text-lg font-bold", d.overdueCents > 0 && "text-[#ffb4ab]")}>{formatMoney(d.overdueCents)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/70">{d.nextDue && d.nextDue.date < d.generatedAt.slice(0, 10) ? "Venció el" : "Próximo vencimiento"}</p>
            <p className="tabular text-lg font-bold">{d.nextDue ? formatDate(d.nextDue.date) : "Ninguno"}</p>
            {d.nextDue && <p className="tabular text-xs text-white/70">{formatMoney(d.nextDue.amountCents)}</p>}
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-[24px] bg-card p-5 shadow-[var(--shadow-card)]" aria-labelledby="st-orders">
        <h2 id="st-orders" className="text-base font-bold">
          Tus pedidos
        </h2>
        <motion.ul variants={listVariants} className="mt-3 flex flex-col">
          {d.orders.map((o) => (
            <motion.li variants={itemVariants} key={o.id} className="border-t border-line-soft py-3.5 first:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.id}</p>
                  <p className="text-[13px] text-muted">{o.description}</p>
                </div>
                <Chip
                  tone={STATE_TONE[o.state]}
                  icon={o.state === "Pagado" ? <CheckCircle size={14} weight="bold" /> : o.state === "Vencido" ? <WarningCircle size={14} weight="bold" /> : <Clock size={14} weight="bold" />}
                >
                  {o.state}
                </Chip>
              </div>
              <div className="tabular mt-2 grid grid-cols-3 gap-2 text-xs">
                <span>
                  <span className="block text-faint">Pedido</span>
                  {formatDate(o.issuedOn)}
                </span>
                <span>
                  <span className="block text-faint">Despacho</span>
                  {o.despachoOn ? formatDate(o.despachoOn) : "En producción"}
                </span>
                <span>
                  <span className="block text-faint">Vence</span>
                  <span className={cx(o.balanceCents > 0 && "font-bold")}>{o.dueDate ? formatDate(o.dueDate) : "Al despachar"}</span>
                </span>
              </div>
              <div className="tabular mt-2 flex justify-between text-[13px]">
                <span className="text-muted">
                  Total {formatMoney(o.saleCents)} · Pagado {formatMoney(o.paidCents)}
                </span>
                <span className="font-bold">Saldo {formatMoney(o.balanceCents)}</span>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-[24px] bg-card p-5 shadow-[var(--shadow-card)]" aria-labelledby="st-pay">
        <h2 id="st-pay" className="text-base font-bold">
          Pagos registrados
        </h2>
        {d.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Todavía no hay pagos registrados.</p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {d.payments.map((p) => (
              <li key={p.id} className="tabular flex items-center justify-between gap-3 border-t border-line-soft py-3 text-sm first:border-t-0">
                <span>
                  <span className="block font-semibold">{formatDate(p.at)}</span>
                  <span className="block text-xs text-muted">
                    {p.orderId} · {p.channel}
                  </span>
                </span>
                <span className="font-bold text-ok">{formatMoney(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
        <CalendarBlank size={14} className="mt-0.5 shrink-0" />
        Enlace válido hasta el {formatDate(d.expiresAt)}. Un pago aparece aquí cuando ya fue verificado. Si ves algo que no corresponde, escribe a tu vendedor.
      </p>
    </>
  );
}
