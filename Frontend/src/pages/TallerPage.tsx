import { useState } from "react";
import { motion } from "motion/react";
import {
  CheckCircle,
  Factory,
  Hourglass,
  Info,
  Needle,
  NotePencil,
  Package,
  PaintBrush,
  Scissors,
  ShieldCheck,
  TShirt,
  Truck,
} from "../components/ui/icons";
import { commands, getTaller, type TallerOrder } from "../api/client";
import { IS_MOCK } from "../config";
import { useApi } from "../hooks/useApi";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { useMe } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { can } from "../lib/permissions";
import { Stagger, itemVariants, listVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Card, DemoBadge, EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { Chip } from "../components/ui/Chip";
import { Button } from "../components/ui/Button";
import { Modal, inputClass } from "../components/ui/Modal";
import { cx, formatDate, formatMoney } from "../lib/format";
import { addDays, daysBetween } from "../lib/dates";
import {
  getOrCreateTechSheet,
  STATION_METADATA,
  updateOrderStation,
  type ManufacturingStation,
  type ProductionTechSheet,
} from "../lib/tallerManufacturing";
import { FichaTecnicaModal, TallerInventoryView } from "../components/organisms";

// Vista profesional de Manufactura Textil:
// - Control de Planta con estaciones (Corte, Sublimación, Bordado, Confección, Calidad)
// - Inventario de Prendas Base en Blanco + Rollos de Tela virgen
// - Gatekeeper de Tesorería y Ficha Técnica de Fabricación imprimible

export function TallerPage() {
  const { scope } = useScope();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => getTaller(scope), [scope]);
  const [tab, setTab] = useState<"produccion" | "inventario">("produccion");
  const [dispatching, setDispatching] = useState<TallerOrder | null>(null);
  const [openDispatch, setOpenDispatch] = useState(false);
  const [inspectingSheet, setInspectingSheet] = useState<ProductionTechSheet | null>(null);
  const [, setRefreshKey] = useState(0);

  const handleStationUpdate = (orderId: string, orderRef: string, newStation: ManufacturingStation) => {
    const updated = updateOrderStation(orderId, newStation, `Cambio de estación desde planta`);
    if (updated) {
      setRefreshKey((k) => k + 1);
      toast(true, `${orderRef} transferido a: ${STATION_METADATA[newStation].shortLabel}`);
    }
  };

  return (
    <Stagger className="mx-auto flex max-w-[1320px] flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Manufactura y Control de Planta"
        subtitle={
          <>
            Enrutamiento a estaciones (Corte, Sublimación, Bordado, Confección), stock de prendas base y despacho. Vista{" "}
            {SCOPE_LABEL[scope]}.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {IS_MOCK ? <DemoBadge /> : undefined}
          </div>
        }
      />

      {/* Selector de Pestañas: Línea de Producción vs Almacén e Inventario */}
      <motion.div variants={itemVariants}>
        <Segmented
          kind="tab"
          label="Módulos de Taller"
          value={tab}
          onChange={(v) => setTab(v as any)}
          options={[
            {
              value: "produccion",
              label: "Línea de Producción Activa",
              count: data?.enProduccion.length,
            },
            {
              value: "inventario",
              label: "Inventario de Planta & Almacén",
            },
          ]}
        />
      </motion.div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton className="h-[360px] rounded-[var(--radius-card)]" />
      ) : tab === "inventario" ? (
        <motion.div variants={itemVariants}>
          <TallerInventoryView />
        </motion.div>
      ) : (
        <Stagger className="flex flex-col gap-6 lg:gap-8">
          {/* Card 1: Órdenes en Producción Activa con Estaciones */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="flex items-center gap-2 text-section font-bold">
                  <Factory size={20} className="text-info" /> Órdenes en Planta Textil
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  Asigna cada pedido a su estación operativa: Corte, Sublimación, Bordado, Costura o Control de Calidad.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Chip tone="info">{data.enProduccion.length} activas</Chip>
              </div>
            </div>

            {data.enProduccion.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Nada en producción activa">
                  Cuando el vendedor confirme una orden con crédito, o se verifique un anticipo, aparecerá aquí.
                </EmptyState>
              </div>
            ) : (
              <motion.ul variants={listVariants} className="mt-4 flex flex-col divide-y divide-line">
                {data.enProduccion.map((o) => (
                  <motion.li variants={itemVariants} key={o.id}>
                    <TallerRow
                      o={o}
                      cutDate={data.cutDate}
                      onInspectSheet={() => setInspectingSheet(getOrCreateTechSheet(o))}
                      onStationChange={(st) => handleStationUpdate(o.id, o.ref, st)}
                      onDispatch={() => {
                        setDispatching(o);
                        setOpenDispatch(true);
                      }}
                    />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </Card>

          {/* Grid: Órdenes Retenidas por Gatekeeper vs Últimos Despachos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <Card className="flex flex-col h-full p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <h2 className="flex items-center gap-2 text-section font-bold">
                    <Hourglass size={20} className="text-warn" /> Retenidas por Gatekeeper
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    Prohibido confeccionar o cortar tela: Tesorería aún no valida el anticipo requerido.
                  </p>
                </div>
                {data.retenidas && <Chip tone="warn">{data.retenidas.length}</Chip>}
              </div>

              {data.retenidas === null ? (
                <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-line-soft bg-panel/40 p-6 text-center text-xs text-muted">
                  Las órdenes retenidas las gestiona Administración: llegan a producción cuando se aplica el anticipo.
                </div>
              ) : data.retenidas.length > 0 ? (
                <ul className="mt-4 flex flex-col divide-y divide-line-soft">
                  {data.retenidas.map((o) => (
                    <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3.5 text-sm">
                      <span className="min-w-0">
                        <span className="block font-bold text-ink truncate">
                          {o.ref}
                          {o.customer && ` · ${o.customer}`}
                        </span>
                        <span className="block truncate text-xs text-muted">{o.description}</span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warn">
                          <Info size={13} weight="bold" /> Falta anticipo de {formatMoney(o.anticipoPendienteCents)}
                        </span>
                      </span>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Chip tone="warn">Bloqueado en Taller</Chip>
                        <span className="text-[10px] text-faint">Esperando voucher</span>
                      </div>
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
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <h2 className="flex items-center gap-2 text-section font-bold">
                    <Truck size={20} className="text-ok" /> Últimos despachos físicos
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    Historial de salida de mercadería con acta y fecha de vencimiento activada.
                  </p>
                </div>
                <Chip tone="ok">{data.despachadas.length}</Chip>
              </div>

              {data.despachadas.length > 0 ? (
                <ul className="mt-4 flex flex-col divide-y divide-line-soft">
                  {data.despachadas.map((o) => (
                    <li key={o.id} className="tabular grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3.5 text-sm">
                      <span className="min-w-0">
                        <span className="block font-bold text-ink truncate">
                          {o.ref}
                          {o.customer && ` · ${o.customer}`}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          Acta: <span className="font-semibold text-ink">{o.despacho?.acta}</span> · Despachado por{" "}
                          {o.despacho?.by}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[13px]">
                        <span className="block font-semibold text-ink">
                          {o.despacho ? formatDate(o.despacho.fecha) : ""}
                        </span>
                        {o.despacho && o.plazoDias != null && (
                          <span className="block text-xs font-medium text-ok">
                            vence {formatDate(addDays(o.despacho.fecha, o.plazoDias))}
                          </span>
                        )}
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

      {/* Modal de Despacho Físico */}
      {data && (
        <DispatchModal
          open={openDispatch}
          order={dispatching}
          cutDate={data.cutDate}
          onClose={() => setOpenDispatch(false)}
        />
      )}

      {/* Modal de Ficha Técnica de Confección & Enrutamiento */}
      <FichaTecnicaModal
        open={Boolean(inspectingSheet)}
        sheet={inspectingSheet}
        onClose={() => setInspectingSheet(null)}
        onUpdate={(updated) => {
          setInspectingSheet(updated);
          setRefreshKey((k) => k + 1);
        }}
      />
    </Stagger>
  );
}

function TallerRow({
  o,
  cutDate,
  onInspectSheet,
  onStationChange,
  onDispatch,
}: {
  o: TallerOrder;
  cutDate: string;
  onInspectSheet: () => void;
  onStationChange: (st: ManufacturingStation) => void;
  onDispatch: () => void;
}) {
  const me = useMe();
  const daysLeft = o.entregaSolicitada ? daysBetween(cutDate, o.entregaSolicitada) : null;
  const sheet = getOrCreateTechSheet(o);
  const currentMeta = STATION_METADATA[sheet.currentStation];

  return (
    <div className="py-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Lado izquierdo: Datos de la orden, cliente y sellos */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink text-base">
              {o.ref}
              {o.customer && ` · ${o.customer}`}
            </p>
            <Chip tone="ok" className="text-[11px] font-bold">
              <ShieldCheck size={13} weight="bold" className="inline mr-1" />
              Liberada para confección
            </Chip>

            {/* Chip de estación operativa */}
            <Chip tone={currentMeta.tone} className="text-[11px] font-bold">
              {sheet.currentStation === "corte" && <Scissors size={12} weight="bold" className="inline mr-1" />}
              {sheet.currentStation === "sublimacion" && <PaintBrush size={12} weight="bold" className="inline mr-1" />}
              {sheet.currentStation === "bordado" && <Needle size={12} weight="bold" className="inline mr-1" />}
              {sheet.currentStation === "confeccion" && <Factory size={12} weight="bold" className="inline mr-1" />}
              {sheet.currentStation === "control_calidad" && <ShieldCheck size={12} weight="bold" className="inline mr-1" />}
              {sheet.currentStation === "listo_despacho" && <Truck size={12} weight="bold" className="inline mr-1" />}
              Estación: {currentMeta.shortLabel}
            </Chip>

            {/* Badge de Modalidad de Manufactura */}
            <span className="inline-flex items-center gap-1 rounded bg-panel px-2 py-0.5 text-[11px] font-semibold text-muted">
              {sheet.modality === "stock_personalizado" ? (
                <>
                  <TShirt size={13} className="text-brand-blue" />
                  Prenda en Stock Base
                </>
              ) : (
                <>
                  <Scissors size={13} className="text-info" />
                  Confección Completa
                </>
              )}
            </span>
          </div>

          <ul className="mt-2 text-[13px] text-muted space-y-1">
            {o.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2">
                <Package size={14} className="text-faint shrink-0" />
                <span>
                  <strong className="text-ink">
                    {it.cantidad} {it.cantidad === 1 ? "unidad" : "unidades"}
                  </strong>{" "}
                  · {it.descripcion} ({it.detalle})
                </span>
              </li>
            ))}
          </ul>

          <p className="tabular mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>Producción desde {o.inicioProduccion ? formatDate(o.inicioProduccion) : "sin fecha"}</span>
            <span>·</span>
            <span className="font-medium text-ink">
              {o.modality === "propia" ? "Taller propio (Corpotex)" : "Taller tercerizado"}
            </span>
            {o.entregaSolicitada && (
              <>
                <span>·</span>
                <span className={cx("font-semibold", daysLeft !== null && daysLeft <= 3 ? "text-bad" : "text-ink")}>
                  Entrega solicitada: {formatDate(o.entregaSolicitada)}
                  {daysLeft !== null && (daysLeft < 0 ? ` (atrasada ${-daysLeft} d)` : ` (en ${daysLeft} d)`)}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Lado derecho: Acciones de Manufactura */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={<NotePencil size={15} weight="bold" />}
            onClick={onInspectSheet}
            title="Abrir ficha técnica, tallas y especificaciones de confección"
          >
            Ficha Técnica ({sheet.totalUnidades} uds)
          </Button>

          {can(me.role, "registrar_despacho") ? (
            <Button
              icon={<Truck size={16} weight="bold" />}
              size="sm"
              onClick={onDispatch}
            >
              Registrar despacho
            </Button>
          ) : (
            <Chip tone="neutral">Lo despacha el Jefe de taller</Chip>
          )}
        </div>
      </div>

      {/* Barra de enrutamiento rápido a estaciones de trabajo */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-panel/50 p-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted">Mover orden a:</span>
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: "corte", label: "Corte", icon: <Scissors size={13} weight="bold" /> },
                { id: "sublimacion", label: "Sublimación", icon: <PaintBrush size={13} weight="bold" /> },
                { id: "bordado", label: "Bordado", icon: <Needle size={13} weight="bold" /> },
                { id: "confeccion", label: "Confección", icon: <Factory size={13} weight="bold" /> },
                { id: "control_calidad", label: "Calidad", icon: <ShieldCheck size={13} weight="bold" /> },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onStationChange(st.id)}
                className={cx(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-all",
                  sheet.currentStation === st.id
                    ? "bg-brand-blue text-white shadow-xs"
                    : "bg-card text-muted hover:text-ink hover:bg-white"
                )}
              >
                {st.icon}
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-right">
          {sheet.modality === "stock_personalizado" && sheet.stockDescontado ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ok">
              <CheckCircle size={13} weight="fill" /> Prenda base reservada en stock
            </span>
          ) : sheet.modality === "stock_personalizado" ? (
            <span className="text-[11px] text-warn font-semibold">
              ⚠️ Falta reservar prenda base en ficha técnica
            </span>
          ) : (
            <span className="text-[11px] text-muted">
              Corte programado desde rollo de tela virgen
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DispatchModal({
  open,
  order,
  cutDate,
  onClose,
}: {
  open: boolean;
  order: TallerOrder | null;
  cutDate: string;
  onClose: () => void;
}) {
  const me = useMe();
  const toast = useToast();
  const [fecha, setFecha] = useState(cutDate);
  const [acta, setActa] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!order) return null;
  const due = order.plazoDias != null && fecha ? addDays(fecha, order.plazoDias) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Despacho físico: ${order.ref}`}
      subtitle={`${order.customer ? `${order.customer}. ` : ""}El registro del despacho activa formalmente el plazo de crédito (${order.plazoDias ?? 0} días).`}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await commands.registerDispatch(
            order.id,
            fecha,
            acta || `ACTA-${order.ref.replace("P-", "")}`,
            me
          );
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
        {/* Previsualización de ítems en despacho */}
        <div className="rounded-xl border border-line-soft bg-panel/50 p-3.5">
          <p className="text-xs font-bold text-ink uppercase tracking-wide">
            Prendas a entregar según orden:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <span>
                  {it.descripcion} ({it.detalle})
                </span>
                <span className="font-bold text-ink">{it.cantidad} uds</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="d-fecha" className="text-[13px] font-semibold text-ink">
              Fecha de despacho físico
            </label>
            <input
              id="d-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={cx(inputClass, "tabular")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="d-acta" className="text-[13px] font-semibold text-ink">
              N.° de acta de entrega o guía
            </label>
            <input
              id="d-acta"
              value={acta}
              onChange={(e) => setActa(e.target.value)}
              placeholder={`Ej. ACTA-${order.ref.replace("P-", "")}`}
              className={inputClass}
            />
          </div>
        </div>

        {due && (
          <div className="tabular flex items-start gap-2.5 rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-3.5 text-[13px] text-ink">
            <CheckCircle size={18} className="text-brand-blue shrink-0 mt-0.5" weight="bold" />
            <div>
              <p className="font-semibold text-brand-blue">Impacto en Cobranzas y Flujo de Caja:</p>
              <p className="mt-0.5 text-xs text-muted">
                La fecha de vencimiento quedará fijada para el{" "}
                <span className="font-bold text-ink">{formatDate(due)}</span>. El sistema programará
                automáticamente los recordatorios por WhatsApp para el cliente.
              </p>
            </div>
          </div>
        )}

        {err && (
          <p role="alert" className="rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
            {err}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon={<Truck size={16} weight="bold" />}>
            Confirmar y Despachar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
