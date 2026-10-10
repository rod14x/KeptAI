import type { Application, DemoState, Evidence, Order } from "./schemas";

// Semilla ficticia del recorrido de demostración (roadmap-german-frontend.md §6), ampliada
// con historial de clientes. Ninguna cifra es dato real de Corpotex; nombres inventados.
// P-001 y P-002 conservan exactamente las cifras del recorrido acordado.

const base: Omit<Evidence, "id" | "brand" | "kind" | "receivedAt" | "orderId" | "fields" | "declaredAmountCents" | "chat" | "transcript" | "status"> = {
  legible: true,
  validatedBy: null,
  validatedAt: null,
  mismatchAccepted: false,
  verifiedBy: null,
  verifiedAt: null,
  appliedAt: null,
  discardReason: null,
  corrections: [],
};

const ADMIN = "Carmen Ramos";
const REGISTRO = "Jorge Ipanaqué";
const GERENCIA = "Patricia Zapata";

type OrderSeed = Omit<Order, "costs" | "internalChargeCents" | "dispute"> &
  Partial<Pick<Order, "internalChargeCents" | "dispute">> & { costs: Partial<Order["costs"]> };

function order(o: OrderSeed): Order {
  return {
    internalChargeCents: null,
    dispute: null,
    ...o,
    costs: { materiales: 0, manoObra: 0, terceros: 0, indirectos: 0, ...o.costs },
  };
}

function paid(id: string, orderId: string, amountCents: number, at: string, channel: string): Application {
  return { id, evidenceId: null, orderId, amountCents, channel, at, by: ADMIN };
}

