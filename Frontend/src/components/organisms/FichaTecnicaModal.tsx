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
  Clock,
  FloppyDisk,
} from "../ui/icons";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { cx, formatDateTime } from "../../lib/format";
import {
  calculateEstimatedFabricKg,
  deductStockForSheet,
  isConfeccionRollo,
  isStockBordado,
  loadWorkshopInventory,
  persistTechSheet,
  STATION_METADATA,
  updateOrderModality,
  updateOrderStation,
  validateFabricStatus,
  type ManufacturingModality,
  type ManufacturingStation,
  type ProductionTechSheet,
  type SemaforoTela,
} from "../../lib/tallerManufacturing";
import { useToast } from "../../context/ToastContext";
import { useMe } from "../../context/AuthContext";
import { can } from "../../lib/permissions";

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
  const me = useMe();
  const toast = useToast();
  const [stationNote, setStationNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Rol y permisos
  const isReadOnly = me.role === "gerencia";
  const isJefeTaller = me.role === "jefe_taller" || me.role === "administracion";
  const canMoveStation = !isReadOnly && (can(me.role, "registrar_despacho") || isJefeTaller);

  if (!sheet) return null;

  const inventory = loadWorkshopInventory();
  const linkedItem = inventory.find((it) => it.id === sheet.itemInventarioId);
  const currentMeta = STATION_METADATA[sheet.currentStation] ?? STATION_METADATA.corte;
  const isRollo = isConfeccionRollo(sheet.modality);
  const estimatedKg = calculateEstimatedFabricKg(sheet.curvaTallas);

  const handleStationChange = (newStation: ManufacturingStation) => {
    if (isReadOnly || !canMoveStation) return;
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
    if (isReadOnly) return;
    const updated = updateOrderModality(sheet.orderId, newModality);
    if (updated) {
      onUpdate(updated);
      toast(true, `Modalidad cambiada a: ${isStockBordado(newModality) ? "Prenda en Stock + Bordado" : "Confección Personalizada desde Rollo"}`);
    }
  };

  const handleSemaforoChange = (semaforo: SemaforoTela) => {
    if (isReadOnly) return;
    const updated: ProductionTechSheet = {
      ...sheet,
      semaforoTela: semaforo,
      validacionTela: semaforo === "HABITUAL_VERDE" ? "CONFIRMADA_TALLER" : "COMPRA_REQUERIDA",
      estado: semaforo === "HABITUAL_VERDE" ? "COMPLETA" : "BORRADOR",
    };
    onUpdate(updated);
  };

  const handleValidateFabric = async (validacion: "CONFIRMADA_TALLER" | "COMPRA_REQUERIDA") => {
    if (isReadOnly) return;
    const res = await validateFabricStatus(sheet.orderId, validacion, undefined, me);
    toast(res.ok, res.message);
    if (res.ok && res.sheet) {
      onUpdate(res.sheet);
    }
  };

  const handleDeductStock = () => {
    if (isReadOnly) return;
    const res = deductStockForSheet(sheet.orderId);
    toast(res.ok, res.message);
    if (res.ok) {
      const updated = { ...sheet, stockDescontado: true, unidadesDescontadas: sheet.totalUnidades };
      onUpdate(updated);
    }
  };

  const handleSaveSpecs = async () => {
    if (isReadOnly) return;
    setSaving(true);
    const res = await persistTechSheet(sheet, me);
    setSaving(false);
    toast(res.ok, res.message);
    if (res.ok) {
      onUpdate(res.sheet);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ficha Técnica Textil: ${sheet.orderRef}`}
      subtitle={`Orden de Fabricación · ${sheet.customer} · ${sheet.prendaTipo} (${sheet.totalUnidades} uds)`}
    >
      <div className="flex flex-col gap-6 max-h-[80vh] overflow-y-auto pr-1 w-full max-w-4xl">
        {/* Barra superior de estado y acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted uppercase">Estación:</span>
            <Chip tone={currentMeta.tone} className="text-xs font-bold py-1 px-3">
              {currentMeta.label}
            </Chip>
            <Chip tone={sheet.estado === "COMPLETA" ? "ok" : "warn"} className="text-xs font-bold py-1 px-3">
              {sheet.estado === "COMPLETA" ? "✓ Ficha Completa" : "⚠️ Ficha en Borrador"}
            </Chip>
            {isReadOnly && (
              <span className="rounded-md bg-panel px-2 py-1 text-[11px] font-semibold text-muted">
                Solo lectura (Gerencia)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={16} weight="bold" />}
              onClick={() => window.print()}
            >
              Imprimir Ficha
            </Button>
            {!isReadOnly && (
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                icon={<FloppyDisk size={16} weight="bold" />}
                onClick={handleSaveSpecs}
              >
                Guardar Ficha
              </Button>
            )}
          </div>
        </div>

        {/* 1. Selector de Modalidad (Fase 3): STOCK_BORDADO vs CONFECCION_ROLLO */}
        <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4 print:border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">
                Modalidad de Manufactura
              </p>
              <p className="text-xs text-muted mt-0.5">
                Diferenciación operativa: prendas base en blanco vs confección completa personalizada.
              </p>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => handleModalityChange("STOCK_BORDADO")}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                  isStockBordado(sheet.modality)
                    ? "bg-brand-blue text-white shadow-sm"
                    : "bg-panel text-muted hover:text-ink hover:bg-card",
                  isReadOnly && "opacity-50 cursor-not-allowed"
                )}
              >
                <TShirt size={15} weight="bold" />
                Prenda en Stock + Bordado
              </button>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => handleModalityChange("CONFECCION_ROLLO")}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                  isRollo
                    ? "bg-brand-blue text-white shadow-sm"
                    : "bg-panel text-muted hover:text-ink hover:bg-card",
                  isReadOnly && "opacity-50 cursor-not-allowed"
                )}
              >
                <Scissors size={15} weight="bold" />
                Confección desde Rollo
              </button>
            </div>
          </div>

          {/* Panel según modalidad */}
          {isStockBordado(sheet.modality) ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-soft bg-card p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-info-tint text-info">
                  <TShirt size={20} weight="bold" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink">
                    Prenda Base: {linkedItem?.nombre ?? "Polo Base en Blanco / Stock"}
                  </p>
                  <p className="text-[11px] text-muted">
                    Vía rápida: pasa directo a bordado/sublimado sin cálculo de rollos de tela.
                    Stock en planta: <strong className="text-ink">{linkedItem?.stockActual ?? 0} uds</strong> (se requieren {sheet.totalUnidades} uds).
                  </p>
                </div>
              </div>

              <div>
                {sheet.stockDescontado ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ok-tint px-2.5 py-1 text-xs font-bold text-ok">
                    <CheckCircle size={15} weight="fill" />
                    Stock reservado ({sheet.unidadesDescontadas} uds)
                  </span>
                ) : (
                  <Button
                    size="sm"
                    disabled={isReadOnly}
                    icon={<Package size={15} weight="bold" />}
                    onClick={handleDeductStock}
                  >
                    Descontar Stock ({sheet.totalUnidades} uds)
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line-soft bg-card p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2.5">
                <div className="flex items-center gap-2">
                  <Scissors size={16} className="text-info" />
                  <span className="text-xs font-bold text-ink">Estimador Automático Reactivo de Tela:</span>
                  <span className="rounded-md bg-info-tint px-2 py-0.5 text-xs font-extrabold text-info">
                    {estimatedKg} Kg de tela ({sheet.tela})
                  </span>
                </div>
                <span className="text-[11px] text-muted">
                  Cálculo automático: {sheet.totalUnidades} prendas × 0.28 kg/prenda
                </span>
              </div>

              {/* Selector de Semáforo de Telas (Fase 3) */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-ink">Semáforo de Disponibilidad de Tela:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleSemaforoChange("HABITUAL_VERDE")}
                    className={cx(
                      "flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all",
                      sheet.semaforoTela === "HABITUAL_VERDE"
                        ? "border-ok bg-ok-tint text-ok ring-2 ring-ok/20 font-bold"
                        : "border-line bg-panel text-muted hover:text-ink",
                      isReadOnly && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-base">🟢</span>
                    <div>
                      <span className="block font-bold">Verde Habitual</span>
                      <span className="block text-[10px] text-muted">Alta rotación en stock (Pasa directo)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleSemaforoChange("POR_CONFIRMAR_AMARILLO")}
                    className={cx(
                      "flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all",
                      sheet.semaforoTela === "POR_CONFIRMAR_AMARILLO"
                        ? "border-warn bg-warn-tint text-warn ring-2 ring-warn/20 font-bold"
                        : "border-line bg-panel text-muted hover:text-ink",
                      isReadOnly && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-base">🟡</span>
                    <div>
                      <span className="block font-bold">Por Confirmar</span>
                      <span className="block text-[10px] text-muted">Valida el Jefe de Taller en panel</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleSemaforoChange("ESPECIAL_ROJO")}
                    className={cx(
                      "flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all",
                      sheet.semaforoTela === "ESPECIAL_ROJO"
                        ? "border-bad bg-bad-tint text-bad ring-2 ring-bad/20 font-bold"
                        : "border-line bg-panel text-muted hover:text-ink",
                      isReadOnly && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-base">🔴</span>
                    <div>
                      <span className="block font-bold">Rojo Especial</span>
                      <span className="block text-[10px] text-muted">Pedido especial a proveedor (+días)</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Tarjeta de Validación de Tela para el Jefe de Taller (Fase 3 - Elimina cuello de botella del dueño) */}
              {sheet.semaforoTela !== "HABITUAL_VERDE" && (
                <div className="rounded-lg border border-warn/40 bg-warn-tint/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Clock size={15} className="text-warn" />
                        Compuerta Técnica: Validación de Tela en Almacén
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {sheet.validacionTela === "CONFIRMADA_TALLER" ? (
                          <span className="text-ok font-semibold">
                            ✓ Disponibilidad confirmada en almacén {sheet.telaValidadaPor ? `por ${sheet.telaValidadaPor}` : ""} el {sheet.telaValidadaAt ? formatDateTime(sheet.telaValidadaAt) : "hoy"}.
                          </span>
                        ) : sheet.validacionTela === "COMPRA_REQUERIDA" ? (
                          <span className="text-warn font-semibold">
                            ⚠️ Solicitud de tela enviada a Compras (+3 días sobre plazo de entrega).
                          </span>
                        ) : (
                          "Pendiente de visto bueno físico en taller para autorizar corte."
                        )}
                      </p>
                    </div>

                    {/* Botones rápidos para Jefe de Taller */}
                    {isJefeTaller && !isReadOnly && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleValidateFabric("CONFIRMADA_TALLER")}
                          className="rounded-lg bg-ok px-3 py-1.5 text-xs font-bold text-inverse shadow-xs transition-all hover:bg-ok/90"
                        >
                          [Hay tela en almacén]
                        </button>
                        <button
                          type="button"
                          onClick={() => handleValidateFabric("COMPRA_REQUERIDA")}
                          className="rounded-lg border border-warn bg-card px-3 py-1.5 text-xs font-bold text-warn shadow-xs transition-all hover:bg-warn-tint"
                        >
                          [Pedir tela (+días)]
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Enrutamiento a Estaciones de Manufactura */}
        <div className="rounded-xl border border-line bg-card p-4 print:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Transferir Orden a Estación Operativa
            </p>
            {!canMoveStation && (
              <span className="text-[11px] text-muted">
                Solo el Jefe de Taller o Administración pueden avanzar estaciones
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(              [                { id: "corte", label: "Corte", icon: <Scissors size={16} weight="bold" /> },                { id: "sublimacion", label: "Sublimación", icon: <PaintBrush size={16} weight="bold" /> },                { id: "bordado", label: "Bordado", icon: <Needle size={16} weight="bold" /> },                { id: "confeccion", label: "Confección", icon: <Factory size={16} weight="bold" /> },                { id: "control_calidad", label: "Calidad", icon: <ShieldCheck size={16} weight="bold" /> },                { id: "listo_despacho", label: "Despacho", icon: <Truck size={16} weight="bold" /> },              ] as const            ).map((st) => {              const isActive = sheet.currentStation === st.id;              return (                <button                  key={st.id}                  type="button"                  disabled={!canMoveStation}                  onClick={() => handleStationChange(st.id)}                  className={cx(                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all",                    isActive                      ? "border-brand-blue bg-brand-blue text-white shadow-sm ring-2 ring-brand-blue/30"                      : "border-line bg-panel hover:bg-card hover:border-brand-blue/50 text-muted hover:text-ink",                    !canMoveStation && "cursor-not-allowed opacity-50 hover:bg-panel hover:text-muted"                  )}                >                  {st.icon}                  <span className="text-xs font-bold">{st.label}</span>                </button>              );            })}          </div>
        </div>

        {/* 3. Cuadro de Curva de Tallas y Cantidades */}
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

        {/* 4. Ficha de Especificaciones de Tejido y Corte */}
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

        {/* 5. Instrucciones de Confección & Control de Calidad */}
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

        {/* 6. Historial de Estaciones */}
        {sheet.stationHistory.length > 0 && (
          <div className="rounded-xl border border-line-soft bg-panel/40 p-4 print:hidden">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Trazabilidad en Línea de Planta
            </h4>
            <ul className="space-y-1.5 text-xs">
              {sheet.stationHistory.map((h, i) => (
                <li key={i} className="flex items-center justify-between text-muted">
                  <span>
                    <strong className="text-ink">
                      {STATION_METADATA[h.station]?.shortLabel ?? h.station}
                    </strong>: {h.note}
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
