import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Bell,
  CalendarBlank,
  CaretDown,
  ChatCircleDots,
  CheckCircle,
  Copy,
  HandCoins,
  LinkSimple,
  Package,
  Phone,
  Prohibit,
  Scales,
  ShareNetwork,
  Truck,
  WarningCircle,
  XCircle,
  ArrowSquareOut,
  Wallet,
} from "@phosphor-icons/react";
import { getCustomer, type CustomerDetailDTO, type TimelineItem } from "../api/client";
import { actions } from "../api/store";
import { useApi } from "../hooks/useApi";
import { useMe } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { can } from "../lib/permissions";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { Chip, CreditChip, FinanceChip, type Tone } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Modal, inputClass } from "../components/ui/Modal";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

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
  if (data === null || (me.role === "vendedor" && me.brand !== data.customer.brand))
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
  const me = useMe();
  const c = d.customer;
  const snap = d.snapshot;
  const [requestOpen, setRequestOpen] = useState(false);
  const pending = d.requests.find((r) => r.status === "pendiente");

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <Link to="/clientes" className="animate-fade inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} weight="bold" /> Clientes
      </Link>

      <Card className="animate-rise flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="hidden sm:block">
            <AvatarXL name={c.name} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{c.name}</h1>
              <CreditChip status={snap.status} />
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span>
                {c.brand === "corpotex" ? "Corpotex" : "Unicrack"} · {c.kind === "corporativo" ? "Corporativo" : "De a pie"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Avatar name={d.seller ?? "?"} size="sm" /> {d.seller}
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone size={14} /> {c.phone}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarBlank size={14} /> Cliente desde {formatDate(c.since)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoBadge />
          {can(me.role, "solicitar_credito") && (
            <Button size="sm" variant="violet" icon={<HandCoins size={16} weight="bold" />} onClick={() => setRequestOpen(true)} disabled={Boolean(pending)} title={pending ? `Ya existe ${pending.id} pendiente` : undefined}>
              Solicitar crédito
            </Button>
          )}
        </div>
      </Card>

      {snap.suggestion && (
        <p className="animate-rise flex items-start gap-2.5 rounded-2xl bg-warn-tint px-4 py-3 text-sm font-medium text-warn ring-1 ring-[#f0dfb5]">
          <WarningCircle size={18} weight="bold" className="mt-px shrink-0" />
          <span>
            {snap.suggestion} <span className="font-normal text-ink-soft">La decisión la toma gerencia; la app no bloquea ni aprueba sola.</span>
          </span>
        </p>
      )}

      <section aria-label="Crédito" className="animate-rise grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <CreditStat label="Línea de crédito" value={<Money cents={c.creditLimitCents} />} hint={`Plazo ${c.termDays} días desde la entrega`} />
        <CreditStat
          label="Usado"
          value={<Money cents={snap.usedCents} />}
          hint={snap.usedCents > c.creditLimitCents ? `Excede la línea en ${formatMoney(snap.usedCents - c.creditLimitCents)}` : `Disponible ${formatMoney(snap.availableCents)}`}
          bar={c.creditLimitCents ? snap.usedCents / c.creditLimitCents : 0}
        />
        <CreditStat
          label="Vencido"
          value={<Money cents={snap.overdueCents} />}
          hint={snap.overdueCents > 0 ? `Hasta ${snap.maxOverdueDays} días de atraso` : snap.disputedCents > 0 ? `${formatMoney(snap.disputedCents)} en disputa` : "Sin atrasos"}
          bad={snap.overdueCents > 0}
        />
        <CreditStat
          label="Comportamiento de pago"
          value={snap.avgDaysLate === null ? "Sin cierres" : snap.avgDaysLate > 0 ? `${snap.avgDaysLate} d tarde` : snap.avgDaysLate < 0 ? `${-snap.avgDaysLate} d antes` : "A tiempo"}
          hint={snap.lastPaymentAt ? `En pedidos ya cerrados. Último pago ${formatDate(snap.lastPaymentAt)}` : "Sin pagos registrados"}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <OrdersCard d={d} />
          <TimelineCard items={d.timeline} cutDate={d.cutDate} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <SummaryCard d={d} />
          <RequestsCard d={d} />
          <ShareCard d={d} />
        </div>
      </div>

      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} d={d} />
    </div>
  );
}

