import { PLAZO_MAX, PLAZO_MIN, type AuditEvent, type Evidence, type FieldKey, type Order, type OutgoingMessage, type Person, type Settings } from "../model";
import { DemoStateSchema, type DemoState } from "./state";
import { createSeed } from "./seed";
import { bump } from "../events";
import { addDays, anticipoRequired, appliedCents, creditSnapshot, gatekeeperPasses, matchFor, orderBalance, orderCost, scheduleCollection } from "./domain";

const orderCostKnown = (o: Order) => orderCost(o) > 0;
import { can, ROLE_LABEL, type Permission } from "../../lib/permissions";
import { formatMoney } from "../../lib/format";

// MOCK: backend simulado en el navegador mientras Spring no está disponible. Eliminar al integrar.
// Se guarda en localStorage para sobrevivir a recargas y compartirse entre pestañas
// (por ejemplo, el enlace de estado de cuenta abierto en otra pestaña).

const STORAGE_KEY = "keptai-demo-v4";

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = DemoStateSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {
    // Almacenamiento bloqueado o corrupto: se vuelve a la semilla.
  }
  return createSeed();
}

let state: DemoState = load();

function commit(next: DemoState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin persistencia: la demo sigue funcionando en memoria.
  }
  bump();
}

// Otra pestaña cambió la demo: recargar y avisar a los suscriptores.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    bump();
  });
}

export function getState() {
  return state;
}

export type ActionResult = { ok: true; message: string } | { ok: false; message: string; code?: "aviso_mora" };

const fail = (message: string, code?: "aviso_mora"): ActionResult => ({ ok: false, message, code });
const done = (message: string): ActionResult => ({ ok: true, message });

export function nowIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function event(kind: AuditEvent["kind"], by: string, text: string, extra: Partial<AuditEvent>): AuditEvent {
  return { id: uid("E"), at: nowIso(), by, kind, brand: null, evidenceId: null, orderId: null, customerId: null, amountCents: null, text, ...extra };
}

function evEvent(ev: Evidence, kind: AuditEvent["kind"], by: string, text: string, amountCents = ev.fields.amountCents): AuditEvent {
  return event(kind, by, text, { brand: ev.brand, evidenceId: ev.id, orderId: ev.orderId, amountCents });
}

function message(customerId: string, orderId: string | null, tipo: OutgoingMessage["tipo"]): OutgoingMessage {
  // En la demo el envío por WF3 se simula como inmediato al contacto de prueba. La BD no guarda el texto.
  const at = nowIso();
  return { id: uid("M"), customerId, orderId, tipo, estado: "enviado", programadoPara: at, intentos: 1, enviadoAt: at, error: null };
}

function updateEvidence(id: string, fn: (ev: Evidence) => Evidence, events: AuditEvent[] = []) {
  commit({ ...state, evidences: state.evidences.map((e) => (e.id === id ? fn(e) : e)), audit: [...state.audit, ...events] });
}

const findEv = (id: string) => state.evidences.find((e) => e.id === id) ?? null;
const findOrder = (id: string) => state.orders.find((o) => o.id === id) ?? null;

/** Permiso del rol y, para vendedores, que el registro sea de su marca. */
function guard(actor: Person, permission: Permission, brand?: string | null): ActionResult | null {
  if (!can(actor.role, permission)) return fail(`Tu rol (${ROLE_LABEL[actor.role]}) no permite esta acción.`);
  if (actor.role === "vendedor" && brand && actor.brand !== brand) return fail("Solo puedes actuar sobre clientes de tu marca.");
  return null;
}

function nextId(prefix: string, ids: string[]) {
  const n = ids.filter((i) => i.startsWith(prefix)).map((i) => Number(i.slice(prefix.length)) || 0);
  return `${prefix}${String(Math.max(0, ...n) + 1).padStart(3, "0")}`;
}

export type PaymentTerms = { tipo: "contado" | "anticipo" | "credito"; plazoDias: number; anticipoPct: number | null };

