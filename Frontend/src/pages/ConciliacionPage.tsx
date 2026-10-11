import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Bank, CheckCircle, CopySimple, Info, LinkSimple, NotePencil, Trash, WarningCircle, ChatCircleText, UploadSimple } from "@phosphor-icons/react";
import { getEvidence, getQueue, queueGroup, type EvidenceDetailDTO, type PaymentCard, type QueueFilter } from "../api/client";
import { actions, type ActionResult } from "../api/store";
import type { FieldKey, Person } from "../api/schemas";
import { useApi } from "../hooks/useApi";
import { useScope } from "../context/ScopeContext";
import { useMe } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { can, rolesWith, ROLE_LABEL, type Permission } from "../lib/permissions";
import { MotionLink, Stagger, itemVariants, listVariants, press, spring } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { Chip, DueTag, MatchChip } from "../components/ui/Chip";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EvidenceViewer } from "../components/evidence/EvidenceViewer";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

const FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "recibidos", label: "Recibidos" },
  { value: "revision", label: "En revisión" },
  { value: "verificados", label: "Verificados" },
  { value: "aplicados", label: "Aplicados" },
];

export function ConciliacionPage() {
  const { id } = useParams();
  const { scope } = useScope();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queue = useApi(() => getQueue(scope), [scope]);
  const filter = (FILTERS.find((f) => f.value === params.get("fase"))?.value ?? "recibidos") as QueueFilter;

  const grouped = useMemo(() => {
    const all = queue.data ?? [];
    return { visible: all.filter((c) => queueGroup(c) === filter), count: (f: QueueFilter) => all.filter((c) => queueGroup(c) === f).length };
  }, [queue.data, filter]);

  // Sin selección en escritorio: abrir el primero del filtro.
  useEffect(() => {
    if (!id && grouped.visible.length && window.matchMedia("(min-width: 1280px)").matches) {
      navigate(`/conciliacion/${grouped.visible[0].id}?fase=${filter}`, { replace: true });
    }
  }, [id, grouped.visible, filter, navigate]);

  return (
    <Stagger className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Conciliación"
        subtitle="Cada pago pasa por recibido, verificado en banco y aplicado. Solo el aplicado mueve el saldo."
        actions={
          <>
            <DemoBadge />
            {/* La carga manual es el respaldo cuando WhatsApp no trae el comprobante. */}
            <MotionLink to="/captura" {...press} className="inline-flex h-10 items-center gap-2 rounded-full bg-card px-4 text-[13px] font-semibold ring-1 ring-line transition-colors hover:bg-panel">
              <UploadSimple size={16} weight="bold" /> Cargar a mano
            </MotionLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <motion.aside variants={listVariants} className={cx("flex-col gap-3", id ? "hidden xl:flex" : "flex")} aria-label="Cola de pagos">
          <motion.div variants={itemVariants}>
            <Segmented
              label="Fase del pago"
              value={filter}
              onChange={(f) => setParams({ fase: f })}
              size="sm"
              className="flex w-full [&>button]:flex-1 [&>button]:px-2"
              options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: grouped.count(f.value) }))}
            />
          </motion.div>
          {queue.error ? (
            <ErrorState error={queue.error} onRetry={queue.reload} />
          ) : queue.loading || !queue.data ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[84px] rounded-2xl" />)
          ) : grouped.visible.length === 0 ? (
            <EmptyState title="Nada en esta fase">Cuando llegue un comprobante por WhatsApp o lo cargues a mano, aparecerá aquí.</EmptyState>
          ) : (
            <motion.div key={filter} variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-2">
              {grouped.visible.map((c) => (
                <QueueItem key={c.id} card={c} active={c.id === id} filter={filter} />
              ))}
            </motion.div>
          )}
        </motion.aside>

        <section className={cx("min-w-0", !id && "hidden xl:block")}>{id ? <Detail id={id} /> : <EmptyState title="Elige un comprobante de la lista" />}</section>
      </div>
    </Stagger>
  );
}

