import { motion } from "motion/react";
import { useState } from "react";
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
import { Pagination, PAGE_SIZE } from "../components/ui/Pagination";
import { cx, formatDate, formatMoney } from "../lib/format";

const COLUMN_STYLE: Record<OrderColumnId, { pill: string; icon: React.ReactNode; empty: string }> = {
  por_confirmar: { pill: "bg-violet-tint text-violet-ink", icon: <NotePencil size={16} weight="bold" />, empty: "Las hojas de resumen que arma n8n al escribir /cerrar aparecen aquí." },
  retenida: { pill: "bg-warn-tint text-warn", icon: <Hourglass size={16} weight="bold" />, empty: "Ninguna orden espera anticipo." },
  en_produccion: { pill: "bg-info-tint text-info", icon: <Factory size={16} weight="bold" />, empty: "Nada en producción ahora." },
  por_cobrar: { pill: "bg-warn-tint text-warn", icon: <Truck size={16} weight="bold" />, empty: "No hay saldos por cobrar." },
  cobrada: { pill: "bg-ok-tint text-ok", icon: <CheckCircle size={16} weight="bold" />, empty: "Todavía no hay órdenes cobradas." },
};

export function PedidosPage() {
  const { scope } = useScope();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const view = params.get("vista") === "tablero" ? "tablero" : "lista";
  const { data, loading, error, reload } = useApi(() => getOrderBoard(scope), [scope]);

  return (
    <Stagger className="mx-auto flex max-w-[1500px] flex-col gap-6">
      <PageHeader
        title="Pedidos"
        subtitle={<>Consulta saldos y vencimientos o revisa cada etapa. Vista {SCOPE_LABEL[scope]}.</>}
        actions={
          <>
            {IS_MOCK && <DemoBadge />}
            {can(me.role, "captura") && capabilities.manualOrderCapture && (
              <MotionLink to="/captura?tipo=orden" {...press} className="primary-link">
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
          onChange={(v) => setParams(v === "tablero" ? { vista: "tablero" } : {})}
          options={[
            { value: "lista", label: "Todos los pedidos" },
            { value: "tablero", label: "Por etapa" },
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
  const [stage, setStage] = useState<OrderColumnId>(() => data.columns.find((c) => c.cards.length)?.id ?? "por_confirmar");
  const col = data.columns.find((c) => c.id === stage);
  return (
    <Stagger className="flex min-w-0 flex-col gap-5">
      <Segmented label="Etapa del pedido" value={stage} onChange={setStage} options={data.columns.map((c) => ({ value: c.id, label: c.title, count: c.cards.length }))} />
      {col && <section aria-label={`${col.title}, ${col.cards.length} órdenes`}>
        {col.cards.length === 0 ? <EmptyState title="Sin órdenes">{COLUMN_STYLE[col.id].empty}</EmptyState> : <Stagger key={stage} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{col.cards.map((c) => <OrderCardView key={c.id} card={c} />)}</Stagger>}
      </section>}
    </Stagger>
  );
}

function OrderCardView({ card }: { card: OrderCard }) {
  return (
    <MotionLink
      to={`/pedidos/${card.id}`}
      variants={itemVariants}
      {...lift}
      className="group relative block rounded-xl border border-line bg-card p-5 transition-colors hover:border-violet"
    >
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = (data ?? []).filter((o) => `${o.ref} ${o.customer}`.toLowerCase().includes(search.trim().toLowerCase()));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />;
  if (data.length === 0) return <EmptyState title="Sin pedidos en esta vista" />;
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <p className="text-sm font-semibold">{data.length} pedidos</p>
        <label className="w-full sm:w-72"><span className="sr-only">Buscar pedido</span><input aria-label="Buscar pedido" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar por cliente o referencia" className="h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm" /></label>
      </div>
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[700px] text-sm">
          <thead className="bg-panel text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Pedido / Cliente</th>
              <th className="px-3 py-3 font-semibold">Vencimiento</th>
              <th className="px-3 py-3 text-right font-semibold">Venta</th>
              <th className="px-3 py-3 text-right font-semibold">Saldo</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <motion.tbody variants={listVariants} initial="hidden" animate="show">
            {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((o: OrderRow) => (
              <motion.tr variants={itemVariants} key={o.id} className="border-t border-line-soft hover:bg-panel">
                <td className="px-5 py-3.5">
                  <Link to={`/pedidos/${o.id}`} className="group block">
                    <span className="block font-bold group-hover:underline">{o.ref}</span>
                    <span className="block max-w-[220px] truncate text-[13px] text-muted">{o.customer}</span>
                  </Link>
                </td>
                <td className={cx("px-3 py-3.5", o.balanceCents > 0 && o.dueDate && "font-bold")}>{o.dueDate ? formatDate(o.dueDate) : <span className="font-normal text-muted">Al despachar</span>}</td>
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
      {filtered.length === 0 && <div className="p-5"><EmptyState title="No hay pedidos que coincidan">Prueba con otro cliente o referencia.</EmptyState></div>}
      <Pagination page={currentPage} total={filtered.length} onChange={setPage} />
      <p className="border-t border-line px-5 py-3 text-xs text-muted">Abre un pedido para consultar entregas, pagos y su historial completo.</p>
    </Card>
  );
}
