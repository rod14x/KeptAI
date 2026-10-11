import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, CaretDown, ChatCircleText, Check, CheckCircle, Factory, Hourglass, Info, LockOpen, Prohibit, Robot, Truck, UploadSimple, WarningCircle } from "../components/ui/icons";
import { capabilities, commands, getOrder, MESSAGE_LABEL, PLAZO_MAX, PLAZO_MIN, type OrderDetailDTO, type PaymentTerms } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useMe } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { can, rolesWith } from "../lib/permissions";
import { MotionLink, Stagger, itemVariants, listVariants, press } from "../components/motion/primitives";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { Chip, FinanceChip, MatchChip, MessageStateChip, OrderStateChip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { DialogShell } from "../components/ui/Dialog";
import { inputClass } from "../components/ui/Modal";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

export function OrdenDetailPage() {
  const { ref = "" } = useParams();
  const me = useMe();
  const { data, loading, error, reload } = useApi(() => getOrder(ref), [ref]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || data === undefined)
    return (
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-[140px] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[480px] rounded-[var(--radius-card)]" />
      </div>
    );
  if (data === null || (me.role === "vendedor" && me.brand && data.card.brand && me.brand !== data.card.brand))
    return (
      <div className="mx-auto max-w-md py-12">
        <EmptyState title="Orden no disponible">
          No existe o no pertenece a tu marca.{" "}
          <Link to="/pedidos" className="font-semibold text-violet-ink underline">
            Volver a pedidos
          </Link>
        </EmptyState>
      </div>
    );
  return <Detail d={data} />;
}

/** Ciclo de la orden según el flujo del DER. */
const LIFECYCLE = [
  { key: "pendiente_aprobacion", label: "Por confirmar" },
  { key: "liberada", label: "Liberada" },
  { key: "despachada", label: "Despachada" },
  { key: "cobrada", label: "Cobrada" },
] as const;

function lifecycleIndex(d: OrderDetailDTO) {
  const o = d.order;
  if (o.estado === "pendiente_aprobacion" || o.estado === "rechazada") return 0;
  if (o.estado === "retenida") return 0.5;
  if (o.estado === "en_produccion") return 1;
  return d.card.balanceCents > 0 ? 2 : 3;
}

function Detail({ d }: { d: OrderDetailDTO }) {
  const o = d.order;
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "pagos" ? "pagos" : params.get("tab") === "mensajes" ? "mensajes" : "pedido";
  const idx = lifecycleIndex(d);
  const pending = o.estado === "pendiente_aprobacion";
  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <MotionLink to="/pedidos" variants={itemVariants} {...press} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink">
        <ArrowLeft size={16} weight="bold" /> Pedidos
      </MotionLink>

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-title font-extrabold">Por cobrar - Fecha de vencimiento</h1>
              <span className="text-xs font-semibold text-muted">({o.ref})</span>
              <OrderStateChip estado={o.estado} />
              {o.estado === "despachada" && <FinanceChip finance={d.card.finance} daysToDue={d.card.daysToDue ?? undefined} />}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              {d.customer.id ? (
                <Link to={`/clientes/${d.customer.id}`} className="font-semibold text-ink hover:underline">
                  {d.customer.name}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{d.customer.name}</span>
              )}
              <span>{[d.card.brand && (d.card.brand === "corpotex" ? "Corpotex" : "Unicrack"), o.line, `producción ${o.modality}`].filter(Boolean).join(" · ")}</span>
              {d.seller && (
                <span className="inline-flex items-center gap-1">
                  <Avatar name={d.seller} size="sm" /> {d.seller}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-end gap-6">
            <dl className="tabular grid grid-cols-3 gap-5 text-sm">
              <div>
                <dt className="text-xs text-muted">Total</dt>
                <dd className="font-extrabold">{formatMoney(o.saleCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Cobrado</dt>
                <dd className="font-extrabold text-ok">{formatMoney(d.paidCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Saldo</dt>
                <dd className={cx("font-extrabold", d.card.finance === "vencido" && "text-bad")}>{formatMoney(d.card.balanceCents)}</dd>
              </div>
            </dl>
            {d.card.demo && (
              <span className="hidden sm:block">
                <DemoBadge />
              </span>
            )}
          </div>
        </div>
        {o.estado !== "rechazada" && (
          <ol className="grid grid-cols-4 gap-1.5" aria-label="Ciclo de la orden">
            {LIFECYCLE.map((s, i) => {
              const done = idx >= i;
              const current = Math.floor(idx) === i;
              return (
                <li key={s.key} className="flex min-w-0 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
                  <span className="h-1.5 overflow-hidden rounded-full bg-line">
                    <motion.span className={cx("block h-full w-full origin-left rounded-full", current && idx < 3 ? "bg-violet" : "bg-ok")} initial={{ scaleX: 0 }} animate={{ scaleX: done ? 1 : 0 }} />
                  </span>
                  <span className={cx("truncate text-[11px] font-semibold", current ? "text-ink" : done ? "text-ok" : "text-faint")}>
                    {i === 1 && o.estado === "retenida" ? "Retenida" : s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <NextStep d={d} />
      </Card>

      <Segmented kind="tab" label="Detalle del pedido" value={tab} onChange={(value) => setParams(value === "pedido" ? {} : { tab: value })} options={[{ value: "pedido", label: "Pedido y condiciones" }, { value: "pagos", label: "Pagos y fechas" }, { value: "mensajes", label: "Seguimiento" }]} />
      {tab === "pedido" && <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {pending && <ConditionCard d={d} />}
          <HojaCard d={d} />
          <ItemsCard d={d} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {!pending && <ConditionCard d={d} />}
          <DatesCard d={d} />
        </div>
      </div>}
      {tab === "pagos" && <div className="grid items-start gap-6 xl:grid-cols-2"><div className="flex min-w-0 flex-col gap-6"><PaymentsCard d={d} /><MarginCard d={d} /></div><DatesCard d={d} /></div>}
      {tab === "mensajes" && <MessagesCard d={d} />}
    </Stagger>
  );
}

/** Quién mueve la orden ahora: así nadie tiene que acordarse del flujo. */
function NextStep({ d }: { d: OrderDetailDTO }) {
  const o = d.order;
  if (o.estado === "rechazada") return null;
  const step =
    o.estado === "pendiente_aprobacion"
      ? `${d.seller ? `${d.seller} (vendedor)` : "El vendedor"} confirma la orden y decide el crédito.`
      : o.estado === "retenida"
        ? `Administración confirma que llegó el anticipo de ${formatMoney(d.card.anticipoPendienteCents)}.`
        : o.estado === "en_produccion"
          ? "El Jefe de taller registra el despacho. Desde ahí corre el plazo de pago."
          : d.card.balanceCents > 0
            ? `El cliente paga ${formatMoney(d.card.balanceCents)}${d.card.dueDate ? ` antes del ${formatDate(d.card.dueDate)}` : ""}; Administración revisa el comprobante.`
            : null;
  return (
    <p className={cx("flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px]", step ? "bg-violet-wash text-violet-ink" : "bg-ok-tint text-ok")}>
      {step ? <ArrowRight size={16} weight="bold" className="mt-0.5 shrink-0" /> : <CheckCircle size={16} weight="bold" className="mt-0.5 shrink-0" />}
      <span>
        <span className="font-bold">{step ? "Siguiente paso: " : "Listo: "}</span>
        {step ?? "orden cobrada por completo. No queda nada por hacer."}
      </span>
    </p>
  );
}

function HojaCard({ d }: { d: OrderDetailDTO }) {
  const h = d.order.hoja;
  if (!h)
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-section font-bold">Hoja de resumen</h2>
        <p className="mt-2 text-sm text-muted">Orden sin hoja de resumen asociada: registro histórico o creada fuera del flujo de WhatsApp.</p>
      </Card>
    );
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            {h.origen === "whatsapp" ? (
              <>
                <Robot size={14} weight="bold" /> Datos extraídos de WhatsApp
              </>
            ) : (
              <>
                <UploadSimple size={14} weight="bold" /> Cargada a mano
              </>
            )}
          </p>
          <h2 className="text-section font-bold">Hoja de resumen · versión {h.version}</h2>
        </div>
        <Chip tone={h.estado === "confirmada" ? "ok" : "violet"}>{h.estado === "confirmada" ? "Confirmada" : "Borrador"}</Chip>
      </div>
      <dl className="mt-4 grid gap-2 rounded-[var(--radius-block)] bg-panel p-4 text-sm ring-1 ring-line/70 sm:grid-cols-2">
        {h.campos.map((c) => (
          <div key={c.campo} className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
            <dt className="text-[13px] text-muted">{c.campo}</dt>
            <dd className={cx("truncate font-semibold", c.estado !== "present" && "text-warn")}>
              {c.estado === "present" ? c.valor : c.estado === "illegible" ? "Ilegible" : "Falta"}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        {h.confianza != null && <Chip tone="neutral">Confianza de la extracción {Math.round(h.confianza * 100)}%</Chip>}
        {h.faltantes.length > 0 ? (
          h.faltantes.map((f) => (
            <Chip key={f} tone="warn" icon={<WarningCircle size={14} weight="bold" />}>
              Falta: {f}
            </Chip>
          ))
        ) : (
          <Chip tone="ok">Sin datos faltantes</Chip>
        )}
      </div>
      {h.revisadoPor && h.revisadoAt && (
        <p className="tabular mt-3 text-xs text-muted">
          Revisada y confirmada por {h.revisadoPor} el {formatDateTime(h.revisadoAt)}.
        </p>
      )}
    </Card>
  );
}

function ItemsCard({ d }: { d: OrderDetailDTO }) {
  // El DTO Order del contrato no trae ítems: la tarjeta solo aparece cuando la fuente los tiene.
  if (!capabilities.orderItems || d.order.items.length === 0) return null;
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Ítems</h2>
      <ul className="mt-3 flex flex-col">
        {d.order.items.map((it, i) => (
          <li key={i} className="tabular flex items-start justify-between gap-4 border-t border-line-soft py-3 text-sm first:border-t-0">
            <span className="min-w-0">
              <span className="block font-semibold">
                {it.cantidad} × {it.descripcion}
              </span>
              <span className="block text-[13px] text-muted">{it.detalle}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-bold">{formatMoney(it.cantidad * it.precioUnitCents)}</span>
              <span className="block text-xs text-muted">{formatMoney(it.precioUnitCents)} c/u</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const PLAZOS = [15, 20, 25, 30];

function termsLabel(tipo: PaymentTerms["tipo"], plazo: string, pct: string) {
  if (tipo === "contado") return "Contado";
  if (tipo === "anticipo") return `Anticipo ${pct}% y saldo a ${plazo} días`;
  return `Crédito a ${plazo} días desde el despacho`;
}

function ConditionCard({ d }: { d: OrderDetailDTO }) {
  const me = useMe();
  const toast = useToast();
  const o = d.order;
  const canDecide = can(me.role, "aprobar_credito") && can(me.role, "confirmar_orden") && (me.role !== "vendedor" || !me.brand || !d.card.brand || me.brand === d.card.brand);
  const [tipo, setTipo] = useState<PaymentTerms["tipo"]>("credito");
  const [plazo, setPlazo] = useState(String(Math.min(Math.max(d.plazoDefecto, PLAZO_MIN), PLAZO_MAX)));
  const [pct, setPct] = useState("50");
  const [nota, setNota] = useState("");
  const [moraOpen, setMoraOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [customize, setCustomize] = useState(false);

  const terms = (): PaymentTerms => ({ tipo, plazoDias: Number(plazo), anticipoPct: tipo === "anticipo" ? Number(pct) : null });
  const confirm = async (moraAcknowledged: boolean) => {
    const r = await commands.confirmOrder(o.id, terms(), me, { moraAcknowledged, nota: nota.trim() || null });
    if (!r.ok && r.code === "aviso_mora") {
      setMoraOpen(true);
      return;
    }
    toast(r.ok, r.message);
    if (r.ok) setMoraOpen(false);
  };

  if (o.estado !== "pendiente_aprobacion") {
    const c = o.condicionPago;
    const cr = o.credito;
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-section font-bold">Condición de pago</h2>
        {o.estado === "rechazada" ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] text-bad">
            <Prohibit size={18} weight="bold" className="mt-px shrink-0" /> Rechazada por {cr?.by} el {cr ? formatDateTime(cr.at) : ""}: {cr?.nota}
          </p>
        ) : (
          <>
            <dl className="tabular mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[13px] text-muted">Condición</dt>
                <dd className="font-bold">{c?.tipo === "credito" ? "Crédito" : c?.tipo === "anticipo" ? `Anticipo ${c.anticipoPct}%` : "Contado"}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Plazo desde el despacho</dt>
                <dd className="font-bold">{c?.plazoDias ? `${c.plazoDias} días` : "Sin plazo"}</dd>
              </div>
              {d.anticipoRequeridoCents > 0 && (
                <div>
                  <dt className="text-[13px] text-muted">Anticipo requerido</dt>
                  <dd className="font-bold">{formatMoney(d.anticipoRequeridoCents)}</dd>
                </div>
              )}
              <div>
                <dt className="text-[13px] text-muted">Gatekeeper</dt>
                <dd className={cx("flex items-center gap-1.5 font-bold", d.gatekeeper ? "text-ok" : "text-warn")}>
                  {d.gatekeeper ? <LockOpen size={16} weight="bold" /> : <Hourglass size={16} weight="bold" />}
                  {d.gatekeeper ? "Liberada" : "Retenida"}
                </dd>
              </div>
            </dl>
            {cr && (
              <p className="tabular mt-4 rounded-xl bg-panel px-3.5 py-2.5 text-[13px] text-muted ring-1 ring-line/70">
                Aprobado por <span className="font-semibold text-ink">{cr.by}</span> el {formatDateTime(cr.at)}.
                {cr.avisoMoraMostrado && <span className="font-semibold text-warn"> Vio el aviso de mora y decidió dar crédito.</span>}
                {cr.nota && <> {cr.nota}</>}
              </p>
            )}
            {o.estado === "retenida" && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-tint px-3.5 py-2.5 text-[13px] font-medium text-warn">
                <Hourglass size={18} weight="bold" className="mt-px shrink-0" />
                No entra a producción hasta verificar y aplicar {formatMoney(d.card.anticipoPendienteCents)} de anticipo.
              </p>
            )}
          </>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6 border-2 border-violet/30 shadow-sm">
      <h2 className="text-section font-bold">Condición de pago y crédito</h2>
      <p className="mt-1 text-[13px] text-muted">Revisa la hoja y confirma. Equivale a escribir /ok {o.ref} en WhatsApp.</p>

      {d.credit.aviso && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warn-tint px-3.5 py-2.5 text-[13px] font-medium text-warn">
          <WarningCircle size={18} weight="bold" className="mt-px shrink-0" />
          <span>
            {d.credit.aviso} <span className="font-normal text-ink-soft">La mora no bloquea: decides tú y queda registrado.</span>
          </span>
        </p>
      )}
      {!d.credit.aviso && d.credit.closedCount > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-ok-tint px-3.5 py-2.5 text-[13px] font-medium text-ok">
          <CheckCircle size={18} weight="bold" className="mt-px shrink-0" />
          Historial al día: {d.credit.paidOnTime} de {d.credit.closedCount} pedidos pagados a tiempo.
        </p>
      )}

      {!canDecide ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-panel px-4 py-3 text-[13px] text-muted ring-1 ring-line">
          <Info size={18} weight="bold" className="mt-px shrink-0" /> La confirma {rolesWith("aprobar_credito").join(" o ")} de la marca ({d.seller}).
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-violet-tint/40 p-3 ring-1 ring-violet/20">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-ink">Decisión del vendedor</span>
              <span className="block text-xs text-muted">Confirma la orden o modifícala antes de producir.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="md" icon={<Check size={18} weight="bold" />} onClick={() => confirm(false)}>
                Confirmar orden
              </Button>
              <button onClick={() => setRejectOpen(true)} className="min-h-10 rounded-lg px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-bad-tint hover:text-bad">
                Rechazar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-block)] bg-panel px-4 py-3 ring-1 ring-line/70">
            <span className="text-sm">
              <span className="font-bold">{termsLabel(tipo, plazo, pct)}</span>
              <span className="block text-xs text-muted">
                {tipo === "credito" ? "Con crédito, la orden pasa directo a producción." : tipo === "anticipo" ? "Queda retenida hasta que llegue el anticipo." : "Queda retenida hasta que llegue el pago completo."}
              </span>
            </span>
            <button
              onClick={() => setCustomize((c) => !c)}
              aria-expanded={customize}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink"
            >
              <CaretDown size={14} weight="bold" className={cx("transition-transform", customize && "rotate-180")} />
              Cambiar condición
            </button>
          </div>

          {customize && (
            <motion.div variants={itemVariants} initial="hidden" animate="show" className="flex flex-col gap-4">
              <Segmented
                label="Condición de pago"
                value={tipo}
                onChange={setTipo}
                className="flex w-full [&>button]:flex-1"
                options={[
                  { value: "credito", label: "Crédito" },
                  { value: "anticipo", label: "Anticipo" },
                  { value: "contado", label: "Contado" },
                ]}
              />
              {tipo !== "contado" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="plazo" className="text-[13px] font-semibold">
                      Plazo desde el despacho
                    </label>
                    <select id="plazo" value={plazo} onChange={(e) => setPlazo(e.target.value)} className={inputClass}>
                      {PLAZOS.map((p) => (
                        <option key={p} value={p}>
                          {p} días
                        </option>
                      ))}
                    </select>
                  </div>
                  {tipo === "anticipo" && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="pct" className="text-[13px] font-semibold">
                        Anticipo (%)
                      </label>
                      <input id="pct" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} className={cx(inputClass, "tabular")} />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nota" className="text-[13px] font-semibold">
                  Nota (opcional)
                </label>
                <input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. cliente frecuente, tallas llegan el lunes" className={inputClass} />
              </div>
            </motion.div>
          )}







        </div>
      )}

      <DialogShell open={moraOpen} onClose={() => setMoraOpen(false)} labelledBy="mora-title" panelClassName="max-w-md p-6">
        <span className="flex size-11 items-center justify-center rounded-full bg-warn-tint text-warn">
          <WarningCircle size={22} weight="bold" />
        </span>
        <h2 id="mora-title" className="mt-4 text-section font-bold">
          Este cliente está en mora
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{d.credit.aviso}</p>
        <p className="mt-2 text-sm text-muted">La decisión queda registrada con tu nombre y la marca de que viste este aviso.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button data-autofocus variant="primary" onClick={() => confirm(true)} className="w-full">
            Sí, darle crédito
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setTipo("anticipo");
              setMoraOpen(false);
            }}
            className="w-full"
          >
            Mejor pedir anticipo
          </Button>
          <Button variant="ghost" onClick={() => setMoraOpen(false)} className="w-full">
            Cancelar
          </Button>
        </div>
      </DialogShell>

      <DialogShell open={rejectOpen} onClose={() => setRejectOpen(false)} labelledBy="reject-title" panelClassName="max-w-md p-6">
        <h2 id="reject-title" className="text-section font-bold">
          Rechazar {o.ref}
        </h2>
        <label htmlFor="reason" className="mt-4 block text-[13px] font-semibold">
          Motivo
        </label>
        <textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. cliente no acepta anticipo"
          className="mt-1.5 w-full rounded-[var(--radius-block)] bg-panel px-3.5 py-2.5 text-sm outline-none ring-1 ring-line focus:bg-card focus:ring-2 focus:ring-violet"
        />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const r = await commands.rejectOrder(o.id, reason, me);
              toast(r.ok, r.message);
              if (r.ok) setRejectOpen(false);
            }}
          >
            Rechazar orden
          </Button>
        </div>
      </DialogShell>
    </Card>
  );
}

function DatesCard({ d }: { d: OrderDetailDTO }) {
  const o = d.order;
  const rows: Array<{ label: string; value: string | null; icon: ReactNode; strong?: boolean; hint?: string }> = [
    { label: "Pedido", value: o.issuedOn, icon: <ChatCircleText size={16} weight="bold" /> },
    { label: "Entrega solicitada", value: o.fechaEntregaSolicitada, icon: <Hourglass size={16} weight="bold" /> },
    { label: "Inicio de producción", value: o.inicioProduccion, icon: <Factory size={16} weight="bold" />, hint: "Cuando pasa el gatekeeper" },
    { label: "Despacho", value: o.despacho?.fecha ?? null, icon: <Truck size={16} weight="bold" />, hint: o.despacho ? `${o.despacho.acta} · ${o.despacho.by}` : "Lo registra el Jefe de taller" },
    { label: "Vencimiento", value: d.card.dueDate, icon: <WarningCircle size={16} weight="bold" />, strong: true, hint: "Despacho + plazo" },
  ];
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Fechas</h2>
      <motion.ol variants={listVariants} className="mt-3 flex flex-col">
        {rows.map((r) => (
          <motion.li variants={itemVariants} key={r.label} className="flex items-center gap-3 border-t border-line-soft py-2.5 first:border-t-0">
            <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full", r.value ? "bg-violet-tint text-violet-ink" : "bg-line-soft text-faint")}>{r.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{r.label}</span>
              {r.hint && <span className="block truncate text-xs text-muted">{r.hint}</span>}
            </span>
            <span className={cx("tabular text-sm", r.value ? (r.strong ? "font-extrabold" : "font-semibold") : "text-faint")}>{r.value ? formatDate(r.value) : "Pendiente"}</span>
          </motion.li>
        ))}
      </motion.ol>
    </Card>
  );
}

function PaymentsCard({ d }: { d: OrderDetailDTO }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Pagos</h2>
      {d.payments.length === 0 && d.pendingEvidence.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sin pagos registrados.</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {d.pendingEvidence.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 text-[13px] first:border-t-0">
              <span className="min-w-0">
                <Link to={`/conciliacion/${e.id}`} className="font-semibold text-violet-ink hover:underline">
                  {e.ref}
                </Link>{" "}
                <span className="text-muted">· {e.status === "verificado_banco" ? "verificado, falta aplicar" : "recibido, falta verificar"}</span>
                <span className="tabular block text-xs text-faint">{formatDateTime(e.receivedAt)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <MatchChip match={e.match} />
                <span className="tabular font-bold">{e.amountCents != null ? formatMoney(e.amountCents) : "S/ ?"}</span>
              </span>
            </li>
          ))}
          {d.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 text-[13px] first:border-t-0">
              <span className="min-w-0">
                <span className="tabular block font-semibold">{formatDateTime(p.at)}</span>
                <span className="block truncate text-muted">
                  {p.channel} · {p.evidenceId ?? "histórico"} · {p.by}
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

function MessagesCard({ d }: { d: OrderDetailDTO }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-section font-bold">Mensajes al cliente</h2>
          <p className="mt-0.5 text-[13px] text-muted">Los programa el sistema y los envía WhatsApp (n8n WF3), solo al contacto de prueba.</p>
        </div>
        {d.customer.contactoWhatsapp && <Chip tone="neutral">{d.customer.contactoWhatsapp}</Chip>}
      </div>
      {d.messages === null ? (
        <p className="mt-3 text-sm text-muted">La bitácora de envíos todavía no tiene endpoint en la API. Las alertas de cobranza sí se muestran abajo.</p>
      ) : d.messages.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin mensajes. Los recordatorios −3, 0 y +3 días se programan al despachar.</p>
      ) : (
        <motion.ul variants={listVariants} className="mt-3 flex flex-col">
          {d.messages.map((m) => (
            <motion.li variants={itemVariants} key={m.id} className="border-t border-line-soft py-3 first:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{MESSAGE_LABEL[m.tipo]}</span>
                <MessageStateChip estado={m.estado} />
              </div>
              <p className="tabular mt-1 text-xs text-faint">
                {m.estado === "enviado" && m.enviadoAt ? `Enviado ${formatDateTime(m.enviadoAt)}` : `Programado ${formatDateTime(m.programadoPara)}`}
                {m.intentos > 1 && ` · ${m.intentos} intentos`}
                {m.error && ` · ${m.error}`}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      )}
      {d.alerts.length > 0 && (
        <div className="mt-4 rounded-xl bg-panel p-3.5 ring-1 ring-line/70">
          <p className="text-xs font-semibold text-muted">Alertas internas</p>
          {d.alerts.map((a) => (
            <p key={a.id} className="mt-1.5 text-[13px]">
              <Chip tone={a.estado === "abierta" ? "bad" : "neutral"} className="mr-2">
                {a.estado === "abierta" ? "Abierta" : a.estado === "resuelta" ? "Resuelta" : "Cancelada"}
              </Chip>
              {a.regla} · {a.responsable}
              {a.resolucion && <span className="text-muted"> · {a.resolucion}</span>}
            </p>
          ))}
          {d.alerts.some((a) => a.estado === "abierta") && (
            <Link to="/cobranza?vista=alertas" className="mt-2 inline-block text-[13px] font-semibold text-violet-ink hover:underline">
              Gestionar en Cobranza
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}

function MarginCard({ d }: { d: OrderDetailDTO }) {
  const me = useMe();
  if (!can(me.role, "ver_resultado")) return null;
  const o = d.order;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section font-bold">Margen</h2>
        {d.costCents != null && <Chip tone={o.costOrigin === "real" ? "ok" : "warn"}>Costo {o.costOrigin === "real" ? "real" : "teórico"}</Chip>}
      </div>
      {d.costCents == null ? (
        <p className="mt-2 text-sm text-muted">Costeo incompleto: no hay margen hasta cerrar los costos reales de la orden.</p>
      ) : (
        <dl className="tabular mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-[13px] text-muted">Costo</dt>
            <dd className="font-bold">{formatMoney(d.costCents)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted" title="Venta menos costo">
              Teórico
            </dt>
            <dd className={cx("font-bold", (d.marginCents ?? 0) < 0 ? "text-bad" : "text-ok")}>
              <Money cents={d.marginCents} />
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted" title="Margen en proporción a lo cobrado">
              Percibido
            </dt>
            <dd className={cx("font-bold", (d.perceivedCents ?? 0) < 0 ? "text-bad" : "text-ink")}>
              <Money cents={d.perceivedCents} />
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
