import type { Role } from "../api/schemas";

// Matriz de permisos de la demo, según los actores de PROP-FLUJO-DER-001.
// El servidor es quien autoriza; la UI oculta o deshabilita y explica por qué.

export type Permission =
  | "ver_comercial"
  | "confirmar_orden"
  | "aprobar_credito"
  | "captura"
  | "verificar"
  | "aplicar"
  | "editar_evidencia"
  | "descartar"
  | "gestionar_cobranza"
  | "registrar_despacho"
  | "compartir_estado"
  | "ver_resultado"
  | "exportar"
  | "configurar"
  | "cambiar_vista";

const MATRIX: Record<Role, Permission[]> = {
  vendedor: ["ver_comercial", "confirmar_orden", "aprobar_credito", "captura"],
  administracion: [
    "ver_comercial",
    "captura",
    "verificar",
    "aplicar",
    "editar_evidencia",
    "descartar",
    "gestionar_cobranza",
    "compartir_estado",
    "ver_resultado",
    "exportar",
    "cambiar_vista",
  ],
  gerencia: ["ver_comercial", "compartir_estado", "ver_resultado", "exportar", "configurar", "cambiar_vista"],
  jefe_taller: ["registrar_despacho", "cambiar_vista"],
};

export function can(role: Role | undefined, permission: Permission) {
  return role ? MATRIX[role].includes(permission) : false;
}

export const ROLES: Role[] = ["vendedor", "administracion", "gerencia", "jefe_taller"];

export function rolesWith(p: Permission) {
  return ROLES.filter((r) => can(r, p)).map((r) => ROLE_LABEL[r]);
}

export const ROLE_LABEL: Record<Role, string> = {
  vendedor: "Vendedor",
  administracion: "Administración",
  gerencia: "Gerencia",
  jefe_taller: "Jefe de taller",
};

export const ROLE_SUMMARY: Record<Role, string> = {
  vendedor: "Negocia por WhatsApp, revisa la hoja de resumen, aprueba el crédito de sus clientes y confirma la orden.",
  administracion: "Verifica los pagos en su banca, los aplica, atiende la mora, resuelve pagos dudosos y comparte estados de cuenta.",
  gerencia: "Ve margen real, flujo de caja y reportes, exporta a contabilidad y ajusta los supuestos.",
  jefe_taller: "Recibe solo órdenes liberadas y registra el despacho, que fija el vencimiento.",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  ver_comercial: "Ver pedidos, clientes y caja",
  confirmar_orden: "Confirmar órdenes (/ok)",
  aprobar_credito: "Aprobar crédito de sus clientes",
  captura: "Cargar comprobantes y chats a mano",
  verificar: "Verificar pagos en el banco",
  aplicar: "Aplicar pagos a órdenes",
  editar_evidencia: "Corregir datos leídos por la IA",
  descartar: "Descartar comprobantes",
  gestionar_cobranza: "Resolver alertas y reenviar mensajes",
  registrar_despacho: "Registrar despacho",
  compartir_estado: "Compartir estado de cuenta",
  ver_resultado: "Ver margen y resultado",
  exportar: "Exportar CSV y reportes",
  configurar: "Editar supuestos de caja",
  cambiar_vista: "Cambiar entre marcas y consolidado",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];
