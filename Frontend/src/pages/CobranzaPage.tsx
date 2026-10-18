import { useState } from "react";
import { motion } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { ArrowClockwise, Bell, ChatCircleText, CheckCircle, CopySimple, Info, Receipt } from "../components/ui/icons";
import { capabilities, commands, getCobranza, MESSAGE_LABEL, type AlertRow, type MessageRow, type ReceivableRow } from "../api/client";
import { IS_MOCK } from "../config";
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
  const views: View[] = capabilities.messagesLog ? ["cartera", "alertas", "mensajes"] : ["cartera", "alertas"];
  const view = (views.includes(params.get("vista") as View) ? params.get("vista") : "cartera") as View;
  const { data, loading, error, reload } = useApi(() => getCobranza(scope), [scope]);
  const openAlerts = data?.alerts.filter((a) => a.estado === "abierta").length ?? 0;
  const failed = data?.messages?.filter((m) => m.estado === "error").length ?? 0;

  return (
    <Stagger className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <PageHeader
        title="Cobranza"
        subtitle={<>Prioriza los vencimientos y da seguimiento a cada saldo. Vista {SCOPE_LABEL[scope]}.</>}
        actions={IS_MOCK ? <DemoBadge /> : undefined}
      />
      {view === "mensajes" && (
        <motion.p variants={itemVariants} className="flex items-start gap-2 rounded-lg border border-line px-4 py-3 text-[13px] text-muted">
          <Info size={18} weight="bold" className="mt-px shrink-0" />
          WhatsApp en modo prueba (D-005): los mensajes salen por n8n WF3 y Evolution API solo al contacto de prueba.{IS_MOCK ? " En esta demo el envío se simula." : " KeptAI no guarda el texto de los mensajes."}
        </motion.p>
      )}
      <motion.div variants={itemVariants}>
        <Segmented
          kind="tab"
          label="Vista de cobranza"
          value={view}
          onChange={(v) => setParams({ vista: v })}
          options={[
            { value: "cartera", label: "Por cobrar" },
            { value: "alertas", label: "Alertas", count: openAlerts },
            ...(capabilities.messagesLog ? [{ value: "mensajes" as const, label: "Mensajes WhatsApp", count: failed || undefined }] : []),
          ]}
        />
      </motion.div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton className="h-[380px] rounded-[var(--radius-card)]" />
      ) : (
        <Stagger key={view} className="flex flex-col gap-6">
          {view === "cartera" ? <Cartera rows={data.receivables} /> : view === "alertas" ? <Alertas rows={data.alerts} /> : <Mensajes rows={data.messages ?? []} />}
        </Stagger>
      )}
    </Stagger>
  );
}

const BUCKETS: Array<{ id: string; label: string; test: (r: ReceivableRow) => boolean; tone: string }> = [
  { id: "vencido", label: "Vencido (Crítico)", test: (r) => r.daysToDue < 0, tone: "text-bad" },
  { id: "hoy", label: "Vence hoy o en 3 días", test: (r) => r.daysToDue >= 0 && r.daysToDue <= 3, tone: "text-warn" },
  { id: "dia", label: "Al día", test: (r) => r.daysToDue > 3, tone: "text-ink" },
];

