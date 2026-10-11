import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowSquareOut,
  CalendarBlank,
  ChatCircleDots,
  ChatCircleText,
  CheckCircle,
  HandCoins,
  Package,
  Phone,
  Receipt,
  Truck,
  Wallet,
  WarningCircle,
  XCircle,
  IdentificationCard,
} from "../components/ui/icons";
import { getCustomer, type CustomerDetailDTO, type TimelineItem } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useMe } from "../context/AuthContext";
import { can } from "../lib/permissions";
import { MotionLink, Stagger, itemVariants, listVariants, press } from "../components/motion/primitives";
import { Segmented } from "../components/ui/Segmented";
import { Meter } from "../components/ui/Meter";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { Chip, CreditChip, FinanceChip, OrderStateChip, type Tone } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

const TIPO_LABEL = { colegio: "Colegio", empresa: "Empresa", persona: "Persona" } as const;

export function ClienteDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useApi(() => getCustomer(id), [id]);
  const me = useMe();

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || data === undefined)
    return (
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-[150px] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[120px] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />
      </div>
    );
  if (data === null || (me.role === "vendedor" && me.brand && data.customer.brand && me.brand !== data.customer.brand))
    return (
      <div className="mx-auto max-w-md py-12">
        <EmptyState title="Cliente no disponible">
          No existe o no pertenece a tu marca.{" "}
          <Link to="/clientes" className="font-semibold text-violet-ink underline">
            Volver a clientes
          </Link>
        </EmptyState>
      </div>
    );
  return <Detail d={data} />;
}

function Detail({ d }: { d: CustomerDetailDTO }) {
  const c = d.customer;
  const snap = d.snapshot;
  const [tab, setTab] = useState("pedidos");
  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <MotionLink to="/clientes" variants={itemVariants} {...press} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full pr-3 text-sm font-semibold text-muted transition-colors hover:text-ink">
        <ArrowLeft size={16} weight="bold" /> Clientes
      </MotionLink>

      <Card className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-lg bg-violet-tint text-xl font-semibold text-violet-ink sm:flex">
            {c.name
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-title font-extrabold">{c.name}</h1>
              <CreditChip status={snap.status} />
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              {(c.brand || c.tipo) && <span>{[c.brand && (c.brand === "corpotex" ? "Corpotex" : "Unicrack"), c.tipo && TIPO_LABEL[c.tipo]].filter(Boolean).join(" · ")}</span>}
              <span className="inline-flex items-center gap-1">
                <IdentificationCard size={14} /> RUC/DNI {c.rucDni ?? "por confirmar"}
              </span>
              {d.seller && (
                <span className="inline-flex items-center gap-1">
                  <Avatar name={d.seller} size="sm" /> {d.seller}
                </span>
              )}
              {c.contactoWhatsapp && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={14} /> {c.contactoWhatsapp}
                </span>
              )}
              {c.since && (
                <span className="inline-flex items-center gap-1">
                  <CalendarBlank size={14} /> Cliente desde {formatDate(c.since)}
                </span>
              )}
            </p>
          </div>
        </div>
        {d.orders.some((o) => o.demo) && <DemoBadge />}
      </Card>

      {snap.aviso && (
        <motion.p variants={itemVariants} className="flex items-start gap-2.5 rounded-lg bg-warn-tint px-4 py-3 text-sm font-medium text-warn">
          <WarningCircle size={18} weight="bold" className="mt-px shrink-0" />
          <span>
            {snap.aviso} <span className="font-normal text-ink-soft">La mora no bloquea: el vendedor ve este aviso al confirmar una orden y decide.</span>
          </span>
        </motion.p>
      )}

      <motion.section variants={listVariants} aria-label="Crédito" className="metric-strip grid md:grid-cols-2 lg:grid-cols-4">
        <CreditStat
          label="Línea de referencia"
          value={<Money cents={c.creditLimitCents} />}
          hint={c.creditLimitCents == null ? "Sin línea registrada en la API" : "Plazo por orden: 15 a 30 días desde el despacho"}
        />
        <CreditStat
          label="Saldo abierto"
          value={<Money cents={snap.usedCents} />}
          hint={
            c.creditLimitCents == null
              ? "Suma de saldos por cobrar"
              : snap.usedCents > c.creditLimitCents
                ? `Supera la línea en ${formatMoney(snap.usedCents - c.creditLimitCents)}`
                : `Disponible ${formatMoney(snap.availableCents)}`
          }
          bar={c.creditLimitCents ? snap.usedCents / c.creditLimitCents : undefined}
        />
        <CreditStat label="Vencido" value={<Money cents={snap.overdueCents} />} hint={snap.overdueCents > 0 ? `Hasta ${snap.maxOverdueDays} días de atraso` : "Sin atrasos"} bad={snap.overdueCents > 0} />
        <CreditStat
          label="Historial de pago"
          value={snap.closedCount ? `${snap.paidOnTime} de ${snap.closedCount} a tiempo` : "Sin cierres"}
          hint={snap.avgDaysLate != null ? `Promedio ${snap.avgDaysLate > 0 ? `${snap.avgDaysLate} d tarde` : snap.avgDaysLate < 0 ? `${-snap.avgDaysLate} d antes` : "a tiempo"}` : "Cliente nuevo"}
        />
      </motion.section>

      <Segmented kind="tab" label="Detalle del cliente" value={tab} onChange={setTab} options={[{ value: "pedidos", label: "Pedidos" }, { value: "pagos", label: "Pagos" }, { value: "historial", label: "Historial" }]} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {tab === "pedidos" && <OrdersCard d={d} />}
          {tab === "pagos" && <PaymentsCard d={d} />}
          {tab === "historial" && <><TimelineCard items={d.timeline} cutDate={d.cutDate} /><DecisionsCard d={d} /></>}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <StatementCard d={d} />
        </div>
      </div>
    </Stagger>
  );
}

