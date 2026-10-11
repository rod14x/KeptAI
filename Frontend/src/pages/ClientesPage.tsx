import { AnimatePresence, motion } from "motion/react";
import { MotionLink, Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Meter } from "../components/ui/Meter";
import { useMemo, useState } from "react";
import { CaretRight, HandCoins, MagnifyingGlass } from "@phosphor-icons/react";
import { getCustomers, type CustomerRow } from "../api/client";
import type { CreditStatus } from "../api/domain";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { Chip, CreditChip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { cx, formatDate, formatMoney } from "../lib/format";

type Filter = "todos" | CreditStatus;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "en_mora", label: "En mora" },
  { id: "por_vencer", label: "Por vencer" },
  { id: "sobre_linea", label: "Sobre la línea" },
  { id: "al_dia", label: "Al día" },
];

export function ClientesPage() {
  const { scope } = useScope();
  const { data, loading, error, reload } = useApi(() => getCustomers(scope), [scope]);
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () => (data ?? []).filter((r) => (filter === "todos" || r.status === filter) && r.name.toLowerCase().includes(q.trim().toLowerCase())),
    [data, filter, q],
  );

  const totals = useMemo(() => {
    const d = data ?? [];
    return {
      used: d.reduce((s, r) => s + r.usedCents, 0),
      overdue: d.reduce((s, r) => s + r.overdueCents, 0),
      inMora: d.filter((r) => r.status === "en_mora").length,
      pending: d.reduce((s, r) => s + r.pendingOrders, 0),
    };
  }, [data]);

  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <PageHeader title="Clientes y crédito" subtitle={<>Saldo, mora e historial de pago de cada cliente. Vista {SCOPE_LABEL[scope]}.</>} actions={<DemoBadge />} />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[92px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <Stagger className="flex flex-col gap-6">
          <motion.dl variants={listVariants} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Crédito en uso" value={<Money cents={totals.used} />} hint={`${data.length} clientes`} />
            <Stat label="Saldo vencido" value={<Money cents={totals.overdue} />} hint={`${totals.inMora} ${totals.inMora === 1 ? "cliente en mora" : "clientes en mora"}`} bad={totals.overdue > 0} />
            <Stat label="Órdenes por confirmar" value={String(totals.pending)} hint="Esperan la decisión del vendedor" />
            <Stat
              label="Pago promedio"
              value={avgLabel(data)}
              hint="Días respecto al vencimiento, pedidos cerrados"
            />
          </motion.dl>

          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Segmented
                tone="solid"
                label="Filtrar por estado"
                value={filter}
                onChange={setFilter}
                className="-mx-1 flex px-1"
                options={FILTERS.map((f) => ({ value: f.id, label: f.label, count: f.id === "todos" ? data.length : data.filter((r) => r.status === f.id).length }))}
              />
              <label className="flex h-11 items-center gap-2 rounded-full bg-panel px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-violet lg:w-72">
                <MagnifyingGlass size={16} className="text-faint" />
                <span className="sr-only">Buscar cliente</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" className="w-full bg-transparent text-sm outline-none placeholder:text-faint" />
              </label>
            </div>

            {rows.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="Ningún cliente coincide">Cambia el filtro o la búsqueda.</EmptyState>
              </div>
            ) : (
              <motion.ul variants={listVariants} className="mt-4 flex flex-col">
                <li className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_120px_24px] gap-4 px-3 pb-2 text-xs font-semibold text-muted xl:grid">
                  <span>Cliente</span>
                  <span>Crédito usado</span>
                  <span className="text-right">Vencido</span>
                  <span>Próximo vencimiento</span>
                  <span>Último pago</span>
                  <span>Estado</span>
                  <span />
                </li>
                <AnimatePresence initial={false} mode="popLayout">
                  {rows.map((r) => (
                    <CustomerRowView key={r.id} r={r} />
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
          </Card>
        </Stagger>
      )}
    </Stagger>
  );
}

