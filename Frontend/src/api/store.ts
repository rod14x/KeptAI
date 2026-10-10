import { DemoStateSchema, type AuditEvent, type DemoState, type Evidence, type FieldKey, type Person, type Settings } from "./schemas";
import { createSeed } from "./seed";
import { addDays, matchFor, missingFields, orderBalance } from "./domain";
import { can, ROLE_LABEL, type Permission } from "../lib/permissions";
import { formatMoney } from "../lib/format";

// Store en memoria que simula al backend mientras Spring no está disponible.
// Se guarda en localStorage para sobrevivir a recargas y compartirse entre pestañas
// (por ejemplo, el enlace de estado de cuenta abierto en otra pestaña).

const STORAGE_KEY = "keptai-demo-v2";

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
let version = 0;
const listeners = new Set<() => void>();

function commit(next: DemoState) {
  state = next;
  version++;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin persistencia: la demo sigue funcionando en memoria.
  }
  listeners.forEach((l) => l());
}

// Otra pestaña cambió la demo: recargar y avisar a los suscriptores.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    version++;
    listeners.forEach((l) => l());
  });
}

export function getState() {
  return state;
}
export function getVersion() {
  return version;
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const fail = (message: string): ActionResult => ({ ok: false, message });
const done = (message: string): ActionResult => ({ ok: true, message });

export function nowIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const eid = () => `E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function audit(ev: Evidence, kind: AuditEvent["kind"], by: string, text: string, amountCents = ev.fields.amountCents): AuditEvent {
  return { id: eid(), at: nowIso(), by, kind, brand: ev.brand, evidenceId: ev.id, orderId: ev.orderId, customerId: null, amountCents, text };
}

function updateEvidence(id: string, fn: (ev: Evidence) => Evidence, events: AuditEvent[] = []) {
  commit({
    ...state,
    evidences: state.evidences.map((e) => (e.id === id ? fn(e) : e)),
    audit: [...state.audit, ...events],
  });
}

function find(id: string) {
  return state.evidences.find((e) => e.id === id) ?? null;
}

/** Permiso del rol y, para vendedores, que el registro sea de su marca. */
function guard(actor: Person, permission: Permission, brand?: string | null): ActionResult | null {
  if (!can(actor.role, permission)) return fail(`Tu rol (${ROLE_LABEL[actor.role]}) no permite esta acción.`);
  if (actor.role === "vendedor" && brand && actor.brand !== brand) return fail("Solo puedes actuar sobre clientes de tu marca.");
  return null;
}

export const actions = {
  editField(id: string, field: FieldKey, raw: string, actor: Person): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    const denied = guard(actor, "editar_evidencia");
    if (denied) return denied;
    if (ev.status === "pago_aplicado" || ev.status === "pago_verificado") {
      return fail("Un pago verificado ya no se edita. Registra una corrección con administración.");
    }
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
        // Si el humano corrige el monto, deja de compararse contra lo anunciado.
        mismatchAccepted: field === "amountCents" ? false : e.mismatchAccepted,
        validatedBy: null,
        validatedAt: null,
        corrections: [...e.corrections, { field, from: prev == null ? null : String(prev), to: next == null ? null : String(next), by: actor.name, at: nowIso() }],
      }),
      [audit(ev, "corregido", actor.name, `Campo corregido: ${field === "amountCents" ? "monto" : field}`)],
    );
    return done("Campo actualizado. Queda registrado quién lo corrigió y cuándo.");
  },

  assignOrder(id: string, orderId: string, actor: Person): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    const denied = guard(actor, "editar_evidencia");
    if (denied) return denied;
    if (!state.orders.some((o) => o.id === orderId)) return fail("Pedido no válido.");
    updateEvidence(id, (e) => ({ ...e, orderId, validatedBy: null, validatedAt: null }), [audit(ev, "corregido", actor.name, `Asignado a ${orderId}`)]);
    return done(`Comprobante vinculado a ${orderId}.`);
  },

  confirmDraft(id: string, actor: Person): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    const denied = guard(actor, "editar_evidencia");
    if (denied) return denied;
    if (ev.status !== "borrador") return fail("Este borrador ya fue confirmado.");
    const missing = missingFields(ev);
    if (missing.length) return fail(`Faltan datos: ${missing.join(", ")}. Complétalos o pide el dato al cliente.`);
    updateEvidence(id, (e) => ({ ...e, status: "comprobante_pendiente" }), [audit(ev, "recibido", actor.name, "Borrador confirmado")]);
    return done("Borrador confirmado. Pasa a comprobante pendiente; todavía no reduce el saldo.");
  },

  validate(id: string, actor: Person, acceptMismatch = false): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    const denied = guard(actor, "validar");
    if (denied) return denied;
    if (ev.status !== "comprobante_pendiente") return fail("Solo se valida un comprobante pendiente.");
    if (ev.validatedBy) return fail("La evidencia ya está validada.");
    const match = matchFor(state, ev);
    if (match === "duplicado") return fail("Es un duplicado: márcalo como tal, no se valida.");
    if (match === "huerfano") return fail("Asigna un pedido antes de validar.");
    if (match === "incompleto") return fail("Faltan datos del comprobante.");
    if (match === "excede") return fail("El monto supera el saldo del pedido. Un sobrepago requiere una regla acordada.");
    if (match === "monto_no_cuadra" && !acceptMismatch) return fail("Confirma la diferencia de monto antes de validar.");
    updateEvidence(id, (e) => ({ ...e, validatedBy: actor.name, validatedAt: nowIso(), mismatchAccepted: e.mismatchAccepted || acceptMismatch }), [
      audit(ev, "validado", actor.name, "Evidencia validada"),
    ]);
    return done("Evidencia validada. Siguiente paso: registrar la verificación de fondos.");
  },

  verifyFunds(id: string, actor: Person): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    const denied = guard(actor, "verificar");
    if (denied) return denied;
    if (ev.status === "pago_verificado" || ev.status === "pago_aplicado") return fail("Los fondos ya fueron verificados.");
    if (!ev.validatedBy) return fail("Primero valida la evidencia.");
    updateEvidence(id, (e) => ({ ...e, status: "pago_verificado", verifiedBy: actor.name, verifiedAt: nowIso() }), [
      audit(ev, "verificado", actor.name, "Fondos verificados (simulado)"),
    ]);
    return done("Verificación registrada. Ya puedes aplicar el pago al pedido.");
  },

  applyPayment(id: string, actor: Person): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    // Idempotente: aplicar de nuevo no duplica el pago.
    if (ev.status === "pago_aplicado" || state.applications.some((a) => a.evidenceId === id)) {
      return fail("Este pago ya fue aplicado. No se vuelve a sumar.");
    }
    const denied = guard(actor, "aplicar");
    if (denied) return denied;
    if (ev.status !== "pago_verificado") return fail("Solo se aplica un pago verificado.");
    const order = state.orders.find((o) => o.id === ev.orderId);
    if (!order || ev.fields.amountCents == null) return fail("El pago no tiene pedido o monto.");
    const balance = orderBalance(state, order);
    if (ev.fields.amountCents > balance) return fail("El monto supera el saldo pendiente del pedido.");
    const at = nowIso();
    commit({
      ...state,
      evidences: state.evidences.map((e) => (e.id === id ? { ...e, status: "pago_aplicado", appliedAt: at } : e)),
      applications: [
        ...state.applications,
        { id: `A-${Date.now()}`, evidenceId: id, orderId: order.id, amountCents: ev.fields.amountCents, channel: ev.fields.channel ?? "Sin canal", at, by: actor.name },
      ],
      audit: [...state.audit, audit(ev, "aplicado", actor.name, "Pago aplicado")],
    });
    const left = balance - ev.fields.amountCents;
    return done(left === 0 ? `Pago aplicado. ${order.id} queda sin saldo y sus alertas se cancelan.` : `Pago aplicado. Saldo de ${order.id}: ${formatMoney(left)}.`);
  },

  markDuplicate(id: string, actor: Person): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    const denied = guard(actor, "validar");
    if (denied) return denied;
    if (matchFor(state, ev) !== "duplicado") return fail("Esta evidencia no figura como duplicada.");
    updateEvidence(id, (e) => ({ ...e, status: "descartado", discardReason: "Duplicado" }), [
      audit(ev, "duplicado", actor.name, "Marcado como duplicado, no reduce el saldo"),
    ]);
    return done("Marcado como duplicado. El saldo del pedido no cambia.");
  },

  discard(id: string, actor: Person, reason: string): ActionResult {
    const ev = find(id);
    if (!ev) return fail("No se encontró la evidencia.");
    const denied = guard(actor, "descartar");
    if (denied) return denied;
    if (ev.status === "pago_aplicado") return fail("Un pago aplicado no se descarta; se corrige con un ajuste auditado.");
    updateEvidence(id, (e) => ({ ...e, status: "descartado", discardReason: reason }), [audit(ev, "descartado", actor.name, `Descartado: ${reason}`)]);
    return done("Evidencia descartada. Queda en el historial.");
  },

  requestCredit(customerId: string, amountCents: number, termDays: number, reason: string, actor: Person): ActionResult {
    const c = state.customers.find((x) => x.id === customerId);
    if (!c) return fail("Cliente no encontrado.");
    const denied = guard(actor, "solicitar_credito", c.brand);
    if (denied) return denied;
    if (!Number.isInteger(amountCents) || amountCents <= 0) return fail("Indica un monto mayor que cero.");
    if (!state.settings.termOptions.includes(termDays)) return fail("Plazo no permitido en la configuración.");
    if (reason.trim().length < 5) return fail("Describe el motivo del pedido.");
    if (state.creditRequests.some((r) => r.customerId === customerId && r.status === "pendiente")) {
      return fail("Este cliente ya tiene una solicitud pendiente.");
    }
    const at = nowIso();
    const id = `CR-${String(state.creditRequests.length + 1).padStart(3, "0")}`;
    commit({
      ...state,
      creditRequests: [
        ...state.creditRequests,
        { id, customerId, requestedBy: actor.name, requestedAt: at, amountCents, termDays, reason: reason.trim(), status: "pendiente", decidedBy: null, decidedAt: null, decisionNote: null },
      ],
      audit: [
        ...state.audit,
        { id: eid(), at, by: actor.name, kind: "credito_solicitado", brand: c.brand, evidenceId: null, orderId: null, customerId, amountCents, text: `Solicitud de crédito ${id}` },
      ],
    });
    return done(`Solicitud ${id} enviada a gerencia. El crédito no está aprobado todavía.`);
  },

  decideCredit(requestId: string, approve: boolean, note: string, actor: Person): ActionResult {
    const r = state.creditRequests.find((x) => x.id === requestId);
    if (!r) return fail("Solicitud no encontrada.");
    const denied = guard(actor, "decidir_credito");
    if (denied) return denied;
    if (r.status !== "pendiente") return fail("Esta solicitud ya fue decidida.");
    if (note.trim().length < 5) return fail("Registra el motivo de la decisión.");
    const c = state.customers.find((x) => x.id === r.customerId);
    const at = nowIso();
    commit({
      ...state,
      creditRequests: state.creditRequests.map((x) =>
        x.id === requestId ? { ...x, status: approve ? "aprobada" : "rechazada", decidedBy: actor.name, decidedAt: at, decisionNote: note.trim() } : x,
      ),
      audit: [
        ...state.audit,
        {
          id: eid(),
          at,
          by: actor.name,
          kind: approve ? "credito_aprobado" : "credito_rechazado",
          brand: c?.brand ?? null,
          evidenceId: null,
          orderId: null,
          customerId: r.customerId,
          amountCents: r.amountCents,
          text: `Crédito ${approve ? "aprobado" : "rechazado"} ${r.id}`,
        },
      ],
    });
    return done(approve ? `${r.id} aprobada. Queda registrado quién decidió y por qué.` : `${r.id} rechazada. El vendedor verá el motivo.`);
  },

  updateSettings(patch: Partial<Pick<Settings, "factorMora" | "termOptions" | "termStartEvent">>, actor: Person): ActionResult {
    const denied = guard(actor, "configurar");
    if (denied) return denied;
    if (patch.factorMora != null && (patch.factorMora < 0 || patch.factorMora > 0.9)) return fail("El factor de mora va de 0% a 90%.");
    if (patch.termOptions && patch.termOptions.length === 0) return fail("Debe quedar al menos un plazo.");
    const at = nowIso();
    commit({
      ...state,
      settings: { ...state.settings, ...patch, updatedBy: actor.name, updatedAt: at },
      audit: [...state.audit, { id: eid(), at, by: actor.name, kind: "configuracion", brand: null, evidenceId: null, orderId: null, customerId: null, amountCents: null, text: "Supuestos actualizados" }],
    });
    return done("Supuestos guardados. Las proyecciones se recalculan con estos valores.");
  },

  setInternalCharge(orderId: string, cents: number, actor: Person): ActionResult {
    const denied = guard(actor, "configurar");
    if (denied) return denied;
    const o = state.orders.find((x) => x.id === orderId);
    if (!o || o.modality !== "propia") return fail("Solo los pedidos de producción propia tienen cargo interno.");
    if (!Number.isInteger(cents) || cents < 0) return fail("Monto no válido.");
    const at = nowIso();
    commit({
      ...state,
      orders: state.orders.map((x) => (x.id === orderId ? { ...x, internalChargeCents: cents } : x)),
      audit: [
        ...state.audit,
        { id: eid(), at, by: actor.name, kind: "configuracion", brand: o.brand, evidenceId: null, orderId, customerId: null, amountCents: cents, text: `Precio de transferencia de ${orderId}` },
      ],
    });
    return done(`Cargo interno de ${orderId} actualizado a ${formatMoney(cents)}.`);
  },

  createShareLink(customerId: string, actor: Person): ActionResult & { token?: string } {
    const denied = guard(actor, "compartir_estado");
    if (denied) return denied;
    const c = state.customers.find((x) => x.id === customerId);
    if (!c) return fail("Cliente no encontrado.");
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
    const at = nowIso();
    commit({
      ...state,
      shareLinks: [...state.shareLinks, { token, customerId, createdBy: actor.name, createdAt: at, expiresAt: `${addDays(at.slice(0, 10), 7)}T23:59:59`, revokedAt: null }],
      audit: [...state.audit, { id: eid(), at, by: actor.name, kind: "enlace_creado", brand: c.brand, evidenceId: null, orderId: null, customerId, amountCents: null, text: "Enlace de estado de cuenta creado" }],
    });
    return { ok: true, message: "Enlace creado. Vence en 7 días y puedes revocarlo cuando quieras.", token };
  },

  revokeShareLink(token: string, actor: Person): ActionResult {
    const denied = guard(actor, "compartir_estado");
    if (denied) return denied;
    const link = state.shareLinks.find((l) => l.token === token);
    if (!link || link.revokedAt) return fail("El enlace no existe o ya fue revocado.");
    const c = state.customers.find((x) => x.id === link.customerId);
    const at = nowIso();
    commit({
      ...state,
      shareLinks: state.shareLinks.map((l) => (l.token === token ? { ...l, revokedAt: at } : l)),
      audit: [
        ...state.audit,
        { id: eid(), at, by: actor.name, kind: "enlace_revocado", brand: c?.brand ?? null, evidenceId: null, orderId: null, customerId: link.customerId, amountCents: null, text: "Enlace de estado de cuenta revocado" },
      ],
    });
    return done("Enlace revocado. Quien lo tenga ya no podrá abrirlo.");
  },

  reset(): ActionResult {
    commit(createSeed());
    return done("Demo reiniciada con los datos de la semilla.");
  },
};
