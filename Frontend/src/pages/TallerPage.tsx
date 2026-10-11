import { useState } from "react";
import { motion } from "motion/react";
import { Factory, Hourglass, Truck } from "../components/ui/icons";
import { commands, getTaller, type TallerOrder } from "../api/client";
import { IS_MOCK } from "../config";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { useMe } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { can } from "../lib/permissions";
import { Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, DemoBadge, EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { Chip } from "../components/ui/Chip";
import { Button } from "../components/ui/Button";
import { Modal, inputClass } from "../components/ui/Modal";
import { cx, formatDate } from "../lib/format";
import { addDays, daysBetween } from "../lib/dates";

// Vista mínima del Jefe de taller (decisión de Germán): solo órdenes liberadas y el despacho,
// que fija el vencimiento. Las etapas Corte → Calidad quedan para la fase 2.

export function TallerPage() {
  const { scope } = useScope();
  const { data, loading, error, reload } = useApi(() => getTaller(scope), [scope]);
  const [dispatching, setDispatching] = useState<TallerOrder | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6 lg:gap-8">
      <PageHeader title="Producción y despacho" subtitle={<>Registra la salida de los pedidos listos para entregar. Vista {SCOPE_LABEL[scope]}.</>} actions={IS_MOCK ? <DemoBadge /> : undefined} />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton className="h-[360px] rounded-[var(--radius-card)]" />
      ) : (
        <Stagger className="flex flex-col gap-6 lg:gap-8">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-section font-bold">
                <Factory size={20} className="text-info" /> En producción
              </h2>
              <Chip tone="info">{data.enProduccion.length}</Chip>
            </div>
            <p className="mt-1 text-[13px] text-muted">Órdenes liberadas en proceso de confección o listas para despacho.</p>
            {data.enProduccion.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Nada en producción">Cuando el vendedor confirme una orden con crédito, o se verifique un anticipo, aparecerá aquí.</EmptyState>
              </div>
            ) : (
              <motion.ul variants={listVariants} className="mt-4 flex flex-col divide-y divide-line">
                {data.enProduccion.map((o) => (
                  <motion.li variants={itemVariants} key={o.id}>
                    <TallerRow
                      o={o}
                      cutDate={data.cutDate}
                      onDispatch={() => {
                        setDispatching(o);
                        setOpen(true);
                      }}
                    />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <Card className="flex flex-col h-full p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-section font-bold">
                  <Hourglass size={20} className="text-warn" /> Retenidas
                </h2>
                <Chip tone="warn">{data.retenidas.length}</Chip>
              </div>
              <p className="mt-1 text-[13px] text-muted">No se producen hasta que Administración verifique el anticipo.</p>
              {data.retenidas.length > 0 ? (
                <ul className="mt-4 flex flex-col divide-y divide-line-soft">
                  {data.retenidas.map((o) => (
                    <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block font-bold truncate">
                          {o.ref} · {o.customer}
                        </span>
                        <span className="block truncate text-[13px] text-muted">{o.description}</span>
                      </span>
                      <Chip tone="warn" className="shrink-0">Esperando anticipo</Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-line-soft bg-panel/40 p-6 text-center text-xs text-muted">
                  Sin órdenes retenidas pendientes de anticipo.
                </div>
              )}
            </Card>

            <Card className="flex flex-col h-full p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-section font-bold">
                  <Truck size={20} className="text-ok" /> Últimos despachos
                </h2>
                <Chip tone="ok">{data.despachadas.length}</Chip>
              </div>
              <p className="mt-1 text-[13px] text-muted">Historial de pedidos despachados con guía y vencimiento.</p>
              {data.despachadas.length > 0 ? (
                <ul className="mt-4 flex flex-col divide-y divide-line-soft">
                  {data.despachadas.map((o) => (
                    <li key={o.id} className="tabular grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block font-bold truncate">
                          {o.ref} · {o.customer}
                        </span>
                        <span className="block truncate text-[13px] text-muted">
                          {o.despacho?.acta} · {o.despacho?.by}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[13px]">
                        <span className="block font-semibold">{o.despacho ? formatDate(o.despacho.fecha) : ""}</span>
                        {o.despacho && o.plazoDias != null && <span className="block text-xs text-muted">vence {formatDate(addDays(o.despacho.fecha, o.plazoDias))}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-line-soft bg-panel/40 p-6 text-center text-xs text-muted">
                  Sin despachos registrados en este período.
                </div>
              )}
            </Card>
          </div>
        </Stagger>
      )}

      {data && <DispatchModal open={open} order={dispatching} cutDate={data.cutDate} onClose={() => setOpen(false)} />}
    </Stagger>
  );
}

function TallerRow({ o, cutDate, onDispatch }: { o: TallerOrder; cutDate: string; onDispatch: () => void }) {
  const me = useMe();
  const daysLeft = o.entregaSolicitada ? daysBetween(cutDate, o.entregaSolicitada) : null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] items-start md:items-center gap-4 py-5">
      <div className="min-w-0">
        <p className="font-bold text-ink">
          {o.ref} · {o.customer}
        </p>
        <ul className="mt-1 text-[13px] text-muted space-y-0.5">
          {o.items.map((it, i) => (
            <li key={i}>
              {it.cantidad} × {it.descripcion} · {it.detalle}
            </li>
          ))}
        </ul>
        <p className="tabular mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>Producción desde {o.inicioProduccion ? formatDate(o.inicioProduccion) : "sin fecha"}</span>
          <span>·</span>
          <span>{o.modality === "propia" ? "Taller interno" : "Taller tercero"}</span>
          {o.entregaSolicitada && (
            <>
              <span>·</span>
              <span className={cx("font-semibold", daysLeft !== null && daysLeft <= 3 ? "text-bad" : "text-ink")}>
                Entrega pedida {formatDate(o.entregaSolicitada)}
                {daysLeft !== null && (daysLeft < 0 ? ` (atrasada ${-daysLeft} d)` : ` (en ${daysLeft} d)`)}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-start md:justify-end w-full md:w-auto">
        {can(me.role, "registrar_despacho") ? (
          <Button icon={<Truck size={18} weight="bold" />} onClick={onDispatch} className="w-full md:w-auto">
            Registrar despacho
          </Button>
        ) : (
          <Chip tone="neutral">Lo despacha el Jefe de taller</Chip>
        )}
      </div>
    </div>
  );
}

function DispatchModal({ open, order, cutDate, onClose }: { open: boolean; order: TallerOrder | null; cutDate: string; onClose: () => void }) {
  const me = useMe();
  const toast = useToast();
  const [fecha, setFecha] = useState(cutDate);
  const [acta, setActa] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!order) return null;
  const due = order.plazoDias != null && fecha ? addDays(fecha, order.plazoDias) : null;
  return (
    <Modal open={open} onClose={onClose} title={`Despachar ${order.ref}`} subtitle={`${order.customer}. El acta fija el vencimiento: despacho + ${order.plazoDias ?? 0} días.`}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await commands.registerDispatch(order.id, fecha, acta, me);
          if (!r.ok) {
            setErr(r.message);
            return;
          }
          toast(true, r.message);
          setActa("");
          setErr(null);
          onClose();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="d-fecha" className="text-[13px] font-semibold">
              Fecha de despacho
            </label>
            <input id="d-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={cx(inputClass, "tabular")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="d-acta" className="text-[13px] font-semibold">
              N.° de acta o guía
            </label>
            <input id="d-acta" value={acta} onChange={(e) => setActa(e.target.value)} placeholder="Ej. Guía 016-10" className={inputClass} />
          </div>
        </div>
        {due && (
          <p className="tabular rounded-xl bg-violet-wash px-3.5 py-2.5 text-[13px] text-violet-ink">
            Vencerá el <span className="font-bold">{formatDate(due)}</span>. Se programan recordatorios por WhatsApp −3, 0 y +3 días.
          </p>
        )}
        {err && (
          <p role="alert" className="rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
            {err}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon={<Truck size={16} weight="bold" />}>
            Registrar despacho
          </Button>
        </div>
      </form>
    </Modal>
  );
}