export function createSeed(): DemoState {
  return {
    version: 2,
    cutDate: "2026-10-10",
    settings: {
      factorMora: 0,
      termOptions: [15, 30, 45],
      termStartEvent: "entrega",
      alertOffsets: [-3, 0, 3, 7],
      updatedBy: null,
      updatedAt: null,
    },
    people: [
      { id: "u-patricia", name: GERENCIA, email: "patricia.zapata@keptai.pe", role: "gerencia", title: "Gerencia general", brand: null, since: "2024-03-01" },
      { id: "u-carmen", name: ADMIN, email: "carmen.ramos@keptai.pe", role: "administracion", title: "Administración y tesorería", brand: null, since: "2024-08-12" },
      { id: "u-jorge", name: REGISTRO, email: "jorge.ipanaque@keptai.pe", role: "registro", title: "Registro de pagos", brand: null, since: "2025-05-05" },
      { id: "u-rosa", name: "Rosa Chunga", email: "rosa.chunga@keptai.pe", role: "vendedor", title: "Vendedora Corpotex", brand: "corpotex", since: "2023-11-20" },
      { id: "u-luis", name: "Luis Yarlequé", email: "luis.yarleque@keptai.pe", role: "vendedor", title: "Vendedor Unicrack", brand: "unicrack", since: "2024-01-15" },
    ],
    customers: [
      { id: "c-huanca", name: "Constructora Huancabamba Norte", brand: "corpotex", kind: "corporativo", sellerId: "u-rosa", phone: "+51 9•• ••• 214", since: "2025-11-04", creditLimitCents: 150000, termDays: 15 },
      { id: "c-sullana", name: "Agroindustrias Sullana Verde", brand: "corpotex", kind: "corporativo", sellerId: "u-rosa", phone: "+51 9•• ••• 587", since: "2025-06-12", creditLimitCents: 300000, termDays: 30 },
      { id: "c-sechura", name: "Transportes Sechura Sur", brand: "corpotex", kind: "corporativo", sellerId: "u-rosa", phone: "+51 9•• ••• 903", since: "2026-02-20", creditLimitCents: 200000, termDays: 30 },
      { id: "c-tallan", name: "Club Deportivo Tallán", brand: "unicrack", kind: "de_a_pie", sellerId: "u-luis", phone: "+51 9•• ••• 146", since: "2026-03-02", creditLimitCents: 80000, termDays: 15 },
      { id: "c-vientos", name: "Academia Deportiva Cuatro Vientos", brand: "unicrack", kind: "corporativo", sellerId: "u-luis", phone: "+51 9•• ••• 731", since: "2025-09-15", creditLimitCents: 150000, termDays: 30 },
      { id: "c-horizonte", name: "Colegio Nuevo Horizonte", brand: "unicrack", kind: "corporativo", sellerId: "u-luis", phone: "+51 9•• ••• 368", since: "2025-02-10", creditLimitCents: 400000, termDays: 45 },
    ],
    orders: [
      order({
        id: "P-001", customerId: "c-huanca", brand: "corpotex", line: "Uniformes corporativos", description: "Camisas drill con bordado, 12 unidades",
        modality: "propia", saleCents: 30000, costs: { materiales: 20000, manoObra: 8000, indirectos: 6000 }, internalChargeCents: 32000,
        issuedOn: "2026-09-22", deliveredOn: "2026-10-01", dueDate: "2026-10-16", sellerId: "u-rosa",
      }),
      order({
        id: "P-002", customerId: "c-tallan", brand: "unicrack", line: "Unicrack Sport", description: "Camisetas sublimadas, 20 unidades",
        modality: "tercerizada", saleCents: 50000, costs: { terceros: 35000 },
        issuedOn: "2026-09-08", deliveredOn: "2026-09-20", dueDate: "2026-10-05", sellerId: "u-luis",
      }),
      order({
        id: "P-003", customerId: "c-huanca", brand: "corpotex", line: "Uniformes corporativos", description: "Polos piqué con logo, 24 unidades",
        modality: "propia", saleCents: 48000, costs: { materiales: 26000, manoObra: 9000, indirectos: 5000 }, internalChargeCents: 43000,
        issuedOn: "2026-07-28", deliveredOn: "2026-08-08", dueDate: "2026-08-23", sellerId: "u-rosa",
      }),
      order({
        id: "P-004", customerId: "c-sullana", brand: "corpotex", line: "Uniformes industriales", description: "Overoles de drill con cinta reflectiva, 30 unidades",
        modality: "tercerizada", saleCents: 126000, costs: { terceros: 92000 },
        issuedOn: "2026-08-03", deliveredOn: "2026-08-14", dueDate: "2026-09-13", sellerId: "u-rosa",
      }),
      order({
        id: "P-005", customerId: "c-sullana", brand: "corpotex", line: "Uniformes industriales", description: "Camisas manga larga para campo, 40 unidades",
        modality: "propia", saleCents: 98000, costs: { materiales: 52000, manoObra: 18000, indirectos: 9000 }, internalChargeCents: 85000,
        issuedOn: "2026-09-10", deliveredOn: "2026-09-20", dueDate: "2026-10-20", sellerId: "u-rosa",
      }),
      order({
        id: "P-006", customerId: "c-sechura", brand: "corpotex", line: "Uniformes corporativos", description: "Casacas para conductores, 18 unidades",
        modality: "propia", saleCents: 72000, costs: { materiales: 34000, manoObra: 15000, indirectos: 9000 }, internalChargeCents: 62000,
        issuedOn: "2026-07-15", deliveredOn: "2026-07-25", dueDate: "2026-08-24", sellerId: "u-rosa",
      }),
      order({
        id: "P-007", customerId: "c-sechura", brand: "corpotex", line: "Uniformes industriales", description: "Chalecos y pantalones de trabajo, 25 juegos",
        modality: "propia", saleCents: 85000, costs: { materiales: 41000, manoObra: 17000, indirectos: 8000 }, internalChargeCents: 71000,
        issuedOn: "2026-08-18", deliveredOn: "2026-08-22", dueDate: "2026-09-21", sellerId: "u-rosa",
      }),
      order({
        id: "P-008", customerId: "c-tallan", brand: "unicrack", line: "Unicrack Sport", description: "Shorts y medias de entrenamiento, 20 juegos",
        modality: "tercerizada", saleCents: 36000, costs: { terceros: 25000 },
        issuedOn: "2026-08-20", deliveredOn: "2026-08-28", dueDate: "2026-09-12", sellerId: "u-luis",
      }),
      order({
        id: "P-009", customerId: "c-vientos", brand: "unicrack", line: "Unicrack Sport", description: "Buzos deportivos sublimados, 32 unidades",
        modality: "tercerizada", saleCents: 64000, costs: { terceros: 47000 },
        issuedOn: "2026-08-30", deliveredOn: "2026-09-13", dueDate: "2026-10-13", sellerId: "u-luis",
      }),
      order({
        id: "P-010", customerId: "c-vientos", brand: "unicrack", line: "Unicrack Sport", description: "Camisetas de competencia, 30 unidades",
        modality: "tercerizada", saleCents: 58000, costs: { terceros: 41000 },
        issuedOn: "2026-06-10", deliveredOn: "2026-06-20", dueDate: "2026-07-20", sellerId: "u-luis",
      }),
      order({
        id: "P-011", customerId: "c-horizonte", brand: "unicrack", line: "Unicrack Uniformes", description: "Buzos escolares, 60 unidades",
        modality: "tercerizada", saleCents: 120000, costs: { terceros: 88000 },
        issuedOn: "2026-07-20", deliveredOn: "2026-08-01", dueDate: "2026-09-15", sellerId: "u-luis",
        dispute: { since: "2026-09-18", note: "Reclamo por tallas en 30 buzos. En revisión con el taller tercero." },
      }),
      order({
        id: "P-012", customerId: "c-horizonte", brand: "unicrack", line: "Unicrack Uniformes", description: "Uniformes de gala escolar, 50 juegos",
        modality: "tercerizada", saleCents: 150000, costs: { terceros: 108000 },
        issuedOn: "2026-09-05", deliveredOn: "2026-09-13", dueDate: "2026-10-28", sellerId: "u-luis",
      }),
    ],
    evidences: [
      {
        ...base,
        id: "V-001",
        brand: "corpotex",
        kind: "voucher",
        receivedAt: "2026-10-02T16:40:00",
        orderId: "P-001",
        fields: { amountCents: 30000, operationRef: "48213307", payer: "Constructora Huancabamba Norte", paidAt: "02/10/2026 16:31", channel: "Yape" },
        declaredAmountCents: 30000,
        chat: [
          { from: "cliente", text: "Buenas tardes, le yapeé los 300 de las camisas.", time: "16:38" },
          { from: "cliente", text: "Comprobante", time: "16:38", attachment: true },
          { from: "vendedor", text: "Gracias, lo paso a administración.", time: "16:40" },
        ],
        transcript: null,
        status: "pago_aplicado",
        validatedBy: REGISTRO,
        validatedAt: "2026-10-02T17:05:00",
        verifiedBy: ADMIN,
        verifiedAt: "2026-10-03T09:10:00",
        appliedAt: "2026-10-03T09:12:00",
      },
      {
        ...base,
        id: "V-002",
        brand: "unicrack",
        kind: "voucher",
        receivedAt: "2026-10-09T09:14:00",
        orderId: "P-002",
        fields: { amountCents: 10000, operationRef: "00927714", payer: "Club Deportivo Tallán", paidAt: "09/10/2026 09:05", channel: "Transferencia BCP" },
        declaredAmountCents: 10000,
        chat: [
          { from: "cliente", text: "Buen día, le hago un adelanto de 100 soles por las camisetas del club.", time: "09:12" },
          { from: "cliente", text: "Voucher de la transferencia", time: "09:13", attachment: true },
          { from: "vendedor", text: "Recibido, lo validamos y le confirmo.", time: "09:14" },
        ],
        transcript: null,
        status: "comprobante_pendiente",
      },
      {
        ...base,
        id: "V-003",
        brand: "unicrack",
        kind: "voucher",
        receivedAt: "2026-10-09T18:02:00",
        orderId: "P-002",
        fields: { amountCents: 10000, operationRef: "00927714", payer: "Club Deportivo Tallán", paidAt: "09/10/2026 09:05", channel: "Transferencia BCP" },
        declaredAmountCents: 10000,
        chat: [
          { from: "cliente", text: "Le reenvío el voucher de la mañana por si no le llegó.", time: "18:01" },
          { from: "cliente", text: "Voucher de la transferencia", time: "18:02", attachment: true },
        ],
        transcript: null,
        status: "comprobante_pendiente",
      },
      {
        ...base,
        id: "V-004",
        brand: "unicrack",
        kind: "voucher",
        receivedAt: "2026-10-09T20:47:00",
        orderId: null,
        fields: { amountCents: 25000, operationRef: "7731045", payer: "Marco Sernaqué", paidAt: "09/10/2026 20:45", channel: "Plin" },
        declaredAmountCents: null,
        chat: [
          { from: "cliente", text: "Pago de los polos, gracias.", time: "20:46" },
          { from: "cliente", text: "Captura de Plin", time: "20:47", attachment: true },
        ],
        transcript: null,
        status: "comprobante_pendiente",
      },
      {
        ...base,
        id: "V-005",
        brand: "unicrack",
        kind: "voucher",
        receivedAt: "2026-10-10T08:21:00",
        orderId: "P-002",
        fields: { amountCents: 18000, operationRef: "5520198", payer: "Club Deportivo Tallán", paidAt: "10/10/2026 08:19", channel: "Yape" },
        declaredAmountCents: 20000,
        chat: [
          { from: "cliente", text: "Le mando 200 por Yape a cuenta del saldo.", time: "08:20" },
          { from: "cliente", text: "Captura de Yape", time: "08:21", attachment: true },
        ],
        transcript: null,
        status: "comprobante_pendiente",
      },
      {
        ...base,
        id: "V-006",
        brand: "corpotex",
        kind: "voucher",
        receivedAt: "2026-10-10T10:05:00",
        orderId: null,
        fields: { amountCents: null, operationRef: null, payer: null, paidAt: null, channel: "Yape" },
        declaredAmountCents: null,
        legible: false,
        chat: [
          { from: "cliente", text: "Ahí le mandé.", time: "10:04" },
          { from: "cliente", text: "Foto del comprobante (borrosa)", time: "10:05", attachment: true },
        ],
        transcript: null,
        status: "borrador",
      },
      {
        ...base,
        id: "N-001",
        brand: "unicrack",
        kind: "audio",
        receivedAt: "2026-10-10T11:32:00",
        orderId: "P-002",
        fields: { amountCents: 15000, operationRef: null, payer: "Club Deportivo Tallán", paidAt: null, channel: "Transferencia" },
        declaredAmountCents: 15000,
        chat: [],
        transcript:
          "Hola, le habla el delegado del Club Tallán. Ya le transferí ciento cincuenta soles por lo de las camisetas, el número de operación se lo paso más tarde.",
        status: "borrador",
      },
    ],
    applications: [
      { id: "A-001", evidenceId: "V-001", orderId: "P-001", amountCents: 30000, channel: "Yape", at: "2026-10-03T09:12:00", by: ADMIN },
      paid("A-H01", "P-003", 48000, "2026-08-21T11:20:00", "Transferencia BCP"),
      paid("A-H02", "P-004", 126000, "2026-09-25T10:05:00", "Transferencia BBVA"),
      paid("A-H03", "P-005", 40000, "2026-09-22T15:40:00", "Transferencia BCP"),
      paid("A-H04", "P-006", 72000, "2026-09-02T09:30:00", "Depósito en cuenta"),
      paid("A-H05", "P-008", 36000, "2026-09-12T18:10:00", "Yape"),
      paid("A-H06", "P-010", 58000, "2026-07-18T12:00:00", "Transferencia Interbank"),
      paid("A-H07", "P-011", 50000, "2026-08-05T10:45:00", "Transferencia BCP"),
      paid("A-H08", "P-012", 60000, "2026-09-15T16:25:00", "Transferencia BCP"),
    ],
    creditRequests: [
      {
        id: "CR-001", customerId: "c-sullana", requestedBy: "Rosa Chunga", requestedAt: "2026-09-08T10:20:00", amountCents: 98000, termDays: 30,
        reason: "Pedido P-005: camisas de campo para la campaña de mango.", status: "aprobada", decidedBy: GERENCIA, decidedAt: "2026-09-08T16:05:00",
        decisionNote: "Cliente al día. Se acuerda anticipo de S/ 400.",
      },
      {
        id: "CR-002", customerId: "c-sechura", requestedBy: "Rosa Chunga", requestedAt: "2026-10-06T11:15:00", amountCents: 54000, termDays: 30,
        reason: "Reposición de 20 chalecos.", status: "rechazada", decidedBy: GERENCIA, decidedAt: "2026-10-06T17:30:00",
        decisionNote: "Mantiene P-007 vencido. Se ofrece pago contra entrega.",
      },
      {
        id: "CR-003", customerId: "c-tallan", requestedBy: "Luis Yarlequé", requestedAt: "2026-10-10T09:40:00", amountCents: 60000, termDays: 15,
        reason: "Nuevo pedido: 30 camisetas para el campeonato regional.", status: "pendiente", decidedBy: null, decidedAt: null, decisionNote: null,
      },
    ],
    shareLinks: [],
    audit: [
      { id: "E-01", at: "2026-09-20T12:00:00", by: "Luis Yarlequé", kind: "entregado", brand: "unicrack", evidenceId: null, orderId: "P-002", amountCents: 50000, text: "Pedido entregado" },
      { id: "E-02", at: "2026-10-01T15:00:00", by: "Rosa Chunga", kind: "entregado", brand: "corpotex", evidenceId: null, orderId: "P-001", amountCents: 30000, text: "Pedido entregado" },
      { id: "E-03", at: "2026-10-03T09:12:00", by: ADMIN, kind: "aplicado", brand: "corpotex", evidenceId: "V-001", orderId: "P-001", amountCents: 30000, text: "Pago aplicado" },
      { id: "E-04", at: "2026-10-09T09:14:00", by: "Luis Yarlequé", kind: "recibido", brand: "unicrack", evidenceId: "V-002", orderId: "P-002", amountCents: 10000, text: "Comprobante recibido" },
      { id: "E-05", at: "2026-10-09T18:02:00", by: "Luis Yarlequé", kind: "recibido", brand: "unicrack", evidenceId: "V-003", orderId: "P-002", amountCents: 10000, text: "Comprobante recibido" },
      { id: "E-06", at: "2026-10-09T20:47:00", by: "Luis Yarlequé", kind: "recibido", brand: "unicrack", evidenceId: "V-004", orderId: null, amountCents: 25000, text: "Comprobante sin pedido" },
      { id: "E-07", at: "2026-10-10T08:21:00", by: "Luis Yarlequé", kind: "recibido", brand: "unicrack", evidenceId: "V-005", orderId: "P-002", amountCents: 18000, text: "Comprobante recibido" },
      { id: "E-08", at: "2026-10-10T10:05:00", by: "Rosa Chunga", kind: "borrador", brand: "corpotex", evidenceId: "V-006", orderId: null, amountCents: null, text: "Imagen ilegible en revisión" },
      { id: "E-09", at: "2026-10-10T11:32:00", by: "Luis Yarlequé", kind: "borrador", brand: "unicrack", evidenceId: "N-001", orderId: "P-002", amountCents: 15000, text: "Nota de voz transcrita" },
      { id: "E-10", at: "2026-10-02T17:05:00", by: REGISTRO, kind: "validado", brand: "corpotex", evidenceId: "V-001", orderId: "P-001", amountCents: 30000, text: "Evidencia validada" },
      { id: "E-11", at: "2026-10-03T09:10:00", by: ADMIN, kind: "verificado", brand: "corpotex", evidenceId: "V-001", orderId: "P-001", amountCents: 30000, text: "Fondos verificados (simulado)" },
      { id: "E-12", at: "2026-09-08T10:20:00", by: "Rosa Chunga", kind: "credito_solicitado", brand: "corpotex", evidenceId: null, orderId: null, customerId: "c-sullana", amountCents: 98000, text: "Solicitud de crédito CR-001" },
      { id: "E-13", at: "2026-09-08T16:05:00", by: GERENCIA, kind: "credito_aprobado", brand: "corpotex", evidenceId: null, orderId: null, customerId: "c-sullana", amountCents: 98000, text: "Crédito aprobado CR-001" },
      { id: "E-14", at: "2026-10-06T11:15:00", by: "Rosa Chunga", kind: "credito_solicitado", brand: "corpotex", evidenceId: null, orderId: null, customerId: "c-sechura", amountCents: 54000, text: "Solicitud de crédito CR-002" },
      { id: "E-15", at: "2026-10-06T17:30:00", by: GERENCIA, kind: "credito_rechazado", brand: "corpotex", evidenceId: null, orderId: null, customerId: "c-sechura", amountCents: 54000, text: "Crédito rechazado CR-002" },
      { id: "E-16", at: "2026-10-10T09:40:00", by: "Luis Yarlequé", kind: "credito_solicitado", brand: "unicrack", evidenceId: null, orderId: null, customerId: "c-tallan", amountCents: 60000, text: "Solicitud de crédito CR-003" },
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
}
