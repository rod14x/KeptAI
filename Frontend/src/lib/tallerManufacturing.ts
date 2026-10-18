import type { TallerOrder } from "../api/client";

export type ManufacturingStation =
  | "corte"
  | "sublimacion"
  | "bordado"
  | "confeccion"
  | "control_calidad"
  | "listo_despacho";

export type ManufacturingModality =
  | "stock_personalizado" // Prenda en stock en blanco + sublimado/bordado
  | "confeccion_completa"; // Paquete completo: rollo tela -> corte -> armado

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
  orderId: string;
  orderRef: string;
  customer: string;
  modality: ManufacturingModality;
  currentStation: ManufacturingStation;
  stationUpdatedOn: string;
  stationHistory: Array<{ station: ManufacturingStation; timestamp: string; note: string }>;
  
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
  tecnicaPersonalizacion: "Sublimación Digital Full Print" | "Bordado Computarizado" | "Sublimación + Vinil Deportivo" | "Bordado 3D";
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

/** Genera una ficha técnica profesional por defecto si la orden no tiene una personalizada */
export function getOrCreateTechSheet(order: TallerOrder): ProductionTechSheet {
  const sheets = loadProductionSheets();
  if (sheets[order.id]) {
    return sheets[order.id];
  }

  const isDeportivo = order.brand === "unicrack" || order.description.toLowerCase().includes("camiset") || order.description.toLowerCase().includes("casac");
  const isChaleco = order.description.toLowerCase().includes("chaleco");
  
  const totalQty = order.items.reduce((s, it) => s + it.cantidad, 0);

  // Determinar modalidad inteligente por defecto
  // Casacas o Polos bordados suelen salir de prendas base en stock; Camisetas de juego completas van desde corte
  const modality: ManufacturingModality = isDeportivo && !order.description.toLowerCase().includes("casac")
    ? "confeccion_completa"
    : "stock_personalizado";

  const matchingInvId = isDeportivo
    ? (order.description.toLowerCase().includes("casac") ? "inv-pb-03" : "inv-pb-01")
    : (isChaleco ? "inv-pb-04" : "inv-pb-02");

  const curvaTallas: SizeBreakdown[] = isChaleco
    ? [{ talla: "Única", cantidad: totalQty }]
    : [
        { talla: "S", cantidad: Math.max(1, Math.floor(totalQty * 0.2)) },
        { talla: "M", cantidad: Math.max(1, Math.floor(totalQty * 0.45)) },
        { talla: "L", cantidad: Math.max(1, Math.floor(totalQty * 0.25)) },
        { talla: "XL", cantidad: Math.max(1, totalQty - Math.floor(totalQty * 0.2) - Math.floor(totalQty * 0.45) - Math.floor(totalQty * 0.25)) },
      ];

  const initialStation: ManufacturingStation = modality === "confeccion_completa" ? "corte" : (isDeportivo ? "sublimacion" : "bordado");

  const sheet: ProductionTechSheet = {
    orderId: order.id,
    orderRef: order.ref,
    customer: order.customer ?? "Cliente Corpotex/Unicrack",
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
    prendaTipo: order.items[0]?.descripcion ?? order.description,
    tela: isDeportivo ? "Win Microfibra Dry-Fit 145g (100% Poliéster)" : (isChaleco ? "Drill Tecnología 100% Algodón con bandas 3M" : "Piqué 24/1 Peinado 210g"),
    gramaje: isDeportivo ? "145 gr/m²" : "210 gr/m²",
    colorPrincipal: isDeportivo ? "Blanco Óptico / Degradado Corporativo" : "Verde Botella Institucional",
    colorContraste: isDeportivo ? "Azul Marino / Dorado" : "Cuello Rib Blanco",
    tipoCuello: isDeportivo ? "Cuello en V tejido con rib elástico" : "Cuello Camisero Piqué con pechera 2 botones",
    curvaTallas,
    totalUnidades: totalQty,
    tecnicaPersonalizacion: isDeportivo
      ? (order.description.toLowerCase().includes("casac") ? "Bordado Computarizado" : "Sublimación Digital Full Print")
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
  if (newModality === "confeccion_completa" && sheet.currentStation === "sublimacion") {
    sheet.currentStation = "corte";
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
