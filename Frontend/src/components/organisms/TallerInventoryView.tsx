import { useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  Scissors,
  TShirt,
  WarningCircle,
} from "../ui/icons";
import { Card } from "../ui/States";
import { Chip } from "../ui/Chip";
import { Button } from "../ui/Button";
import { cx } from "../../lib/format";
import {
  loadWorkshopInventory,
  saveWorkshopInventory,
  type InventoryItem,
} from "../../lib/tallerManufacturing";
import { useToast } from "../../context/ToastContext";

export function TallerInventoryView() {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>(() => loadWorkshopInventory());
  const [filter, setFilter] = useState<"todos" | "prenda_base" | "tela_rollo" | "avio">("todos");

  const filteredItems = items.filter((it) => (filter === "todos" ? true : it.tipo === filter));

  const totalPrendasBase = items
    .filter((it) => it.tipo === "prenda_base")
    .reduce((s, it) => s + it.stockActual, 0);

  const totalTelaKg = items
    .filter((it) => it.tipo === "tela_rollo")
    .reduce((s, it) => s + it.stockActual, 0);

  const criticalCount = items.filter((it) => it.stockActual <= it.stockMinimo).length;

  const handleRestock = (item: InventoryItem) => {
    const qty = item.tipo === "tela_rollo" ? 25 : 50;
    const next = items.map((it) => (it.id === item.id ? { ...it, stockActual: it.stockActual + qty } : it));
    setItems(next);
    saveWorkshopInventory(next);
    toast(true, `Ingreso de lote registrado: +${qty} ${item.unidad} en "${item.nombre}"`);
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
              <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">{totalPrendasBase} uds</p>
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
              <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">{totalTelaKg.toFixed(1)} Kg</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Materia prima para órdenes de confección completa (desde cero).
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
            <h3 className="text-section font-bold">Catálogo de Almacén e Insumos de Manufactura</h3>
            <p className="text-xs text-muted">
              Control de existencias de prendas base en blanco (para sublimar/bordar) y rollos de tela virgen.
            </p>
          </div>

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
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead>
              <tr className="border-b border-line-soft text-left text-muted font-semibold">
                <th className="py-2.5">Código & Descripción</th>
                <th className="py-2.5">Tipo</th>
                <th className="py-2.5">Curva de Tallas / Formato</th>
                <th className="py-2.5 text-right">Stock Actual</th>
                <th className="py-2.5 text-right">Acción de Planta</th>
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
                        <div className="flex flex-wrap items-center gap-1">
                          {Object.entries(it.detalleTallas).map(([t, q]) => (
                            <span
                              key={t}
                              className="rounded bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-ink"
                            >
                              {t}: <strong>{q}</strong>
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

                    <td className="py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestock(it)}
                        icon={<ArrowClockwise size={13} weight="bold" />}
                        title="Registrar ingreso de lote al almacén"
                      >
                        + Entrada
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