function QueueItem({ card, active, filter }: { card: PaymentCard; active: boolean; filter: QueueFilter }) {
  return (
    <MotionLink
      to={`/conciliacion/${card.id}?fase=${filter}`}
      aria-current={active ? "page" : undefined}
      variants={itemVariants}
      {...press}
      className={cx(
        "relative flex min-h-[84px] items-center gap-3 rounded-2xl p-3 transition-colors duration-200",
        active ? "bg-card shadow-[var(--shadow-card)]" : "bg-card/60 ring-1 ring-line/70 hover:bg-card",
      )}
    >
      {active && <motion.span layoutId="queue-active" transition={spring} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-violet" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          {card.origen === "whatsapp" ? <ChatCircleText size={13} weight="bold" /> : <UploadSimple size={13} weight="bold" />}
          {card.id}
          {card.orderId && <span className="text-faint">· {card.orderId}</span>}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold">{card.customer}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {card.status === "aplicado" ? (
            <Chip tone="ok" icon={<CheckCircle size={14} weight="bold" />}>
              Aplicado
            </Chip>
          ) : card.status === "verificado_banco" ? (
            <Chip tone="info" icon={<Bank size={14} weight="bold" />}>
              Verificado
            </Chip>
          ) : (
            <MatchChip match={card.match} />
          )}
          <span className="tabular text-[11px] text-faint">{formatDateTime(card.receivedAt)}</span>
        </div>
      </div>
      <span className="text-sm font-extrabold">{card.amountCents != null ? <Money cents={card.amountCents} /> : <span className="text-warn">S/ ?</span>}</span>
    </MotionLink>
  );
}

function Detail({ id }: { id: string }) {
  const me = useMe();
  const { data, loading, error, reload } = useApi(() => getEvidence(id), [id]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || data === undefined)
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-[520px] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[520px] rounded-[var(--radius-card)]" />
      </div>
    );
  if (data === null || (me.role === "vendedor" && data.evidence.brand !== me.brand))
    return (
      <EmptyState title={`El comprobante ${id} no está disponible`}>
        <Link to="/conciliacion" className="font-semibold text-violet-ink underline">
          Volver a la lista
        </Link>
      </EmptyState>
    );
  return <SplitView key={data.evidence.id} d={data} />;
}

const STEPS = [
  { key: "recibido", label: "Recibido" },
  { key: "verificado_banco", label: "Verificado en banco" },
  { key: "aplicado", label: "Aplicado" },
] as const;

