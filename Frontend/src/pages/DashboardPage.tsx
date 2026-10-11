import { motion } from "motion/react";
import { MotionLink, Stagger, itemVariants, listVariants, press } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Bank, CaretDown, CaretRight, HandCoins, ChartLineUp, Info, MagnifyingGlass, Receipt, Wallet, WarningCircle } from "../components/ui/icons";
import { getDashboard, type ActivityItem, type AssistantNote, type DashboardDTO, type WeekPoint } from "../api/client";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { useMe } from "../context/AuthContext";
import { readPrefs } from "../lib/preferences";
import { ROLE_LABEL, can } from "../lib/permissions";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { ActivityChip, Chip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { CashFlowChart } from "../components/charts/CashFlowChart";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

export function DashboardPage() {
  const { scope } = useScope();
  const me = useMe();
  const { data, loading, error, reload } = useApi(() => getDashboard(scope, me.role, readPrefs(me.id).notify), [scope, me.id, me.role]);

  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Resumen financiero"
        subtitle={
          <>
            {ROLE_LABEL[me.role]}. Vista {SCOPE_LABEL[scope]}
            {data && <>, corte al {formatDate(data.cutDate)}</>}.
          </>
        }
        actions={data?.demo ? <DemoBadge /> : undefined}
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <Stagger className="flex flex-col gap-6 lg:gap-8">
          <Kpis d={data} canResult={can(me.role, "ver_resultado")} />
          {data.weeks ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <CashCard d={data} weeks={data.weeks} />
              <AssistantCard notes={data.assistant} />
            </div>
          ) : (
            <AssistantCard notes={data.assistant} />
          )}
          {data.activity && <ActivityCard activity={data.activity} />}
        </Stagger>
      )}
    </Stagger>
  );
}

