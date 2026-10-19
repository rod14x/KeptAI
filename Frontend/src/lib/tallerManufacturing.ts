/** Versión: 1.1 | Fecha: 2026-10-19 | Autora: Isabelita */
import type { TallerOrder } from "../api/dto";
import type { Person } from "../api/model";
import { endpoints } from "../api/contract/endpoints";
import { IS_MOCK } from "../config";

export type ManufacturingStation =
  | "corte"
  | "sublimacion"
  | "bordado"
  | "confeccion"
  | "control_calidad"
  | "listo_despacho";

export type ManufacturingModality =
  | "STOCK_BORDADO"
  | "CONFECCION_ROLLO"
  | "stock_personalizado"
  | "confeccion_completa";

export type SemaforoTela = "HABITUAL_VERDE" | "POR_CONFIRMAR_AMARILLO" | "ESPECIAL_ROJO";
export type ValidacionTela = "NO_APLICA" | "CONFIRMADA_TALLER" | "COMPRA_REQUERIDA";

export interface SizeBreakdown {
  talla: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "Única";
  cantidad: number;
}

export interface InventoryItem {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "prenda_base" | "tela_rollo" | "avio";
  categoria: "Deportivo" | "Corporativo" | "Insumo";
  unidad: "uds" | "kg" | "conos" | "metros";
  stockActual: number;
  stockMinimo: number;
  detalleTallas?: Record<string, number>;
}

export interface ProductionTechSheet {
  id?: string;
  orderId: string;
  orderRef: string;
  customer: string;
  estado?: "BORRADOR" | "COMPLETA";
  modality: ManufacturingModality;
  currentStation: ManufacturingStation;
  stationUpdatedOn: string;
  stationHistory: Array<{ station: ManufacturingStation; timestamp: string; note: string }>;

  // Semáforo de telas y validación de taller (Fase 3)
  semaforoTela?: SemaforoTela;
  consumoEstimadoKg?: number;
  validacionTela?: ValidacionTela;
  telaValidadaPor?: string | null;
  telaValidadaAt?: string | null;

  // Especificaciones técnicas
  prendaTipo: string;
  tela: string;
  gramaje: string;
  colorPrincipal: string;
  colorContraste?: string;
  tipoCuello: string;

  // Curva de tallas
  curvaTallas: SizeBreakdown[];
  totalUnidades: number;

  // Personalización y arte
  tecnicaPersonalizacion: string;
  arteUbicaciones: Array<{
    ubicacion: string;
    medidas: string;
    descripcion: string;
  }>;
  archivoArte: string;

  // Insumos e inventario
  itemInventarioId?: string;
  stockDescontado: boolean;
  unidadesDescontadas?: number;

  // Instrucciones de taller
  instruccionesCostura: string[];
  completadaPor?: string | null;
  completadaEn?: string | null;
  orderEstado?: string;
}

export function isStockBordado(m: ManufacturingModality): boolean {
  return m === "STOCK_BORDADO" || m === "stock_personalizado";
}

export function isConfeccionRollo(m: ManufacturingModality): boolean {
  return m === "CONFECCION_ROLLO" || m === "confeccion_completa";
}

export function calculateEstimatedFabricKg(curvaTallas: SizeBreakdown[]): number {
  const total = curvaTallas.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
  return Number((total * 0.28).toFixed(2));
}