function Stepper({ status }: { status: string }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="grid grid-cols-3 gap-1.5" aria-label="Fase del pago">
      {STEPS.map((s, i) => {
        const done = idx >= i;
        const current = idx === i;
        return (
          <li key={s.key} className="flex min-w-0 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
            <span className="h-1.5 overflow-hidden rounded-full bg-line">
              <motion.span
                className={cx("block h-full w-full origin-left rounded-full", current && status !== "aplicado" ? "bg-violet" : "bg-ok")}
                initial={false}
                animate={{ scaleX: done ? 1 : 0 }}
                transition={spring}
              />
            </span>
            <span className={cx("truncate text-[11px] font-semibold", current ? "text-ink" : done ? "text-ok" : "text-faint")}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const FIELDS: Array<{ key: FieldKey; label: string; money?: boolean; placeholder: string }> = [
  { key: "amountCents", label: "Monto (S/)", money: true, placeholder: "0.00" },
  { key: "operationRef", label: "N.° de operación", placeholder: "Ej. 00927714" },
  { key: "payer", label: "Remitente", placeholder: "Nombre del cliente" },
  { key: "paidAt", label: "Fecha y hora del pago", placeholder: "dd/mm/aaaa hh:mm" },
  { key: "channel", label: "Banco o billetera", placeholder: "Yape, Plin, BCP..." },
];

type Pending = { title: string; body: ReactNode; label: string; tone: "primary" | "violet" | "danger"; run: () => ActionResult };

function SplitView({ d }: { d: EvidenceDetailDTO }) {
  const me = useMe();
  const toast = useToast();
  const ev = d.evidence;
  const canEdit = can(me.role, "editar_evidencia");
  const [pending, setPendingState] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acceptMismatch, setAcceptMismatch] = useState(false);
  const [orderChoice, setOrderChoice] = useState("");
  // El contenido se conserva al cerrar para que el diálogo no se vacíe durante su salida.
  const setPending = (p: Pending | null) => {
    if (p) setPendingState(p);
    setConfirmOpen(p != null);
  };
  const locked = !canEdit || ev.status !== "recibido";

  const run = (fn: () => ActionResult) => {
    const r = fn();
    toast(r.ok, r.message);
  };

  const amount = ev.fields.amountCents != null ? formatMoney(ev.fields.amountCents) : "el monto";
  const needed: Permission | null = ev.status === "recibido" ? "verificar" : ev.status === "verificado_banco" ? "aplicar" : null;

  let primary: ReactNode = null;
  if (needed && !can(me.role, needed)) {
    primary = (
      <p className="flex items-start gap-2 rounded-xl bg-panel px-4 py-3 text-[13px] text-muted ring-1 ring-line">
        <Info size={18} weight="bold" className="mt-px shrink-0" />
        <span>
          Este paso lo hace {rolesWith(needed).join(" o ")}. Tu rol ({ROLE_LABEL[me.role]}) puede ver el comprobante y su estado.
        </span>
      </p>
    );
  } else if (ev.status === "recibido" && d.match === "duplicado") {
    primary = (
      <Button
        size="lg"
        variant="danger"
        className="w-full"
        icon={<CopySimple size={18} weight="bold" />}
        onClick={() =>
          setPending({
            title: `Marcar ${ev.id} como duplicado`,
            body: `Tiene el mismo código, monto y fecha que ${d.duplicateOfId}. Se guarda en el historial y no reduce el saldo.`,
            label: "Marcar duplicado",
            tone: "danger",
            run: () => actions.markDuplicate(ev.id, me),
          })
        }
      >
        Marcar como duplicado
      </Button>
    );
  } else if (ev.status === "recibido") {
    const blocked = ["sin_orden", "incompleto", "excede"].includes(d.match) || (d.match === "no_cuadra" && !acceptMismatch);
    primary = (
      <Button
        size="lg"
        className="w-full"
        disabled={blocked}
        icon={<Bank size={18} weight="bold" />}
        onClick={() =>
          setPending({
            title: "Verificar en banco",
            body: `Confirmas que el abono de ${amount} aparece en la banca de la empresa. KeptAI no se conecta al banco: esta verificación la hace Administración.`,
            label: "Verificado",
            tone: "primary",
            run: () => actions.verifyFunds(ev.id, me, acceptMismatch),
          })
        }
      >
        1. Verificar en banco
      </Button>
    );
  } else if (ev.status === "verificado_banco") {
    primary = (
      <Button
        size="lg"
        variant="violet"
        className="w-full"
        icon={<CheckCircle size={18} weight="bold" />}
        onClick={() =>
          setPending({
            title: `Aplicar ${amount} a ${ev.orderId}`,
            body: d.order ? `El saldo de ${d.order.id} pasa de ${formatMoney(d.order.balanceCents)} a ${formatMoney(d.order.balanceCents - (ev.fields.amountCents ?? 0))}.` : "",
            label: "Aplicar pago",
            tone: "violet",
            run: () => actions.applyPayment(ev.id, me),
          })
        }
      >
        2. Aplicar a la orden
      </Button>
    );
  } else if (ev.status === "aplicado") {
    primary = (
      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" disabled icon={<CheckCircle size={18} weight="fill" />}>
          Pago aplicado
        </Button>
        {can(me.role, "aplicar") && (
          <button onClick={() => run(() => actions.applyPayment(ev.id, me))} className="min-h-10 text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
            Reintentar aplicación (no duplica el pago)
          </button>
        )}
      </div>
    );
  }

  const canDiscard = can(me.role, "descartar") && ev.status === "recibido" && d.match !== "duplicado";

  return (
    <Stagger className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Link to="/conciliacion" className="-mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink xl:hidden">
        <ArrowLeft size={16} weight="bold" /> Volver a la lista
      </Link>

      <Card className="p-5 sm:p-6 lg:self-start">
        <EvidenceViewer ev={ev} />
      </Card>

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              {ev.origen === "whatsapp" ? (
                <>
                  <ChatCircleText size={14} weight="bold" /> Llegó por WhatsApp (n8n WF2)
                </>
              ) : (
                <>
                  <UploadSimple size={14} weight="bold" /> Cargado a mano
                </>
              )}
            </p>
            <h2 className="text-xl font-extrabold tracking-tight">
              {ev.id}
              {ev.orderId && <span className="font-semibold text-muted"> · {ev.orderId}</span>}
            </h2>
          </div>
          {ev.status === "aplicado" ? (
            <Chip tone="ok" icon={<CheckCircle size={14} weight="bold" />}>
              Aplicado
            </Chip>
          ) : ev.status === "descartado" ? (
            <Chip tone="neutral">Descartado: {ev.discardReason}</Chip>
          ) : (
            <MatchChip match={d.match} />
          )}
        </div>

        {ev.status !== "descartado" && <Stepper status={ev.status} />}

        {ev.status !== "aplicado" && ev.status !== "descartado" && (
          <p className="flex items-start gap-2 rounded-xl bg-warn-tint px-3.5 py-2.5 text-[13px] font-semibold text-warn">
            <Info size={18} weight="bold" className="mt-px shrink-0" />
            La IA propone, no confirma: este pago aún no reduce el saldo.
          </p>
        )}

        {d.match === "duplicado" && ev.status !== "descartado" && (
          <p className="flex items-start gap-2 rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
            <CopySimple size={18} weight="bold" className="mt-px shrink-0" />
            <span>
              Mismo código de operación, monto y fecha que{" "}
              <Link to={`/conciliacion/${d.duplicateOfId}`} className="font-bold underline">
                {d.duplicateOfId}
              </Link>
              . Queda en revisión y no se aplica.
            </span>
          </p>
        )}

        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={locked}>
          <legend className="sr-only">Datos leídos del comprobante</legend>
          {FIELDS.map((f) => (
            <FieldInput key={`${ev.id}-${f.key}`} evId={ev.id} field={f} value={ev.fields[f.key]} by={me} />
          ))}
        </fieldset>
        {ev.corrections.length > 0 && (
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted">
            <NotePencil size={14} /> {ev.corrections.length} {ev.corrections.length === 1 ? "corrección" : "correcciones"} humanas, la última de{" "}
            {ev.corrections[ev.corrections.length - 1].by} el {formatDateTime(ev.corrections[ev.corrections.length - 1].at)}.
          </p>
        )}

        {d.match === "no_cuadra" && ev.status === "recibido" && (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-warn-tint/70 p-3.5 text-[13px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet">
            <input type="checkbox" checked={acceptMismatch} onChange={(e) => setAcceptMismatch(e.target.checked)} className="mt-0.5 size-4 accent-[#7c5cdb]" />
            <span>
              <span className="font-semibold">El chat anuncia {formatMoney(ev.declaredAmountCents ?? 0)} y el comprobante dice {amount}.</span> Confirmo que el monto correcto es el del comprobante.
            </span>
          </label>
        )}

        <OrderBlock d={d} canEdit={canEdit} orderChoice={orderChoice} setOrderChoice={setOrderChoice} onAssign={() => run(() => actions.assignOrder(ev.id, orderChoice, me))} />

        <div className="mt-auto flex flex-col gap-2 border-t border-line-soft pt-5">
          {primary}
          {ev.status === "descartado" && <p className="text-center text-sm text-muted">Comprobante cerrado. Queda en el historial de auditoría.</p>}
          <Trace ev={ev} appliedBy={d.appliedBy} />
          {canDiscard && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash size={16} />}
              className="self-center"
              onClick={() =>
                setPending({
                  title: `Descartar ${ev.id}`,
                  body: "El comprobante se cierra sin afectar saldos. Queda registrado en el historial.",
                  label: "Descartar",
                  tone: "danger",
                  run: () => actions.discard(ev.id, me, "No corresponde a un pago"),
                })
              }
            >
              Descartar comprobante
            </Button>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title={pending?.title ?? ""}
        confirmLabel={pending?.label ?? ""}
        tone={pending?.tone}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending && confirmOpen) run(pending.run);
          setPending(null);
        }}
      >
        {pending?.body}
      </ConfirmDialog>
    </Stagger>
  );
}

function Trace({ ev, appliedBy }: { ev: EvidenceDetailDTO["evidence"]; appliedBy: string | null }) {
  const rows = [
    { label: ev.origen === "whatsapp" ? "Recibido por WhatsApp" : "Cargado a mano", at: ev.receivedAt, by: null as string | null },
    { label: "Verificado en banco", at: ev.verifiedAt, by: ev.verifiedBy },
    { label: "Aplicado a la orden", at: ev.appliedAt, by: appliedBy },
  ];
  return (
    <ol className="mt-1 grid gap-1.5 rounded-xl bg-panel p-3 text-xs ring-1 ring-line/70" aria-label="Trazabilidad">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3">
          <span className={cx("flex items-center gap-1.5 font-semibold", r.at ? "text-ink" : "text-faint")}>
            <span className={cx("size-1.5 rounded-full", r.at ? "bg-ok" : "bg-line")} />
            {r.label}
          </span>
          <span className="tabular text-muted">{r.at ? `${formatDateTime(r.at)}${r.by ? ` · ${r.by}` : ""}` : "Pendiente"}</span>
        </li>
      ))}
      {ev.status === "descartado" && (
        <li className="flex items-center justify-between gap-3">
          <span className="font-semibold text-bad">Descartado</span>
          <span className="text-muted">{ev.discardReason}</span>
        </li>
      )}
    </ol>
  );
}

