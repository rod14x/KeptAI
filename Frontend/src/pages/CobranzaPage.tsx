import { useState } from "react";
import { motion } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { ArrowClockwise, Bell, ChatCircleText, CheckCircle, Info } from "../components/ui/icons";
import { getCobranza, MESSAGE_LABEL, type AlertRow, type MessageRow, type ReceivableRow } from "../api/client";
import { actions } from "../api/store";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { useMe } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { can } from "../lib/permissions";
import { Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { Chip, FinanceChip, MessageStateChip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

type View = "cartera" | "alertas" | "mensajes";

export function CobranzaPage() {
  const { scope } = useScope();
  const [params, setParams] = useSearchParams();
  const view = (["cartera", "alertas", "mensajes"].includes(params.get("vista") ?? "") ? params.get("vista") : "cartera") as View;
  const { data, loading, error, reload } = useApi(() => getCobranza(scope), [scope]);
  const openAlerts = data?.alerts.filter((a) => a.estado === "abierta").length ?? 0;
  const failed = data?.messages.filter((m) => m.estado === "error").length ?? 0;

  return (
    <Stagger className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <PageHeader
        title="Cobranza"
        subtitle={<>Cartera por vencimiento, alertas internas y mensajes de WhatsApp al cliente. Vista {SCOPE_LABEL[scope]}.</>}
        actions={<DemoBadge />}
      />
      <motion.p variants={itemVariants} className="flex items-start gap-2 rounded-2xl bg-info-tint px-4 py-3 text-[13px] text-info">
        <Info size={18} weight="bold" className="mt-px shrink-0" />
        WhatsApp en modo prueba (D-005): los mensajes salen por n8n WF3 y Evolution API solo al contacto de prueba. En esta demo el envío se simula.
      </motion.p>
      <motion.div variants={itemVariants}>
        <Segmented
          kind="tab"
          label="Vista de cobranza"
          value={view}
          onChange={(v) => setParams({ vista: v })}
          options={[
            { value: "cartera", label: "Por cobrar" },
            { value: "alertas", label: "Alertas", count: openAlerts },
            { value: "mensajes", label: "Mensajes WhatsApp", count: failed || undefined },
          ]}
        />
      </motion.div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton className="h-[380px] rounded-[var(--radius-card)]" />
      ) : (
        <Stagger key={view} className="flex flex-col gap-6">
          {view === "cartera" ? <Cartera rows={data.receivables} /> : view === "alertas" ? <Alertas rows={data.alerts} /> : <Mensajes rows={data.messages} />}
        </Stagger>
      )}
    </Stagger>
  );
}

const BUCKETS: Array<{ id: string; label: string; test: (r: ReceivableRow) => boolean; tone: string }> = [
  { id: "vencido", label: "Vencido", test: (r) => r.daysToDue < 0, tone: "text-bad" },
  { id: "hoy", label: "Vence hoy o en 3 días", test: (r) => r.daysToDue >= 0 && r.daysToDue <= 3, tone: "text-warn" },
  { id: "dia", label: "Al día", test: (r) => r.daysToDue > 3, tone: "text-ink" },
];

