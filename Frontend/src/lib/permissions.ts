import type { Role } from "../api/model";
import { IS_MOCK } from "../config";

// Matriz de permisos alineada con los "Roles propuestos" de Backend/docs/contrato-api.md.
// Spring es quien autoriza (y RLS V4 aísla por organización); la UI solo oculta o explica.

export type Permission =
  | "ver_comercial"
  | "confirmar_orden"
  | "aprobar_credito"
  | "captura"
  | "verificar"
  | "aplicar"
  | "editar_evidencia"
  | "descartar"
  | "ver_pagos"
  | "ver_cobranza"
  | "gestionar_cobranza"
  | "registrar_despacho"
  | "ver_estado_cuenta"
  | "ver_resultado"
  | "exportar"
  | "ver_auditoria"
  | "configurar"
  | "cambiar_vista";

const MATRIX: Record<Role, Permission[]> = {
  // confirmDraft, submitCreditDecision (solo vendedor), uploadEvidenceFile, receivables, alerts, statement.
  vendedor: ["ver_comercial", "confirmar_orden", "aprobar_credito", "captura", "ver_cobranza", "ver_estado_cuenta"],
  // payments/verifications/applications, drafts, dispatch, alerts, audit, statement.
  administracion: [
    "ver_comercial",
    "confirmar_orden",
    "captura",
    "verificar",
    "aplicar",
    "editar_evidencia",
    "descartar",
    "ver_pagos",
    "ver_cobranza",
    "gestionar_cobranza",
    "registrar_despacho",
    "ver_estado_cuenta",
    "ver_auditoria",
    "cambiar_vista",
  ],
  // results/*, reports/orders.csv, payments (lectura), receivables, statement, audit.
  gerencia: ["ver_comercial", "ver_pagos", "ver_cobranza", "ver_estado_cuenta", "ver_resultado", "exportar", "ver_auditoria", "configurar", "cambiar_vista"],
  // listOrders/getOrder y registerDispatch. Sin acceso financiero a pagos ni vouchers.
  jefe_taller: ["registrar_despacho", "cambiar_vista"],
};

// Modo api: decisiones vigentes del backend. D-014: ADMIN autoriza el crédito durante el MVP y la cartera del vendedor
// sigue sin definir (Spring responde 403 a sus lecturas del panel), así que el vendedor solo ve su sesión.
const API_MATRIX: Record<Role, Permission[]> = {
  ...MATRIX,
  vendedor: [],
  administracion: [...MATRIX.administracion, "aprobar_credito"],
};

export function can(role: Role | undefined, permission: Permission) {
  return role ? (IS_MOCK ? MATRIX : API_MATRIX)[role].includes(permission) : false;
}

export const ROLES: Role[] = ["vendedor", "administracion", "gerencia", "jefe_taller"];

export function rolesWith(p: Permission) {
  return ROLES.filter((r) => can(r, p)).map((r) => ROLE_LABEL[r]);
}

/** usuario.rol del contrato ↔ rol de la vista. */
export const ROLE_FROM_API = { VENDEDOR: "vendedor", ADMIN: "administracion", GERENTE: "gerencia", JEFE_TALLER: "jefe_taller" } as const satisfies Record<string, Role>;

export const ROLE_LABEL: Record<Role, string> = {
  vendedor: "Vendedor",
  administracion: "Administración",
  gerencia: "Gerencia",
  jefe_taller: "Jefe de taller",
};

export const ROLE_SUMMARY: Record<Role, string> = {
  vendedor: "Negocia por WhatsApp, revisa la hoja de resumen, aprueba el crédito de sus clientes y confirma la orden.",
  administracion: "Verifica los pagos en su banca, los aplica, revisa borradores, atiende la cobranza y registra despachos.",
  gerencia: "Consulta margen, caja y reportes, y exporta a contabilidad. No escribe datos de negocio.",
  jefe_taller: "Ve las órdenes liberadas y registra el despacho, que fija el vencimiento. Sin acceso a pagos.",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  ver_comercial: "Ver pedidos y clientes",
  confirmar_orden: "Confirmar borradores de orden",
  aprobar_credito: "Decidir el crédito de sus clientes",
  captura: "Subir comprobantes",
  verificar: "Verificar pagos en el banco",
  aplicar: "Aplicar pagos a órdenes",
  editar_evidencia: "Corregir datos leídos por la IA",
  descartar: "Descartar borradores",
  ver_pagos: "Ver pagos y comprobantes",
  ver_cobranza: "Ver cartera y alertas",
  gestionar_cobranza: "Gestionar alertas de cobranza",
  registrar_despacho: "Registrar despacho",
  ver_estado_cuenta: "Ver estado de cuenta del cliente",
  ver_resultado: "Ver margen, caja y resultado",
  exportar: "Exportar CSV",
  ver_auditoria: "Ver auditoría",
  configurar: "Editar supuestos (demo)",
  cambiar_vista: "Cambiar entre marcas y consolidado",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];