function FieldInput({ evId, field, value, by }: { evId: string; field: (typeof FIELDS)[number]; value: string | number | null; by: Person }) {
  const toast = useToast();
  const initial = value == null ? "" : field.money ? (Number(value) / 100).toFixed(2) : String(value);
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  const id = `f-${evId}-${field.key}`;
  const missing = value == null || value === "";

  const commit = () => {
    if (draft === initial) return;
    const r = actions.editField(evId, field.key, draft, by);
    if (!r.ok) {
      toast(false, r.message);
      setDraft(initial);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="truncate text-[13px] font-semibold text-ink-soft">
        {field.label}
      </label>
      <div className="relative">
        <input
          id={id}
          value={draft}
          inputMode={field.money ? "decimal" : undefined}
          placeholder={field.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-describedby={missing ? `${id}-pending` : undefined}
          className={cx(
            "h-11 w-full rounded-[var(--radius-block)] bg-panel px-3.5 text-sm font-semibold outline-none ring-1 transition-shadow placeholder:font-normal placeholder:text-faint focus:bg-card focus:ring-2 focus:ring-violet disabled:text-muted",
            field.money && "tabular",
            missing ? "pr-24 ring-[#ecd39c]" : "ring-line",
          )}
        />
        {missing && (
          <span id={`${id}-pending`} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <Chip tone="warn" className="px-2 py-0.5 text-[11px]">
              Pendiente
            </Chip>
          </span>
        )}
      </div>
    </div>
  );
}

function OrderBlock({
  d,
  canEdit,
  orderChoice,
  setOrderChoice,
  onAssign,
}: {
  d: EvidenceDetailDTO;
  canEdit: boolean;
  orderChoice: string;
  setOrderChoice: (v: string) => void;
  onAssign: () => void;
}) {
  const ev = d.evidence;
  if (d.order) {
    const o = d.order;
    return (
      <div className="rounded-[var(--radius-block)] bg-panel p-4 ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted">Orden vinculada</p>
            <Link to={`/pedidos/${o.id}`} className="block truncate font-bold hover:underline">
              {o.id} · {o.customer}
            </Link>
            <p className="text-[13px] text-muted">
              {o.line} · vendedor {o.seller}
            </p>
          </div>
          {o.balanceCents <= 0 ? <Chip tone="ok">Sin saldo</Chip> : o.daysToDue != null ? <DueTag daysToDue={o.daysToDue} /> : <Chip tone="neutral">Sin despacho</Chip>}
        </div>
        <dl className="tabular mt-3 grid grid-cols-3 gap-3 text-[13px]">
          <div>
            <dt className="text-muted">Venta</dt>
            <dd className="font-bold">{formatMoney(o.saleCents)}</dd>
          </div>
          <div>
            <dt className="text-muted">Saldo actual</dt>
            <dd className="font-bold">{formatMoney(o.balanceCents)}</dd>
          </div>
          <div>
            <dt className="text-muted">Vence</dt>
            <dd className="font-bold">{o.dueDate ? formatDate(o.dueDate) : "Al despachar"}</dd>
          </div>
        </dl>
      </div>
    );
  }
  if (ev.status === "descartado") return null;
  return (
    <div className="rounded-[var(--radius-block)] bg-warn-tint/60 p-4 ring-1 ring-[#f0dfb5]">
      <p className="flex items-center gap-2 text-sm font-bold text-warn">
        <WarningCircle size={18} weight="bold" /> Sin orden vinculada
      </p>
      <p className="mt-1 text-[13px] text-ink-soft">Elige a qué orden corresponde. Si no corresponde a ninguna, descártalo.</p>
      {!canEdit ? (
        <p className="mt-3 text-[13px] text-muted">Administración vincula la orden.</p>
      ) : d.openOrders.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">No hay órdenes con saldo en esta marca.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="order-select" className="sr-only">
            Orden
          </label>
          <select
            id="order-select"
            value={orderChoice}
            onChange={(e) => setOrderChoice(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-[var(--radius-block)] bg-card px-3 text-sm font-medium outline-none ring-1 ring-line focus:ring-2 focus:ring-violet"
          >
            <option value="">Selecciona una orden</option>
            {d.openOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={!orderChoice} icon={<LinkSimple size={16} weight="bold" />} onClick={onAssign}>
            Vincular
          </Button>
        </div>
      )}
    </div>
  );
}
