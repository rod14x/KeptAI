import { motion } from "motion/react";
import { Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Meter } from "../components/ui/Meter";
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CaretDown, DownloadSimple, Factory, Info, Printer, Storefront, Stack } from "../components/ui/icons";
import { getResults, ordersCsv, type ResultRow, type ResultsDTO } from "../api/client";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { useToast } from "../context/ToastContext";
import { Card, DemoBadge, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { Chip } from "../components/ui/Chip";
import { Button } from "../components/ui/Button";
import { cx, formatDate, formatMoney } from "../lib/format";
import type { Scope } from "../api/schemas";

type Modality = "todas" | "propia" | "tercerizada";

export function ResultadoPage() {
  const { scope } = useScope();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => getResults(scope), [scope]);

  const download = () => {
    const blob = new Blob(["﻿" + ordersCsv(scope)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keptai-pedidos-${scope}-${data?.cutDate ?? "corte"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(true, "CSV descargado con IDs, marca, moneda, fechas y estado.");
  };

  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <PageHeader
        title="Resultado por pedido"
        subtitle={
          <>
            Margen por pedido, línea y marca. Vista {SCOPE_LABEL[scope]}
            {data && <>, corte al {formatDate(data.cutDate)}</>}.
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <DemoBadge />
            <Button variant="secondary" size="sm" icon={<Printer size={16} weight="bold" />} onClick={() => window.print()}>
              Imprimir reporte
            </Button>
            <Button size="sm" icon={<DownloadSimple size={16} weight="bold" />} onClick={download} disabled={!data}>
              Exportar CSV
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[120px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[320px] rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <Stagger className="flex flex-col gap-6">
          <BrandSummary d={data} />
          <OrdersTable rows={data.rows} />
          <Workshop d={data} scope={scope} />
        </Stagger>
      )}
    </Stagger>
  );
}

function BrandSummary({ d }: { d: ResultsDTO }) {
  const total = d.byBrand.reduce((s, b) => s + b.marginCents, 0);
  const max = Math.max(...d.byBrand.map((b) => Math.abs(b.marginCents)), 1);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-section font-bold">Margen por marca</h2>
        <p className="text-sm text-muted">
          Margen conjunto <span className={cx("tabular text-lg font-extrabold", total < 0 ? "text-bad" : "text-ink")}>{formatMoney(total)}</span>
        </p>
      </div>
      <ul className="mt-4 flex flex-col gap-4" aria-label="Por marca">
        {d.byBrand.map((b) => {
          const pct = (Math.abs(b.marginCents) / max) * 100;
          const neg = b.marginCents < 0;
          return (
            <li key={b.brand} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 sm:grid-cols-[120px_1fr_auto]">
              <span className="text-sm font-semibold">{b.brand === "corpotex" ? "Corpotex" : "Unicrack"}</span>
              <Meter value={Math.max(pct, 3) / 100} tone={neg ? "bad" : "ok"} label={`Margen ${b.brand}`} thick track={false} />
              <span className="tabular w-28 text-right text-sm">
                <span className={cx("font-bold", neg && "text-bad")}>{formatMoney(b.marginCents)}</span>
                <span className="block text-xs text-muted">de {formatMoney(b.saleCents)} vendidos</span>
              </span>
            </li>
          );
        })}
      </ul>
      <h3 className="mt-6 text-sm font-bold">Por línea</h3>
      <motion.ul variants={listVariants} className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {d.byLine.map((l) => {
          const pct = l.saleCents ? Math.round((l.marginCents / l.saleCents) * 1000) / 10 : 0;
          return (
            <motion.li key={l.line} variants={itemVariants} className="rounded-[var(--radius-block)] bg-panel p-3.5 ring-1 ring-line/70">
              <p className="truncate text-[13px] font-semibold">{l.line}</p>
              <p className={cx("tabular mt-1 text-lg font-extrabold", l.marginCents < 0 ? "text-bad" : "text-ink")}>{formatMoney(l.marginCents)}</p>
              <p className="tabular text-xs text-muted">
                {pct}% de {formatMoney(l.saleCents, { short: true })} · {l.orders} {l.orders === 1 ? "pedido" : "pedidos"}
              </p>
            </motion.li>
          );
        })}
      </motion.ul>
    </Card>
  );
}

const MODALITIES: Array<{ id: Modality; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "propia", label: "Propia" },
  { id: "tercerizada", label: "Tercerizada" },
];

