import { motion } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { CalendarBlank, ChatCircleText, CheckCircle, Factory, Hourglass, NotePencil, Truck, UploadSimple, WarningCircle } from "../components/ui/icons";
import { capabilities, getOrderBoard, getOrders, type OrderBoardDTO, type OrderCard, type OrderColumnId, type OrderRow } from "../api/client";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { useMe } from "../context/AuthContext";
import { can } from "../lib/permissions";
import { MotionLink, Stagger, itemVariants, lift, listVariants, press } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { IS_MOCK } from "../config";
import { Chip, FinanceChip, OrderStateChip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

const COLUMN_STYLE: Record<OrderColumnId, { pill: string; icon: React.ReactNode; empty: string }> = {
  por_confirmar: { pill: "bg-violet-tint text-violet-ink", icon: <NotePencil size={16} weight="bold" />, empty: "Las hojas de resumen que arma n8n al escribir /cerrar aparecen aquí." },
  retenida: { pill: "bg-warn-tint text-warn", icon: <Hourglass size={16} weight="bold" />, empty: "Ninguna orden espera anticipo." },
  en_produccion: { pill: "bg-info-tint text-info", icon: <Factory size={16} weight="bold" />, empty: "Nada en producción ahora." },
  por_cobrar: { pill: "bg-[#fdeee0] text-[#8a4b12]", icon: <Truck size={16} weight="bold" />, empty: "No hay saldos por cobrar." },
  cobrada: { pill: "bg-ok-tint text-ok", icon: <CheckCircle size={16} weight="bold" />, empty: "Todavía no hay órdenes cobradas." },
};

export function PedidosPage() {
  const { scope } = useScope();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const view = params.get("vista") === "lista" ? "lista" : "tablero";
  const { data, loading, error, reload } = useApi(() => getOrderBoard(scope), [scope]);

  return (
    <Stagger className="mx-auto flex max-w-[1500px] flex-col gap-6">
      <PageHeader
        title="Pedidos"
        subtitle={<>Del chat a la cobranza: ninguna orden entra a producción sin crédito aprobado o anticipo verificado. Vista {SCOPE_LABEL[scope]}.</>}
        actions={
          <>
            {IS_MOCK && <DemoBadge />}
            {can(me.role, "captura") && capabilities.manualOrderCapture && (
              <MotionLink to="/captura?tipo=orden" {...press} className="inline-flex h-10 items-center gap-2 rounded-full bg-card px-4 text-[13px] font-semibold ring-1 ring-line transition-colors hover:bg-panel">
                <UploadSimple size={16} weight="bold" /> Cargar pedido a mano
              </MotionLink>
            )}
          </>
        }
      />

      <motion.div variants={itemVariants}>
        <Segmented
          kind="tab"
          label="Vista de pedidos"
          value={view}
          onChange={(v) => setParams(v === "lista" ? { vista: "lista" } : {})}
          options={[
            { value: "tablero", label: "Tablero" },
            { value: "lista", label: "Lista con fechas" },
          ]}
        />
      </motion.div>

      {view === "lista" ? (
        <OrdersList />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="grid gap-4 xl:grid-cols-5" aria-busy="true" aria-label="Cargando">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[420px] rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : (
        <Board data={data} />
      )}
    </Stagger>
  );
}

function Board({ data }: { data: OrderBoardDTO }) {
  return (
    <Stagger className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 2xl:mx-0 2xl:grid 2xl:grid-cols-5 2xl:overflow-visible 2xl:px-0">
      {data.columns.map((col) => {
        const style = COLUMN_STYLE[col.id];
        return (
          <motion.section
            variants={itemVariants}
            key={col.id}
            aria-label={`${col.title}, ${col.cards.length} órdenes`}
            className="flex w-[84vw] max-w-[320px] shrink-0 snap-start flex-col gap-3 sm:w-[300px] 2xl:w-auto 2xl:max-w-none"
          >
            <span className={cx("inline-flex h-9 w-fit items-center gap-2 rounded-full pl-3 pr-1.5 text-[13px] font-bold", style.pill)}>
              {style.icon}
              {col.title}
              <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-card px-1.5 text-xs text-ink">{col.cards.length}</span>
            </span>
            <motion.div variants={listVariants} className="flex min-h-[200px] flex-col gap-3 rounded-[22px] bg-line-soft/60 p-2">
              {col.cards.length === 0 ? <EmptyState title="Sin órdenes">{style.empty}</EmptyState> : col.cards.map((c) => <OrderCardView key={c.id} card={c} />)}
            </motion.div>
          </motion.section>
        );
      })}
    </Stagger>
  );
}

function OrderCardView({ card }: { card: OrderCard }) {
  return (
    <MotionLink
      to={`/pedidos/${card.id}`}
      variants={itemVariants}
      {...lift}
      className="group relative block rounded-[18px] bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line/70"
    >
      {/* Sombra elevada en capa propia: al hover solo cambia su opacidad (GPU). */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[18px] opacity-0 shadow-[var(--shadow-lift)] transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          {card.origen === "whatsapp" ? <ChatCircleText size={14} weight="bold" /> : card.origen === "manual" ? <UploadSimple size={14} weight="bold" /> : null}
          {card.ref}
        </span>
        {card.estado === "pendiente_aprobacion" && card.clienteEnMora && (
          <Chip tone="bad" icon={<WarningCircle size={12} weight="bold" />} className="rounded-md px-1.5 py-0.5">
            Cliente en mora
          </Chip>
        )}
      </div>
      <p className="mt-2 truncate text-[15px] font-bold leading-snug">{card.customer}</p>
      <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{card.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {card.dueDate ? (
          <span className="tabular inline-flex items-center gap-1 rounded-md bg-panel px-1.5 py-1 text-xs font-medium text-muted ring-1 ring-line-soft">
            <CalendarBlank size={13} weight="bold" /> Vence: <span className="text-ink">{formatDate(card.dueDate)}</span>
          </span>
        ) : card.entregaSolicitada ? (
          <span className="tabular inline-flex items-center gap-1 rounded-md bg-panel px-1.5 py-1 text-xs font-medium text-muted ring-1 ring-line-soft">
            <CalendarBlank size={13} weight="bold" /> Entrega: <span className="text-ink">{formatDate(card.entregaSolicitada)}</span>
          </span>
        ) : null}
        {card.estado === "despachada" && card.balanceCents > 0 && <FinanceChip finance={card.finance} daysToDue={card.daysToDue ?? undefined} />}
        {card.faltantes > 0 && <Chip tone="warn">Faltan {card.faltantes} datos</Chip>}
        {card.anticipoPendienteCents > 0 && card.estado === "retenida" && <Chip tone="warn">Anticipo {formatMoney(card.anticipoPendienteCents, { short: true })}</Chip>}
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
        <span className="shrink-0 text-right">
          <span className="block text-base font-extrabold">
            <Money cents={card.estado === "despachada" ? card.balanceCents : card.saleCents} />
          </span>
          {card.estado === "despachada" && card.balanceCents > 0 && <span className="tabular block text-[11px] text-faint">de {formatMoney(card.saleCents)}</span>}
        </span>
      </div>
    </MotionLink>
  );
}

function OrdersList() {
  const { scope } = useScope();
  const { data, loading, error, reload } = useApi(() => getOrders(scope), [scope]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />;
  if (data.length === 0) return <EmptyState title="Sin pedidos en esta vista" />;
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[1080px] text-sm">
          <thead className="bg-panel text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Orden</th>
              <th className="px-3 py-3 font-semibold">Pedido</th>
              <th className="px-3 py-3 font-semibold">Entrega pedida</th>
              <th className="px-3 py-3 font-semibold">Despacho</th>
              <th className="px-3 py-3 font-semibold">Vencimiento</th>
              <th className="px-3 py-3 font-semibold">Último pago</th>
              <th className="px-3 py-3 text-right font-semibold">Venta</th>
              <th className="px-3 py-3 text-right font-semibold">Saldo</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <motion.tbody variants={listVariants} initial="hidden" animate="show">
            {data.map((o: OrderRow) => (
              <motion.tr variants={itemVariants} key={o.id} className="border-t border-line-soft">
                <td className="px-5 py-3.5">
                  <Link to={`/pedidos/${o.id}`} className="group block">
                    <span className="block font-bold group-hover:underline">{o.ref}</span>
                    <span className="block max-w-[220px] truncate text-[13px] text-muted">{o.customer}</span>
                  </Link>
                </td>
                <td className="px-3 py-3.5">{formatDate(o.issuedOn)}</td>
                <td className="px-3 py-3.5 text-muted">{o.entregaSolicitada ? formatDate(o.entregaSolicitada) : "Sin fecha"}</td>
                <td className="px-3 py-3.5">{o.despachoOn ? formatDate(o.despachoOn) : <span className="text-muted">Pendiente</span>}</td>
                <td className={cx("px-3 py-3.5", o.balanceCents > 0 && o.dueDate && "font-bold")}>{o.dueDate ? formatDate(o.dueDate) : <span className="font-normal text-muted">Al despachar</span>}</td>
                <td className="px-3 py-3.5 text-muted">
                  {o.lastPaymentAt ? formatDateTime(o.lastPaymentAt) : "Sin pagos"}
                  {o.daysLate !== null && o.daysLate > 0 && <span className="block text-xs text-bad">{o.daysLate} d tarde</span>}
                </td>
                <td className="px-3 py-3.5 text-right">{formatMoney(o.saleCents)}</td>
                <td className="px-3 py-3.5 text-right font-bold">{formatMoney(o.balanceCents)}</td>
                <td className="px-5 py-3.5">
                  <span className="flex flex-col items-start gap-1">
                    <OrderStateChip estado={o.estado} />
                    {o.estado === "despachada" && <FinanceChip finance={o.finance} daysToDue={o.daysToDue ?? undefined} />}
                  </span>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </Card>
  );
}