const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: "inv-pb-01",
    codigo: "PB-DRY-WHT",
    nombre: "Camiseta Dry-Fit Poliéster Blanca (Sublimable)",
    tipo: "prenda_base",
    categoria: "Deportivo",
    unidad: "uds",
    stockActual: 245,
    stockMinimo: 50,
    detalleTallas: { S: 60, M: 85, L: 70, XL: 30 },
  },
  {
    id: "inv-pb-02",
    codigo: "PB-PIQ-WHT",
    nombre: "Polo Piqué Algodón 24/1 Blanco Base",
    tipo: "prenda_base",
    categoria: "Corporativo",
    unidad: "uds",
    stockActual: 149,
    stockMinimo: 40,
    detalleTallas: { S: 35, M: 54, L: 42, XL: 18 },
  },
  {
    id: "inv-pb-03",
    codigo: "PB-CAS-BLK",
    nombre: "Casaca Cortavientos Negra Base",
    tipo: "prenda_base",
    categoria: "Deportivo",
    unidad: "uds",
    stockActual: 75,
    stockMinimo: 20,
    detalleTallas: { S: 15, M: 28, L: 20, XL: 12 },
  },
  {
    id: "inv-pb-04",
    codigo: "PB-CHA-ORA",
    nombre: "Chaleco Drill Naranja de Seguridad Base",
    tipo: "prenda_base",
    categoria: "Corporativo",
    unidad: "uds",
    stockActual: 45,
    stockMinimo: 15,
    detalleTallas: { "Única": 45 },
  },
  {
    id: "inv-tr-01",
    codigo: "TR-WIN-MIC",
    nombre: "Rollo Tela Win Microfibra Transpirable Sublimable",
    tipo: "tela_rollo",
    categoria: "Deportivo",
    unidad: "kg",
    stockActual: 180.0,
    stockMinimo: 30.0,
  },
  {
    id: "inv-tr-02",
    codigo: "TR-PIM-501",
    nombre: "Rollo Algodón Pima 50/1 Peinado Verde Corporativo",
    tipo: "tela_rollo",
    categoria: "Corporativo",
    unidad: "kg",
    stockActual: 95.5,
    stockMinimo: 25.0,
  },
  {
    id: "inv-tr-03",
    codigo: "TR-FRA-NVY",
    nombre: "Rollo Franela Reactiva 100% Algodón Azul Noche",
    tipo: "tela_rollo",
    categoria: "Corporativo",
    unidad: "kg",
    stockActual: 120.0,
    stockMinimo: 30.0,
  },
  {
    id: "inv-av-01",
    codigo: "AV-HIL-402",
    nombre: "Conos de Hilo 40/2 Poliéster (Blanco/Negro/Azul/Verde)",
    tipo: "avio",
    categoria: "Insumo",
    unidad: "conos",
    stockActual: 38,
    stockMinimo: 10,
  },
  {
    id: "inv-av-02",
    codigo: "AV-CIN-TAP",
    nombre: "Cinta Tapacostura de Hombro a Hombro",
    tipo: "avio",
    categoria: "Insumo",
    unidad: "metros",
    stockActual: 250,
    stockMinimo: 50,
  },
];

const STORAGE_INVENTORY_KEY = "keptai_manufacturing_inventory_v1";
const STORAGE_SHEETS_KEY = "keptai_manufacturing_sheets_v1";
const STORAGE_MOVEMENTS_KEY = "keptai_manufacturing_movements_v1";

export interface InventoryMovement {
  id: string;
  itemId: string;
  codigoItem: string;
  nombreItem: string;
  fecha: string;
  usuario: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE";
  motivo: string;
  talla: string;
  cantidad: number;
}