function OrdersTable({ rows }: { rows: ResultRow[] }) {
  const [modality, setModality] = useState<Modality>("todas");
  const [open, setOpen] = useState<string | null>(null);
  const visible = rows.filter((r) => modality === "todas" || r.modality === modality);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section font-bold">Pedidos</h2>
        <Segmented
          label="Modalidad de producción"
          value={modality}
          onChange={setModality}
          size="sm"
          options={MODALITIES.map((m) => ({ value: m.id, label: m.label }))}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sin pedidos con esta modalidad">Cambia el filtro o la vista de marca.</EmptyState>
        </div>
      ) : (
        <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="tabular w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="pb-3 font-semibold">Pedido</th>
                <th className="pb-3 font-semibold">Línea</th>
                <th className="pb-3 text-right font-semibold">Venta</th>
                <th className="pb-3 text-right font-semibold">Costo</th>
                <th className="pb-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1" title="Resultado económico: venta menos costo. No es dinero cobrado.">
                    Margen <Info size={14} />
                  </span>
                </th>
                <th className="pb-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1" title="Margen real percibido: margen en proporción a lo efectivamente cobrado (rediseño 5.3).">
                    Percibido <Info size={14} />
                  </span>
                </th>
                <th className="pb-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1" title="Dinero cobrado: pagos aplicados al pedido.">
                    Cobrado <Info size={14} />
                  </span>
                </th>
                <th className="pb-3 text-right font-semibold">Saldo</th>
                <th className="w-10 pb-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const expanded = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className={cx("border-t border-line-soft", r.marginCents < 0 && "bg-bad-tint/40")}>
                      <td className="py-3.5">
                        <p className="font-bold">{r.id}</p>
                        <Link to={`/clientes/${r.customerId}`} className="block max-w-[220px] truncate text-[13px] text-muted hover:text-ink hover:underline">
                          {r.customer}
                        </Link>
                        <p className="tabular text-xs text-faint">Pedido {formatDate(r.issuedOn)}</p>
                      </td>
                      <td className="py-3.5">
                        <p className="font-medium">{r.line}</p>
                        <Chip tone={r.modality === "propia" ? "violet" : "info"} className="mt-1">
                          {r.modality === "propia" ? "Producción propia" : "Tercerizada"}
                        </Chip>
                      </td>
                      <td className="py-3.5 text-right">{formatMoney(r.saleCents)}</td>
                      <td className="py-3.5 text-right">{formatMoney(r.costCents)}</td>
                      <td className={cx("py-3.5 text-right font-extrabold", !r.hasCost ? "text-faint" : r.marginCents < 0 ? "text-bad" : "text-ok")}>
                        {r.hasCost ? formatMoney(r.marginCents) : "Costo pendiente"}
                        <span className="block text-[11px] font-semibold text-faint">{r.costOrigin === "real" ? "costo real" : "costo teórico"}</span>
                      </td>
                      <td className={cx("py-3.5 text-right font-semibold", r.perceivedCents < 0 && "text-bad")}>{r.hasCost ? formatMoney(r.perceivedCents) : "Sin dato"}</td>
                      <td className="py-3.5 text-right">{formatMoney(r.collectedCents)}</td>
                      <td className="py-3.5 text-right font-semibold">{formatMoney(r.balanceCents)}</td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => setOpen(expanded ? null : r.id)}
                          aria-expanded={expanded}
                          aria-label={`Desglose de costo de ${r.id}`}
                          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
                        >
                          <CaretDown size={16} weight="bold" className={cx("transition-transform", expanded && "rotate-180")} />
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={9} className="pb-4">
                          <CostBreakdown r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CostBreakdown({ r }: { r: ResultRow }) {
  const items = [
    { label: "Materia prima", v: r.costs.materiales },
    { label: "Mano de obra", v: r.costs.manoObra },
    { label: "Terceros", v: r.costs.terceros },
    { label: "Indirectos", v: r.costs.indirectos, note: "asignación por validar" },
  ].filter((i) => i.v > 0);
  return (
    <motion.div variants={itemVariants} className="grid gap-3 rounded-[var(--radius-block)] bg-panel p-4 ring-1 ring-line sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label}>
          <p className="text-xs font-semibold text-muted">{i.label}</p>
          <p className="font-bold">{formatMoney(i.v)}</p>
          {i.note && <p className="text-[11px] text-warn">{i.note}</p>}
        </div>
      ))}
    </motion.div>
  );
}

