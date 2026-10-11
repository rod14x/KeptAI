import type { Application, AuditEvent, CollectionAlert, DemoState, Evidence, Order, OutgoingMessage } from "./schemas";
import { addDays, dueDateOf, orderBalance, scheduleCollection } from "./domain";

// Semilla ficticia del recorrido de demostración, alineada con PROP-FLUJO-DER-001 (D-005).
// Ninguna cifra es dato real de Corpotex; nombres inventados.
// Equivalencia con el recorrido del cerebro: P-001 = ORD-001 y P-002 = ORD-002, con las mismas cifras.

const ADMIN = "Carmen Ramos";
const GERENCIA = "Patricia Zapata";
const TALLER = "Jorge Ipanaqué";
const ROSA = "Rosa Chunga";
const LUIS = "Luis Yarlequé";

const baseEv: Omit<Evidence, "id" | "brand" | "kind" | "receivedAt" | "orderId" | "fields" | "declaredAmountCents" | "chat" | "transcript" | "status"> = {
  origen: "whatsapp",
  legible: true,
  mismatchAccepted: false,
  verifiedBy: null,
  verifiedAt: null,
  appliedAt: null,
  discardReason: null,
  corrections: [],
};

type OrderSeed = Omit<Order, "costs" | "internalChargeCents" | "items" | "costOrigin" | "hoja" | "credito" | "fechaEntregaSolicitada" | "inicioProduccion"> & {
  costs: Partial<Order["costs"]>;
} & Partial<Pick<Order, "internalChargeCents" | "items" | "costOrigin" | "hoja" | "credito" | "fechaEntregaSolicitada" | "inicioProduccion">>;

function order(o: OrderSeed): Order {
  return {
    internalChargeCents: null,
    items: [{ descripcion: o.description, cantidad: 1, detalle: "Detalle consolidado del pedido", precioUnitCents: o.saleCents }],
    costOrigin: "real",
    hoja: null,
    credito: null,
    fechaEntregaSolicitada: null,
    inicioProduccion: null,
    ...o,
    costs: { materiales: 0, manoObra: 0, terceros: 0, indirectos: 0, ...o.costs },
  };
}

/** Pedido histórico: crédito aprobado por el vendedor, producido y despachado. */
function historic(o: Omit<OrderSeed, "estado" | "condicionPago" | "credito" | "despacho" | "inicioProduccion"> & { plazo: number; despacho: string }): Order {
  const { plazo, despacho, ...rest } = o;
  const seller = o.sellerId === "u-rosa" ? ROSA : LUIS;
  return order({
    ...rest,
    estado: "despachada",
    condicionPago: { tipo: "credito", plazoDias: plazo, anticipoPct: null },
    credito: { decision: "aprobado", by: seller, at: `${o.issuedOn}T11:00:00`, avisoMoraMostrado: false, saldoReferenciaCents: 0, nota: null },
    inicioProduccion: addDays(o.issuedOn, 1),
    despacho: { fecha: despacho, acta: `Guía ${o.id.replace("ORD-", "")}-${despacho.slice(5, 7)}`, by: TALLER },
  });
}

function paid(id: string, orderId: string, amountCents: number, at: string, channel: string): Application {
  return { id, evidenceId: null, orderId, amountCents, channel, at, by: ADMIN };
}

function audit(id: string, at: string, by: string, kind: AuditEvent["kind"], brand: AuditEvent["brand"], text: string, extra: Partial<AuditEvent> = {}): AuditEvent {
  return { id, at, by, kind, brand, evidenceId: null, orderId: null, customerId: null, amountCents: null, text, ...extra };
}

