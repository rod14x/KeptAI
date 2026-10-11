import { motion } from "motion/react";
import { MotionLink, Stagger, itemVariants, lift, listVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Link, useSearchParams } from "react-router";
import { CalendarBlank, ChatCircleText, CheckCircle, Image, Microphone, NotePencil, SealCheck, Hourglass, X } from "@phosphor-icons/react";
import { getBoard, getOrders, type BoardCard, type BoardColumnId, type BoardDTO, type OrderRow } from "../api/client";
import { getState } from "../api/store";
import { daysToDue, orderBalance } from "../api/domain";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { DueTag, FinanceChip, MatchChip, PriorityTag } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

const COLUMN_STYLE: Record<BoardColumnId, { pill: string; icon: React.ReactNode; empty: string }> = {
  borrador: {
    pill: "bg-violet-tint text-violet-ink",
    icon: <NotePencil size={16} weight="bold" />,
    empty: "Los chats, audios e imágenes leídos por la IA aparecen aquí para revisión humana.",
  },
  comprobante_pendiente: {
    pill: "bg-warn-tint text-warn",
    icon: <Hourglass size={16} weight="bold" />,
    empty: "Sin comprobantes por validar.",
  },
  pago_verificado: {
    pill: "bg-info-tint text-info",
    icon: <SealCheck size={16} weight="bold" />,
    empty: "Valida una evidencia y registra la verificación de fondos para que pase aquí.",
  },
  pago_aplicado: {
    pill: "bg-ok-tint text-ok",
    icon: <CheckCircle size={16} weight="bold" />,
    empty: "Todavía no hay pagos aplicados en esta vista.",
  },
};

const KIND_ICON = {
  voucher: <Image size={14} weight="bold" />,
  chat: <ChatCircleText size={14} weight="bold" />,
  audio: <Microphone size={14} weight="bold" />,
};

export function PedidosPage() {
  const { scope } = useScope();
  const [params, setParams] = useSearchParams();
  const focus = params.get("pedido");
  const view = params.get("vista") === "lista" ? "lista" : "tablero";
  const { data, loading, error, reload } = useApi(() => getBoard(scope), [scope]);
  const setView = (v: "tablero" | "lista") => {
    const next = new URLSearchParams(params);
    if (v === "lista") next.set("vista", "lista");
    else next.delete("vista");
    setParams(next);
  };

  return (
    <Stagger className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader title="Pedidos y cobro" subtitle={<>Cada comprobante avanza de borrador a pago aplicado. Vista {SCOPE_LABEL[scope]}.</>} actions={<DemoBadge />} />

      <motion.div variants={itemVariants}>
        <Segmented
          kind="tab"
          label="Vista de pedidos"
          value={view}
          onChange={setView}
          options={[
            { value: "tablero", label: "Tablero de cobro" },
            { value: "lista", label: "Lista de pedidos" },
          ]}
        />
      </motion.div>

      {focus && <OrderFocus id={focus} onClose={() => setParams(view === "lista" ? { vista: "lista" } : {})} />}

      {view === "lista" ? (
        <OrdersList focus={focus} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="grid gap-4 xl:grid-cols-4" aria-busy="true" aria-label="Cargando">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[420px] rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : (
        <Board data={data} focus={focus} />
      )}
    </Stagger>
  );
}

function OrderFocus({ id, onClose }: { id: string; onClose: () => void }) {
  const s = getState();
  const order = s.orders.find((o) => o.id === id);
  if (!order) return null;
  const customer = s.customers.find((c) => c.id === order.customerId)?.name ?? "";
  const balance = orderBalance(s, order);
  const d = daysToDue(s, order);
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={customer} size="lg" />
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {order.id} · {order.line} · producción {order.modality}
          </p>
          <p className="truncate text-lg font-bold">{customer}</p>
        </div>
      </div>
      <dl className="tabular grid grid-cols-3 gap-4 text-sm sm:flex sm:gap-8">
        <div>
          <dt className="text-muted">Venta</dt>
          <dd className="font-bold">
            <Money cents={order.saleCents} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Saldo</dt>
          <dd className={cx("font-bold", balance > 0 && d < 0 && "text-bad")}>
            <Money cents={balance} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Vence</dt>
          <dd className="font-bold">{formatDate(order.dueDate)}</dd>
        </div>
      </dl>
      <div className="flex items-center gap-2">
        {balance > 0 ? <DueTag daysToDue={d} /> : <span className="text-sm font-semibold text-ok">Cobrado</span>}
        <button onClick={onClose} aria-label="Quitar filtro de pedido" className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft">
          <X size={16} weight="bold" />
        </button>
      </div>
    </Card>
  );
}

