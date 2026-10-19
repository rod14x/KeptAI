/**
 * TallerInventoryView.tsx
 * Versión: 1.1 | Fecha: 2026-10-19 | Autora: Isabelita
 *
 * Vista de Inventario y Existencias de Planta Textil:
 * - Defecto 1: Alta de producto con variantes obligatorias de talla.
 * - Defecto 1: Ingreso de stock mediante matriz talla x cantidad (elimina el botón fijo de +50).
 * - Defecto 1: Registro estricto de movimientos (kárdex auditado por usuario).
 * - Permisos: Administracion y Jefe de taller crean y ajustan; Vendedor y Gerencia en solo lectura.
 */

import { useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  Plus,
  Scissors,
  TShirt,
  WarningCircle,
  Receipt,
} from "../ui/icons";
import { Card } from "../ui/States";
import { Chip } from "../ui/Chip";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { cx, formatDateTime } from "../../lib/format";
import {
  loadWorkshopInventory,
  loadWorkshopMovements,
  recordStockMatrixMovement,
  createNewProductWithVariants,
  type InventoryItem,
  type InventoryMovement,
} from "../../lib/tallerManufacturing";
import { useToast } from "../../context/ToastContext";
import { useMe } from "../../context/AuthContext";

export function TallerInventoryView() {
  const me = useMe();
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>(() => loadWorkshopInventory());
  const [movements, setMovements] = useState<InventoryMovement[]>(() => loadWorkshopMovements());
  const [filter, setFilter] = useState<"todos" | "prenda_base" | "tela_rollo" | "avio">("todos");
  const [showMovementsModal, setShowMovementsModal] = useState(false);

  // Permisos: solo administración y taller pueden mutar inventario
  const canManageStock = me.role === "administracion" || me.role === "jefe_taller";

  // Estados de modales
  const [matrixModalItem, setMatrixModalItem] = useState<InventoryItem | null>(null);
  const [matrixValues, setMatrixValues] = useState<Record<string, number>>({});
  const [matrixType, setMatrixType] = useState<"ENTRADA" | "AJUSTE">("ENTRADA");
  const [matrixReason, setMatrixReason] = useState("");

  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [newProdCode, setNewProdCode] = useState("");
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrenda, setNewProdPrenda] = useState("Polo");
  const [newProdTela, setNewProdTela] = useState("Piqué Algodón 24/1");
  const [newProdColor, setNewProdColor] = useState("Blanco");
  const newProdSizes = ["S", "M", "L", "XL"];
  const [newProdInitialStock, setNewProdInitialStock] = useState<Record<string, number>>({
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
  });

  const filteredItems = items.filter((it) => (filter === "todos" ? true : it.tipo === filter));

  const totalPrendasBase = items
    .filter((it) => it.tipo === "prenda_base")
    .reduce((s, it) => s + it.stockActual, 0);

  const totalTelaKg = items
    .filter((it) => it.tipo === "tela_rollo")
    .reduce((s, it) => s + it.stockActual, 0);

  const criticalCount = items.filter((it) => it.stockActual <= it.stockMinimo).length;

  // Abrir modal de matriz talla x cantidad
  const handleOpenMatrix = (item: InventoryItem) => {
    if (!canManageStock) return;
    setMatrixModalItem(item);
    const initialValues: Record<string, number> = {};
    if (item.detalleTallas) {
      Object.keys(item.detalleTallas).forEach((sz) => {
        initialValues[sz] = 0;
      });
    } else {
      initialValues["Única"] = 0;
    }
    setMatrixValues(initialValues);
    setMatrixType("ENTRADA");
    setMatrixReason("Recepción de lote de confección en planta");
  };

  // Guardar matriz de movimiento (Defecto 1)
  const handleSaveMatrix = () => {
    if (!matrixModalItem || !canManageStock) return;
    const res = recordStockMatrixMovement({
      itemId: matrixModalItem.id,
      tipo: matrixType,
      motivo: matrixReason,
      matriz: matrixValues,
      usuario: me.name || me.email || me.role,
    });

    toast(res.ok, res.message);
    if (res.ok) {
      setItems(res.updatedItems);
      setMovements(loadWorkshopMovements());
      setMatrixModalItem(null);
    }
  };

  // Crear nuevo producto con variantes (Defecto 1)
  const handleCreateProduct = () => {
    if (!canManageStock) return;
    if (!newProdCode || !newProdName) {
      toast(false, "El código y nombre del producto son obligatorios.");
      return;
    }
    if (newProdSizes.length === 0) {
      toast(false, "Cada producto debe tener al menos una talla obligatoria.");
      return;
    }

    const res = createNewProductWithVariants({
      codigo: newProdCode,
      nombre: newProdName,
      tipo: "prenda_base",
      categoria: "Corporativo",
      unidad: "uds",
      prenda: newProdPrenda,
      tela: newProdTela,
      color: newProdColor,
      tallas: newProdSizes,
      stockInicial: newProdInitialStock,
      stockMinimo: 30,
      usuario: me.name || me.email || me.role,
    });

    toast(res.ok, res.message);
    if (res.ok) {
      setItems(res.updatedItems);
      setMovements(loadWorkshopMovements());
      setCreateProductOpen(false);
      setNewProdCode("");
      setNewProdName("");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Tarjetas de Resumen de Inventario de Planta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
              <TShirt size={22} weight="bold" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted">Prendas Base en Blanco (Stock)</p>
              <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">{totalPrendasBase} prendas</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Listas para personalización inmediata por sublimación o bordado.
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-info-tint text-info">
              <Scissors size={22} weight="bold" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted">Rollos de Tela en Planta</p>
              <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">{totalTelaKg.toFixed(1)} kg</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Materia prima para órdenes de confección completa (desde rollo).
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className={cx(
                "flex size-10 items-center justify-center rounded-xl",
                criticalCount > 0 ? "bg-warn-tint text-warn" : "bg-ok-tint text-ok"
              )}
            >
              {criticalCount > 0 ? <WarningCircle size={22} weight="bold" /> : <CheckCircle size={22} weight="bold" />}
            </span>
            <div>
              <p className="text-xs font-semibold text-muted">Salud de Inventario</p>
              <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">
                {criticalCount > 0 ? `${criticalCount} ítems bajos` : "Stock Óptimo"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            {criticalCount > 0 ? "Algunos insumos requieren reposición" : "Todo el almacén sobre el stock mínimo"}
          </p>
        </Card>
      </div>

      {/* Tabla de Existencias de Taller */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-section font-bold">Catálogo de Almacén e Inventario de Variantes</h3>
              {!canManageStock && (
                <span className="rounded-md bg-panel px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                  Solo Lectura ({me.role === "vendedor" ? "Ventas" : "Gerencia"})
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Existencias por talla obligatoria y movimientos auditados de prendas base y rollos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Receipt size={15} />}
              onClick={() => setShowMovementsModal(true)}
            >
              Ver Kárdex ({movements.length})
            </Button>

            {canManageStock && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={15} weight="bold" />}
                onClick={() => setCreateProductOpen(true)}
              >
                + Nuevo Producto
              </Button>
            )}
          </div>
        </div>

        {/* Filtros de Tipo */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "todos", label: "Todos" },
                { id: "prenda_base", label: "Prendas en Blanco" },
                { id: "tela_rollo", label: "Rollos de Tela" },
                { id: "avio", label: "Avíos & Hilos" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                  filter === f.id
                    ? "bg-brand-blue text-white shadow-sm"
                    : "bg-panel text-muted hover:text-ink"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-muted">
            Mostrando <strong>{filteredItems.length}</strong> productos
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[750px] text-xs">
            <thead>
              <tr className="border-b border-line-soft text-left text-muted font-semibold">
                <th className="py-2.5">Código & Descripción</th>
                <th className="py-2.5">Tipo</th>
                <th className="py-2.5">Existencias por Talla (Variantes)</th>
                <th className="py-2.5 text-right">Stock Total</th>
                {canManageStock && <th className="py-2.5 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filteredItems.map((it) => {
                const isLow = it.stockActual <= it.stockMinimo;
                return (
                  <tr key={it.id} className="hover:bg-panel/40">
                    <td className="py-3">
                      <p className="font-bold text-ink">{it.nombre}</p>
                      <p className="tabular text-[11px] text-muted">
                        Código: <span className="font-semibold text-ink">{it.codigo}</span> · Línea {it.categoria}
                      </p>
                    </td>

                    <td className="py-3">
                      <Chip
                        tone={it.tipo === "prenda_base" ? "violet" : it.tipo === "tela_rollo" ? "info" : "neutral"}
                        className="text-[11px]"
                      >
                        {it.tipo === "prenda_base"
                          ? "Prenda Base"
                          : it.tipo === "tela_rollo"
                          ? "Rollo de Tela"
                          : "Avío / Hilo"}
                      </Chip>
                    </td>

                    <td className="py-3">
                      {it.detalleTallas ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {Object.entries(it.detalleTallas).map(([t, q]) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 rounded bg-panel px-2 py-1 text-[11px] font-semibold text-ink border border-line-soft"
                            >
                              <strong className="text-muted">{t}:</strong> {q} {it.unidad}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">Lote por peso continuo ({it.unidad})</span>
                      )}
                    </td>

                    <td className="py-3 text-right">
                      <p className={cx("tabular text-sm font-extrabold", isLow ? "text-warn" : "text-ink")}>
                        {it.stockActual} {it.unidad}
                      </p>
                      <p className="text-[10px] text-muted">Mínimo: {it.stockMinimo} {it.unidad}</p>
                    </td>

                    {canManageStock && (
                      <td className="py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenMatrix(it)}
                          icon={<ArrowClockwise size={13} weight="bold" />}
                          title="Ingresar stock por matriz de tallas"
                        >
                          Matriz Tallas
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Ingreso de Stock mediante Matriz Talla x Cantidad (Defecto 1) */}
      {matrixModalItem && (
        <Modal
          open={!!matrixModalItem}
          onClose={() => setMatrixModalItem(null)}
          title={`Movimiento de Stock: ${matrixModalItem.codigo}`}
          subtitle={`${matrixModalItem.nombre} · Ingrese cantidades por cada talla`}
        >
          <div className="flex flex-col gap-4 max-w-lg w-full">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Tipo de Movimiento</label>
                <select
                  value={matrixType}
                  onChange={(e) => setMatrixType(e.target.value as any)}
                  className="w-full rounded-lg border border-line bg-card p-2 text-xs font-semibold text-ink"
                >
                  <option value="ENTRADA">ENTRADA (Añadir a existencias)</option>
                  <option value="AJUSTE">AJUSTE (Fijar conteo físico)</option>
                  <option value="SALIDA">SALIDA (Merma o retiro)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">Motivo</label>
                <input
                  type="text"
                  value={matrixReason}
                  onChange={(e) => setMatrixReason(e.target.value)}
                  placeholder="Ej: Recepción confección / Inventario"
                  className="w-full rounded-lg border border-line bg-card p-2 text-xs text-ink"
                />
              </div>
            </div>

            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink mb-3">
                Matriz Talla × Cantidad a Ingresar ({matrixModalItem.unidad})
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.keys(matrixModalItem.detalleTallas ?? { Única: 0 }).map((sz) => (
                  <div key={sz} className="flex flex-col gap-1">
                    <span className="text-[11px] font-extrabold text-muted">
                      Talla {sz} (actual: {matrixModalItem.detalleTallas?.[sz] ?? 0})
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={matrixValues[sz] ?? 0}
                      onChange={(e) =>
                        setMatrixValues({
                          ...matrixValues,
                          [sz]: parseInt(e.target.value || "0", 10),
                        })
                      }
                      className="rounded-lg border border-line bg-card p-2 text-center text-sm font-extrabold text-ink tabular"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-between items-center text-xs text-muted border-t border-line-soft pt-2">
                <span>Total a registrar en movimiento:</span>
                <strong className="text-brand-blue font-extrabold text-sm tabular">
                  {Object.values(matrixValues).reduce((s, v) => s + (Number(v) || 0), 0)} {matrixModalItem.unidad}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={() => setMatrixModalItem(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSaveMatrix}>
                Confirmar Movimiento
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Alta de Nuevo Producto con Variantes (Defecto 1) */}
      {createProductOpen && (
        <Modal
          open={createProductOpen}
          onClose={() => setCreateProductOpen(false)}
          title="Alta de Producto Textil con Variantes"
          subtitle="Catálogo maestro: cada variante exige una talla obligatoria"
        >
          <div className="flex flex-col gap-4 max-w-lg w-full">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Código Único *</label>
                <input
                  type="text"
                  value={newProdCode}
                  onChange={(e) => setNewProdCode(e.target.value.toUpperCase())}
                  placeholder="Ej: PB-POL-BLU"
                  className="w-full rounded-lg border border-line bg-card p-2 text-xs font-bold text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Ej: Polo Piqué Manga Corta Azul"
                  className="w-full rounded-lg border border-line bg-card p-2 text-xs text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Prenda</label>
                <input
                  type="text"
                  value={newProdPrenda}
                  onChange={(e) => setNewProdPrenda(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card p-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">Tela Base</label>
                <input
                  type="text"
                  value={newProdTela}
                  onChange={(e) => setNewProdTela(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card p-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">Color</label>
                <input
                  type="text"
                  value={newProdColor}
                  onChange={(e) => setNewProdColor(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card p-2 text-xs text-ink"
                />
              </div>
            </div>

            {/* Selector de Tallas Obligatorias */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-ink block mb-2">
                Tallas Obligatorias y Stock Inicial (S-XL)
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["S", "M", "L", "XL"].map((sz) => (
                  <div key={sz} className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-muted">Talla {sz}</span>
                    <input
                      type="number"
                      min="0"
                      value={newProdInitialStock[sz] ?? 0}
                      onChange={(e) =>
                        setNewProdInitialStock({
                          ...newProdInitialStock,
                          [sz]: parseInt(e.target.value || "0", 10),
                        })
                      }
                      className="rounded-lg border border-line bg-card p-2 text-center text-sm font-extrabold text-ink tabular"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={() => setCreateProductOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCreateProduct}>
                Guardar Producto
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Bitácora de Movimientos Kárdex (Defecto 1) */}
      {showMovementsModal && (
        <Modal
          open={showMovementsModal}
          onClose={() => setShowMovementsModal(false)}
          title="Kárdex de Movimientos de Inventario"
          subtitle="Trazabilidad inmutable de entradas, salidas y ajustes por talla y usuario"
        >
          <div className="flex flex-col gap-4 max-w-2xl w-full max-h-[70vh] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-panel font-bold text-muted border-b border-line-soft">
                  <tr>
                    <th className="py-2 px-2.5">Fecha</th>
                    <th className="py-2 px-2.5">Producto</th>
                    <th className="py-2 px-2 text-center">Talla</th>
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2 text-right">Cantidad</th>
                    <th className="py-2 px-2.5">Usuario & Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-panel/20">
                      <td className="py-2.5 px-2.5 tabular text-muted whitespace-nowrap">
                        {formatDateTime(m.fecha)}
                      </td>
                      <td className="py-2.5 px-2.5 font-bold text-ink">
                        {m.codigoItem}
                      </td>
                      <td className="py-2.5 px-2 text-center font-extrabold text-brand-blue">
                        {m.talla}
                      </td>
                      <td className="py-2.5 px-2">
                        <Chip tone={m.tipo === "ENTRADA" ? "ok" : m.tipo === "AJUSTE" ? "warn" : "bad"} className="text-[10px]">
                          {m.tipo}
                        </Chip>
                      </td>
                      <td className="py-2.5 px-2 text-right font-black tabular text-ink">
                        {m.cantidad} uds
                      </td>
                      <td className="py-2.5 px-2.5 text-[11px] text-muted">
                        <span className="font-semibold text-ink block">{m.usuario}</span>
                        <span className="truncate block max-w-xs">{m.motivo}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-line pt-3">
              <Button variant="secondary" onClick={() => setShowMovementsModal(false)}>
                Cerrar Kárdex
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TallerInventoryView;