function Kpi({
  icon,
  label,
  value,
  children,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  children: React.ReactNode;
  href: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-muted">{icon}</span>
        {href && (
          <MotionLink
            to={href}
            {...press}
            className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink"
          >
            Ver detalle <CaretRight size={14} weight="bold" />
          </MotionLink>
        )}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-muted">{label}</p>
        <p className={cx("tabular mt-1 text-[clamp(1.625rem,1.35rem+0.9vw,1.875rem)] font-extrabold leading-tight tracking-tight", (value ?? 0) < 0 && "text-bad")}>{formatMoney(value)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">{children}</div>
    </div>
  );
}

function Kpis({ d, canResult }: { d: DashboardDTO; canResult: boolean }) {
  return (
    <section aria-label="Indicadores" className="metric-strip grid md:grid-cols-3">
      <Kpi icon={<ChartLineUp size={20} weight="bold" />} label="Ingresos esperados" value={d.expectedCents} href="/pedidos">
        {d.overdueCents > 0 ? (
          <Chip tone="bad" icon={<WarningCircle size={14} weight="bold" />}>
            <Money cents={d.overdueCents} /> vencido
          </Chip>
        ) : (
          <Chip tone="ok">Sin saldo vencido</Chip>
        )}
        <span>
          {d.openOrders} {d.openOrders === 1 ? "pedido con saldo" : "pedidos con saldo"}
          {d.pipelineCount > 0 && <>, {formatMoney(d.pipelineCents)} en {d.pipelineCount} órdenes aún sin despacho</>}
        </span>
      </Kpi>
      {d.cashCents != null ? (
        <Kpi icon={<Wallet size={20} weight="bold" />} label="Caja / Saldo total" value={d.cashCents} href="/conciliacion">
          <Chip tone="ok" icon={<Bank size={14} weight="bold" />}>
            +<Money cents={d.collectedCents} /> cobrado
          </Chip>
          <span title={d.openingSource}>
            Apertura <Money cents={d.openingCents} /> (supuesto)
          </span>
        </Kpi>
      ) : (
        <Kpi icon={<Wallet size={20} weight="bold" />} label="Cobrado y aplicado" value={d.collectedCents} href={null}>
          <span>Pagos verificados en banco y aplicados a órdenes. La caja la ve gerencia.</span>
        </Kpi>
      )}
      {canResult ? (
        <Kpi icon={<Receipt size={20} weight="bold" />} label="Margen conjunto" value={d.marginCents} href="/resultado">
          <span>
            {d.marginCents == null
              ? "Costeo incompleto: no hay margen hasta cerrar los costos reales."
              : `${d.orderCount} ${d.orderCount === 1 ? "pedido" : "pedidos"}. Resultado económico, no dinero cobrado.`}
          </span>
        </Kpi>
      ) : (
        <Kpi icon={<Receipt size={20} weight="bold" />} label="En producción" value={d.pipelineCents} href="/pedidos">
          <span>
            {d.pipelineCount} {d.pipelineCount === 1 ? "orden" : "órdenes"} sin despacho: el plazo empieza al despachar.
          </span>
        </Kpi>
      )}
    </section>
  );
}

function CashCard({ d, weeks }: { d: DashboardDTO; weeks: WeekPoint[] }) {
  const [table, setTable] = useState(false);
  const negative = weeks.find((w) => w.balanceCents < 0);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-section font-bold">Caja a 4 semanas</h2>
          <p className="mt-0.5 text-[13px] text-muted">Cobros por vencimiento menos obligaciones fijas (planillas, terceros, alquiler).</p>
        </div>
        {d.factorCobro != null && (
          <Chip tone="neutral" icon={<Info size={14} weight="bold" />}>
            Factor de cobro {Math.round(d.factorCobro * 100)}%
          </Chip>
        )}
      </div>
      {negative && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
          <WarningCircle size={18} weight="bold" className="mt-px shrink-0" />
          La caja queda en {formatMoney(negative.balanceCents)} en la {negative.label.replace("Sem", "semana")} ({negative.range}).
        </p>
      )}
      <div className="mt-5">
        <CashFlowChart weeks={weeks} />
      </div>
      <button
        onClick={() => setTable((t) => !t)}
        aria-expanded={table}
        className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink"
      >
        <CaretDown size={14} weight="bold" className={cx("transition-transform", table && "rotate-180")} />
        {table ? "Ocultar tabla" : "Ver como tabla"}
      </button>
      {table && (
        <motion.div variants={itemVariants} className="mt-2 overflow-x-auto">
          <table className="tabular w-full min-w-[460px] text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 font-semibold">Semana</th>
                <th className="py-2 text-right font-semibold">Cobros</th>
                <th className="py-2 text-right font-semibold">Obligaciones</th>
                <th className="py-2 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.label} className="border-t border-line-soft">
                  <td className="py-2">
                    <span className="font-semibold">{w.label}</span> <span className="text-muted">{w.range}</span>
                  </td>
                  <td className="py-2 text-right">{formatMoney(w.inCents)}</td>
                  <td className="py-2 text-right">{formatMoney(w.outCents)}</td>
                  <td className={cx("py-2 text-right font-semibold", w.balanceCents < 0 && "text-bad")}>{formatMoney(w.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
       <details className="quiet-disclosure mt-4">
         <summary>Cómo se calcula la proyección</summary>
         <p className="mt-2 text-xs leading-relaxed text-muted">{d.demo && "Fuente: semilla de demostración. "}Saldo inicial = apertura supuesta + pagos aplicados. Un pago aplicado deja de contar como cobro futuro.</p>
       </details>
    </Card>
  );
}

const NOTE_ICON: Record<AssistantNote["tone"], React.ReactNode> = {
  violet: <HandCoins size={18} weight="bold" />,
  bad: <WarningCircle size={18} weight="bold" />,
  warn: <MagnifyingGlass size={18} weight="bold" />,
  info: <Info size={18} weight="bold" />,
};
const NOTE_TONE: Record<AssistantNote["tone"], string> = {
  violet: "bg-violet-tint text-violet-ink",
  bad: "bg-bad-tint text-bad",
  warn: "bg-warn-tint text-warn",
  info: "bg-info-tint text-info",
};

function AssistantCard({ notes }: { notes: AssistantNote[] }) {
  return (
    <motion.section variants={itemVariants}
      aria-labelledby="assistant-title"
      className="rounded-[var(--radius-card)] border border-line bg-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div>
          <h2 id="assistant-title" className="text-section font-bold">
            Requiere atención
          </h2>
          <p className="mt-1 text-[13px] text-muted">{notes.length ? `${notes.length} asuntos por revisar` : "Todo al día"}</p>
        </div>
      </div>

      <motion.ul variants={listVariants} className="mt-4 flex flex-col divide-y divide-line-soft">
        {notes.length === 0 && (
          <li className="rounded-2xl bg-card/80 p-4 text-sm text-muted">No hay duplicados, vencimientos ni comprobantes sin pedido en esta vista.</li>
        )}
        {notes.slice(0, 5).map((n) => (
          <motion.li key={n.id} variants={itemVariants}>
            <MotionLink
              to={n.href}
              {...press}
              className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-panel"
            >
              <span className={cx("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", NOTE_TONE[n.tone])}>{NOTE_ICON[n.tone]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug">{n.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{n.detail}</span>
                {n.date && <span className="tabular mt-1 block text-[11px] font-semibold text-faint">{n.date.length > 10 ? formatDateTime(n.date) : formatDate(n.date)}</span>}
              </span>
              <ArrowRight size={16} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
            </MotionLink>
          </motion.li>
        ))}
      </motion.ul>
      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">Alertas sobre la evidencia registrada. Los pagos requieren revisión humana.</p>
    </motion.section>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section font-bold">Actividad reciente</h2>
        <MotionLink to="/perfil?tab=actividad" {...press} className="inline-flex min-h-10 items-center rounded-full px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink">
          Mi actividad
        </MotionLink>
      </div>
      {activity.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sin movimientos todavía">Cuando registres comprobantes o pagos aparecerán aquí.</EmptyState>
        </div>
      ) : (
        <motion.ul variants={listVariants} className="mt-3 flex flex-col">
          {activity.map((a) => {
            const body = (
              <>
                <Avatar name={a.who} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.who}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {a.text}
                    {a.reference && ` · ${a.reference}`} · {a.actor}
                  </span>
                </span>
                <span className="hidden w-32 text-right text-[13px] text-muted sm:block">{formatDateTime(a.at)}</span>
                <span className="w-24 text-right text-sm font-bold">{a.amountCents != null ? <Money cents={a.amountCents} /> : "Sin monto"}</span>
                <span className="hidden w-28 justify-end md:flex">
                  <ActivityChip status={a.status} />
                </span>
              </>
            );
            return (
              <motion.li key={a.id} variants={itemVariants} className="border-t border-line-soft first:border-t-0">
                {a.href ? (
                  <Link to={a.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-panel">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{body}</div>
                )}
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[178px] rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />
      </div>
      <Skeleton className="h-[320px] rounded-[var(--radius-card)]" />
    </div>
  );
}