function Board({ data, focus }: { data: BoardDTO; focus: string | null }) {
  return (
    <Stagger className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0">
      {data.columns.map((col) => {
        const style = COLUMN_STYLE[col.id];
        return (
          <motion.section variants={itemVariants}
            key={col.id}
            aria-label={`${col.title}, ${col.cards.length} elementos`}
            className="flex w-[84vw] max-w-[340px] shrink-0 snap-start flex-col gap-3 sm:w-[320px] xl:w-auto xl:max-w-none"
          >
            <div className="flex items-center justify-between px-1">
              <span className={cx("inline-flex h-9 items-center gap-2 rounded-full pl-3 pr-1.5 text-[13px] font-bold", style.pill)}>
                {style.icon}
                {col.title}
                <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-card px-1.5 text-xs text-ink">{col.cards.length}</span>
              </span>
            </div>
            <motion.div variants={listVariants} className="flex min-h-[200px] flex-col gap-3 rounded-[22px] bg-line-soft/60 p-2">
              {col.cards.length === 0 ? (
                <EmptyState title="Sin elementos">{style.empty}</EmptyState>
              ) : (
                col.cards.map((c) => <BoardCardView key={c.id} card={c} dim={focus != null && c.orderId !== focus} />)
              )}
            </motion.div>
          </motion.section>
        );
      })}
    </Stagger>
  );
}

function BoardCardView({ card, dim }: { card: BoardCard; dim: boolean }) {
  return (
    <MotionLink
      to={`/conciliacion/${card.id}`}
      variants={itemVariants}
      {...lift}
      className={cx(
        "group relative block rounded-[18px] bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line/70 transition-opacity duration-200",
        dim && "opacity-40",
      )}
    >
      {/* Sombra elevada en una capa propia: al hover solo cambia su opacidad (GPU), no el box-shadow. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[18px] opacity-0 shadow-[var(--shadow-lift)] transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          {KIND_ICON[card.kind]}
          {card.id}
          {card.orderId && <span className="text-faint">· {card.orderId}</span>}
        </span>
        <PriorityTag priority={card.priority} />
      </div>
      <p className="mt-2.5 truncate text-[15px] font-bold leading-snug">{card.customer}</p>
      <p className="tabular mt-0.5 text-[13px] text-muted">
        {card.channel ?? "Canal por confirmar"} · recibido {formatDateTime(card.receivedAt)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {card.dueDate ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-panel px-1.5 py-1 text-xs font-medium text-muted ring-1 ring-line-soft">
            <CalendarBlank size={13} weight="bold" />
            Vence: <span className="tabular text-ink">{formatDate(card.dueDate)}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-panel px-1.5 py-1 text-xs font-medium text-muted ring-1 ring-line-soft">
            <CalendarBlank size={13} weight="bold" />
            Sin pedido vinculado
          </span>
        )}
        {card.status !== "pago_aplicado" && <MatchChip match={card.match} />}
        {card.validated && card.status !== "pago_aplicado" && (
          <span className="inline-flex items-center gap-1 rounded-md bg-ok-tint px-1.5 py-1 text-xs font-semibold text-ok">
            <CheckCircle size={13} weight="bold" /> Validado
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-3">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
          {card.seller && (
            <>
              <Avatar name={card.seller} size="sm" />
              <span className="truncate">{card.seller}</span>
            </>
          )}
        </span>
        <span className="shrink-0 text-base font-extrabold">
          {card.amountCents != null ? <Money cents={card.amountCents} /> : <span className="text-sm font-semibold text-warn">Monto pendiente</span>}
        </span>
      </div>
    </MotionLink>
  );
}

function OrdersList({ focus }: { focus: string | null }) {
  const { scope } = useScope();
  const { data, loading, error, reload } = useApi(() => getOrders(scope), [scope]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />;
  if (data.length === 0) return <EmptyState title="Sin pedidos en esta vista" />;
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[980px] text-sm">
          <thead className="bg-panel text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Pedido</th>
              <th className="px-3 py-3 font-semibold">Fecha pedido</th>
              <th className="px-3 py-3 font-semibold">Entrega</th>
              <th className="px-3 py-3 font-semibold">Vencimiento</th>
              <th className="px-3 py-3 font-semibold">Último pago</th>
              <th className="px-3 py-3 text-right font-semibold">Venta</th>
              <th className="px-3 py-3 text-right font-semibold">Saldo</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((o: OrderRow) => (
              <tr key={o.id} className={cx("border-t border-line-soft", focus === o.id && "bg-violet-wash")}>
                <td className="px-5 py-3.5">
                  <Link to={`/clientes/${o.customerId}`} className="group block">
                    <span className="block font-bold group-hover:underline">{o.id}</span>
                    <span className="block max-w-[240px] truncate text-[13px] text-muted">{o.customer}</span>
                  </Link>
                </td>
                <td className="px-3 py-3.5">{formatDate(o.issuedOn)}</td>
                <td className="px-3 py-3.5">{formatDate(o.deliveredOn)}</td>
                <td className={cx("px-3 py-3.5", o.balanceCents > 0 && "font-bold")}>{formatDate(o.dueDate)}</td>
                <td className="px-3 py-3.5 text-muted">
                  {o.lastPaymentAt ? formatDateTime(o.lastPaymentAt) : "Sin pagos"}
                  {o.daysLate !== null && o.daysLate > 0 && <span className="block text-xs text-bad">{o.daysLate} d tarde</span>}
                </td>
                <td className="px-3 py-3.5 text-right">{formatMoney(o.saleCents)}</td>
                <td className="px-3 py-3.5 text-right font-bold">{formatMoney(o.balanceCents)}</td>
                <td className="px-5 py-3.5">
                  <FinanceChip finance={o.finance} daysToDue={o.daysToDue} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