function AvatarXL({ name }: { name: string }) {
  return (
    <span className="flex size-16 items-center justify-center rounded-[20px] bg-violet-tint text-xl font-extrabold text-violet-ink">
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")}
    </span>
  );
}

function CreditStat({ label, value, hint, bad, bar }: { label: string; value: ReactNode; hint: string; bad?: boolean; bar?: number }) {
  return (
    <div className="rounded-[18px] bg-card p-4 ring-1 ring-line/70">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={cx("tabular mt-1 text-xl font-extrabold tracking-tight sm:text-2xl", bad && "text-bad")}>{value}</p>
      {bar !== undefined && (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line-soft">
          <span className={cx("block h-full rounded-full", bar > 1 ? "bg-bad" : bar > 0.75 ? "bg-[#d69a1f]" : "bg-violet")} style={{ width: `${Math.max(Math.min(bar, 1) * 100, 2)}%` }} />
        </span>
      )}
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

const ALERT_STATUS: Record<string, { tone: Tone; label: string }> = {
  enviada: { tone: "info", label: "Enviada" },
  programada: { tone: "neutral", label: "Programada" },
  cancelada: { tone: "ok", label: "Cancelada por pago" },
  pausada: { tone: "warn", label: "Pausada por disputa" },
};

function OrdersCard({ d }: { d: CustomerDetailDTO }) {
  const [open, setOpen] = useState<string | null>(d.orders.find((o) => o.balanceCents > 0)?.id ?? null);
  return (
    <Card className="animate-rise p-5 sm:p-6" style={{ animationDelay: "100ms" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Pedidos</h2>
        <span className="text-[13px] text-muted">
          {d.orders.length} pedidos · <Money cents={d.snapshot.totalSoldCents} /> vendidos
        </span>
      </div>
      {d.orders.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sin pedidos todavía" />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col">
          {d.orders.map((o) => {
            const expanded = open === o.id;
            return (
              <li key={o.id} className="border-t border-line-soft first:border-t-0">
                <button
                  onClick={() => setOpen(expanded ? null : o.id)}
                  aria-expanded={expanded}
                  className="flex w-full flex-col gap-2 rounded-xl px-2 py-3.5 text-left hover:bg-panel"
                >
                  <span className="flex w-full items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{o.id}</span>
                      <span className="block truncate text-[13px] text-muted">{o.description}</span>
                    </span>
                    <span className="tabular shrink-0 text-right text-sm">
                      <span className="block font-bold">{formatMoney(o.balanceCents)}</span>
                      <span className="block text-xs text-muted">de {formatMoney(o.saleCents)}</span>
                    </span>
                    <span className="hidden shrink-0 sm:flex">
                      <FinanceChip finance={o.finance} daysToDue={o.daysToDue} />
                    </span>
                    <CaretDown size={16} weight="bold" className={cx("shrink-0 text-faint transition-transform", expanded && "rotate-180")} />
                  </span>
                  <span className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <DateCell label="Pedido" date={o.issuedOn} />
                    <DateCell label="Entrega" date={o.deliveredOn} />
                    <DateCell label={o.balanceCents > 0 && o.daysToDue < 0 ? "Venció" : "Vence"} date={o.dueDate} strong={o.balanceCents > 0} />
                    <span className="sm:hidden">
                      <FinanceChip finance={o.finance} daysToDue={o.daysToDue} />
                    </span>
                  </span>
                </button>
                {expanded && (
                  <div className="animate-fade mb-3 grid gap-4 rounded-[var(--radius-block)] bg-panel p-4 ring-1 ring-line md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-muted">Cobro</p>
                      <dl className="tabular mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                        <dt className="text-muted">Línea</dt>
                        <dd className="font-medium">{o.line}</dd>
                        <dt className="text-muted">Pagado</dt>
                        <dd className="font-medium">{formatMoney(o.paidCents)}</dd>
                        <dt className="text-muted">Último pago</dt>
                        <dd className="font-medium">{o.lastPaymentAt ? formatDateTime(o.lastPaymentAt) : "Sin pagos"}</dd>
                        {o.daysLate !== null && (
                          <>
                            <dt className="text-muted">Cierre</dt>
                            <dd className={cx("font-medium", o.daysLate > 0 && "text-bad")}>
                              {o.daysLate > 0 ? `${o.daysLate} días tarde` : o.daysLate < 0 ? `${-o.daysLate} días antes` : "El día del vencimiento"}
                            </dd>
                          </>
                        )}
                        <dt className="text-muted">Cierre operativo</dt>
                        <dd className="font-medium">Entregado el {formatDate(o.deliveredOn)}</dd>
                        <dt className="text-muted">Cierre financiero</dt>
                        <dd className="font-medium">{o.balanceCents === 0 && o.lastPaymentAt ? `Cobrado el ${formatDate(o.lastPaymentAt)}` : "Abierto"}</dd>
                      </dl>
                      {o.dispute && (
                        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-tint px-3 py-2 text-[13px] text-warn">
                          <Scales size={16} weight="bold" className="mt-px shrink-0" />
                          <span>
                            Disputa desde {formatDate(o.dispute.since)}: {o.dispute.note}
                          </span>
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                        <Bell size={14} /> Alertas internas (propuesta -3, 0, +3, +7)
                      </p>
                      <ol className="mt-2 flex flex-col gap-2">
                        {o.alerts.map((a) => (
                          <li key={a.offset} className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="min-w-0">
                              <span className="tabular font-semibold">{formatDate(a.date)}</span> <span className="text-muted">{a.label}</span>
                            </span>
                            <Chip tone={ALERT_STATUS[a.status].tone} className="px-2 py-0.5 text-[11px]">
                              {ALERT_STATUS[a.status].label}
                            </Chip>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function DateCell({ label, date, strong }: { label: string; date: string; strong?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-faint">{label}</span>
      <span className={cx(strong ? "font-bold text-ink" : "font-medium text-muted")}>{formatDate(date)}</span>
    </span>
  );
}

function SummaryCard({ d }: { d: CustomerDetailDTO }) {
  const s = d.snapshot;
  return (
    <Card className="animate-rise p-5 sm:p-6" style={{ animationDelay: "100ms" }}>
      <h2 className="text-lg font-bold tracking-tight">Resumen de cuenta</h2>
      <dl className="tabular mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-[13px] text-muted">Total comprado</dt>
          <dd className="font-bold">{formatMoney(s.totalSoldCents)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Total pagado</dt>
          <dd className="font-bold text-ok">{formatMoney(s.totalPaidCents)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Último pedido</dt>
          <dd className="font-bold">{s.lastOrderOn ? formatDate(s.lastOrderOn) : "Sin pedidos"}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">{s.nextDue && s.nextDue.dueDate < d.cutDate ? "Venció" : "Próximo vencimiento"}</dt>
          <dd className={cx("font-bold", s.nextDue && s.nextDue.dueDate < d.cutDate && "text-bad")}>{s.nextDue ? `${formatDate(s.nextDue.dueDate)} · ${s.nextDue.id}` : "Ninguno"}</dd>
        </div>
      </dl>
      <h3 className="mt-6 text-sm font-bold">Pagos recibidos</h3>
      {d.payments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sin pagos aplicados.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {d.payments.slice(0, 6).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 text-[13px] first:border-t-0">
              <span className="min-w-0">
                <span className="tabular block font-semibold">{formatDateTime(p.at)}</span>
                <span className="block truncate text-muted">
                  {p.orderId} · {p.channel}
                  {p.evidence ? (
                    <>
                      {" · "}
                      <Link to={`/conciliacion/${p.evidence}`} className="font-semibold text-violet-ink hover:underline">
                        {p.evidence}
                      </Link>
                    </>
                  ) : (
                    " · histórico"
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

function RequestsCard({ d }: { d: CustomerDetailDTO }) {
  const me = useMe();
  const toast = useToast();
  const [note, setNote] = useState("");
  const decide = (id: string, approve: boolean) => {
    const r = actions.decideCredit(id, approve, note, me);
    toast(r.ok, r.message);
    if (r.ok) setNote("");
  };
  return (
    <Card className="animate-rise p-5 sm:p-6" style={{ animationDelay: "140ms" }}>
      <h2 className="text-lg font-bold tracking-tight">Solicitudes de crédito</h2>
      {d.requests.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Este cliente no tiene solicitudes registradas.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {d.requests.map((r) => (
            <li key={r.id} className={cx("rounded-[var(--radius-block)] p-4 ring-1", r.status === "pendiente" ? "bg-violet-wash ring-violet-tint" : "bg-panel ring-line")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {r.id} · <Money cents={r.amountCents} /> a {r.termDays} días
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">{r.reason}</p>
                </div>
                {r.status === "pendiente" ? (
                  <Chip tone="violet">Pendiente</Chip>
                ) : r.status === "aprobada" ? (
                  <Chip tone="ok" icon={<CheckCircle size={14} weight="bold" />}>
                    Aprobada
                  </Chip>
                ) : (
                  <Chip tone="bad" icon={<XCircle size={14} weight="bold" />}>
                    Rechazada
                  </Chip>
                )}
              </div>
              <p className="tabular mt-2 text-xs text-muted">
                Solicitada por {r.requestedBy} el {formatDateTime(r.requestedAt)}
              </p>
              {r.decidedAt && (
                <p className="tabular mt-1 text-xs text-muted">
                  {r.status === "aprobada" ? "Aprobada" : "Rechazada"} por {r.decidedBy} el {formatDateTime(r.decidedAt)}: <span className="text-ink-soft">{r.decisionNote}</span>
                </p>
              )}
              {r.status === "pendiente" && can(me.role, "decidir_credito") && (
                <div className="mt-3 flex flex-col gap-2">
                  {d.snapshot.suggestion && <p className="text-xs font-medium text-warn">{d.snapshot.suggestion}</p>}
                  <label htmlFor={`note-${r.id}`} className="text-[13px] font-semibold">
                    Motivo de la decisión
                  </label>
                  <textarea
                    id={`note-${r.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Ej. aprobado con anticipo del 30%"
                    className="rounded-[var(--radius-block)] bg-card px-3.5 py-2.5 text-sm outline-none ring-1 ring-line placeholder:text-faint focus:ring-2 focus:ring-violet"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" icon={<CheckCircle size={16} weight="bold" />} onClick={() => decide(r.id, true)}>
                      Aprobar
                    </Button>
                    <Button size="sm" variant="danger" className="flex-1" icon={<Prohibit size={16} weight="bold" />} onClick={() => decide(r.id, false)}>
                      Rechazar
                    </Button>
                  </div>
                </div>
              )}
              {r.status === "pendiente" && !can(me.role, "decidir_credito") && <p className="mt-2 text-xs font-medium text-violet-ink">Espera la decisión de gerencia.</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ShareCard({ d }: { d: CustomerDetailDTO }) {
  const me = useMe();
  const toast = useToast();
  const allowed = can(me.role, "compartir_estado");
  const url = (token: string) => `${window.location.origin}/estado-cuenta/${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(url(token));
      toast(true, "Enlace copiado. Envíalo al cliente por WhatsApp.");
    } catch {
      toast(false, "No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  };

  return (
    <Card className="animate-rise p-5 sm:p-6" style={{ animationDelay: "180ms" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Estado de cuenta para el cliente</h2>
          <p className="mt-0.5 text-[13px] text-muted">Enlace de solo lectura, vence en 7 días. No muestra costos, márgenes ni comprobantes.</p>
        </div>
        <ShareNetwork size={22} className="shrink-0 text-faint" />
      </div>
      {allowed ? (
        <Button
          size="sm"
          variant="secondary"
          className="mt-4"
          icon={<LinkSimple size={16} weight="bold" />}
          onClick={() => {
            const r = actions.createShareLink(d.customer.id, me);
            toast(r.ok, r.message);
            if (r.ok && r.token) void copy(r.token);
          }}
        >
          Generar enlace
        </Button>
      ) : (
        <p className="mt-3 text-[13px] text-muted">Administración o gerencia generan el enlace.</p>
      )}
      {d.links.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {d.links.map((l) => (
            <li key={l.token} className="rounded-[var(--radius-block)] bg-panel p-3 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular truncate text-xs text-muted">…/estado-cuenta/{l.token.slice(0, 10)}…</span>
                <Chip tone={l.state === "activo" ? "ok" : "neutral"} className="px-2 py-0.5 text-[11px]">
                  {l.state === "activo" ? "Activo" : l.state === "vencido" ? "Vencido" : "Revocado"}
                </Chip>
              </div>
              <p className="tabular mt-1 text-xs text-muted">
                Creado por {l.createdBy} el {formatDateTime(l.createdAt)}. {l.revokedAt ? `Revocado el ${formatDateTime(l.revokedAt)}.` : `Vence el ${formatDate(l.expiresAt)}.`}
              </p>
              {l.state === "activo" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={<Copy size={14} weight="bold" />} onClick={() => void copy(l.token)}>
                    Copiar
                  </Button>
                  <a
                    href={`/estado-cuenta/${l.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-card px-3.5 text-[13px] font-semibold ring-1 ring-line hover:bg-panel"
                  >
                    <ArrowSquareOut size={14} weight="bold" /> Ver como cliente
                  </a>
                  {allowed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const r = actions.revokeShareLink(l.token, me);
                        toast(r.ok, r.message);
                      }}
                    >
                      Revocar
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const TL_ICON: Record<TimelineItem["kind"], ReactNode> = {
  pedido: <Package size={16} weight="bold" />,
  entrega: <Truck size={16} weight="bold" />,
  vencimiento: <CalendarBlank size={16} weight="bold" />,
  pago: <Wallet size={16} weight="bold" />,
  credito: <HandCoins size={16} weight="bold" />,
  disputa: <Scales size={16} weight="bold" />,
  enlace: <ShareNetwork size={16} weight="bold" />,
  alerta: <Bell size={16} weight="bold" />,
};
const TL_TONE: Record<Tone, string> = {
  ok: "bg-ok-tint text-ok",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  violet: "bg-violet-tint text-violet-ink",
  info: "bg-info-tint text-info",
  neutral: "bg-line-soft text-muted",
};

const TL_FILTERS: Array<{ id: "todo" | TimelineItem["kind"]; label: string }> = [
  { id: "todo", label: "Todo" },
  { id: "pago", label: "Pagos" },
  { id: "pedido", label: "Pedidos" },
  { id: "vencimiento", label: "Vencimientos" },
  { id: "credito", label: "Crédito" },
];

function TimelineCard({ items, cutDate }: { items: TimelineItem[]; cutDate: string }) {
  const [f, setF] = useState<(typeof TL_FILTERS)[number]["id"]>("todo");
  const [all, setAll] = useState(false);
  const visible = items.filter((i) => f === "todo" || i.kind === f);
  const shown = all ? visible : visible.slice(0, 10);
  return (
    <Card className="animate-rise p-5 sm:p-6" style={{ animationDelay: "160ms" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <ChatCircleDots size={20} className="text-faint" /> Historial
        </h2>
        <div role="radiogroup" aria-label="Filtrar historial" className="no-scrollbar flex gap-1 overflow-x-auto">
          {TL_FILTERS.map((x) => (
            <button
              key={x.id}
              role="radio"
              aria-checked={f === x.id}
              onClick={() => setF(x.id)}
              className={cx("h-8 shrink-0 rounded-full px-3 text-xs font-semibold", f === x.id ? "bg-ink text-white" : "bg-line-soft text-muted hover:text-ink")}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">Fecha de corte {formatDate(cutDate)}. Lo programado aparece arriba con borde punteado.</p>
      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sin eventos de este tipo" />
        </div>
      ) : (
        <ol className="relative mt-4 flex flex-col gap-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
          {shown.map((i) => (
            <li key={i.id} className={cx("relative flex gap-3 rounded-xl py-2.5 pl-0 pr-2", i.future && "opacity-80")}>
              <span className={cx("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", TL_TONE[i.tone], i.future && "border border-dashed border-current bg-card")}>
                {TL_ICON[i.kind]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-semibold">{i.title}</span>
                  <span className="tabular text-xs text-muted">
                    {i.future ? "Programado · " : ""}
                    {i.kind === "vencimiento" || i.kind === "pedido" || i.kind === "entrega" || i.kind === "disputa" ? formatDate(i.at) : formatDateTime(i.at)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] text-muted">
                  <span className="min-w-0">{i.detail}</span>
                  {i.amountCents != null && <span className={cx("tabular shrink-0 font-semibold", i.kind === "pago" ? "text-ok" : "text-ink")}>{i.kind === "pago" ? "+" : ""}{formatMoney(i.amountCents)}</span>}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {visible.length > 10 && (
        <button onClick={() => setAll((a) => !a)} className="mt-3 text-[13px] font-semibold text-muted hover:text-ink">
          {all ? "Ver menos" : `Ver los ${visible.length} eventos`}
        </button>
      )}
    </Card>
  );
}

function RequestModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: CustomerDetailDTO }) {
  const me = useMe();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState(String(d.customer.termDays));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Indica un monto mayor que cero.");
      return;
    }
    const r = actions.requestCredit(d.customer.id, Math.round(n * 100), Number(term), reason, me);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    toast(true, r.message);
    setAmount("");
    setReason("");
    setErr(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Solicitar crédito" subtitle={`${d.customer.name} · línea ${formatMoney(d.customer.creditLimitCents)}, usado ${formatMoney(d.snapshot.usedCents)}`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {d.snapshot.suggestion && <p className="rounded-xl bg-warn-tint px-3.5 py-2.5 text-[13px] font-medium text-warn">{d.snapshot.suggestion}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cr-amount" className="text-[13px] font-semibold">
              Monto (S/)
            </label>
            <input id="cr-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={cx(inputClass, "tabular")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cr-term" className="text-[13px] font-semibold">
              Plazo
            </label>
            <select id="cr-term" value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass}>
              {d.termOptions.map((t) => (
                <option key={t} value={t}>
                  {t} días desde la entrega
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cr-reason" className="text-[13px] font-semibold">
            Motivo y detalle del pedido
          </label>
          <textarea
            id="cr-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. 30 camisetas para el campeonato, entrega el 24/10"
            className="rounded-[var(--radius-block)] bg-panel px-3.5 py-2.5 text-sm outline-none ring-1 ring-line placeholder:text-faint focus:bg-card focus:ring-2 focus:ring-violet"
          />
        </div>
        {err && (
          <p role="alert" className="rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
            {err}
          </p>
        )}
        <p className="text-xs text-muted">Se registra con tu nombre y la fecha de hoy. Gerencia aprueba o rechaza con motivo.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="violet" icon={<HandCoins size={16} weight="bold" />}>
            Enviar solicitud
          </Button>
        </div>
      </form>
    </Modal>
  );
}
