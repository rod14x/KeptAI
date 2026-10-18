import { useState } from "react";
import {
  CheckCircle,
  Factory,
  Needle,
  Package,
  PaintBrush,
  Printer,
  Scissors,
  ShieldCheck,
  TShirt,
  Truck,
} from "../ui/icons";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { cx, formatDateTime } from "../../lib/format";
import {
  deductStockForSheet,
  loadWorkshopInventory,
  STATION_METADATA,
  updateOrderModality,
  updateOrderStation,
  type ManufacturingModality,
  type ManufacturingStation,
  type ProductionTechSheet,
} from "../../lib/tallerManufacturing";
import { useToast } from "../../context/ToastContext";

interface FichaTecnicaModalProps {
  open: boolean;
  sheet: ProductionTechSheet | null;
  onClose: () => void;
  onUpdate: (updated: ProductionTechSheet) => void;
}

export function FichaTecnicaModal({
  open,
  sheet,
  onClose,
  onUpdate,
}: FichaTecnicaModalProps) {
  const toast = useToast();
  const [stationNote, setStationNote] = useState("");

  if (!sheet) return null;

  const inventory = loadWorkshopInventory();
  const linkedItem = inventory.find((it) => it.id === sheet.itemInventarioId);

  const handleStationChange = (newStation: ManufacturingStation) => {
    const updated = updateOrderStation(
      sheet.orderId,
      newStation,
      stationNote || `Reasignado a ${STATION_METADATA[newStation].label}`
    );
    if (updated) {
      onUpdate(updated);
      setStationNote("");
      toast(true, `Orden ${sheet.orderRef} transferida a estación: ${STATION_METADATA[newStation].shortLabel}`);
    }
  };

  const handleModalityChange = (newModality: ManufacturingModality) => {
    const updated = updateOrderModality(sheet.orderId, newModality);
    if (updated) {
      onUpdate(updated);
      toast(true, `Modalidad cambiada a: ${newModality === "stock_personalizado" ? "Prenda en Stock" : "Confección Completa"}`);
    }
  };

  const handleDeductStock = () => {
    const res = deductStockForSheet(sheet.orderId);
    toast(res.ok, res.message);
    if (res.ok) {
      const updated = { ...sheet, stockDescontado: true, unidadesDescontadas: sheet.totalUnidades };
      onUpdate(updated);
    }
  };

  const currentMeta = STATION_METADATA[sheet.currentStation];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ficha Técnica Textil: ${sheet.orderRef}`}
      subtitle={`Orden de Producción para ${sheet.customer} · ${sheet.prendaTipo} (${sheet.totalUnidades} uds)`}
    >
      <div className="flex flex-col gap-6 max-h-[80vh] overflow-y-auto pr-1 w-full max-w-4xl">
        {/* Barra superior de acciones para operarios */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted uppercase">Estación Actual:</span>
            <Chip tone={currentMeta.tone} className="text-xs font-bold py-1 px-3">
              {currentMeta.label}
            </Chip>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={16} weight="bold" />}
              onClick={() => window.print()}
            >
              Imprimir Ficha de Taller
            </Button>
          </div>
        </div>

        {/* Selector de Modalidad de Manufactura */}
        <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4 print:border-line">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">
                Modalidad de Manufactura
              </p>
              <p className="text-xs text-muted mt-0.5">
                Define si el pedido toma prendas base en blanco del almacén o se corta desde tela virgen.
              </p>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => handleModalityChange("stock_personalizado")}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                  sheet.modality === "stock_personalizado"
                    ? "bg-brand-blue text-white shadow-sm"
                    : "bg-panel text-muted hover:text-ink"
                )}
              >
                <TShirt size={15} weight="bold" />
                Prenda en Stock (Base)
              </button>
              <button
                type="button"
                onClick={() => handleModalityChange("confeccion_completa")}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                  sheet.modality === "confeccion_completa"
                    ? "bg-brand-blue text-white shadow-sm"
                    : "bg-panel text-muted hover:text-ink"
                )}
              >
                <Scissors size={15} weight="bold" />
                Confección Completa (Desde Rollo)
              </button>
            </div>
          </div>

          {/* Panel de inventario asociado a la modalidad */}
          {sheet.modality === "stock_personalizado" ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-soft bg-card p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-info-tint text-info">
                  <TShirt size={20} weight="bold" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink">
                    Prenda Base: {linkedItem?.nombre ?? "Polo Base en Blanco"}
                  </p>
                  <p className="text-[11px] text-muted">
                    Stock en almacén de planta:{" "}
                    <strong className="text-ink">{linkedItem?.stockActual ?? 0} uds</strong> (se requieren {sheet.totalUnidades} uds)
                  </p>
                </div>
              </div>

              <div>
                {sheet.stockDescontado ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ok-tint px-2.5 py-1 text-xs font-bold text-ok">
                    <CheckCircle size={15} weight="fill" />
                    Inventario descontado ({sheet.unidadesDescontadas} uds)
                  </span>
                ) : (
                  <Button
                    size="sm"
                    icon={<Package size={15} weight="bold" />}
                    onClick={handleDeductStock}
                  >
                    Descontar Stock ({sheet.totalUnidades} uds)
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-line-soft bg-card p-3 text-xs text-muted">
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <Scissors size={15} className="text-info" />
                Ruta de Confección Completa:
              </p>
              <p className="mt-1">
                Consume aproximadamente <strong className="text-ink">{((sheet.totalUnidades * 0.22)).toFixed(1)} Kg</strong> de tejido ({sheet.tela}) desde almacén de insumos textiles. La tela se corta en piezas planas antes de entrar a sublimación o bordado.
              </p>
            </div>
          )}
        </div>

        {/* Enrutamiento de Estaciones de Manufactura */}
        <div className="rounded-xl border border-line bg-card p-4 print:hidden">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Transferir Orden a Estación de Trabajo
          </p>
          <p className="text-xs text-muted mt-0.5">
            Selecciona la estación donde se encuentra físicamente el lote de prendas:
          </p>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(
              [
                { id: "corte", label: "Corte", icon: <Scissors size={16} weight="bold" /> },
                { id: "sublimacion", label: "Sublimación", icon: <PaintBrush size={16} weight="bold" /> },
                { id: "bordado", label: "Bordado", icon: <Needle size={16} weight="bold" /> },
                { id: "confeccion", label: "Confección", icon: <Factory size={16} weight="bold" /> },
                { id: "control_calidad", label: "Calidad", icon: <ShieldCheck size={16} weight="bold" /> },
                { id: "listo_despacho", label: "Despacho", icon: <Truck size={16} weight="bold" /> },
              ] as const
            ).map((st) => {
              const isActive = sheet.currentStation === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleStationChange(st.id)}
                  className={cx(
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all",
                    isActive
                      ? "border-brand-blue bg-brand-blue text-white shadow-sm ring-2 ring-brand-blue/30"
                      : "border-line bg-panel hover:bg-card hover:border-brand-blue/50 text-muted hover:text-ink"
                  )}
                >
                  {st.icon}
                  <span className="text-xs font-bold">{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuadro de Curva de Tallas y Cantidades */}
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
              <TShirt size={16} className="text-brand-blue" />
              Curva de Tallas y Cantidades a Fabricar
            </h4>
            <span className="tabular text-xs font-extrabold text-ink">
              Total: {sheet.totalUnidades} prendas
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {sheet.curvaTallas.map((ct) => (
              <div
                key={ct.talla}
                className="flex items-center justify-between rounded-lg border border-line-soft bg-panel/70 px-3 py-2"
              >
                <span className="text-xs font-extrabold text-muted">Talla {ct.talla}</span>
                <span className="tabular text-sm font-extrabold text-ink">{ct.cantidad} uds</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ficha de Especificaciones de Tejido y Corte */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-line bg-card p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-b border-line-soft pb-2">
              Especificación Textil & Avíos
            </h4>
            <dl className="mt-2.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">Tipo de Tela:</dt>
                <dd className="font-bold text-ink">{sheet.tela}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Gramaje:</dt>
                <dd className="font-bold text-ink">{sheet.gramaje}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Color Principal:</dt>
                <dd className="font-bold text-ink">{sheet.colorPrincipal}</dd>
              </div>
              {sheet.colorContraste && (
                <div className="flex justify-between">
                  <dt className="text-muted">Color Contraste:</dt>
                  <dd className="font-bold text-ink">{sheet.colorContraste}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Tipo de Cuello:</dt>
                <dd className="font-bold text-ink">{sheet.tipoCuello}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-card p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-b border-line-soft pb-2">
              Personalización, Arte & Estampado
            </h4>
            <div className="mt-2 text-xs">
              <p className="font-bold text-brand-blue">
                Técnica: {sheet.tecnicaPersonalizacion}
              </p>
              <ul className="mt-2 space-y-1.5 divide-y divide-line-soft">
                {sheet.arteUbicaciones.map((arte, i) => (
                  <li key={i} className="pt-1.5 first:pt-0">
                    <span className="font-bold text-ink block">{arte.ubicacion} ({arte.medidas})</span>
                    <span className="text-[11px] text-muted block">{arte.descripcion}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded bg-panel px-2.5 py-1.5 text-[11px] text-muted">
                Archivo vectorial: <span className="font-semibold text-ink">{sheet.archivoArte}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instrucciones de Confección & Control de Calidad */}
        <div className="rounded-xl border border-line bg-card p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-b border-line-soft pb-2">
            Instrucciones de Confección & Estándar de Calidad (AQL)
          </h4>
          <ul className="mt-2.5 space-y-1.5 text-xs text-muted">
            {sheet.instruccionesCostura.map((inst, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-brand-blue font-bold">✓</span>
                <span>{inst}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Historial de Estaciones */}
        {sheet.stationHistory.length > 0 && (
          <div className="rounded-xl border border-line-soft bg-panel/40 p-4 print:hidden">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Trazabilidad en Línea de Planta
            </h4>
            <ul className="space-y-1.5 text-xs">
              {sheet.stationHistory.map((h, i) => (
                <li key={i} className="flex items-center justify-between text-muted">
                  <span>
                    <strong className="text-ink">{STATION_METADATA[h.station].shortLabel}</strong>: {h.note}
                  </span>
                  <span className="tabular text-[11px]">{formatDateTime(h.timestamp)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Botón de cierre */}
        <div className="flex justify-end gap-2 border-t border-line pt-3 print:hidden">
          <Button variant="secondary" onClick={onClose}>
            Cerrar Ficha
          </Button>
        </div>
      </div>
    </Modal>
  );
}