function Workshop({ d, scope }: { d: ResultsDTO; scope: Scope }) {
  const w = d.workshop;
  if (!w) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-section font-bold">Taller como centro de resultados</h2>
        <div className="mt-4">
          <EmptyState title="Sin producción propia en esta vista">Los pedidos tercerizados no pasan por el taller interno.</EmptyState>
        </div>
      </Card>
    );
  }
  const consolidated = scope === "consolidado";
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-section font-bold">Taller como centro de resultados</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {w.orderIds.join(", ")}. El taller vende a la marca con un precio de transferencia interno.
          </p>
        </div>
        <Chip tone="warn">Propuesta: precio de transferencia por validar</Chip>
      </div>

      <div className="mt-5 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <FlowBox icon={<Stack size={18} weight="bold" />} title="Costo de producción" value={w.costCents} note="Insumos, mano de obra e indirectos" />
        <FlowArrow />
        <FlowBox
          icon={<Factory size={18} weight="bold" />}
          title="Cargo interno al comercial"
          value={w.internalChargeCents}
          note={consolidated ? "Eliminado en el consolidado" : "Ingreso del taller, costo de la marca"}
          struck={consolidated}
        />
        <FlowArrow />
        <FlowBox icon={<Storefront size={18} weight="bold" />} title="Venta al cliente" value={w.internalChargeCents + w.commercialResultCents} note="Único ingreso externo" />
      </div>

      <dl className="tabular mt-5 grid gap-3 sm:grid-cols-3">
        <ResultCell label="Resultado del taller" value={w.workshopResultCents} hint="Cargo interno menos costo" />
        <ResultCell label="Resultado comercial" value={w.commercialResultCents} hint="Venta menos cargo interno" />
        <ResultCell label="Margen consolidado" value={w.consolidatedMarginCents} hint="Sin doble conteo del cargo interno" strong />
      </dl>
      {consolidated && (
        <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
          <Info size={16} className="mt-px shrink-0" />
          En el consolidado el cargo interno de {formatMoney(w.internalChargeCents)} no suma como ingreso ni entra a la caja: es una transferencia dentro del grupo.
        </p>
      )}
    </Card>
  );
}

function FlowBox({ icon, title, value, note, struck }: { icon: React.ReactNode; title: string; value: number; note: string; struck?: boolean }) {
  return (
    <div className={cx("rounded-[var(--radius-block)] bg-panel p-4", struck ? "border border-dashed border-[#d3d0c9]" : "ring-1 ring-line")}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        {icon}
        {title}
      </p>
      <p className={cx("tabular mt-2 text-2xl font-extrabold tracking-tight", struck && "text-faint line-through")}>{formatMoney(value)}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <span aria-hidden="true" className="flex items-center justify-center text-faint">
      <ArrowRight size={20} weight="bold" className="rotate-90 lg:rotate-0" />
    </span>
  );
}

function ResultCell({ label, value, hint, strong }: { label: string; value: number; hint: string; strong?: boolean }) {
  return (
    <div className={cx("rounded-[var(--radius-block)] p-4", strong ? "bg-ink text-white" : "bg-card ring-1 ring-line")}>
      <dt className={cx("text-[13px] font-semibold", strong ? "text-white/70" : "text-muted")}>{label}</dt>
      <dd className={cx("mt-1 text-xl font-extrabold", value < 0 && (strong ? "text-[#ffb4ab]" : "text-bad"))}>
        <Money cents={value} />
      </dd>
      <p className={cx("mt-0.5 text-xs", strong ? "text-white/60" : "text-muted")}>{hint}</p>
    </div>
  );
}
