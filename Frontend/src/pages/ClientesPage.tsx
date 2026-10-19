import { AnimatePresence, motion } from "motion/react";
import { MotionLink, Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Meter } from "../components/ui/Meter";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CaretRight, Kanban, List, MagnifyingGlass, Plus, WarningCircle } from "../components/ui/icons";
import { Button } from "../components/ui/Button";
import { CustomerModal } from "../components/CustomerModal";
import { getCustomers, getOrders, type CustomerRow, type OrderRow } from "../api/client";
import type { CreditStatus } from "../api/model";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { IS_MOCK } from "../config";
import { CreditChip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { cx, formatDate, formatMoney } from "../lib/format";
import { checkDeliveryOverdue, type DeliveryAlert } from "../lib/orderAlerts";

type Filter = "todos" | CreditStatus;
type ViewMode = "kanban" | "lista";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "en_mora", label: "En mora" },
  { id: "por_vencer", label: "Por vencer" },
  { id: "sobre_linea", label: "Sobre la línea" },
  { id: "al_dia", label: "Al día" },
];

const KANBAN_COLUMNS: Array<{ id: CreditStatus; title: string; hint: string }> = [
  { id: "en_mora", title: "En mora", hint: "Pagos y compromisos vencidos" },
  { id: "por_vencer", title: "Por vencer", hint: "Compromisos próximos a expirar" },
  { id: "sobre_linea", title: "Sobre la línea", hint: "Crédito al límite de referencia" },
  { id: "al_dia", title: "Al día", hint: "Operación regular sin atrasos" },
];

