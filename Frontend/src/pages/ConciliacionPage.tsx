import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Bank, CaretDown, CheckCircle, CopySimple, Info, LinkSimple, NotePencil, Trash, WarningCircle, ChatCircleText, UploadSimple } from "../components/ui/icons";
import { capabilities, commands, getEvidence, getQueue, queueGroup, type ActionResult, type EvidenceDetailDTO, type PaymentCard } from "../api/client";
import type { FieldKey, Person } from "../api/model";
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

// Bandeja de pagos: un comprobante a la vez, una acción principal ("Sí, llegó al banco") y,
// al terminar, pasa solo al siguiente. Por dentro el pago sigue RECIBIDO → VERIFICADO_BANCO → APLICADO
// con dos comandos auditados; la persona los confirma juntos en un único diálogo.

type Fase = "por_revisar" | "problema" | "hechos";

const FASES: Array<{ value: Fase; label: string }> = [
  { value: "por_revisar", label: "Por revisar" },
  { value: "problema", label: "Con problema" },
  { value: "hechos", label: "Hechos" },
];

function faseOf(c: PaymentCard): Fase | null {
  const g = queueGroup(c);
  if (!g) return null;
  return g === "aplicados" ? "hechos" : g === "revision" ? "problema" : "por_revisar";
}