export const actions = {
  /* ---------- Conciliación ---------- */

  editField(id: string, field: FieldKey, raw: string, actor: Person): ActionResult {
    const ev = findEv(id);
    if (!ev) return fail("No se encontró el comprobante.");
    const denied = guard(actor, "editar_evidencia");
    if (denied) return denied;
    if (ev.status !== "recibido") return fail("Un pago verificado ya no se edita. Registra una corrección con un ajuste auditado.");
    const prev = ev.fields[field];
    let next: string | number | null = raw.trim() === "" ? null : raw.trim();
    if (field === "amountCents" && next !== null) {
      const n = Number(String(next).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) return fail("El monto debe ser un número mayor que cero.");
      next = Math.round(n * 100);
    }
    if (String(prev ?? "") === String(next ?? "")) return done("Sin cambios.");
    updateEvidence(
      id,
      (e) => ({
        ...e,
        fields: { ...e.fields, [field]: next },
        mismatchAccepted: field === "amountCents" ? false : e.mismatchAccepted,
        corrections: [...e.corrections, { field, from: prev == null ? null : String(prev), to: next == null ? null : String(next), by: actor.name, at: nowIso() }],
      }),
      [evEvent(ev, "corregido", actor.name, `Campo corregido: ${field === "amountCents" ? "monto" : field}`)],
    );
    return done("Campo actualizado. Queda registrado quién lo corrigió y cuándo.");
  },

  assignOrder(id: string, orderId: string, actor: Person): ActionResult {
    const ev = findEv(id);
    if (!ev) return fail("No se encontró el comprobante.");
    const denied = guard(actor, "editar_evidencia");
    if (denied) return denied;
    if (!findOrder(orderId)) return fail("Orden no válida.");
    updateEvidence(id, (e) => ({ ...e, orderId }), [evEvent(ev, "corregido", actor.name, `Vinculado a ${orderId}`)]);
    return done(`Comprobante vinculado a ${orderId}.`);
  },

  verifyFunds(id: string, actor: Person, acceptMismatch = false): ActionResult {
    const ev = findEv(id);
    if (!ev) return fail("No se encontró el comprobante.");
    const denied = guard(actor, "verificar");
    if (denied) return denied;
    if (ev.status !== "recibido") return fail("Este pago ya fue verificado.");
    const match = matchFor(state, ev);
    if (match === "duplicado") return fail("Es un duplicado: márcalo como tal, no se verifica.");
    if (match === "sin_orden") return fail("Vincula una orden antes de verificar.");
    if (match === "incompleto") return fail("Faltan datos del comprobante.");
    if (match === "excede") return fail("El monto supera el saldo de la orden. Un sobrepago requiere una regla acordada.");
    if (match === "no_cuadra" && !acceptMismatch) return fail("Confirma la diferencia de monto antes de verificar.");
    updateEvidence(id, (e) => ({ ...e, status: "verificado_banco", verifiedBy: actor.name, verifiedAt: nowIso(), mismatchAccepted: e.mismatchAccepted || acceptMismatch }), [
      evEvent(ev, "verificado", actor.name, "Verificado en banco"),
    ]);
    return done("Pago verificado en banco. Ya puedes aplicarlo a la orden.");
  },

  /** Transacción única: aplicación + auditoría + cancelación de alertas y mensajes + gatekeeper. */
  applyPayment(id: string, actor: Person): ActionResult {
    const ev = findEv(id);
    if (!ev) return fail("No se encontró el comprobante.");
    // Idempotente: aplicar de nuevo no duplica el pago.
    if (ev.status === "aplicado" || state.applications.some((a) => a.evidenceId === id)) return fail("Este pago ya fue aplicado. No se vuelve a sumar.");
    const denied = guard(actor, "aplicar");
    if (denied) return denied;
    if (ev.status !== "verificado_banco") return fail("Solo se aplica un pago verificado en banco.");
    const order = ev.orderId ? findOrder(ev.orderId) : null;
    if (!order || ev.fields.amountCents == null) return fail("El pago no tiene orden o monto.");
    const balance = orderBalance(state, order);
    if (ev.fields.amountCents > balance) return fail("El monto supera el saldo pendiente de la orden.");

    const at = nowIso();
    const amount = ev.fields.amountCents;
    const left = balance - amount;
    const customer = state.customers.find((c) => c.id === order.customerId)!;
    let next: DemoState = {
      ...state,
      evidences: state.evidences.map((e) => (e.id === id ? { ...e, status: "aplicado", appliedAt: at } : e)),
      applications: [...state.applications, { id: uid("A"), evidenceId: id, orderId: order.id, amountCents: amount, channel: ev.fields.channel ?? "Sin canal", at, by: actor.name }],
      audit: [...state.audit, evEvent(ev, "aplicado", actor.name, "Pago aplicado")],
      messages: [...state.messages, message(customer.id, order.id, "confirmacion_pago")],
    };
    const notes: string[] = [];
    if (left === 0) {
      next = {
        ...next,
        messages: next.messages.map((m) => (m.orderId === order.id && m.estado === "pendiente" ? { ...m, estado: "cancelado" } : m)),
        alerts: next.alerts.map((a) => (a.orderId === order.id && a.estado === "abierta" ? { ...a, estado: "cancelada", resolucion: "Pago completo aplicado", resueltaBy: actor.name, resueltaAt: at } : a)),
      };
      notes.push("sus recordatorios y alertas se cancelan");
    }
    // Gatekeeper: el anticipo verificado libera la orden retenida.
    const updated = next.orders.find((o) => o.id === order.id)!;
    if (updated.estado === "retenida" && gatekeeperPasses(next, updated)) {
      next = {
        ...next,
        orders: next.orders.map((o) => (o.id === order.id ? { ...o, estado: "en_produccion", inicioProduccion: next.cutDate } : o)),
        audit: [...next.audit, event("produccion", actor.name, "Anticipo verificado: liberada a producción", { brand: order.brand, orderId: order.id, customerId: order.customerId })],
      };
      notes.push("el anticipo está cubierto y la orden pasa a producción");
    }
    commit(next);
    return done(`Pago aplicado. Saldo de ${order.id}: ${formatMoney(left)}${notes.length ? `; ${notes.join(" y ")}` : ""}.`);
  },

  markDuplicate(id: string, actor: Person): ActionResult {
    const ev = findEv(id);
    if (!ev) return fail("No se encontró el comprobante.");
    const denied = guard(actor, "verificar");
    if (denied) return denied;
    if (matchFor(state, ev) !== "duplicado") return fail("Este comprobante no figura como duplicado.");
    updateEvidence(id, (e) => ({ ...e, status: "descartado", discardReason: "Duplicado" }), [evEvent(ev, "duplicado", actor.name, "Marcado como duplicado, no reduce el saldo")]);
    return done("Marcado como duplicado. El saldo de la orden no cambia.");
  },

  discard(id: string, actor: Person, reason: string): ActionResult {
    const ev = findEv(id);
    if (!ev) return fail("No se encontró el comprobante.");
    const denied = guard(actor, "descartar");
    if (denied) return denied;
    if (ev.status === "aplicado") return fail("Un pago aplicado no se descarta; se corrige con un ajuste auditado.");
    updateEvidence(id, (e) => ({ ...e, status: "descartado", discardReason: reason }), [evEvent(ev, "descartado", actor.name, `Descartado: ${reason}`)]);
    return done("Comprobante descartado. Queda en el historial.");
  },

  /* ---------- Órdenes ---------- */

  /**
   * Equivale a `/ok ORD-123`: el vendedor fija la condición de pago, aprueba el crédito y confirma la hoja.
   * Si el cliente está en mora, la primera llamada devuelve `aviso_mora`: la UI muestra el aviso y el
   * vendedor decide. La mora no bloquea (D-005).
   */
  confirmOrder(orderId: string, terms: PaymentTerms, actor: Person, opts: { moraAcknowledged: boolean; nota: string | null }): ActionResult {
    const order = findOrder(orderId);
    if (!order) return fail("Orden no encontrada.");
    const denied = guard(actor, "confirmar_orden", order.brand) ?? guard(actor, "aprobar_credito", order.brand);
    if (denied) return denied;
    if (order.estado !== "pendiente_aprobacion") return fail("Esta orden ya fue confirmada o rechazada.");
    if (terms.tipo !== "contado" && (terms.plazoDias < PLAZO_MIN || terms.plazoDias > PLAZO_MAX)) return fail(`El plazo va de ${PLAZO_MIN} a ${PLAZO_MAX} días.`);
    if (terms.tipo === "anticipo" && (!terms.anticipoPct || terms.anticipoPct <= 0 || terms.anticipoPct >= 100)) return fail("El anticipo debe estar entre 1% y 99%.");
    const customer = state.customers.find((c) => c.id === order.customerId)!;
    const snap = creditSnapshot(state, customer);
    const enMora = snap.status === "en_mora";
    if (enMora && terms.tipo !== "contado" && !opts.moraAcknowledged) return fail(snap.aviso ?? "Cliente en mora.", "aviso_mora");

    const at = nowIso();
    const condicion = { tipo: terms.tipo, plazoDias: terms.tipo === "contado" ? 0 : terms.plazoDias, anticipoPct: terms.tipo === "anticipo" ? terms.anticipoPct : null };
    let updated: Order = {
      ...order,
      condicionPago: condicion,
      credito: { decision: "aprobado", by: actor.name, at, avisoMoraMostrado: enMora, saldoReferenciaCents: snap.usedCents, nota: opts.nota },
      hoja: order.hoja ? { ...order.hoja, estado: "confirmada", revisadoPor: actor.name, revisadoAt: at } : null,
    };
    const passes = gatekeeperPasses(state, updated);
    updated = { ...updated, estado: passes ? "en_produccion" : "retenida", inicioProduccion: passes ? state.cutDate : null };
    const resumen =
      terms.tipo === "credito"
        ? `crédito a ${condicion.plazoDias} días desde el despacho`
        : terms.tipo === "anticipo"
          ? `anticipo ${condicion.anticipoPct}% (${formatMoney(anticipoRequired(updated))}) y saldo a ${condicion.plazoDias} días`
          : "pago al contado antes de producir";
    commit({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? updated : o)),
      messages: [...state.messages, message(customer.id, orderId, "resumen_orden")],
      audit: [
        ...state.audit,
        event("credito_aprobado", actor.name, enMora ? "Crédito aprobado tras aviso de mora" : `Condición aprobada: ${resumen}`, { brand: order.brand, orderId, customerId: customer.id, amountCents: order.saleCents }),
        event("orden_confirmada", actor.name, passes ? "Orden confirmada y liberada a producción" : "Orden confirmada; retenida hasta verificar el anticipo", { brand: order.brand, orderId, customerId: customer.id }),
      ],
    });
    return done(passes ? `${orderId} confirmada y liberada a producción. El cliente recibe el resumen.` : `${orderId} confirmada. Queda retenida hasta verificar ${formatMoney(anticipoRequired(updated))}.`);
  },

  rejectOrder(orderId: string, nota: string, actor: Person): ActionResult {
    const order = findOrder(orderId);
    if (!order) return fail("Orden no encontrada.");
    const denied = guard(actor, "aprobar_credito", order.brand);
    if (denied) return denied;
    if (order.estado !== "pendiente_aprobacion") return fail("Esta orden ya fue decidida.");
    if (nota.trim().length < 5) return fail("Registra el motivo.");
    const customer = state.customers.find((c) => c.id === order.customerId)!;
    const snap = creditSnapshot(state, customer);
    commit({
      ...state,
      orders: state.orders.map((o) =>
        o.id === orderId
          ? { ...o, estado: "rechazada", credito: { decision: "rechazado", by: actor.name, at: nowIso(), avisoMoraMostrado: snap.status === "en_mora", saldoReferenciaCents: snap.usedCents, nota: nota.trim() } }
          : o,
      ),
      audit: [...state.audit, event("credito_rechazado", actor.name, `Crédito rechazado: ${nota.trim()}`, { brand: order.brand, orderId, customerId: customer.id, amountCents: order.saleCents })],
    });
    return done(`${orderId} rechazada. Queda registrado el motivo.`);
  },

  /** El acta de despacho fija el vencimiento (despacho + plazo) y programa la cobranza −3/0/+3. */
  registerDispatch(orderId: string, fecha: string, acta: string, actor: Person): ActionResult {
    const order = findOrder(orderId);
    if (!order) return fail("Orden no encontrada.");
    const denied = guard(actor, "registrar_despacho");
    if (denied) return denied;
    if (order.estado !== "en_produccion") return fail("Solo se despacha una orden en producción.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail("Indica la fecha de despacho.");
    if (order.inicioProduccion && fecha < order.inicioProduccion) return fail("El despacho no puede ser anterior al inicio de producción.");
    if (acta.trim().length < 3) return fail("Indica el número de acta o guía.");
    const customer = state.customers.find((c) => c.id === order.customerId)!;
    const updated: Order = { ...order, estado: "despachada", costOrigin: "real", costComplete: orderCostKnown(order), despacho: { fecha, acta: acta.trim(), by: actor.name } };
    const balance = orderBalance(state, updated);
    const scheduled = balance > 0 ? scheduleCollection(updated, customer, uid("M")) : [];
    commit({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? updated : o)),
      messages: [...state.messages, ...scheduled],
      audit: [...state.audit, event("despacho", actor.name, `Despacho registrado (${acta.trim()})`, { brand: order.brand, orderId, customerId: customer.id, amountCents: order.saleCents })],
    });
    const due = addDays(fecha, updated.condicionPago?.plazoDias ?? 0);
    return done(balance > 0 ? `Despacho registrado. Vence el ${due.split("-").reverse().join("/")}; se programaron 3 recordatorios.` : "Despacho registrado. La orden ya estaba pagada.");
  },

  /* ---------- Cobranza ---------- */

  resolveAlert(alertId: string, resolucion: string, actor: Person): ActionResult {
    const a = state.alerts.find((x) => x.id === alertId);
    if (!a) return fail("Alerta no encontrada.");
    const denied = guard(actor, "gestionar_cobranza");
    if (denied) return denied;
    if (a.estado !== "abierta") return fail("La alerta ya está cerrada.");
    if (resolucion.trim().length < 5) return fail("Describe qué se acordó con el cliente.");
    const order = findOrder(a.orderId);
    const at = nowIso();
    commit({
      ...state,
      alerts: state.alerts.map((x) => (x.id === alertId ? { ...x, estado: "resuelta", resolucion: resolucion.trim(), resueltaBy: actor.name, resueltaAt: at } : x)),
      audit: [...state.audit, event("alerta_resuelta", actor.name, `Alerta resuelta: ${resolucion.trim()}`, { brand: order?.brand ?? null, orderId: a.orderId, customerId: order?.customerId ?? null })],
    });
    return done("Alerta resuelta. Queda la resolución con tu nombre y la hora.");
  },

  retryMessage(id: string, actor: Person): ActionResult {
    const m = state.messages.find((x) => x.id === id);
    if (!m) return fail("Mensaje no encontrado.");
    const denied = guard(actor, "gestionar_cobranza");
    if (denied) return denied;
    if (m.estado !== "error") return fail("Solo se reintenta un envío con error.");
    const at = nowIso();
    commit({
      ...state,
      messages: state.messages.map((x) => (x.id === id ? { ...x, estado: "enviado", intentos: x.intentos + 1, enviadoAt: at, error: null } : x)),
      audit: [...state.audit, event("mensaje", actor.name, "Reintento de envío por WhatsApp", { orderId: m.orderId, customerId: m.customerId })],
    });
    return done("Reintento enviado al contacto de prueba (simulado en la demo).");
  },



  /* ---------- Captura manual (respaldo de WhatsApp) ---------- */

  captureVoucher(
    input: { brand: "corpotex" | "unicrack"; orderId: string | null; amountCents: number; operationRef: string; payer: string; paidAt: string; channel: string },
    actor: Person,
  ): ActionResult & { id?: string } {
    const denied = guard(actor, "captura", input.brand);
    if (denied) return denied;
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return fail("Indica el monto del comprobante.");
    if (input.operationRef.trim().length < 4) return fail("Indica el número de operación.");
    const id = nextId("V-", state.evidences.map((e) => e.id));
    const ev: Evidence = {
      id,
      ref: id,
      brand: input.brand,
      kind: "voucher",
      origen: "manual",
      evidenceIds: [],
      dataOrigin: "manual_entry",
      receivedAt: nowIso(),
      orderId: input.orderId,
      fields: { amountCents: input.amountCents, operationRef: input.operationRef.trim(), payer: input.payer.trim() || null, paidAt: input.paidAt || null, channel: input.channel },
      declaredAmountCents: null,
      legible: true,
      status: "recibido",
      mismatchAccepted: false,
      verifiedBy: null,
      verifiedAt: null,
      appliedAt: null,
      discardReason: null,
      corrections: [],
    };
    commit({ ...state, evidences: [...state.evidences, ev], audit: [...state.audit, evEvent(ev, "recibido", actor.name, "Comprobante cargado a mano")] });
    return { ok: true, message: `${id} registrado como recibido. Administración lo verifica en su banca.`, id };
  },

  captureOrder(
    input: { customerId: string; description: string; cantidad: number; totalCents: number; entrega: string | null },
    actor: Person,
  ): ActionResult & { id?: string } {
    const c = state.customers.find((x) => x.id === input.customerId);
    if (!c) return fail("Elige un cliente.");
    const denied = guard(actor, "captura", c.brand);
    if (denied) return denied;
    if (input.description.trim().length < 3) return fail("Describe el pedido.");
    if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) return fail("Indica la cantidad.");
    if (!Number.isInteger(input.totalCents) || input.totalCents <= 0) return fail("Indica el total.");
    const id = nextId("ORD-", state.orders.map((o) => o.id));
    const faltantes = ["costos estimados", ...(input.entrega ? [] : ["fecha de entrega"])];
    const o: Order = {
      id,
      ref: id,
      dataOrigin: "manual_entry",
      costComplete: false,
      customerId: c.id,
      brand: c.brand,
      line: c.brand === "corpotex" ? "Profesional" : c.tipo === "colegio" ? "Escolar" : "Deportivo",
      description: input.description.trim(),
      items: [{ descripcion: input.description.trim(), cantidad: input.cantidad, detalle: "Cargado a mano", precioUnitCents: Math.round(input.totalCents / input.cantidad) }],
      modality: "tercerizada",
      saleCents: input.totalCents,
      costs: { materiales: 0, manoObra: 0, terceros: 0, indirectos: 0 },
      costOrigin: "teorico",
      internalChargeCents: null,
      sellerId: c.sellerId,
      estado: "pendiente_aprobacion",
      condicionPago: null,
      credito: null,
      hoja: {
        version: 1,
        origen: "manual",
        campos: [
          { campo: "Cliente", valor: c.name, estado: "present" },
          { campo: "Producto", valor: input.description.trim(), estado: "present" },
          { campo: "Cantidad", valor: String(input.cantidad), estado: "present" },
          { campo: "Monto", valor: formatMoney(input.totalCents), estado: "present" },
          { campo: "Entrega solicitada", valor: input.entrega, estado: input.entrega ? "present" : "missing" },
        ],
        faltantes,
        confianza: null,
        estado: "borrador",
        revisadoPor: null,
        revisadoAt: null,
      },
      issuedOn: state.cutDate,
      fechaEntregaSolicitada: input.entrega,
      inicioProduccion: null,
      despacho: null,
    };
    commit({ ...state, orders: [...state.orders, o], audit: [...state.audit, event("orden_ingresada", actor.name, "Orden cargada a mano", { brand: c.brand, orderId: id, customerId: c.id, amountCents: o.saleCents })] });
    return { ok: true, message: `${id} creada como borrador. El vendedor la confirma y define la condición de pago.`, id };
  },

  /* ---------- Configuración ---------- */

  updateSettings(patch: Partial<Pick<Settings, "factorCobro" | "plazoDefecto">>, actor: Person): ActionResult {
    const denied = guard(actor, "configurar");
    if (denied) return denied;
    if (patch.factorCobro != null && (patch.factorCobro < 0.1 || patch.factorCobro > 1)) return fail("El factor de cobro va de 10% a 100%.");
    if (patch.plazoDefecto != null && (patch.plazoDefecto < PLAZO_MIN || patch.plazoDefecto > PLAZO_MAX)) return fail(`El plazo va de ${PLAZO_MIN} a ${PLAZO_MAX} días.`);
    commit({
      ...state,
      settings: { ...state.settings, ...patch, updatedBy: actor.name, updatedAt: nowIso() },
      audit: [...state.audit, event("configuracion", actor.name, "Supuestos actualizados", {})],
    });
    return done("Supuestos guardados. Las proyecciones se recalculan con estos valores.");
  },

  setInternalCharge(orderId: string, cents: number, actor: Person): ActionResult {
    const denied = guard(actor, "configurar");
    if (denied) return denied;
    const o = findOrder(orderId);
    if (!o || o.modality !== "propia") return fail("Solo las órdenes de producción propia tienen cargo interno.");
    if (!Number.isInteger(cents) || cents < 0) return fail("Monto no válido.");
    commit({
      ...state,
      orders: state.orders.map((x) => (x.id === orderId ? { ...x, internalChargeCents: cents } : x)),
      audit: [...state.audit, event("configuracion", actor.name, `Precio de transferencia de ${orderId}`, { brand: o.brand, orderId, amountCents: cents })],
    });
    return done(`Cargo interno de ${orderId} actualizado a ${formatMoney(cents)}.`);
  },

  reset(): ActionResult {
    commit(createSeed());
    return done("Demo reiniciada con los datos de la semilla.");
  },
};

/** Útil para pantallas: cuánto anticipo falta para liberar una orden retenida. */
export function anticipoPendiente(order: Order) {
  return Math.max(anticipoRequired(order) - appliedCents(state, order.id), 0);
}