function CreditStat({ label, value, hint, bad, bar }: { label: string; value: ReactNode; hint: string; bad?: boolean; bar?: number }) {
  return (
    <motion.div variants={itemVariants}>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={cx("tabular mt-1 text-xl font-extrabold tracking-tight", bad && "text-bad")}>{value}</p>
      {bar !== undefined && (
        <span className="mt-2 block">
          <Meter value={bar} label={label} />
        </span>
      )}
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    </motion.div>
  );
}

function OrdersCard({ d }: { d: CustomerDetailDTO }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section font-bold">Órdenes</h2>
        <span className="text-[13px] text-muted">
          {d.snapshot.orderCount} confirmadas · <Money cents={d.snapshot.totalSoldCents} />
        </span>
      </div>
      {d.orders.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sin órdenes todavía" />
        </div>
      ) : (
        <motion.ul variants={listVariants} className="mt-3 flex flex-col">
          {d.orders.map((o) => (
            <motion.li variants={itemVariants} key={o.id} className="border-t border-line-soft first:border-t-0">
              <Link to={`/pedidos/${o.id}`} className="-mx-2 flex flex-col gap-2 rounded-xl px-2 py-3.5 hover:bg-panel">
                <span className="flex w-full items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{o.ref}</span>
                    <span className="block truncate text-[13px] text-muted">{o.description}</span>
                  </span>
                  <span className="tabular shrink-0 text-right text-sm">
                    <span className="block font-bold">{formatMoney(o.balanceCents)}</span>
                    <span className="block text-xs text-muted">de {formatMoney(o.saleCents)}</span>
                  </span>
                  <span className="hidden shrink-0 sm:flex">{o.estado === "despachada" ? <FinanceChip finance={o.finance} daysToDue={o.daysToDue ?? undefined} /> : <OrderStateChip estado={o.estado} />}</span>
                </span>
                <span className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <DateCell label="Pedido" date={o.issuedOn} />
                  <DateCell label="Despacho" date={o.despachoOn} />
                  <DateCell label={o.balanceCents > 0 && (o.daysToDue ?? 1) < 0 ? "Venció" : "Vence"} date={o.dueDate} strong={o.balanceCents > 0} />
                  {o.lastPaymentAt && <DateCell label="Último pago" date={o.lastPaymentAt} />}
                  {o.daysLate !== null && o.daysLate > 0 && <span className="font-semibold text-bad">cerró {o.daysLate} d tarde</span>}
                </span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Card>
  );
}

function DateCell({ label, date, strong }: { label: string; date: string | null; strong?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-faint">{label}</span>
      <span className={cx(strong ? "font-bold text-ink" : "font-medium text-muted")}>{date ? formatDate(date) : "Pendiente"}</span>
    </span>
  );
}

function DecisionsCard({ d }: { d: CustomerDetailDTO }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Decisiones de crédito</h2>
      <p className="mt-0.5 text-[13px] text-muted">Las toma el vendedor al confirmar cada orden.</p>
      {d.decisions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin decisiones registradas.</p>
      ) : (
        <motion.ul variants={listVariants} className="mt-3 flex flex-col gap-2.5">
          {d.decisions.slice(0, 6).map((r) => (
            <motion.li variants={itemVariants} key={r.orderId} className="rounded-[var(--radius-block)] bg-panel p-3.5 ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold">
                  <Link to={`/pedidos/${r.orderId}`} className="hover:underline">
                    {r.orderRef}
                  </Link>{" "}
                  · {r.tipo}
                  {r.plazoDias ? ` a ${r.plazoDias} días` : ""}
                </p>
                {r.decision === "aprobado" ? (
                  <Chip tone="ok" icon={<CheckCircle size={14} weight="bold" />}>
                    Aprobado
                  </Chip>
                ) : (
                  <Chip tone="bad" icon={<XCircle size={14} weight="bold" />}>
                    Rechazado
                  </Chip>
                )}
              </div>
              <p className="tabular mt-1 text-xs text-muted">
                {r.by} · {formatDateTime(r.at)}
                {r.nota && <span className="text-ink-soft"> · {r.nota}</span>}
              </p>
              {r.avisoMoraMostrado && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-warn">
                  <WarningCircle size={13} weight="bold" /> Vio el aviso de mora y decidió igual
                </p>
              )}
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Card>
  );
}

function PaymentsCard({ d }: { d: CustomerDetailDTO }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Pagos recibidos</h2>
      <p className="mt-0.5 text-[13px] text-muted">
        Total pagado <span className="font-semibold text-ok">{formatMoney(d.snapshot.totalPaidCents)}</span>
      </p>
      {d.payments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin pagos aplicados.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {d.payments.slice(0, 6).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 text-[13px] first:border-t-0">
              <span className="min-w-0">
                <span className="tabular block font-semibold">{formatDateTime(p.at)}</span>
                <span className="block truncate text-muted">
                  {[p.orderRef, p.channel].filter(Boolean).join(" · ")}
                  {p.evidence ? (
                    <>
                      {" · "}
                      <Link to={`/conciliacion/${p.evidence}`} className="font-semibold text-violet-ink hover:underline">
                        {p.evidence}
                      </Link>
                    </>
                  ) : (
                    p.by && " · histórico"
                  )}
                </span>
              </span>
              <span className="tabular shrink-0 font-bold text-ok">+{formatMoney(p.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatementCard({ d }: { d: CustomerDetailDTO }) {
  const me = useMe();
  const lastSent = d.messages?.find((m) => m.tipo === "estado_cuenta");
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-section font-bold">Estado de cuenta</h2>
          <p className="mt-0.5 text-[13px] text-muted">Vista para el cliente: pedidos, pagos y saldo. Sin costos, márgenes ni comprobantes.</p>
        </div>
        <Receipt size={22} className="shrink-0 text-faint" />
      </div>
      {can(me.role, "ver_estado_cuenta") ? (
        <Link
          to={`/clientes/${d.customer.id}/estado-cuenta`}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-card px-4 text-[13px] font-semibold ring-1 ring-line transition-colors hover:bg-panel"
        >
          <ArrowSquareOut size={14} weight="bold" /> Abrir estado de cuenta
        </Link>
      ) : (
        <p className="mt-3 text-[13px] text-muted">Tu rol no tiene acceso al estado de cuenta.</p>
      )}
      <p className="mt-3 text-xs text-muted">
        {lastSent
          ? `Último envío por WhatsApp: ${formatDateTime(lastSent.enviadoAt ?? lastSent.programadoPara)}.`
          : "El envío al cliente por WhatsApp lo hace n8n (WF3) con el contacto de prueba."}
      </p>
    </Card>
  );
}

const TL_ICON: Record<TimelineItem["kind"], ReactNode> = {
  pedido: <Package size={16} weight="bold" />,
  despacho: <Truck size={16} weight="bold" />,
  vencimiento: <CalendarBlank size={16} weight="bold" />,
  pago: <Wallet size={16} weight="bold" />,
  credito: <HandCoins size={16} weight="bold" />,
  mensaje: <ChatCircleText size={16} weight="bold" />,
};
const TL_TONE: Record<Tone, string> = {
  ok: "bg-ok-tint text-ok",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  violet: "bg-violet-tint text-violet-ink",
  info: "bg-info-tint text-info",
  neutral: "bg-line-soft text-muted",
};
const TL_FILTERS: Array<{ value: "todo" | TimelineItem["kind"]; label: string }> = [
  { value: "todo", label: "Todo" },
  { value: "pago", label: "Pagos" },
  { value: "pedido", label: "Pedidos" },
  { value: "credito", label: "Crédito" },
  { value: "mensaje", label: "WhatsApp" },
];

function TimelineCard({ items, cutDate }: { items: TimelineItem[]; cutDate: string }) {
  const [f, setF] = useState<(typeof TL_FILTERS)[number]["value"]>("todo");
  const [all, setAll] = useState(false);
  const visible = items.filter((i) => f === "todo" || i.kind === f || (f === "pedido" && (i.kind === "despacho" || i.kind === "vencimiento")));
  const shown = all ? visible : visible.slice(0, 10);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-section font-bold">
          <ChatCircleDots size={20} className="text-faint" /> Historial
        </h2>
        <Segmented tone="solid" size="sm" label="Filtrar historial" value={f} onChange={setF} options={TL_FILTERS} />
      </div>
      <p className="mt-1 text-xs text-muted">Fecha de corte {formatDate(cutDate)}. Lo programado lleva borde punteado.</p>
      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sin eventos de este tipo" />
        </div>
      ) : (
        <motion.ol
          key={f}
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="relative mt-4 flex flex-col gap-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line"
        >
          {shown.map((i) => (
            <motion.li variants={itemVariants} key={i.id} className={cx("relative flex gap-3 rounded-xl py-2.5 pr-2", i.future && "opacity-80")}>
              <span className={cx("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", TL_TONE[i.tone], i.future && "border border-dashed border-current bg-card")}>
                {TL_ICON[i.kind]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-semibold">{i.title}</span>
                  <span className="tabular text-xs text-muted">
                    {i.future ? "Programado · " : ""}
                    {i.dateOnly ? formatDate(i.at) : formatDateTime(i.at)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] text-muted">
                  <span className="min-w-0">{i.detail}</span>
                  {i.amountCents != null && (
                    <span className={cx("tabular shrink-0 font-semibold", i.kind === "pago" ? "text-ok" : "text-ink")}>
                      {i.kind === "pago" ? "+" : ""}
                      {formatMoney(i.amountCents)}
                    </span>
                  )}
                </span>
              </span>
            </motion.li>
          ))}
        </motion.ol>
      )}
      {visible.length > 10 && (
        <button onClick={() => setAll((a) => !a)} className="mt-3 min-h-10 text-[13px] font-semibold text-muted hover:text-ink">
          {all ? "Ver menos" : `Ver los ${visible.length} eventos`}
        </button>
      )}
    </Card>
  );
}

