/**
 * FichaTecnicaPrint.tsx
 * Versión: 1.0 | Fecha: 2026-10-19 | Autora: Isabelita
 *
 * Vista de impresión dedicada para la Ficha Técnica de Producción Textil.
 * Diseñada para ajustarse a una hoja A4 completa sin cabeceras web,
 * menús de navegación ni elementos ajenos a la orden de manufactura.
 */

import { useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Printer, Scissors, TShirt } from "../components/ui/icons";
import {
  getOrCreateTechSheet,
  loadProductionSheets,
  type ProductionTechSheet,
  calculateEstimatedFabricKg,
} from "../lib/tallerManufacturing";
import { formatDate } from "../lib/format";

export function FichaTecnicaPrint() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("auto") === "1" || searchParams.get("print") === "true";

  // Buscar ficha por referencia en hojas guardadas o generar ficha mock
  const sheet: ProductionTechSheet = useMemo(() => {
    const sheets = loadProductionSheets();
    const existing = Object.values(sheets).find((s) => s.orderRef.toLowerCase() === (ref ?? "").toLowerCase());
    if (existing) return existing;

    // Fallback reactivo con estructura de producción
    return getOrCreateTechSheet({
      id: ref ?? "PED-TEMP",
      ref: ref ?? "PED-MOCK",
      customer: "Cliente Confecciones Corpotex",
      brand: "corpotex",
      description: "Confección y personalización textil de planta",
      items: [
        { descripcion: "Polo Piqué Algodón 24/1 Blanco con Bordado", cantidad: 45, detalle: "Bordado pecho", precioUnitCents: 2500 },
        { descripcion: "Camiseta Dry-Fit Deportiva Sublimada", cantidad: 30, detalle: "Sublimación full", precioUnitCents: 2200 },
      ],
      issuedOn: new Date().toISOString(),
      inicioProduccion: new Date().toISOString(),
      entregaSolicitada: new Date(Date.now() + 10 * 86400000).toISOString(),
      plazoDias: 15,
      despacho: null,
      modality: "propia",
      anticipoPendienteCents: 0,
    });
  }, [ref]);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const totalPrendas = sheet.curvaTallas.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0) || sheet.totalUnidades;
  const consumoTotalKg = calculateEstimatedFabricKg(sheet.curvaTallas);

  return (
    <div className="min-h-screen bg-app p-4 sm:p-8 print:min-h-0 print:p-0 print:bg-white text-ink">
      {/* Botonera de control (oculta al imprimir) */}
      <div className="mx-auto mb-6 flex max-w-[210mm] items-center justify-between gap-4 rounded-xl border border-line bg-card p-4 shadow-xs print:hidden">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3.5 py-2 text-xs font-bold text-muted hover:bg-card hover:text-ink transition-all"
        >
          <ArrowLeft size={16} />
          Volver al Pedido
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            Formato: <strong>A4 Vertical (1 Hoja)</strong> · Vista limpia para planta
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-navy transition-all"
          >
            <Printer size={16} weight="bold" />
            Imprimir Ficha A4
          </button>
        </div>
      </div>

      {/* Contenedor A4 oficial para impresión textil */}
      <article
        id="ficha-tecnica-a4-sheet"
        className="mx-auto w-full max-w-[210mm] rounded-xl border border-line bg-white p-8 shadow-md print:max-w-none print:border-none print:p-0 print:shadow-none print:w-full print:h-auto"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {/* Cabecera Corporativa de Producción */}
        <header className="flex items-start justify-between border-b-2 border-brand-navy pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand-navy text-white font-extrabold text-xl tracking-tight">
              CT
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-brand-navy uppercase">
                Corpotex · Ficha Técnica de Planta
              </h1>
              <p className="text-[11px] font-semibold text-muted">
                Documento de Manufactura Textil y Control Operativo de Calidad
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block rounded-md bg-brand-blue/10 px-2.5 py-1 text-xs font-extrabold text-brand-blue">
              PEDIDO #{sheet.orderRef}
            </span>
            <p className="mt-1 text-[10px] text-muted">
              Emisión: <strong className="text-ink">{formatDate(new Date().toISOString())}</strong>
            </p>
          </div>
        </header>

        {/* 1. Metadatos de la Orden y Condiciones de Entrega */}
        <section className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-line-soft bg-panel/40 p-3 text-xs">
          <div>
            <span className="block text-[10px] font-bold uppercase text-muted">Cliente:</span>
            <span className="font-extrabold text-ink truncate block">{sheet.customer}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-muted">Fecha de Entrega:</span>
            <span className="font-extrabold text-ink block">
              {sheet.stationUpdatedOn ? formatDate(sheet.stationUpdatedOn) : "Programada"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-muted">Modalidad de Planta:</span>
            <span className="font-bold text-brand-blue block">
              {sheet.modality === "CONFECCION_ROLLO" || sheet.modality === "confeccion_completa"
                ? "Confección desde Rollo"
                : "Prenda en Stock + Bordado"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-muted">Estado de Ficha:</span>
            <span className="font-bold text-ok block">
              {sheet.estado === "COMPLETA" ? "✓ Ficha Completa (Validada)" : "Borrador Operativo"}
            </span>
          </div>
        </section>

        {/* 2. Especificación Técnica de Telas y Consumo */}
        <section className="mt-4 rounded-lg border border-line-soft p-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-navy flex items-center gap-1.5 border-b border-line-soft pb-1.5">
            <Scissors size={14} className="text-brand-blue" />
            1. Especificaciones de Materia Prima e Insumos
          </h2>

          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted block text-[10px]">Tipo de Tela:</span>
              <strong className="text-ink">{sheet.tela}</strong>
            </div>
            <div>
              <span className="text-muted block text-[10px]">Gramaje / Densidad:</span>
              <strong className="text-ink">{sheet.gramaje}</strong>
            </div>
            <div>
              <span className="text-muted block text-[10px]">Color Principal:</span>
              <strong className="text-ink">{sheet.colorPrincipal}</strong>
            </div>
            <div>
              <span className="text-muted block text-[10px]">Cuello / Rib:</span>
              <strong className="text-ink">{sheet.tipoCuello}</strong>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded bg-panel px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted uppercase">Validación de Tela:</span>
              <span className="font-bold text-ok">
                {sheet.validacionTela === "CONFIRMADA_TALLER"
                  ? "✓ Confirmada en Almacén por Jefe de Taller"
                  : sheet.validacionTela === "COMPRA_REQUERIDA"
                  ? "⚠ Compra requerida a proveedor"
                  : "No Aplica (Prenda Base Stock)"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted uppercase">Consumo Estimado: </span>
              <strong className="text-brand-navy font-black text-sm">
                {consumoTotalKg.toFixed(2)} kg de tela
              </strong>
              <span className="text-[10px] text-muted ml-1">
                ({totalPrendas} prendas × 0.28 kg/prenda)
              </span>
            </div>
          </div>
        </section>

        {/* 3. Cuadro de Curva de Tallas por Ítem (Defecto 3: Prenda, Color, Tela, Tallas x Cantidad y Totales) */}
        <section className="mt-4 rounded-lg border border-line-soft p-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-navy flex items-center gap-1.5 border-b border-line-soft pb-1.5">
            <TShirt size={14} className="text-brand-blue" />
            2. Ítems de la Orden y Curva de Tallas a Confeccionar
          </h2>

          <div className="mt-2.5 overflow-hidden rounded border border-line-soft">
            <table className="w-full text-xs text-left">
              <thead className="bg-panel font-bold text-muted text-[11px] uppercase border-b border-line-soft">
                <tr>
                  <th className="py-1.5 px-2">Prenda / Ítem</th>
                  <th className="py-1.5 px-2">Color</th>
                  <th className="py-1.5 px-2">Tela</th>
                  <th className="py-1.5 px-1 text-center">XS</th>
                  <th className="py-1.5 px-1 text-center">S</th>
                  <th className="py-1.5 px-1 text-center">M</th>
                  <th className="py-1.5 px-1 text-center">L</th>
                  <th className="py-1.5 px-1 text-center">XL</th>
                  <th className="py-1.5 px-1 text-center">XXL</th>
                  <th className="py-1.5 px-2 text-right">Total Ítem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                <tr className="hover:bg-panel/20">
                  <td className="py-2 px-2 font-bold text-ink">{sheet.prendaTipo}</td>
                  <td className="py-2 px-2 text-muted">{sheet.colorPrincipal}</td>
                  <td className="py-2 px-2 text-muted">{sheet.tela.split(" ")[0]}</td>
                  {["XS", "S", "M", "L", "XL", "XXL"].map((sz) => {
                    const row = sheet.curvaTallas.find((c) => c.talla === sz);
                    return (
                      <td key={sz} className="py-2 px-1 text-center tabular font-semibold text-ink">
                        {row ? `${row.cantidad}` : "-"}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-right font-extrabold tabular text-brand-blue">
                    {totalPrendas} prendas
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-panel/70 border-t border-line font-bold text-xs">
                <tr>
                  <td colSpan={9} className="py-2 px-3 text-right uppercase text-muted">
                    Total General de Producción:
                  </td>
                  <td className="py-2 px-2 text-right font-black tabular text-ink text-sm">
                    {totalPrendas} prendas
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* 4. Personalización, Arte & Estampado */}
        <section className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-line-soft p-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-navy border-b border-line-soft pb-1">
              3. Arte y Personalización
            </h3>
            <p className="mt-1.5 font-bold text-brand-blue">
              Técnica: {sheet.tecnicaPersonalizacion}
            </p>
            <ul className="mt-2 space-y-1 text-muted">
              {sheet.arteUbicaciones.map((arte, i) => (
                <li key={i} className="flex justify-between border-b border-line-soft/50 pb-1">
                  <span className="font-medium text-ink">{arte.ubicacion}</span>
                  <span className="font-semibold text-muted">({arte.medidas})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted truncate">
              Arte: <strong className="text-ink">{sheet.archivoArte}</strong>
            </p>
          </div>

          <div className="rounded-lg border border-line-soft p-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-navy border-b border-line-soft pb-1">
              4. Observaciones de Confección & AQL
            </h3>
            <ul className="mt-1.5 space-y-1 text-[11px] text-muted">
              {sheet.instruccionesCostura.slice(0, 4).map((inst, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-brand-blue font-bold">✓</span>
                  <span>{inst}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. Espacio para Firmas Operativas de Responsabilidad */}
        <section className="mt-8 border-t border-line-soft pt-6">
          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            <div className="flex flex-col items-center">
              <div className="w-48 border-b-2 border-dashed border-ink/40 mb-1.5 h-10"></div>
              <p className="font-extrabold text-ink uppercase text-[11px]">Vendedora Responsable</p>
              <p className="text-[10px] text-muted">Firma y Sello Comercial</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-48 border-b-2 border-dashed border-ink/40 mb-1.5 h-10"></div>
              <p className="font-extrabold text-ink uppercase text-[11px]">Jefe de Taller / Calidad</p>
              <p className="text-[10px] text-muted">Visto Bueno de Planta y Despacho</p>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}

export default FichaTecnicaPrint;