export function ClientesPage() {
  const { scope } = useScope();
  const { data, loading, error, reload } = useApi(async () => {
    const [customers, orders] = await Promise.all([
      getCustomers(scope),
      getOrders(scope).catch(() => [] as OrderRow[]),
    ]);
    return { customers, orders };
  }, [scope]);

  const [view, setView] = useState<ViewMode>("kanban");
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const customers = data?.customers ?? [];
  const orders = data?.orders ?? [];

  // Mapear alertas de entrega por cliente (Despacho > Entrega o Fecha Actual > Entrega)
  const clientAlerts = useMemo(() => {
    const map = new Map<string, DeliveryAlert & { orderRef: string }>();
    for (const order of orders) {
      const alert = checkDeliveryOverdue(order);
      if (alert.isOverdue) {
        const key = order.customerId ?? order.customer;
        if (!map.has(key)) {
          map.set(key, { ...alert, orderRef: order.ref });
        }
      }
    }
    return map;
  }, [orders]);

  const rows = useMemo(
    () =>
      customers.filter(
        (r) => (filter === "todos" || r.status === filter) && r.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [customers, filter, q],
  );

  const totals = useMemo(() => {
    return {
      used: customers.reduce((s, r) => s + r.usedCents, 0),
      overdue: customers.reduce((s, r) => s + r.overdueCents, 0),
      inMora: customers.filter((r) => r.status === "en_mora").length,
      pending: customers.reduce((s, r) => s + r.pendingOrders, 0),
      overdueAlerts: Array.from(clientAlerts.values()).length,
    };
  }, [customers, clientAlerts]);

  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <PageHeader
        title="Clientes y crédito"
        subtitle={<>Tablero Kanban de clientes, crédito y alerta de fechas de entrega. Vista {SCOPE_LABEL[scope]}.</>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} weight="bold" />}
              onClick={() => setCreateOpen(true)}
            >
              + Nuevo cliente
            </Button>
            <Segmented
              label="Modo de vista"
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { value: "kanban", label: <span className="inline-flex items-center gap-1.5"><Kanban size={15} /> Kanban</span> },
                { value: "lista", label: <span className="inline-flex items-center gap-1.5"><List size={15} /> Lista</span> },
              ]}
            />
            {IS_MOCK && <DemoBadge />}
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[92px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <Stagger className="flex flex-col gap-6">
          <motion.dl variants={listVariants} className="metric-strip metric-strip-four grid md:grid-cols-2 lg:grid-cols-4">
            <Stat label="Crédito en uso" value={<Money cents={totals.used} />} hint={`${customers.length} clientes`} />
            <Stat
              label="Saldo vencido"
              value={<Money cents={totals.overdue} />}
              hint={`${totals.inMora} ${totals.inMora === 1 ? "cliente en mora" : "clientes en mora"}`}
              bad={totals.overdue > 0}
            />
            <Stat
              label="Alertas de entrega"
              value={String(totals.overdueAlerts)}
              hint="Pedidos con despacho > entrega"
              bad={totals.overdueAlerts > 0}
            />
            <Stat
              label="Pago promedio"
              value={avgLabel(customers)}
              hint="Días respecto al vencimiento"
            />
          </motion.dl>

          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <Segmented
                tone="solid"
                label="Filtrar por estado"
                value={filter}
                onChange={setFilter}
                className="-mx-1 flex px-1"
                options={FILTERS.map((f) => ({
                  value: f.id,
                  label: f.label,
                  count: f.id === "todos" ? customers.length : customers.filter((r) => r.status === f.id).length,
                }))}
              />
              <label className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-panel px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-violet lg:w-60">
                <MagnifyingGlass size={16} className="text-faint" />
                <span className="sr-only">Buscar cliente</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar cliente"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
                />
              </label>
            </div>

            {rows.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="Ningún cliente coincide">Cambia el filtro o la búsqueda.</EmptyState>
              </div>
            ) : view === "kanban" ? (
              /* Tablero Kanban de Clientes */
              <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-2 2xl:grid-cols-4">
                {KANBAN_COLUMNS.map((col) => {
                  const colCustomers = rows.filter((r) => r.status === col.id);
                  return (
                    <div
                      key={col.id}
                      className="flex min-w-0 flex-col gap-3 rounded-xl bg-panel p-3.5"
                    >
                      <div className="flex items-center justify-between border-b border-line pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-ink">{col.title}</h3>
                            <span className="rounded-md bg-card px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-line">
                              {colCustomers.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted">{col.hint}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        {colCustomers.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
                            Sin clientes
                          </div>
                        ) : (
                          colCustomers.map((r) => {
                            const alert = clientAlerts.get(r.id) ?? clientAlerts.get(r.name);
                            return <KanbanCustomerCard key={r.id} r={r} alert={alert} />;
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Vista Lista tradicional */
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
                  {rows.map((r) => {
                    const alert = clientAlerts.get(r.id) ?? clientAlerts.get(r.name);
                    return <CustomerRowView key={r.id} r={r} alert={alert} />;
                  })}
                </AnimatePresence>
              </motion.ul>
            )}
          </Card>
        </Stagger>
      )}
      <CustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => reload()}
        existingCustomers={customers}
      />
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
    <motion.div variants={itemVariants}>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className={cx("tabular mt-1 text-xl font-extrabold tracking-tight", bad && "text-bad")}>{value}</dd>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </motion.div>
  );
}

const EXIT = { opacity: 0, transition: { duration: 0.12 } };
const TAP = { scale: 0.995 };

/** Tarjeta Kanban individual para cada cliente con alerta roja si está vencido */
function KanbanCustomerCard({ r, alert }: { r: CustomerRow; alert?: DeliveryAlert & { orderRef: string } }) {
  const isOverdue = Boolean(alert?.isOverdue || r.overdueCents > 0);

  return (
    <motion.div
      layout
      variants={itemVariants}
      whileTap={TAP}
      className={cx(
        "rounded-xl border p-3.5 transition-colors",
        isOverdue
          ? "border-bad/50 bg-bad-tint/30"
          : "border-line bg-card hover:border-violet",
      )}
    >
      <MotionLink to={`/clientes/${r.id}`} className="flex flex-col gap-2.5 rounded-md">
        <div className="flex flex-col items-start gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={r.name} size="md" />
            <div className="min-w-0">
              <span className="block text-sm font-bold leading-snug text-ink">{r.name}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {[r.brand === "corpotex" ? "Corpotex" : "Unicrack", r.seller].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
          <CreditChip status={r.status} />
        </div>

        {/* Alerta roja destacada de entrega vs despacho */}
        {alert?.isOverdue && (
          <div className="rounded-lg border border-bad bg-bad-tint p-2 text-bad">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <WarningCircle size={13} weight="bold" /> ALERTA DE FECHA
              </span>
              <span className="rounded bg-bad px-1.5 py-0.5 text-[11px] text-inverse">VENCIDO</span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-ink">{alert.reason}</p>
            <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-muted">
              <span>Entrega: <b className="text-ink">{formatDate(alert.entrega!)}</b></span>
              <span>Despacho: <b className="text-ink">{alert.despacho ? formatDate(alert.despacho) : "Sin despacho"}</b></span>
            </div>
          </div>
        )}

        <div className="space-y-1 pt-1 text-xs">
          <div className="tabular flex justify-between font-semibold">
            <span className="text-muted">Crédito usado:</span>
            <span className="text-ink">{formatMoney(r.usedCents)}</span>
          </div>
          <Meter
            value={r.creditLimitCents ? r.usedCents / r.creditLimitCents : 0}
            label={`Crédito usado de ${r.name}`}
          />
        </div>

        {r.overdueCents > 0 && (
          <div className="tabular flex items-center justify-between rounded-md bg-bad-tint/50 px-2 py-1 text-xs font-bold text-bad">
            <span>Deuda vencida:</span>
            <span>{formatMoney(r.overdueCents)}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-muted">
          <span>{r.pendingOrders > 0 ? `${r.pendingOrders} por confirmar` : "Sin pedidos"}</span>
          <Link
            to={`/captura?tipo=orden&clienteId=${r.id}`}
            title="Nuevo pedido para este cliente"
            className="font-bold text-brand-blue hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            + Nuevo pedido
          </Link>
        </div>
      </MotionLink>
    </motion.div>
  );
}

function CustomerRowView({ r, alert }: { r: CustomerRow; alert?: DeliveryAlert & { orderRef: string } }) {
  const isOverdue = Boolean(alert?.isOverdue || r.overdueCents > 0);

  return (
    <motion.li
      layout
      variants={itemVariants}
      exit={EXIT}
      className={cx(
        "border-t border-line-soft first:border-t-0",
        isOverdue && "bg-bad-tint/15",
      )}
    >
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
              {[r.brand && (r.brand === "corpotex" ? "Corpotex" : "Unicrack"), r.tipo && { colegio: "Colegio", empresa: "Empresa", persona: "Persona" }[r.tipo], r.seller].filter(Boolean).join(" · ") || "Cliente"}
            </span>
            {alert?.isOverdue && (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-bad">
                <WarningCircle size={12} weight="bold" /> {alert.reason}
              </span>
            )}
          </span>
        </span>

        <span className="col-span-2 flex flex-col gap-1.5 xl:col-span-1">
          <span className="tabular flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-bold">{formatMoney(r.usedCents)}</span>
            {r.creditLimitCents != null && <span className="text-muted">de {formatMoney(r.creditLimitCents, { short: true })}</span>}
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
                {r.nextDue.ref}
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
          <Link
            to={`/captura?tipo=orden&clienteId=${r.id}`}
            className="text-xs font-bold text-brand-blue hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            + Nuevo pedido
          </Link>
        </span>
        <CaretRight size={16} weight="bold" className="hidden text-faint xl:block" />
      </MotionLink>
    </motion.li>
  );
}
