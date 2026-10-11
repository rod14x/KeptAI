import { motion } from "motion/react";
import { Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { Link, useParams } from "react-router";
import { ArrowLeft, CalendarBlank, CheckCircle, Clock, Printer, WarningCircle } from "../components/ui/icons";
import { getStatement, type StatementDTO } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Chip, type Tone } from "../components/ui/Chip";
import { DemoBadge, EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { Button } from "../components/ui/Button";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

// Estado de cuenta autenticado (GET /customers/{id}/statement). V6 no tiene enlace público:
// el equipo lo abre aquí y lo imprime o lo envía. Sin costos, márgenes ni datos de otros clientes.

export function EstadoCuentaPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useApi(() => getStatement(id), [id]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={`/clientes/${id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft size={16} weight="bold" /> Ficha del cliente
        </Link>
        {data && (
          <Button variant="secondary" size="sm" icon={<Printer size={16} />} onClick={() => window.print()}>
            Imprimir o guardar PDF
          </Button>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || data === undefined ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-48 rounded-[24px]" />
          <Skeleton className="h-72 rounded-[24px]" />
        </div>
      ) : data === null ? (
        <EmptyState title="Estado de cuenta no disponible">No existe el cliente o tu rol no tiene acceso a su estado de cuenta.</EmptyState>
      ) : (
        <Stagger className="flex flex-col gap-5">
          <Statement d={data} />
        </Stagger>
      )}
    </div>
  );
}

const STATE_TONE: Record<string, Tone> = { Pagado: "ok", Vencido: "bad", "Por pagar": "neutral", "En revisión": "warn" };

function Statement({ d }: { d: StatementDTO }) {
  return (
    <>
      <motion.header variants={itemVariants} className="flex items-center justify-between gap-3">
        <div>
          {d.demo ? <DemoBadge /> : <p className="text-sm font-semibold text-violet-ink">Corpotex · Unicrack</p>}
          <h1 className="text-2xl font-extrabold tracking-tight">Estado de cuenta</h1>
        </div>
        <p className="tabular text-right text-xs text-muted">
          Actualizado al
          <br />
          <span className="font-semibold text-ink">{formatDateTime(d.generatedAt)}</span>
        </p>
      </motion.header>

      <motion.section variants={itemVariants} className="rounded-xl bg-navy p-6 text-white">
        <p className="text-sm text-white/70">{d.customer}</p>
        <p className="mt-4 text-sm text-white/70">Saldo pendiente</p>
        <p className="tabular text-4xl font-extrabold tracking-tight">{formatMoney(d.balanceCents)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="border-t border-white/20 pt-3">
            <p className="text-white/70">Vencido</p>
            <p className={cx("tabular text-lg font-bold", d.overdueCents > 0 && "text-[#ffb4ab]")}>{formatMoney(d.overdueCents)}</p>
          </div>
          <div className="border-t border-white/20 pt-3">
            <p className="text-white/70">{d.nextDue && d.nextDue.date < d.generatedAt.slice(0, 10) ? "Venció el" : "Próximo vencimiento"}</p>
            <p className="tabular text-lg font-bold">{d.nextDue ? formatDate(d.nextDue.date) : "Ninguno"}</p>
            {d.nextDue && <p className="tabular text-xs text-white/70">{formatMoney(d.nextDue.amountCents)}</p>}
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-xl border border-line bg-card p-5" aria-labelledby="st-orders">
        <h2 id="st-orders" className="text-base font-bold">
          Tus pedidos
        </h2>
        <motion.ul variants={listVariants} className="mt-3 flex flex-col">
          {d.orders.map((o) => (
            <motion.li variants={itemVariants} key={o.id} className="border-t border-line-soft py-3.5 first:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.ref}</p>
                  {o.description && <p className="text-[13px] text-muted">{o.description}</p>}
                </div>
                <Chip
                  tone={STATE_TONE[o.state]}
                  icon={o.state === "Pagado" ? <CheckCircle size={14} weight="bold" /> : o.state === "Vencido" ? <WarningCircle size={14} weight="bold" /> : <Clock size={14} weight="bold" />}
                >
                  {o.state}
                </Chip>
              </div>
              <div className="tabular mt-2 grid grid-cols-2 gap-2 text-xs">
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

      <motion.section variants={itemVariants} className="rounded-xl border border-line bg-card p-5" aria-labelledby="st-pay">
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
                    {[p.orderRef, p.paymentRef].filter(Boolean).join(" · ")}
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
        Un pago aparece aquí cuando ya fue verificado y aplicado. Si el cliente ve algo que no corresponde, lo revisa con su vendedor.
      </p>
    </>
  );
}