function Cartera({ rows }: { rows: ReceivableRow[] }) {
  const toast = useToast();
  const [filter, setFilter] = useState<string>("todos");

  if (rows.length === 0)
    return (
      <Card className="p-6">
        <EmptyState title="Sin saldos por cobrar">Todo lo despachado está cobrado.</EmptyState>
      </Card>
    );

  const filteredRows = rows.filter((r) => {
    if (filter === "vencido") return r.daysToDue < 0;
    if (filter === "hoy") return r.daysToDue >= 0 && r.daysToDue <= 3;
    if (filter === "dia") return r.daysToDue > 3;
    return true;
  });

  const copyWhatsApp = (r: ReceivableRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = `Estimado(a) ${r.customer}, le saludamos de Corpotex & Unicrack. Le recordamos que el pedido ${r.orderRef} mantiene un saldo pendiente de ${formatMoney(r.balanceCents)} con fecha de vencimiento ${formatDate(r.dueDate)}. Agradeceremos remitir su comprobante de pago a este canal para conciliar su cuenta. ¡Muchas gracias!`;
    navigator.clipboard.writeText(text);
    toast(true, `Recordatorio copiado para ${r.customer}`);
  };

  return (
    <>
      <motion.dl variants={listVariants} className="metric-strip grid grid-cols-1 md:grid-cols-3">
        {BUCKETS.map((b) => {
          const list = rows.filter(b.test);
          const isSelected = filter === b.id;
          return (
            <motion.div
              variants={itemVariants}
              key={b.id}
              onClick={() => setFilter(isSelected ? "todos" : b.id)}
              className={cx(
                "cursor-pointer rounded-xl p-3 transition-colors hover:bg-panel",
                isSelected && "ring-2 ring-brand-blue bg-panel/70"
              )}
            >
              <dt className="text-[13px] font-semibold text-muted flex items-center justify-between">
                <span>{b.label}</span>
                {isSelected && <span className="text-[10px] font-bold text-brand-blue uppercase">Filtro activo</span>}
              </dt>
              <dd className={cx("tabular mt-1 text-xl font-extrabold", b.tone)}>{formatMoney(list.reduce((s, r) => s + r.balanceCents, 0))}</dd>
              <p className="text-xs text-muted">{list.length} órdenes</p>
            </motion.div>
          );
        })}
      </motion.dl>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 className="text-section font-bold">Órdenes con saldo</h2>
            <p className="text-xs text-muted">
              Priorizadas por criticidad y días de vencimiento. Acciones rápidas de contacto en 1 clic.
            </p>
          </div>
          {filter !== "todos" && (
            <button
              onClick={() => setFilter("todos")}
              className="text-xs font-semibold text-brand-blue hover:underline"
            >
              Mostrar todas ({rows.length})
            </button>
          )}
        </div>

        <motion.ul variants={listVariants} className="mt-3 flex flex-col divide-y divide-line-soft">
          {filteredRows.map((r) => {
            const isOverdue = r.daysToDue < 0;
            return (
              <motion.li variants={itemVariants} key={r.id} className="py-3">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_120px_110px_130px_auto] items-center gap-3">
                  <Link to={`/pedidos/${r.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                    <Avatar name={r.customer} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block truncate text-sm font-bold text-ink">{r.customer}</span>
                        {isOverdue && (
                          <span className="rounded bg-bad-tint px-1.5 py-0.5 text-[10px] font-extrabold text-bad shrink-0">
                            MORA CRÍTICA
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-[13px] text-muted">
                        {[r.orderRef, r.seller].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </Link>

                  <div className="tabular text-[13px]">
                    <span className="block text-xs text-muted">Vence</span>
                    <span className={cx("font-semibold", isOverdue ? "text-bad" : "text-ink")}>
                      {formatDate(r.dueDate)}
                    </span>
                  </div>

                  <div className="tabular text-right text-sm font-extrabold text-ink">
                    <Money cents={r.balanceCents} />
                  </div>

                  <div className="flex justify-start md:justify-end">
                    <FinanceChip finance={r.finance} daysToDue={r.daysToDue} />
                  </div>

                  <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 md:pt-0 border-t border-line-soft md:border-t-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<CopySimple size={15} weight="bold" />}
                      onClick={(e) => copyWhatsApp(r, e)}
                      title="Copiar recordatorio WhatsApp con saldo y cuentas"
                    >
                      <span className="hidden lg:inline">WhatsApp</span>
                    </Button>
                    <Link to={`/clientes/${r.customerId}/estado-cuenta`} title="Ver estado de cuenta formal">
                      <Button variant="ghost" size="sm" icon={<Receipt size={15} weight="bold" />}>
                        <span className="hidden lg:inline">Cuenta</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.li>
            );
          })}
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
            {a.orderId ? (
              <Link to={`/pedidos/${a.orderId}`} className="hover:underline">
                {a.orderRef}
              </Link>
            ) : (
              a.orderRef
            )}{" "}
            · abierta el {formatDateTime(a.creadaAt)} · responsable {a.responsable}
          </p>
          <p className="mt-0.5 font-bold">
            {a.customerId ? (
              <Link to={`/clientes/${a.customerId}`} className="hover:underline">
                {a.customer}
              </Link>
            ) : (
              a.customer
            )}
          </p>
          <p className="text-[13px] text-muted">{a.regla}</p>
        </div>
        <div className="text-right">
          <Chip tone={open ? "bad" : a.estado === "resuelta" ? "ok" : "neutral"}>{open ? "Abierta" : a.estado === "resuelta" ? "Resuelta" : "Cancelada"}</Chip>
          {a.balanceCents != null && <p className="tabular mt-1 text-sm font-bold">{a.balanceCents > 0 ? `Saldo ${formatMoney(a.balanceCents)}` : "Pagado"}</p>}
          {a.dueDate && <p className="tabular text-xs text-muted">Venció {formatDate(a.dueDate)}</p>}
        </div>
      </div>
      {!open && a.resolucion && (
        <p className="tabular mt-3 rounded-xl bg-panel px-3.5 py-2.5 text-[13px] text-muted">
          {[a.resolucion, a.resueltaBy, a.resueltaAt && formatDateTime(a.resueltaAt)].filter(Boolean).join(" · ")}
        </p>
      )}
      {open && can(me.role, "gestionar_cobranza") && capabilities.resolveAlerts && (
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
            disabled={!text.trim()}
            onClick={async () => {
              const r = await commands.resolveAlert(a.id, text, me);
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
                  {m.estado === "error" && can(me.role, "gestionar_cobranza") && capabilities.retryMessages && (
                    <Button
                      size="sm"
                      icon={<ArrowClockwise size={16} />}
                      onClick={async () => {
                        const r = await commands.retryMessage(m.id, me);
                        toast(r.ok, r.message);
                      }}
                    >
                      Reintentar
                    </Button>
                  )}
                </span>
              </div>
              <p className="tabular mt-1 text-xs text-muted">
                {[m.contacto, m.orderRef, m.enviadoAt ? formatDateTime(m.enviadoAt) : `programado ${formatDateTime(m.programadoPara)}`].filter(Boolean).join(" · ")}
              </p>
              {m.error && <p className="mt-1 text-xs text-bad">{m.error}</p>}
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Card>
  );
}