export function loadWorkshopMovements(): InventoryMovement[] {
  try {
    const raw = localStorage.getItem(STORAGE_MOVEMENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading inventory movements", e);
  }
  return [
    {
      id: "mov-01",
      itemId: "inv-pb-01",
      codigoItem: "PB-DRY-WHT",
      nombreItem: "Camiseta Dry-Fit Poliéster Blanca (Sublimable)",
      fecha: new Date(Date.now() - 86400000).toISOString(),
      usuario: "administracion",
      tipo: "ENTRADA",
      motivo: "Recepción de confección de lote inicial",
      talla: "S",
      cantidad: 60,
    },
    {
      id: "mov-02",
      itemId: "inv-pb-01",
      codigoItem: "PB-DRY-WHT",
      nombreItem: "Camiseta Dry-Fit Poliéster Blanca (Sublimable)",
      fecha: new Date(Date.now() - 86400000).toISOString(),
      usuario: "administracion",
      tipo: "ENTRADA",
      motivo: "Recepción de confección de lote inicial",
      talla: "M",
      cantidad: 85,
    },
  ];
}

export function saveWorkshopMovements(movements: InventoryMovement[]): void {
  try {
    localStorage.setItem(STORAGE_MOVEMENTS_KEY, JSON.stringify(movements));
  } catch (e) {
    console.error("Error saving inventory movements", e);
  }
}

export function recordStockMatrixMovement(params: {
  itemId: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE";
  motivo: string;
  matriz: Record<string, number>;
  usuario: string;
}): { ok: boolean; message: string; updatedItems: InventoryItem[] } {
  const items = loadWorkshopInventory();
  const itemIndex = items.findIndex((it) => it.id === params.itemId);
  if (itemIndex === -1) {
    return { ok: false, message: "Ítem no encontrado en almacén", updatedItems: items };
  }

  const target = items[itemIndex];
  const currentDetails: Record<string, number> = { ...(target.detalleTallas ?? {}) };
  const movements = loadWorkshopMovements();
  let totalDelta = 0;

  for (const [talla, qty] of Object.entries(params.matriz)) {
    const numQty = Number(qty) || 0;
    if (numQty <= 0) continue;

    if (params.tipo === "ENTRADA") {
      currentDetails[talla] = (currentDetails[talla] ?? 0) + numQty;
      totalDelta += numQty;
    } else if (params.tipo === "SALIDA") {
      currentDetails[talla] = Math.max(0, (currentDetails[talla] ?? 0) - numQty);
      totalDelta -= numQty;
    } else if (params.tipo === "AJUSTE") {
      const prev = currentDetails[talla] ?? 0;
      currentDetails[talla] = numQty;
      totalDelta += (numQty - prev);
    }

    movements.unshift({
      id: "mov-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      itemId: target.id,
      codigoItem: target.codigo,
      nombreItem: target.nombre,
      fecha: new Date().toISOString(),
      usuario: params.usuario,
      tipo: params.tipo,
      motivo: params.motivo || "Movimiento registrado por matriz de tallas",
      talla,
      cantidad: numQty,
    });
  }

  const newStock = Object.values(currentDetails).reduce((s, q) => s + q, 0);
  items[itemIndex] = {
    ...target,
    detalleTallas: currentDetails,
    stockActual: target.tipo === "prenda_base" ? newStock : target.stockActual + totalDelta,
  };

  saveWorkshopInventory(items);
  saveWorkshopMovements(movements);

  return {
    ok: true,
    message: `Matriz registrada: ${params.tipo} en ${target.nombre} (${params.usuario})`,
    updatedItems: items,
  };
}

export function createNewProductWithVariants(params: {
  codigo: string;
  nombre: string;
  tipo: "prenda_base" | "tela_rollo" | "avio";
  categoria: "Deportivo" | "Corporativo" | "Insumo";
  unidad: "uds" | "kg" | "conos" | "metros";
  prenda: string;
  tela: string;
  color: string;
  tallas: string[];
  stockInicial: Record<string, number>;
  stockMinimo: number;
  usuario: string;
}): { ok: boolean; message: string; updatedItems: InventoryItem[] } {
  const items = loadWorkshopInventory();
  if (items.some((it) => it.codigo.toLowerCase() === params.codigo.toLowerCase())) {
    return { ok: false, message: `El código ${params.codigo} ya está registrado`, updatedItems: items };
  }

  const detalleTallas: Record<string, number> = {};
  const movements = loadWorkshopMovements();
  let totalStock = 0;

  for (const t of params.tallas) {
    const qty = Number(params.stockInicial[t]) || 0;
    detalleTallas[t] = qty;
    totalStock += qty;

    if (qty > 0) {
      movements.unshift({
        id: "mov-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        itemId: "inv-" + params.codigo.toLowerCase(),
        codigoItem: params.codigo,
        nombreItem: params.nombre,
        fecha: new Date().toISOString(),
        usuario: params.usuario,
        tipo: "ENTRADA",
        motivo: "Alta de producto y stock inicial por variante",
        talla: t,
        cantidad: qty,
      });
    }
  }

  const newItem: InventoryItem = {
    id: "inv-" + Date.now(),
    codigo: params.codigo.toUpperCase(),
    nombre: params.nombre,
    tipo: params.tipo,
    categoria: params.categoria,
    unidad: params.unidad,
    stockActual: totalStock,
    stockMinimo: params.stockMinimo,
    detalleTallas,
  };

  items.unshift(newItem);
  saveWorkshopInventory(items);
  saveWorkshopMovements(movements);

  return {
    ok: true,
    message: `Producto creado: ${newItem.codigo} con ${params.tallas.length} variantes de talla (${params.usuario})`,
    updatedItems: items,
  };
}

export function loadWorkshopInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_INVENTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading inventory", e);
  }
  return DEFAULT_INVENTORY;
}

export function saveWorkshopInventory(items: InventoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_INVENTORY_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Error saving inventory", e);
  }
}