export function createSeed(): DemoState {
  const state: DemoState = {
    version: 3,
    cutDate: "2026-10-10",
    settings: { factorCobro: 1, plazoDefecto: 30, alertOffsets: [-3, 0, 3], updatedBy: null, updatedAt: null },
    people: [
      { id: "u-patricia", name: GERENCIA, email: "patricia.zapata@keptai.pe", role: "gerencia", title: "Gerencia general", brand: null, since: "2024-03-01" },
      { id: "u-carmen", name: ADMIN, email: "carmen.ramos@keptai.pe", role: "administracion", title: "Administración y cobranza", brand: null, since: "2024-08-12" },
      { id: "u-jorge", name: TALLER, email: "jorge.ipanaque@keptai.pe", role: "jefe_taller", title: "Jefe de taller", brand: null, since: "2025-05-05" },
      { id: "u-rosa", name: ROSA, email: "rosa.chunga@keptai.pe", role: "vendedor", title: "Vendedora Corpotex", brand: "corpotex", since: "2023-11-20" },
      { id: "u-luis", name: LUIS, email: "luis.yarleque@keptai.pe", role: "vendedor", title: "Vendedor Unicrack", brand: "unicrack", since: "2024-01-15" },
    ],
    customers: [
      { id: "c-huanca", name: "Constructora Huancabamba Norte", brand: "corpotex", tipo: "empresa", rucDni: null, sellerId: "u-rosa", contactoWhatsapp: "+51 9•• ••• 214", since: "2025-11-04", creditLimitCents: 150000 },
      { id: "c-sullana", name: "Agroindustrias Sullana Verde", brand: "corpotex", tipo: "empresa", rucDni: null, sellerId: "u-rosa", contactoWhatsapp: "+51 9•• ••• 587", since: "2025-06-12", creditLimitCents: 300000 },
      { id: "c-sechura", name: "Transportes Sechura Sur", brand: "corpotex", tipo: "empresa", rucDni: null, sellerId: "u-rosa", contactoWhatsapp: "+51 9•• ••• 903", since: "2026-02-20", creditLimitCents: 200000 },
      { id: "c-tallan", name: "Club Deportivo Tallán", brand: "unicrack", tipo: "persona", rucDni: null, sellerId: "u-luis", contactoWhatsapp: "+51 9•• ••• 146", since: "2026-03-02", creditLimitCents: 80000 },
      { id: "c-vientos", name: "Academia Deportiva Cuatro Vientos", brand: "unicrack", tipo: "empresa", rucDni: null, sellerId: "u-luis", contactoWhatsapp: "+51 9•• ••• 731", since: "2025-09-15", creditLimitCents: 150000 },
      { id: "c-horizonte", name: "Colegio Nuevo Horizonte", brand: "unicrack", tipo: "colegio", rucDni: null, sellerId: "u-luis", contactoWhatsapp: "+51 9•• ••• 368", since: "2025-02-10", creditLimitCents: 400000 },
    ],
    orders: [
      historic({
        id: "ORD-001", customerId: "c-huanca", brand: "corpotex", line: "Profesional", description: "Camisas drill con bordado, 12 unidades",
        modality: "propia", saleCents: 30000, costs: { materiales: 20000, manoObra: 8000, indirectos: 6000 }, internalChargeCents: 32000,
        issuedOn: "2026-09-22", plazo: 15, despacho: "2026-10-01", sellerId: "u-rosa",
      }),
      historic({
        id: "ORD-002", customerId: "c-tallan", brand: "unicrack", line: "Deportivo", description: "Camisetas sublimadas, 20 unidades",
        modality: "tercerizada", saleCents: 50000, costs: { terceros: 35000 },
        issuedOn: "2026-09-08", plazo: 15, despacho: "2026-09-20", sellerId: "u-luis",
      }),
      historic({
        id: "ORD-003", customerId: "c-huanca", brand: "corpotex", line: "Profesional", description: "Polos piqué con logo, 24 unidades",
        modality: "propia", saleCents: 48000, costs: { materiales: 26000, manoObra: 9000, indirectos: 5000 }, internalChargeCents: 43000,
        issuedOn: "2026-07-28", plazo: 15, despacho: "2026-08-08", sellerId: "u-rosa",
      }),
      historic({
        id: "ORD-004", customerId: "c-sullana", brand: "corpotex", line: "Profesional", description: "Overoles de drill con cinta reflectiva, 30 unidades",
        modality: "tercerizada", saleCents: 126000, costs: { terceros: 92000 },
        issuedOn: "2026-08-03", plazo: 30, despacho: "2026-08-14", sellerId: "u-rosa",
      }),
      historic({
        id: "ORD-005", customerId: "c-sullana", brand: "corpotex", line: "Profesional", description: "Camisas manga larga para campo, 40 unidades",
        modality: "propia", saleCents: 98000, costs: { materiales: 52000, manoObra: 18000, indirectos: 9000 }, internalChargeCents: 85000,
        issuedOn: "2026-09-10", plazo: 30, despacho: "2026-09-20", sellerId: "u-rosa",
      }),
      historic({
        id: "ORD-006", customerId: "c-sechura", brand: "corpotex", line: "Profesional", description: "Casacas para conductores, 18 unidades",
        modality: "propia", saleCents: 72000, costs: { materiales: 34000, manoObra: 15000, indirectos: 9000 }, internalChargeCents: 62000,
        issuedOn: "2026-07-15", plazo: 30, despacho: "2026-07-25", sellerId: "u-rosa",
      }),
      historic({
        id: "ORD-007", customerId: "c-sechura", brand: "corpotex", line: "Profesional", description: "Chalecos y pantalones de trabajo, 25 juegos",
        modality: "propia", saleCents: 85000, costs: { materiales: 41000, manoObra: 17000, indirectos: 8000 }, internalChargeCents: 71000,
        issuedOn: "2026-08-18", plazo: 30, despacho: "2026-08-22", sellerId: "u-rosa",
      }),
      historic({
        id: "ORD-008", customerId: "c-tallan", brand: "unicrack", line: "Deportivo", description: "Shorts y medias de entrenamiento, 20 juegos",
        modality: "tercerizada", saleCents: 36000, costs: { terceros: 25000 },
        issuedOn: "2026-08-20", plazo: 15, despacho: "2026-08-28", sellerId: "u-luis",
      }),
      historic({
        id: "ORD-009", customerId: "c-vientos", brand: "unicrack", line: "Deportivo", description: "Buzos deportivos sublimados, 32 unidades",
        modality: "tercerizada", saleCents: 64000, costs: { terceros: 47000 },
        issuedOn: "2026-08-30", plazo: 30, despacho: "2026-09-13", sellerId: "u-luis",
      }),
      historic({
        id: "ORD-010", customerId: "c-vientos", brand: "unicrack", line: "Deportivo", description: "Camisetas de competencia, 30 unidades",
        modality: "tercerizada", saleCents: 58000, costs: { terceros: 41000 },
        issuedOn: "2026-06-10", plazo: 30, despacho: "2026-06-20", sellerId: "u-luis",
      }),
      historic({
        id: "ORD-011", customerId: "c-horizonte", brand: "unicrack", line: "Escolar", description: "Buzos escolares, 60 unidades",
        modality: "tercerizada", saleCents: 120000, costs: { terceros: 88000 },
        issuedOn: "2026-07-20", plazo: 30, despacho: "2026-08-01", sellerId: "u-luis",
      }),
      historic({
        id: "ORD-012", customerId: "c-horizonte", brand: "unicrack", line: "Escolar", description: "Uniformes de gala escolar, 50 juegos",
        modality: "tercerizada", saleCents: 150000, costs: { terceros: 108000 },
        issuedOn: "2026-09-05", plazo: 30, despacho: "2026-09-28", sellerId: "u-luis",
      }),
      // ---- Órdenes del flujo nuevo (D-005) ----
      order({
        id: "ORD-013", customerId: "c-tallan", brand: "unicrack", line: "Deportivo", description: "Camisetas para el campeonato regional, 30 unidades",
        items: [{ descripcion: "Camiseta sublimada con número", cantidad: 30, detalle: "Dry-fit, tallas por confirmar", precioUnitCents: 2000 }],
        modality: "tercerizada", saleCents: 60000, costs: { terceros: 42000 }, costOrigin: "teorico",
        sellerId: "u-luis", estado: "pendiente_aprobacion", condicionPago: null, issuedOn: "2026-10-10", fechaEntregaSolicitada: "2026-10-24", despacho: null,
        hoja: {
          version: 1,
          origen: "whatsapp",
          md: "Cliente: Club Deportivo Tallán\nMarca: Unicrack Sport\nÍtems: 30 camisetas sublimadas con número (dry-fit)\nTotal: S/ 600.00\nCondición pedida: crédito a 15 días\nEntrega solicitada: 24/10/2026",
          faltantes: ["tallas por jugador"],
          confianza: 0.82,
          estado: "borrador",
          revisadoPor: null,
          revisadoAt: null,
          chat: [
            { from: "cliente", text: "Hola Luis, necesitamos 30 camisetas para el campeonato regional, con número.", time: "09:21" },
            { from: "vendedor", text: "Claro, dry-fit sublimadas a S/ 20 cada una. ¿Para cuándo?", time: "09:24" },
            { from: "cliente", text: "Para el 24. ¿Nos das 15 días como la vez pasada? Las tallas te las paso luego.", time: "09:30" },
            { from: "vendedor", text: "/cerrar", time: "09:38" },
          ],
        },
      }),
      order({
        id: "ORD-014", customerId: "c-vientos", brand: "unicrack", line: "Deportivo", description: "Casacas de invierno, 24 unidades",
        items: [{ descripcion: "Casaca cortavientos con logo", cantidad: 24, detalle: "Tallas S-XL según lista", precioUnitCents: 3000 }],
        modality: "tercerizada", saleCents: 72000, costs: { terceros: 50000 }, costOrigin: "teorico",
        sellerId: "u-luis", estado: "retenida", issuedOn: "2026-10-08", fechaEntregaSolicitada: "2026-10-30", despacho: null,
        condicionPago: { tipo: "anticipo", plazoDias: 30, anticipoPct: 50 },
        credito: { decision: "aprobado", by: LUIS, at: "2026-10-08T16:20:00", avisoMoraMostrado: false, saldoReferenciaCents: 64000, nota: "Anticipo del 50%; saldo a 30 días desde el despacho." },
        hoja: {
          version: 2,
          origen: "whatsapp",
          md: "Cliente: Academia Deportiva Cuatro Vientos\nMarca: Unicrack Sport\nÍtems: 24 casacas cortavientos con logo\nTotal: S/ 720.00\nCondición: anticipo 50% y saldo a 30 días",
          faltantes: [],
          confianza: 0.9,
          estado: "confirmada",
          revisadoPor: LUIS,
          revisadoAt: "2026-10-08T16:20:00",
          chat: [
            { from: "cliente", text: "Luis, queremos 24 casacas de invierno con el logo.", time: "15:02" },
            { from: "vendedor", text: "Te quedan en S/ 30. Te pido 50% de adelanto y el resto a 30 días.", time: "15:10" },
            { from: "cliente", text: "Ok, mañana te yapeo el adelanto.", time: "15:40" },
            { from: "vendedor", text: "/ok ORD-014", time: "16:20" },
          ],
        },
      }),
      order({
        id: "ORD-015", customerId: "c-sullana", brand: "corpotex", line: "Profesional", description: "Polos piqué bordados, 25 unidades",
        items: [{ descripcion: "Polo piqué con logo bordado", cantidad: 25, detalle: "Color verde, tallas M-XL", precioUnitCents: 2080 }],
        modality: "propia", saleCents: 52000, costs: { materiales: 28000, manoObra: 9000, indirectos: 5000 }, costOrigin: "teorico", internalChargeCents: 45000,
        sellerId: "u-rosa", estado: "pendiente_aprobacion", condicionPago: null, issuedOn: "2026-10-10", fechaEntregaSolicitada: "2026-10-30", despacho: null,
        hoja: {
          version: 1,
          origen: "whatsapp",
          md: "Cliente: Agroindustrias Sullana Verde\nMarca: Corpotex\nÍtems: 25 polos piqué con logo bordado\nTotal: S/ 520.00\nCondición pedida: crédito a 30 días\nEntrega solicitada: 30/10/2026",
          faltantes: [],
          confianza: 0.91,
          estado: "borrador",
          revisadoPor: null,
          revisadoAt: null,
          chat: [
            { from: "cliente", text: "Rosa, otra vez los polos verdes con el logo, 25 unidades.", time: "10:11" },
            { from: "vendedor", text: "Perfecto, S/ 20.80 cada uno, crédito a 30 días como siempre.", time: "10:15" },
            { from: "vendedor", text: "/cerrar", time: "10:16" },
          ],
        },
      }),
      order({
        id: "ORD-016", customerId: "c-huanca", brand: "corpotex", line: "Profesional", description: "Chalecos reflectivos, 15 unidades",
        items: [{ descripcion: "Chaleco reflectivo con bordado", cantidad: 15, detalle: "Naranja, talla única", precioUnitCents: 3000 }],
        modality: "propia", saleCents: 45000, costs: { materiales: 22000, manoObra: 8000, indirectos: 4000 }, costOrigin: "teorico", internalChargeCents: 38000,
        sellerId: "u-rosa", estado: "en_produccion", issuedOn: "2026-10-07", fechaEntregaSolicitada: "2026-10-14", inicioProduccion: "2026-10-07", despacho: null,
        condicionPago: { tipo: "credito", plazoDias: 15, anticipoPct: null },
        credito: { decision: "aprobado", by: ROSA, at: "2026-10-07T12:05:00", avisoMoraMostrado: false, saldoReferenciaCents: 0, nota: "Cliente al día." },
      }),
    ],
    evidences: [
      {
        ...baseEv, id: "V-001", brand: "corpotex", kind: "voucher", receivedAt: "2026-10-02T16:40:00", orderId: "ORD-001",
        fields: { amountCents: 30000, operationRef: "48213307", payer: "Constructora Huancabamba Norte", paidAt: "02/10/2026 16:31", channel: "Yape" },
        declaredAmountCents: 30000,
        chat: [
          { from: "cliente", text: "Buenas tardes, le yapeé los 300 de las camisas.", time: "16:38" },
          { from: "cliente", text: "Comprobante", time: "16:38", attachment: true },
        ],
        transcript: null, status: "aplicado", verifiedBy: ADMIN, verifiedAt: "2026-10-03T09:10:00", appliedAt: "2026-10-03T09:12:00",
      },
      {
        ...baseEv, id: "V-002", brand: "unicrack", kind: "voucher", receivedAt: "2026-10-09T09:14:00", orderId: "ORD-002",
        fields: { amountCents: 10000, operationRef: "00927714", payer: "Club Deportivo Tallán", paidAt: "09/10/2026 09:05", channel: "Transferencia BCP" },
        declaredAmountCents: 10000,
        chat: [
          { from: "cliente", text: "Buen día, le hago un adelanto de 100 soles por las camisetas del club.", time: "09:12" },
          { from: "cliente", text: "Voucher de la transferencia", time: "09:13", attachment: true },
        ],
        transcript: null, status: "recibido",
      },
      {
        ...baseEv, id: "V-003", brand: "unicrack", kind: "voucher", receivedAt: "2026-10-09T18:02:00", orderId: "ORD-002",
        fields: { amountCents: 10000, operationRef: "00927714", payer: "Club Deportivo Tallán", paidAt: "09/10/2026 09:05", channel: "Transferencia BCP" },
        declaredAmountCents: 10000,
        chat: [
          { from: "cliente", text: "Le reenvío el voucher de la mañana por si no le llegó.", time: "18:01" },
          { from: "cliente", text: "Voucher de la transferencia", time: "18:02", attachment: true },
        ],
        transcript: null, status: "recibido",
      },
      {
        ...baseEv, id: "V-004", brand: "unicrack", kind: "voucher", receivedAt: "2026-10-09T20:47:00", orderId: null,
        fields: { amountCents: 25000, operationRef: "7731045", payer: "Marco Sernaqué", paidAt: "09/10/2026 20:45", channel: "Plin" },
        declaredAmountCents: null,
        chat: [
          { from: "cliente", text: "Pago de los polos, gracias.", time: "20:46" },
          { from: "cliente", text: "Captura de Plin", time: "20:47", attachment: true },
        ],
        transcript: null, status: "recibido",
      },
      {
        ...baseEv, id: "V-005", brand: "unicrack", kind: "voucher", receivedAt: "2026-10-10T08:21:00", orderId: "ORD-002",
        fields: { amountCents: 18000, operationRef: "5520198", payer: "Club Deportivo Tallán", paidAt: "10/10/2026 08:19", channel: "Yape" },
        declaredAmountCents: 20000,
        chat: [
          { from: "cliente", text: "Le mando 200 por Yape a cuenta del saldo.", time: "08:20" },
          { from: "cliente", text: "Captura de Yape", time: "08:21", attachment: true },
        ],
        transcript: null, status: "recibido",
      },
      {
        ...baseEv, id: "V-006", brand: "corpotex", kind: "voucher", receivedAt: "2026-10-10T10:05:00", orderId: null,
        fields: { amountCents: null, operationRef: null, payer: null, paidAt: null, channel: "Yape" },
        declaredAmountCents: null, legible: false,
        chat: [
          { from: "cliente", text: "Ahí le mandé.", time: "10:04" },
          { from: "cliente", text: "Foto del comprobante (borrosa)", time: "10:05", attachment: true },
        ],
        transcript: null, status: "recibido",
      },
      {
        ...baseEv, id: "N-001", brand: "unicrack", kind: "audio", receivedAt: "2026-10-10T11:32:00", orderId: "ORD-002",
        fields: { amountCents: 15000, operationRef: null, payer: "Club Deportivo Tallán", paidAt: null, channel: "Transferencia" },
        declaredAmountCents: 15000, chat: [],
        transcript: "Hola, le habla el delegado del Club Tallán. Ya le transferí ciento cincuenta soles por lo de las camisetas, el número de operación se lo paso más tarde.",
        status: "recibido",
      },
      {
        ...baseEv, id: "V-007", brand: "unicrack", kind: "voucher", receivedAt: "2026-10-10T09:40:00", orderId: "ORD-014",
        fields: { amountCents: 36000, operationRef: "61190427", payer: "Academia Deportiva Cuatro Vientos", paidAt: "10/10/2026 09:36", channel: "Yape" },
        declaredAmountCents: 36000,
        chat: [
          { from: "cliente", text: "Luis, ahí va el 50% de las casacas.", time: "09:38" },
          { from: "cliente", text: "Captura de Yape", time: "09:40", attachment: true },
        ],
        transcript: null, status: "recibido",
      },
    ],
    applications: [
      { id: "A-001", evidenceId: "V-001", orderId: "ORD-001", amountCents: 30000, channel: "Yape", at: "2026-10-03T09:12:00", by: ADMIN },
      paid("A-H01", "ORD-003", 48000, "2026-08-21T11:20:00", "Transferencia BCP"),
      paid("A-H02", "ORD-004", 126000, "2026-09-25T10:05:00", "Transferencia BBVA"),
      paid("A-H03", "ORD-005", 40000, "2026-09-22T15:40:00", "Transferencia BCP"),
      paid("A-H04", "ORD-006", 72000, "2026-09-02T09:30:00", "Depósito en cuenta"),
      paid("A-H05", "ORD-008", 36000, "2026-09-12T18:10:00", "Yape"),
      paid("A-H06", "ORD-010", 58000, "2026-07-18T12:00:00", "Transferencia Interbank"),
      paid("A-H07", "ORD-011", 50000, "2026-08-05T10:45:00", "Transferencia BCP"),
      paid("A-H08", "ORD-012", 60000, "2026-09-15T16:25:00", "Transferencia BCP"),
    ],
    messages: [],
    alerts: [],
    shareLinks: [],
    audit: [
      audit("E-01", "2026-09-20T12:00:00", TALLER, "despacho", "unicrack", "Despacho registrado", { orderId: "ORD-002", amountCents: 50000 }),
      audit("E-02", "2026-10-01T15:00:00", TALLER, "despacho", "corpotex", "Despacho registrado", { orderId: "ORD-001", amountCents: 30000 }),
      audit("E-03", "2026-10-03T09:12:00", ADMIN, "aplicado", "corpotex", "Pago aplicado", { evidenceId: "V-001", orderId: "ORD-001", amountCents: 30000 }),
      audit("E-04", "2026-10-09T09:14:00", "n8n WF2", "recibido", "unicrack", "Comprobante recibido por WhatsApp", { evidenceId: "V-002", orderId: "ORD-002", amountCents: 10000 }),
      audit("E-05", "2026-10-09T18:02:00", "n8n WF2", "recibido", "unicrack", "Comprobante recibido por WhatsApp", { evidenceId: "V-003", orderId: "ORD-002", amountCents: 10000 }),
      audit("E-06", "2026-10-09T20:47:00", "n8n WF2", "recibido", "unicrack", "Comprobante sin orden", { evidenceId: "V-004", amountCents: 25000 }),
      audit("E-07", "2026-10-10T08:21:00", "n8n WF2", "recibido", "unicrack", "Comprobante recibido por WhatsApp", { evidenceId: "V-005", orderId: "ORD-002", amountCents: 18000 }),
      audit("E-08", "2026-10-10T10:05:00", "n8n WF2", "recibido", "corpotex", "Imagen ilegible en revisión", { evidenceId: "V-006" }),
      audit("E-09", "2026-10-10T11:32:00", "n8n WF2", "recibido", "unicrack", "Nota de voz transcrita", { evidenceId: "N-001", orderId: "ORD-002", amountCents: 15000 }),
      audit("E-10", "2026-10-03T09:10:00", ADMIN, "verificado", "corpotex", "Verificado en banco", { evidenceId: "V-001", orderId: "ORD-001", amountCents: 30000 }),
      audit("E-11", "2026-10-07T12:05:00", ROSA, "credito_aprobado", "corpotex", "Crédito aprobado a 15 días", { orderId: "ORD-016", customerId: "c-huanca", amountCents: 45000 }),
      audit("E-12", "2026-10-07T12:05:00", ROSA, "produccion", "corpotex", "Liberada a producción", { orderId: "ORD-016", customerId: "c-huanca" }),
      audit("E-13", "2026-10-08T16:20:00", LUIS, "orden_confirmada", "unicrack", "Orden confirmada con anticipo 50%", { orderId: "ORD-014", customerId: "c-vientos", amountCents: 72000 }),
      audit("E-14", "2026-10-10T09:38:00", "n8n WF1", "orden_ingresada", "unicrack", "Orden ingresada desde WhatsApp", { orderId: "ORD-013", customerId: "c-tallan", amountCents: 60000 }),
      audit("E-15", "2026-10-10T09:40:00", "n8n WF2", "recibido", "unicrack", "Anticipo recibido por WhatsApp", { evidenceId: "V-007", orderId: "ORD-014", amountCents: 36000 }),
      audit("E-16", "2026-10-10T10:16:00", "n8n WF1", "orden_ingresada", "corpotex", "Orden ingresada desde WhatsApp", { orderId: "ORD-015", customerId: "c-sullana", amountCents: 52000 }),
    ],
    outflows: [
      { id: "O-01", brand: "corpotex", week: 0, label: "Planilla taller", amountCents: 60000 },
      { id: "O-02", brand: "corpotex", week: 1, label: "Proveedor de tela", amountCents: 45000 },
      { id: "O-09", brand: "corpotex", week: 1, label: "Compra de tela drill (lote octubre)", amountCents: 180000 },
      { id: "O-03", brand: "corpotex", week: 2, label: "Alquiler local", amountCents: 38000 },
      { id: "O-04", brand: "corpotex", week: 3, label: "Planilla taller", amountCents: 70000 },
      { id: "O-05", brand: "unicrack", week: 0, label: "Taller tercero (sublimado)", amountCents: 35000 },
      { id: "O-06", brand: "unicrack", week: 1, label: "Planilla comercial", amountCents: 52000 },
      { id: "O-07", brand: "unicrack", week: 2, label: "Publicidad pagada", amountCents: 24000 },
      { id: "O-08", brand: "unicrack", week: 3, label: "Planilla comercial", amountCents: 52000 },
    ],
    openings: [
      { brand: "corpotex", amountCents: 180000, date: "2026-10-01", source: "Supuesto de demostración" },
      { brand: "unicrack", amountCents: 140000, date: "2026-10-01", source: "Supuesto de demostración" },
    ],
  };

  // Mensajes de cobranza con el mismo criterio que usaría el scheduler de Spring.
  const messages: OutgoingMessage[] = [];
  const alerts: CollectionAlert[] = [];
  for (const o of state.orders.filter((x) => x.despacho)) {
    const customer = state.customers.find((c) => c.id === o.customerId)!;
    const balance = orderBalance(state, o);
    const lastPaid = state.applications.filter((a) => a.orderId === o.id).map((a) => a.at.slice(0, 10)).sort().pop() ?? null;
    for (const m of scheduleCollection(o, customer, balance > 0 ? balance : o.saleCents, "M")) {
      const day = m.programadoPara.slice(0, 10);
      if (balance <= 0 && lastPaid && lastPaid <= day) m.estado = "cancelado";
      else if (day <= state.cutDate) {
        m.estado = "enviado";
        m.enviadoAt = m.programadoPara;
        m.intentos = 1;
      }
      messages.push(m);
    }
    const due = dueDateOf(o)!;
    if (balance > 0 && addDays(due, 3) <= state.cutDate) {
      alerts.push({
        id: `AL-${o.id}`,
        orderId: o.id,
        regla: "Mora temprana (+3 días): escalar a administración",
        responsable: ADMIN,
        estado: "abierta",
        creadaAt: `${addDays(due, 3)}T09:00:00`,
        resolucion: null,
        resueltaBy: null,
        resueltaAt: null,
      });
    }
  }
  // Un envío fallido para mostrar el estado ERROR y el reintento.
  const failed = messages.find((m) => m.orderId === "ORD-011" && m.tipo === "mora_temprana");
  if (failed) {
    failed.estado = "error";
    failed.enviadoAt = null;
    failed.intentos = 2;
    failed.error = "Evolution API no confirmó la entrega al contacto de prueba.";
  }
  messages.push(
    {
      id: "M-CONF-V001", customerId: "c-huanca", orderId: "ORD-001", tipo: "confirmacion_pago",
      texto: "Hola Constructora Huancabamba Norte, registramos tu pago de S/ 300.00 para ORD-001. Gracias.",
      estado: "enviado", programadoPara: "2026-10-03T09:13:00", intentos: 1, enviadoAt: "2026-10-03T09:13:00", error: null,
    },
    {
      id: "M-RES-ORD014", customerId: "c-vientos", orderId: "ORD-014", tipo: "resumen_orden",
      texto: "Resumen de ORD-014: 24 casacas, total S/ 720.00. Anticipo 50% (S/ 360.00) y saldo a 30 días desde el despacho.",
      estado: "enviado", programadoPara: "2026-10-08T16:21:00", intentos: 1, enviadoAt: "2026-10-08T16:21:00", error: null,
    },
  );
  state.messages = messages;
  state.alerts = alerts;
  return state;
}