export function ConciliacionPage() {
  const { id } = useParams();
  const { scope } = useScope();
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queue = useApi(() => getQueue(scope), [scope]);

  const all = queue.data ?? [];
  const current = id ? all.find((c) => c.id === id) : undefined;
  // Sin fase en la URL, se usa la del comprobante abierto (un enlace directo cae en su lista).
  const fase = FASES.find((f) => f.value === params.get("fase"))?.value ?? (current && faseOf(current)) ?? "por_revisar";

  const visible = useMemo(() => all.filter((c) => faseOf(c) === fase), [all, fase]);
  const count = (f: Fase) => all.filter((c) => faseOf(c) === f).length;

  const nextHref = useMemo(() => {
    const i = visible.findIndex((c) => c.id === id);
    const next = (i >= 0 ? visible[i + 1] : undefined) ?? visible.find((c) => c.id !== id);
    return next ? `/conciliacion/${next.id}?fase=${fase}` : null;
  }, [visible, id, fase]);

  // Sin selección en escritorio: abrir el primero de la lista.
  useEffect(() => {
    if (!id && visible.length && window.matchMedia("(min-width: 1280px)").matches) {
      navigate(`/conciliacion/${visible[0].id}?fase=${fase}`, { replace: true });
    }
  }, [id, visible, fase, navigate]);

  return (
    <Stagger className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Pagos"
        subtitle="Confirma que cada pago llegó a tu banca. Recién ahí se descuenta de la deuda."
        actions={
          <>
            <DemoBadge />
            {/* La carga manual es el respaldo cuando WhatsApp no trae el comprobante. */}
            {can(me.role, "captura") && (
              <MotionLink to="/captura" {...press} className="inline-flex h-11 items-center gap-2 rounded-lg bg-card px-4 text-[13px] font-semibold ring-1 ring-line transition-colors hover:bg-panel">
                <UploadSimple size={16} weight="bold" /> Subir comprobante
              </MotionLink>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <motion.aside variants={listVariants} className={cx("flex-col gap-3 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-120px)] xl:self-start xl:overflow-y-auto xl:pr-2", id ? "hidden xl:flex" : "flex")} aria-label="Lista de pagos">
          <motion.div variants={itemVariants}>
            <Segmented
              label="Qué pagos ver"
              value={fase}
              onChange={(f) => setParams({ fase: f })}
              size="sm"
              className="flex w-full [&>button]:flex-1 [&>button]:px-2"
              options={FASES.map((f) => ({ value: f.value, label: f.label, count: count(f.value) }))}
            />
          </motion.div>
          {queue.error ? (
            <ErrorState error={queue.error} onRetry={queue.reload} />
          ) : queue.loading || !queue.data ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[84px] rounded-2xl" />)
          ) : visible.length === 0 ? (
            <EmptyState title={fase === "por_revisar" ? "Todo al día" : "Nada por aquí"} icon={fase === "por_revisar" ? <CheckCircle size={28} weight="fill" className="text-ok" /> : undefined}>
              Cuando llegue un comprobante por WhatsApp o lo subas a mano, aparecerá aquí.
            </EmptyState>
          ) : (
            <motion.div key={fase} variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-1">
              {visible.map((c) => (
                <QueueItem key={c.id} card={c} active={c.id === id} fase={fase} />
              ))}
            </motion.div>
          )}
        </motion.aside>

        <section className={cx("min-w-0", !id && "hidden xl:block")}>
          {id ? <Detail id={id} nextHref={nextHref} /> : <EmptyState title={visible.length ? "Elige un pago de la lista" : "No hay pagos por revisar"} />}
        </section>
      </div>
    </Stagger>
  );
}

function QueueItem({ card, active, fase }: { card: PaymentCard; active: boolean; fase: Fase }) {
  return (
    <MotionLink
      to={`/conciliacion/${card.id}?fase=${fase}`}
      aria-current={active ? "page" : undefined}
      variants={itemVariants}
      {...press}
      className={cx(
        "relative flex min-h-[100px] items-center gap-3 rounded-lg p-3 transition-colors duration-150",
        active ? "bg-violet-tint" : "border-b border-line hover:bg-card",
      )}
    >
      {active && <motion.span layoutId="queue-active" transition={spring} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-violet/40" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          {card.origen === "whatsapp" ? <ChatCircleText size={13} weight="bold" /> : <UploadSimple size={13} weight="bold" />}
          {card.ref}
          {card.orderRef && <span className="text-faint">· {card.orderRef}</span>}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold">{card.customer}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {card.status === "aplicado" ? (
            <Chip tone="ok" icon={<CheckCircle size={14} weight="bold" />}>
              Descontado
            </Chip>
          ) : card.status === "verificado_banco" ? (
            <Chip tone="info" icon={<Bank size={14} weight="bold" />}>
              Llegó, falta descontar
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

function Detail({ id, nextHref }: { id: string; nextHref: string | null }) {
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
  if (data === null || (me.role === "vendedor" && me.brand && data.brand && data.brand !== me.brand))
    return (
      <EmptyState title={`El comprobante ${id} no está disponible`}>
        <Link to="/conciliacion" className="font-semibold text-violet-ink underline">
          Volver a la lista
        </Link>
      </EmptyState>
    );
  return <SplitView key={data.evidence.id} d={data} nextHref={nextHref} />;
}

const FIELDS: Array<{ key: FieldKey; label: string; money?: boolean; placeholder: string }> = [
  { key: "amountCents", label: "Monto (S/)", money: true, placeholder: "0.00" },
  { key: "operationRef", label: "N.° de operación", placeholder: "Ej. 00927714" },
  { key: "payer", label: "Remitente", placeholder: "Nombre del cliente" },
  { key: "paidAt", label: "Fecha y hora del pago", placeholder: "dd/mm/aaaa hh:mm" },
  { key: "channel", label: "Banco o billetera", placeholder: "Yape, Plin, BCP..." },
];

function showField(f: (typeof FIELDS)[number], v: string | number | null) {
  if (v == null || v === "") return null;
  if (f.money) return formatMoney(Number(v));
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v);
  return String(v);
}

type Pending = { title: string; body: ReactNode; label: string; tone: "primary" | "violet" | "danger"; run: () => Promise<ActionResult>; advance: boolean };

function SplitView({ d, nextHref }: { d: EvidenceDetailDTO; nextHref: string | null }) {
  const me = useMe();
  const toast = useToast();
  const navigate = useNavigate();
  const ev = d.evidence;
  const canEdit = can(me.role, "editar_evidencia") && capabilities.editPaymentFields && ev.status === "recibido";
  const canLink = can(me.role, "aplicar");
  const missingField = FIELDS.some((f) => ev.fields[f.key] == null || ev.fields[f.key] === "");
  const [editing, setEditing] = useState(canEdit && missingField);
  const [more, setMore] = useState(false);
  const [pending, setPendingState] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acceptMismatch, setAcceptMismatch] = useState(false);
  const [orderChoice, setOrderChoice] = useState("");
  // El contenido se conserva al cerrar para que el diálogo no se vacíe durante su salida.
  const setPending = (p: Pending | null) => {
    if (p) setPendingState(p);
    setConfirmOpen(p != null);
  };

  const run = async (fn: () => Promise<ActionResult>, advance = false) => {
    const r = await fn();
    toast(r.ok, r.message);
    // Bandeja: al resolver un pago, pasar solo al siguiente.
    if (r.ok && advance) navigate(nextHref ?? "/conciliacion?fase=por_revisar");
  };

  /** "Sí, llegó": verifica en banco y, si el rol puede, descuenta de la deuda en el mismo paso. */
  const verifyAndApply = async (): Promise<ActionResult> => {
    const v = await commands.verifyFunds(ev.id, me, acceptMismatch);
    if (!v.ok || !can(me.role, "aplicar")) return v;
    // D-012 (API): la aplicación la hace un ADMIN distinto de quien verificó.
    if (!capabilities.applyBySameVerifier) return { ok: true, message: `${v.message} Otra persona de Administración lo descuenta de la deuda.` };
    const a = await commands.applyPayment(ev.id, me);
    return a.ok ? a : { ok: false, message: `Quedó verificado en banco, pero no se descontó: ${a.message}` };
  };

  const amount = ev.fields.amountCents != null ? formatMoney(ev.fields.amountCents) : "el monto";
  const balanceLine = d.order
    ? ` Se descuenta de ${d.order.ref}: el saldo pasa de ${formatMoney(d.order.balanceCents)} a ${formatMoney(d.order.balanceCents - (ev.fields.amountCents ?? 0))}.`
    : "";
  const needed: Permission | null = ev.status === "recibido" ? "verificar" : ev.status === "verificado_banco" ? "aplicar" : null;
  const open = ev.status === "recibido" || ev.status === "verificado_banco";

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
  } else if (ev.status === "recibido" && d.match === "duplicado" && (d.duplicateMarked || !capabilities.markDuplicate)) {
    primary = (
      <p className="flex items-start gap-2 rounded-xl bg-panel px-4 py-3 text-[13px] text-muted ring-1 ring-line">
        <CopySimple size={18} weight="bold" className="mt-px shrink-0" />
        <span>{d.duplicateMarked ? "Marcado como duplicado" : "El backend lo clasificó como duplicado"}: queda en revisión y no se descuenta.</span>
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
            title: `Marcar ${ev.ref} como duplicado`,
            body: `Tiene el mismo código, monto y fecha que ${d.duplicateOfRef ?? "otro comprobante"}. Se guarda en el historial y no reduce el saldo.`,
            label: "Marcar duplicado",
            tone: "danger",
            run: () => commands.markDuplicate(ev.id, me),
            advance: true,
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
            title: "¿Llegó el pago?",
            body: `Confirmas que el abono de ${amount} aparece en la banca de la empresa.${can(me.role, "aplicar") ? balanceLine : ""} KeptAI no se conecta al banco: esto lo confirmas tú.`,
            label: "Sí, llegó",
            tone: "primary",
            run: verifyAndApply,
            advance: true,
          })
        }
      >
        Sí, llegó al banco
      </Button>
    );
  } else if (ev.status === "verificado_banco" && d.verifiedByMe && !capabilities.applyBySameVerifier) {
    primary = (
      <p className="flex items-start gap-2 rounded-xl bg-panel px-4 py-3 text-[13px] text-muted ring-1 ring-line">
        <Info size={18} weight="bold" className="mt-px shrink-0" />
        <span>Lo verificaste tú: otra persona de Administración lo descuenta de la deuda (segregación D-012).</span>
      </p>
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
            title: `Descontar ${amount} de ${d.order?.ref ?? "la orden"}`,
            body: balanceLine.trim(),
            label: "Descontar",
            tone: "violet",
            run: () => commands.applyPayment(ev.id, me),
            advance: true,
          })
        }
      >
        Descontar de la deuda
      </Button>
    );
  } else if (ev.status === "aplicado") {
    primary = (
      <p className="flex items-center justify-center gap-2 rounded-xl bg-ok-tint px-4 py-3 text-sm font-semibold text-ok">
        <CheckCircle size={18} weight="fill" /> Pago descontado de la deuda
      </p>
    );
  }

  const canDiscard = capabilities.discardPayment && can(me.role, "descartar") && ev.status === "recibido" && d.match !== "duplicado";
  const canRetry = ev.status === "aplicado" && can(me.role, "aplicar");

  return (
    <Stagger className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Link to="/conciliacion" className="-mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink xl:hidden">
        <ArrowLeft size={16} weight="bold" /> Volver a la lista
      </Link>

      <Card className="p-5 sm:p-6 lg:self-start">
        <EvidenceViewer ev={ev} imageUrl={d.imageUrl} />
      </Card>

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              {ev.origen === "whatsapp" ? (
                <>
                  <ChatCircleText size={14} weight="bold" /> Llegó por WhatsApp
                </>
              ) : (
                <>
                  <UploadSimple size={14} weight="bold" /> Cargado a mano
                </>
              )}
            </p>
            <h2 className="text-xl font-extrabold tracking-tight">
              {ev.ref}
              {d.order && <span className="font-semibold text-muted"> · {d.order.ref}</span>}
            </h2>
          </div>
          {ev.status === "aplicado" ? (
            <Chip tone="ok" icon={<CheckCircle size={14} weight="bold" />}>
              Descontado
            </Chip>
          ) : ev.status === "descartado" ? (
            <Chip tone="neutral">Descartado: {ev.discardReason}</Chip>
          ) : ev.status === "verificado_banco" ? (
            <Chip tone="info" icon={<Bank size={14} weight="bold" />}>
              Llegó, falta descontar
            </Chip>
          ) : (
            <MatchChip match={d.match} />
          )}
        </div>

        {d.match === "duplicado" && ev.status !== "descartado" && (
          <p className="flex items-start gap-2 rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
            <CopySimple size={18} weight="bold" className="mt-px shrink-0" />
            <span>
              Mismo código de operación, monto y fecha que{" "}
              {d.duplicateOfId ? (
                <Link to={`/conciliacion/${d.duplicateOfId}`} className="font-bold underline">
                  {d.duplicateOfRef ?? "otro comprobante"}
                </Link>
              ) : (
                "otro comprobante"
              )}
              . Queda en revisión y no se descuenta.
            </span>
          </p>
        )}

        <section aria-labelledby="leido-title" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="leido-title" className="text-sm font-bold">
              Datos del comprobante
            </h3>
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink">
                <NotePencil size={16} /> Corregir
              </button>
            )}
          </div>
          {editing ? (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Datos leídos del comprobante</legend>
              {FIELDS.map((f) => (
                <FieldInput key={`${ev.id}-${f.key}`} evId={ev.id} field={f} value={ev.fields[f.key]} by={me} />
              ))}
            </fieldset>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-[var(--radius-block)] bg-panel p-4 text-sm ring-1 ring-line/70">
              {FIELDS.map((f) => {
                const v = showField(f, ev.fields[f.key]);
                return (
                  <div key={f.key} className="min-w-0">
                    <dt className="truncate text-xs text-muted">{f.label.replace(" (S/)", "")}</dt>
                    <dd className={cx("truncate font-semibold", !v && "text-warn", f.money && "tabular")}>{v ?? "Falta"}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          {open && <p className="text-xs text-muted">Leído por la IA. No descuenta nada hasta que tú lo confirmes.</p>}
        </section>

        {d.match === "no_cuadra" && ev.status === "recibido" && (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-warn-tint/70 p-3.5 text-[13px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet">
            <input type="checkbox" checked={acceptMismatch} onChange={(e) => setAcceptMismatch(e.target.checked)} className="mt-0.5 size-4 accent-violet" />
            <span>
              <span className="font-semibold">
                {ev.declaredAmountCents != null ? `El cliente anunció ${formatMoney(ev.declaredAmountCents)} y el comprobante dice ${amount}.` : `El monto del comprobante (${amount}) no cuadra con el saldo.`}
              </span>{" "}
              Confirmo que el monto correcto es el del comprobante.
            </span>
          </label>
        )}

        <OrderBlock d={d} canEdit={canLink} orderChoice={orderChoice} setOrderChoice={setOrderChoice} onAssign={() => run(() => commands.assignOrder(ev.id, orderChoice, me))} />

        <div className="mt-auto flex flex-col gap-2 border-t border-line-soft pt-5">
          {primary}
          {ev.status === "descartado" && <p className="text-center text-sm text-muted">Comprobante cerrado. Queda en el historial de auditoría.</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink"
            >
              <CaretDown size={14} weight="bold" className={cx("transition-transform", more && "rotate-180")} />
              Más opciones
            </button>
            {open && nextHref && (
              <MotionLink to={nextHref} {...press} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink">
                Saltar <ArrowRight size={14} weight="bold" />
              </MotionLink>
            )}
          </div>

          {more && (
            <motion.div variants={itemVariants} initial="hidden" animate="show" className="flex flex-col gap-2">
              <Trace ev={ev} appliedBy={d.appliedBy} />
              {canRetry && (
                <button onClick={() => run(() => commands.applyPayment(ev.id, me))} className="min-h-10 text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
                  Reintentar descuento (no duplica el pago)
                </button>
              )}
              {canDiscard && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash size={16} />}
                  className="self-center"
                  onClick={() =>
                    setPending({
                      title: `Descartar ${ev.ref}`,
                      body: "El comprobante se cierra sin afectar saldos. Queda registrado en el historial.",
                      label: "Descartar",
                      tone: "danger",
                      run: () => commands.discard(ev.id, me, "No corresponde a un pago"),
                      advance: true,
                    })
                  }
                >
                  Descartar comprobante
                </Button>
              )}
            </motion.div>
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
          if (pending && confirmOpen) run(pending.run, pending.advance);
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
    { label: "Descontado de la deuda", at: ev.appliedAt, by: appliedBy },
  ];
  return (
    <ol className="grid gap-1.5 rounded-xl bg-panel p-3 text-xs ring-1 ring-line/70" aria-label="Historial del pago">
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

  const commit = async () => {
    if (draft === initial) return;
    const r = await commands.editField(evId, field.key, draft, by);
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
            <p className="text-xs font-semibold text-muted">{ev.status === "aplicado" ? "Se descontó de" : "Se descuenta de"}</p>
            <Link to={`/pedidos/${o.id}`} className="block truncate font-bold hover:underline">
              {o.ref} · {o.customer}
            </Link>
            {(o.line || o.seller) && <p className="text-[13px] text-muted">{[o.line, o.seller && `vendedor ${o.seller}`].filter(Boolean).join(" · ")}</p>}
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
        <WarningCircle size={18} weight="bold" /> ¿De qué pedido es este pago?
      </p>
      <p className="mt-1 text-[13px] text-ink-soft">
        Elige el pedido.{capabilities.discardPayment ? ' Si no corresponde a ninguno, descártalo desde "Más opciones".' : " Si no corresponde a ninguno, queda en revisión."}
      </p>
      {!canEdit ? (
        <p className="mt-3 text-[13px] text-muted">Administración elige el pedido.</p>
      ) : d.openOrders.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">No hay pedidos con saldo que coincidan con este pago.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="order-select" className="sr-only">
            Pedido
          </label>
          <select
            id="order-select"
            value={orderChoice}
            onChange={(e) => setOrderChoice(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-[var(--radius-block)] bg-card px-3 text-sm font-medium outline-none ring-1 ring-line focus:ring-2 focus:ring-violet"
          >
            <option value="">Selecciona un pedido</option>
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