export function loadProductionSheets(): Record<string, ProductionTechSheet> {
  try {
    const raw = localStorage.getItem(STORAGE_SHEETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading production sheets", e);
  }
  return {};
}

export function saveProductionSheets(sheets: Record<string, ProductionTechSheet>): void {
  try {
    localStorage.setItem(STORAGE_SHEETS_KEY, JSON.stringify(sheets));
  } catch (e) {
    console.error("Error saving production sheets", e);
  }
}

/** Genera una ficha técnica profesional por defecto si la orden no tiene una persistida */
export function getOrCreateTechSheet(order: TallerOrder): ProductionTechSheet {
  const sheets = loadProductionSheets();
  if (sheets[order.id]) {
    return sheets[order.id];
  }

  const isDeportivo =
    order.brand === "unicrack" ||
    order.description.toLowerCase().includes("camiset") ||
    order.description.toLowerCase().includes("casac");
  const isChaleco = order.description.toLowerCase().includes("chaleco");

  const totalQty = order.items.reduce((s, it) => s + it.cantidad, 0);

  const modality: ManufacturingModality =
    isDeportivo && !order.description.toLowerCase().includes("casac")
      ? "CONFECCION_ROLLO"
      : "STOCK_BORDADO";

  const matchingInvId = isDeportivo
    ? order.description.toLowerCase().includes("casac")
      ? "inv-pb-03"
      : "inv-pb-01"
    : isChaleco
    ? "inv-pb-04"
    : "inv-pb-02";

  const curvaTallas: SizeBreakdown[] = isChaleco
    ? [{ talla: "Única", cantidad: totalQty }]
    : [
        { talla: "S", cantidad: Math.max(1, Math.floor(totalQty * 0.2)) },
        { talla: "M", cantidad: Math.max(1, Math.floor(totalQty * 0.45)) },
        { talla: "L", cantidad: Math.max(1, Math.floor(totalQty * 0.25)) },
        {
          talla: "XL",
          cantidad: Math.max(
            1,
            totalQty -
              Math.floor(totalQty * 0.2) -
              Math.floor(totalQty * 0.45) -
              Math.floor(totalQty * 0.25)
          ),
        },
      ];

  const initialStation: ManufacturingStation = isConfeccionRollo(modality)
    ? "corte"
    : isDeportivo
    ? "sublimacion"
    : "bordado";

  const estimatedKg = calculateEstimatedFabricKg(curvaTallas);

  const sheet: ProductionTechSheet = {
    orderId: order.id,
    orderRef: order.ref,
    customer: order.customer ?? "Cliente Corpotex/Unicrack",
    estado: "BORRADOR",
    modality,
    currentStation: initialStation,
    stationUpdatedOn: new Date().toISOString(),
    stationHistory: [
      {
        station: initialStation,
        timestamp: new Date().toISOString(),
        note: "Orden liberada por Gatekeeper financiero e ingresada a línea de taller",
      },
    ],
    semaforoTela: isConfeccionRollo(modality) ? "HABITUAL_VERDE" : undefined,
    consumoEstimadoKg: isConfeccionRollo(modality) ? estimatedKg : 0,
    validacionTela: isConfeccionRollo(modality) ? "CONFIRMADA_TALLER" : "NO_APLICA",
    prendaTipo: order.items[0]?.descripcion ?? order.description,
    tela: isDeportivo
      ? "Win Microfibra Dry-Fit 145g (100% Poliéster)"
      : isChaleco
      ? "Drill Tecnología 100% Algodón con bandas 3M"
      : "Piqué 24/1 Peinado 210g",
    gramaje: isDeportivo ? "145 gr/m²" : "210 gr/m²",
    colorPrincipal: isDeportivo ? "Blanco Óptico / Degradado Corporativo" : "Verde Botella Institucional",
    colorContraste: isDeportivo ? "Azul Marino / Dorado" : "Cuello Rib Blanco",
    tipoCuello: isDeportivo ? "Cuello en V tejido con rib elástico" : "Cuello Camisero Piqué con pechera 2 botones",
    curvaTallas,
    totalUnidades: totalQty,
    tecnicaPersonalizacion: isDeportivo
      ? order.description.toLowerCase().includes("casac")
        ? "Bordado Computarizado"
        : "Sublimación Digital Full Print"
      : "Bordado Computarizado",
    arteUbicaciones: isDeportivo
      ? [
          { ubicacion: "Delantero Pecho Izquierdo", medidas: "8.5 x 8.5 cm", descripcion: "Escudo oficial del club / institución vectorizado" },
          { ubicacion: "Espalda Superior", medidas: "28.0 x 6.5 cm", descripcion: "Nombre del sponsor / equipo en tipografía deportiva" },
          { ubicacion: "Espalda Dorsal", medidas: "22.0 x 18.0 cm", descripcion: "Numeración deportiva oficial en dos colores" },
        ]
      : [
          { ubicacion: "Pecho Izquierdo", medidas: "9.0 x 5.0 cm", descripcion: "Logo institucional bordado en hilo poliéster satinado (12,500 puntadas)" },
          { ubicacion: "Manga Derecha", medidas: "6.0 x 2.5 cm", descripcion: "Bandera / sello de calidad bordado" },
        ],
    archivoArte: `VECTOR-${order.ref}.ai / ARTE-APROBADO-CLIENTE.pdf`,
    itemInventarioId: matchingInvId,
    stockDescontado: false,
    instruccionesCostura: [
      "Costura con remalle overlock de 4 hilos con puntada de seguridad incorporada.",
      "Cinta tapacostura de hombro a hombro para mayor durabilidad y confort térmico.",
      "Recubierto doble aguja en basta de mangas y faldón inferior (separación 1/4 pulgada).",
      "Control estricto de hilos sobrantes antes de ingresar a planchado a vapor.",
    ],
  };

  sheets[order.id] = sheet;
  saveProductionSheets(sheets);
  return sheet;
}

/** Consulta GET /api/v1/orders/{id}/tech-sheet con fallback local */
export async function fetchTechSheet(orderId: string, fallbackOrder?: TallerOrder): Promise<ProductionTechSheet> {
  if (!IS_MOCK) {
    try {
      const res = await endpoints.getTechSheet(orderId);
      if (res) {
        return {
          id: res.id,
          orderId: res.order_id,
          orderRef: fallbackOrder?.ref ?? orderId,
          customer: fallbackOrder?.customer ?? "Cliente Corpotex",
          estado: (res.estado as any) ?? "COMPLETA",
          modality: (res.modalidad as any) ?? "CONFECCION_ROLLO",
          currentStation: "corte",
          stationUpdatedOn: new Date().toISOString(),
          stationHistory: [],
          semaforoTela: (res.semaforo_tela as any) ?? "HABITUAL_VERDE",
          consumoEstimadoKg: res.consumo_estimado_kg ?? 0,
          validacionTela: (res.validacion_tela as any) ?? "CONFIRMADA_TALLER",
          telaValidadaPor: res.tela_validada_por ?? null,
          prendaTipo: res.prenda_tipo ?? fallbackOrder?.description ?? "Prenda textil",
          tela: res.tela_nombre ?? "Piqué 24/1",
          gramaje: res.gramaje ?? "210g",
          colorPrincipal: res.color_principal ?? "Azul",
          colorContraste: res.color_contraste ?? undefined,
          tipoCuello: res.tipo_cuello ?? "Cuello camisero",
          curvaTallas: res.curva_tallas ?? fallbackOrder?.items?.map(it => ({ talla: "M" as const, cantidad: it.cantidad })) ?? [],
          totalUnidades: fallbackOrder?.items?.reduce((s, it) => s + it.cantidad, 0) ?? 10,
          tecnicaPersonalizacion: res.tecnica_personalizacion ?? "Bordado Computarizado",
          arteUbicaciones: res.ubicaciones_arte ?? [],
          archivoArte: "ARTE.pdf",
          stockDescontado: false,
          instruccionesCostura: res.instrucciones_costura ?? [],
        };
      }
    } catch (e) {
      // Fallback a localStorage
    }
  }

  if (fallbackOrder) {
    return getOrCreateTechSheet(fallbackOrder);
  }

  const sheets = loadProductionSheets();
  return sheets[orderId] ?? ({} as ProductionTechSheet);
}

/** Guarda y sincroniza PUT /api/v1/orders/{id}/tech-sheet */
export async function persistTechSheet(
  sheet: ProductionTechSheet,
  actor?: Person
): Promise<{ ok: boolean; message: string; sheet: ProductionTechSheet }> {
  const sheets = loadProductionSheets();

  // Calcular kg reactivamente
  const isRollo = isConfeccionRollo(sheet.modality);
  const consumoEstimadoKg = isRollo ? calculateEstimatedFabricKg(sheet.curvaTallas) : 0;
  const validacionTela: ValidacionTela = isRollo
    ? (sheet.semaforoTela === "HABITUAL_VERDE" ? "CONFIRMADA_TALLER" : sheet.validacionTela ?? "COMPRA_REQUERIDA")
    : "NO_APLICA";

  const updated: ProductionTechSheet = {
    ...sheet,
    consumoEstimadoKg,
    validacionTela,
    estado: isRollo && sheet.semaforoTela !== "HABITUAL_VERDE" && validacionTela !== "CONFIRMADA_TALLER" ? "BORRADOR" : "COMPLETA",
    completadaPor: actor?.name ?? sheet.completadaPor ?? "Vendedora",
    completadaEn: new Date().toISOString(),
  };

  sheets[sheet.orderId] = updated;
  saveProductionSheets(sheets);

  if (!IS_MOCK) {
    try {
      await endpoints.saveTechSheet(sheet.orderId, {
        modalidad: updated.modality,
        semaforo_tela: updated.semaforoTela,
        consumo_estimado_kg: updated.consumoEstimadoKg,
        prenda_tipo: updated.prendaTipo,
        tela_nombre: updated.tela,
        gramaje: updated.gramaje,
        color_principal: updated.colorPrincipal,
        color_contraste: updated.colorContraste ?? null,
        tipo_cuello: updated.tipoCuello,
        curva_tallas: updated.curvaTallas,
        tecnica_personalizacion: updated.tecnicaPersonalizacion,
        ubicaciones_arte: updated.arteUbicaciones,
        instrucciones_costura: updated.instruccionesCostura,
      });
    } catch (e) {
      console.warn("Backend tech-sheet save fallback to local:", e);
    }
  }

  return { ok: true, message: "Ficha técnica textil guardada exitosamente.", sheet: updated };
}

/** Validación de tela en almacén por Jefe de Taller (Fase 3) */
export async function validateFabricStatus(
  orderId: string,
  validacion: "CONFIRMADA_TALLER" | "COMPRA_REQUERIDA",
  nota?: string,
  actor?: Person
): Promise<{ ok: boolean; message: string; sheet?: ProductionTechSheet }> {
  const sheets = loadProductionSheets();
  const sheet = sheets[orderId];
  if (!sheet) return { ok: false, message: "Ficha técnica no encontrada." };

  sheet.validacionTela = validacion;
  sheet.telaValidadaPor = actor?.name ?? "Jefe de Taller";
  sheet.telaValidadaAt = new Date().toISOString();
  if (validacion === "CONFIRMADA_TALLER") {
    sheet.estado = "COMPLETA";
  }

  sheets[orderId] = sheet;
  saveProductionSheets(sheets);

  if (!IS_MOCK) {
    try {
      await endpoints.validateFabric(orderId, { validacion, nota });
    } catch (e) {
      console.warn("Backend validateFabric fallback to local:", e);
    }
  }

  const msg =
    validacion === "CONFIRMADA_TALLER"
      ? "Disponibilidad de tela confirmada en almacén por Jefe de Taller. Ficha completa."
      : "Requerimiento de compra de tela registrado. Notificado a Compras (+días adicionales).";

  return { ok: true, message: msg, sheet };
}

/** Avance de estaciones en taller conectado a POST /api/v1/orders/{id}/station-advance (Fase 4) */
export async function advanceOrderStation(
  orderId: string,
  newStation: ManufacturingStation,
  note: string = "Avance de estación en línea de producción",
  _actor?: Person
): Promise<{ ok: boolean; message: string; sheet?: ProductionTechSheet }> {
  const sheet = updateOrderStation(orderId, newStation, note);

  if (!IS_MOCK) {
    try {
      await endpoints.advanceStation(orderId, {
        station: newStation,
        note,
      });
    } catch (e) {
      console.warn("Backend station-advance fallback to local:", e);
    }
  }

  return {
    ok: true,
    message: `Orden transferida a: ${STATION_METADATA[newStation].shortLabel}`,
    sheet: sheet ?? undefined,
  };
}

export function updateOrderStation(
  orderId: string,
  newStation: ManufacturingStation,
  note: string = "Avance de estación en línea de producción"
): ProductionTechSheet | null {
  const sheets = loadProductionSheets();
  const sheet = sheets[orderId];
  if (!sheet) return null;

  sheet.currentStation = newStation;
  sheet.stationUpdatedOn = new Date().toISOString();
  sheet.stationHistory.unshift({
    station: newStation,
    timestamp: new Date().toISOString(),
    note,
  });

  sheets[orderId] = sheet;
  saveProductionSheets(sheets);
  return sheet;
}

export function updateOrderModality(
  orderId: string,
  newModality: ManufacturingModality
): ProductionTechSheet | null {
  const sheets = loadProductionSheets();
  const sheet = sheets[orderId];
  if (!sheet) return null;

  sheet.modality = newModality;
  if (isConfeccionRollo(newModality)) {
    if (sheet.currentStation === "sublimacion" || sheet.currentStation === "bordado") {
      sheet.currentStation = "corte";
    }
    sheet.consumoEstimadoKg = calculateEstimatedFabricKg(sheet.curvaTallas);
    sheet.semaforoTela = sheet.semaforoTela ?? "HABITUAL_VERDE";
    sheet.validacionTela = sheet.semaforoTela === "HABITUAL_VERDE" ? "CONFIRMADA_TALLER" : "COMPRA_REQUERIDA";
  } else {
    sheet.consumoEstimadoKg = 0;
    sheet.validacionTela = "NO_APLICA";
    sheet.estado = "COMPLETA";
  }

  sheets[orderId] = sheet;
  saveProductionSheets(sheets);
  return sheet;
}

export function deductStockForSheet(orderId: string): { ok: boolean; message: string } {
  const sheets = loadProductionSheets();
  const sheet = sheets[orderId];
  if (!sheet) return { ok: false, message: "Ficha técnica no encontrada." };
  if (sheet.stockDescontado) return { ok: false, message: "El stock para esta orden ya fue descontado." };

  const inventory = loadWorkshopInventory();
  const invItem = inventory.find((it) => it.id === sheet.itemInventarioId);
  if (!invItem) return { ok: false, message: "No hay prenda base vinculada en el catálogo de inventario." };

  if (invItem.stockActual < sheet.totalUnidades) {
    return {
      ok: false,
      message: `Stock insuficiente en almacén: Hay ${invItem.stockActual} ${invItem.unidad} disponibles y el pedido requiere ${sheet.totalUnidades} ${invItem.unidad}.`,
    };
  }

  // Descontar
  invItem.stockActual -= sheet.totalUnidades;
  sheet.stockDescontado = true;
  sheet.unidadesDescontadas = sheet.totalUnidades;

  saveWorkshopInventory(inventory);
  sheets[orderId] = sheet;
  saveProductionSheets(sheets);

  return {
    ok: true,
    message: `Se descontaron exitosamente ${sheet.totalUnidades} unidades de "${invItem.nombre}". Stock remanente en planta: ${invItem.stockActual} ${invItem.unidad}.`,
  };
}

export const STATION_METADATA: Record<
  ManufacturingStation,
  { label: string; shortLabel: string; tone: "info" | "violet" | "warn" | "ok" | "neutral"; step: number; description: string }
> = {
  corte: {
    label: "1. Trazo, Tizado & Corte",
    shortLabel: "Corte",
    tone: "info",
    step: 1,
    description: "Corte de piezas desde rollo de tela según cuadro de tallas.",
  },
  sublimacion: {
    label: "2. Sublimación / Estampado",
    shortLabel: "Sublimación",
    tone: "violet",
    step: 2,
    description: "Calandra / termoestampado digital transfer a 200°C.",
  },
  bordado: {
    label: "3. Bordado Computarizado",
    shortLabel: "Bordado",
    tone: "warn",
    step: 3,
    description: "Montaje en bastidores y bordado de escudos/logos.",
  },
  confeccion: {
    label: "4. Costura & Ensamble",
    shortLabel: "Confección",
    tone: "info",
    step: 4,
    description: "Unión en remalladoras overlock, pegado de cuello y recubierto.",
  },
  control_calidad: {
    label: "5. Acabados & Control de Calidad",
    shortLabel: "Calidad",
    tone: "warn",
    step: 5,
    description: "Deshilache, planchado a vapor y auditoría de medidas AQL.",
  },
  listo_despacho: {
    label: "6. Listo para Despacho",
    shortLabel: "Listo Despacho",
    tone: "ok",
    step: 6,
    description: "Doblado, embolsado y encajonado para entrega física.",
  },
};