function avgLabel(rows: CustomerRow[]) {
  const vals = rows.map((r) => r.avgDaysLate).filter((v): v is number => v !== null);
  if (!vals.length) return "Sin datos";
  const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  return avg > 0 ? `${avg} d tarde` : avg < 0 ? `${-avg} d antes` : "A tiempo";
}

function Stat({ label, value, hint, bad }: { label: string; value: React.ReactNode; hint: string; bad?: boolean }) {
  return (
    <motion.div variants={itemVariants} className="rounded-[18px] bg-card p-4 shadow-[0_1px_2px_rgb(23_23_26/0.04)] ring-1 ring-line/70">
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className={cx("tabular mt-1 text-xl font-extrabold tracking-tight", bad && "text-bad")}>{value}</dd>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </motion.div>
  );
}

const EXIT = { opacity: 0, transition: { duration: 0.12 } };
const TAP = { scale: 0.995 };

function CustomerRowView({ r }: { r: CustomerRow }) {
  return (
    <motion.li layout variants={itemVariants} exit={EXIT} className="border-t border-line-soft first:border-t-0">
      <MotionLink
        to={`/clientes/${r.id}`}
        whileTap={TAP}
        className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-2xl px-3 py-4 transition-colors hover:bg-panel xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_120px_24px]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={r.name} size="lg" />
          <span className="min-w-0">
            <span className="block truncate font-bold">{r.name}</span>
            <span className="block truncate text-[13px] text-muted">
              {r.brand === "corpotex" ? "Corpotex" : "Unicrack"} · {r.tipo === "colegio" ? "Colegio" : r.tipo === "empresa" ? "Empresa" : "Persona"} · {r.seller}
            </span>
          </span>
        </span>

        <span className="col-span-2 flex flex-col gap-1.5 xl:col-span-1">
          <span className="tabular flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-bold">{formatMoney(r.usedCents)}</span>
            <span className="text-muted">de {formatMoney(r.creditLimitCents, { short: true })}</span>
          </span>
          <Meter value={r.creditLimitCents ? r.usedCents / r.creditLimitCents : 0} label={`Crédito usado de ${r.name}`} />
          <span className="text-xs text-muted">Línea de referencia</span>
        </span>

        <span className="tabular text-[13px] xl:text-right">
          <span className="text-xs text-muted xl:hidden">Vencido </span>
          {r.overdueCents > 0 ? (
            <>
              <span className="font-bold text-bad">{formatMoney(r.overdueCents)}</span>
              <span className="block text-xs text-muted">hasta {r.maxOverdueDays} d de atraso</span>
            </>
          ) : (
            <span className="text-muted">S/ 0.00</span>
          )}
        </span>

        <span className="tabular text-[13px]">
          <span className="text-xs text-muted xl:hidden">Próximo vencimiento </span>
          {r.nextDue ? (
            <>
              <span className={cx("font-semibold", r.nextDue.overdue && "text-bad")}>{formatDate(r.nextDue.date)}</span>
              <span className="block text-xs text-muted">
                {r.nextDue.id}
                {r.nextDue.overdue && " · vencido"}
              </span>
            </>
          ) : (
            <span className="text-muted">Sin saldo por vencer</span>
          )}
        </span>

        <span className="tabular text-[13px]">
          <span className="text-xs text-muted xl:hidden">Último pago </span>
          {r.lastPaymentAt ? <span className="font-semibold">{formatDate(r.lastPaymentAt)}</span> : <span className="text-muted">Sin pagos</span>}
        </span>

        <span className="col-span-2 flex flex-wrap items-center gap-1.5 xl:col-span-1 xl:flex-col xl:items-start">
          <CreditChip status={r.status} />
          {r.pendingOrders > 0 && (
            <Chip tone="violet" icon={<HandCoins size={14} weight="bold" />}>
              {r.pendingOrders} por confirmar
            </Chip>
          )}
        </span>
        <CaretRight size={16} weight="bold" className="hidden text-faint xl:block" />
      </MotionLink>
    </motion.li>
  );
}