function Cartera({ rows }: { rows: ReceivableRow[] }) {
  if (rows.length === 0)
    return (
      <Card className="p-6">
        <EmptyState title="Sin saldos por cobrar">Todo lo despachado está cobrado.</EmptyState>
      </Card>
    );
  return (
    <>
      <motion.dl variants={listVariants} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {BUCKETS.map((b) => {
          const list = rows.filter(b.test);
          return (
            <motion.div variants={itemVariants} key={b.id} className="rounded-[18px] bg-card p-4 ring-1 ring-line/70">
              <dt className="text-[13px] font-semibold text-muted">{b.label}</dt>
              <dd className={cx("tabular mt-1 text-xl font-extrabold", b.tone)}>{formatMoney(list.reduce((s, r) => s + r.balanceCents, 0))}</dd>
              <p className="text-xs text-muted">{list.length} órdenes</p>
            </motion.div>
          );
        })}
      </motion.dl>
      <Card className="p-5 sm:p-6">
        <h2 className="text-section font-bold">Órdenes con saldo</h2>
        <motion.ul variants={listVariants} className="mt-3 flex flex-col">
          {rows.map((r) => (
            <motion.li variants={itemVariants} key={r.id} className="border-t border-line-soft first:border-t-0">
              <Link to={`/pedidos/${r.id}`} className="-mx-2 grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-2 py-3 hover:bg-panel sm:grid-cols-[minmax(0,1fr)_120px_120px_140px]">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.customer} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.customer}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {r.id} · {r.seller}
                    </span>
                  </span>
                </span>
                <span className="tabular hidden text-[13px] sm:block">
                  <span className="block text-xs text-muted">Vence</span>
                  <span className="font-semibold">{formatDate(r.dueDate)}</span>
                </span>
                <span className="tabular text-right text-sm font-bold">
                  <Money cents={r.balanceCents} />
                </span>
                <span className="col-span-2 flex justify-start sm:col-span-1 sm:justify-end">
                  <FinanceChip finance={r.finance} daysToDue={r.daysToDue} />
                </span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </Card>
    </>
  );
}

function Alertas({ rows }: { rows: AlertRow[] }) {
  if (rows.length === 0)
    return (
      <Card className="p-6">
        <EmptyState title="Sin alertas" icon={<Bell size={28} />}>
          Las alertas internas se abren a los 3 días de vencida una orden y se cancelan al aplicar el pago.
        </EmptyState>
      </Card>
    );
  return (
    <motion.ul variants={listVariants} className="flex flex-col gap-3">
      {rows.map((a) => (
        <motion.li variants={itemVariants} key={a.id}>
          <AlertCard a={a} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

function AlertCard({ a }: { a: AlertRow }) {
  const me = useMe();
  const toast = useToast();
  const [text, setText] = useState("");
  const open = a.estado === "abierta";
  return (
    <Card className={cx("p-5", !open && "opacity-75")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">
            <Link to={`/pedidos/${a.orderId}`} className="hover:underline">
              {a.orderId}
            </Link>{" "}
            · abierta el {formatDateTime(a.creadaAt)} · responsable {a.responsable}
          </p>
          <p className="mt-0.5 font-bold">
            <Link to={`/clientes/${a.customerId}`} className="hover:underline">
              {a.customer}
            </Link>
          </p>
          <p className="text-[13px] text-muted">{a.regla}</p>
        </div>
        <div className="text-right">
          <Chip tone={open ? "bad" : a.estado === "resuelta" ? "ok" : "neutral"}>{open ? "Abierta" : a.estado === "resuelta" ? "Resuelta" : "Cancelada"}</Chip>
          <p className="tabular mt-1 text-sm font-bold">{a.balanceCents > 0 ? `Saldo ${formatMoney(a.balanceCents)}` : "Pagado"}</p>
          {a.dueDate && <p className="tabular text-xs text-muted">Venció {formatDate(a.dueDate)}</p>}
        </div>
      </div>
      {!open && a.resolucion && (
        <p className="tabular mt-3 rounded-xl bg-panel px-3.5 py-2.5 text-[13px] text-muted">
          {a.resolucion} · {a.resueltaBy} · {a.resueltaAt ? formatDateTime(a.resueltaAt) : ""}
        </p>
      )}
      {open && can(me.role, "gestionar_cobranza") && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`res-${a.id}`} className="sr-only">
            Resolución
          </label>
          <input
            id={`res-${a.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Qué se acordó con el cliente (ej. paga el 15/10)"
            className="h-11 min-w-0 flex-1 rounded-[var(--radius-block)] bg-panel px-3.5 text-sm outline-none ring-1 ring-line focus:bg-card focus:ring-2 focus:ring-violet"
          />
          <Button
            icon={<CheckCircle size={16} weight="bold" />}
            onClick={() => {
              const r = actions.resolveAlert(a.id, text, me);
              toast(r.ok, r.message);
              if (r.ok) setText("");
            }}
          >
            Resolver
          </Button>
        </div>
      )}
    </Card>
  );
}

const MSG_FILTERS = ["todos", "enviado", "pendiente", "error", "cancelado"] as const;

function Mensajes({ rows }: { rows: MessageRow[] }) {
  const me = useMe();
  const toast = useToast();
  const [f, setF] = useState<(typeof MSG_FILTERS)[number]>("todos");
  const visible = rows.filter((m) => f === "todos" || m.estado === f);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-section font-bold">
          <ChatCircleText size={20} className="text-faint" /> Bitácora de envíos
        </h2>
        <Segmented
          tone="solid"
          size="sm"
          label="Filtrar mensajes"
          value={f}
          onChange={setF}
          options={MSG_FILTERS.map((x) => ({
            value: x,
            label: x === "todos" ? "Todos" : x === "enviado" ? "Enviados" : x === "pendiente" ? "Programados" : x === "error" ? "Con error" : "Cancelados",
            count: x === "todos" ? rows.length : rows.filter((m) => m.estado === x).length,
          }))}
        />
      </div>
      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sin mensajes en este filtro" />
        </div>
      ) : (
        <motion.ul key={f} variants={listVariants} initial="hidden" animate="show" className="mt-4 flex flex-col">
          {visible.slice(0, 40).map((m) => (
            <motion.li variants={itemVariants} key={m.id} className="border-t border-line-soft py-3 first:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {m.customer} <span className="font-normal text-muted">· {MESSAGE_LABEL[m.tipo]}</span>
                </span>
                <span className="flex items-center gap-2">
                  <MessageStateChip estado={m.estado} />
                  {m.estado === "error" && can(me.role, "gestionar_cobranza") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ArrowClockwise size={14} weight="bold" />}
                      onClick={() => {
                        const r = actions.retryMessage(m.id, me);
                        toast(r.ok, r.message);
                      }}
                    >
                      Reintentar
                    </Button>
                  )}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-muted">{m.texto}</p>
              <p className="tabular mt-1 text-xs text-faint">
                {m.contacto} · {m.estado === "enviado" && m.enviadoAt ? `enviado ${formatDateTime(m.enviadoAt)}` : `programado ${formatDateTime(m.programadoPara)}`}
                {m.orderId && ` · ${m.orderId}`}
                {m.intentos > 1 && ` · ${m.intentos} intentos`}
                {m.error && ` · ${m.error}`}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Card>
  );
}
