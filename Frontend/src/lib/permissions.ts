import type { Role } from "../api/schemas";

// Matriz de permisos de la demo. El servidor es quien autoriza; la UI solo oculta o
// deshabilita lo que el rol no puede hacer y explica por qué.

export type Permission =
  | "validar"
  | "verificar"
  | "aplicar"
  | "editar_evidencia"
  | "descartar"
  | "solicitar_credito"
  | "decidir_credito"
  | "configurar"
  | "compartir_estado"
  | "ver_resultado"
  | "exportar"
  | "cambiar_vista";

const MATRIX: Record<Role, Permission[]> = {
  gerencia: ["decidir_credito", "configurar", "compartir_estado", "ver_resultado", "exportar", "cambiar_vista"],
  administracion: ["validar", "verificar", "aplicar", "editar_evidencia", "descartar", "compartir_estado", "ver_resultado", "exportar", "cambiar_vista"],
  registro: ["validar", "editar_evidencia", "descartar", "cambiar_vista"],
  vendedor: ["solicitar_credito"],
};

export function can(role: Role | undefined, permission: Permission) {
  return role ? MATRIX[role].includes(permission) : false;
}

export const ROLE_LABEL: Record<Role, string> = {
  gerencia: "Gerencia",
  administracion: "Administración",
  registro: "Registro de pagos",
  vendedor: "Vendedor",
};

export const ROLE_SUMMARY: Record<Role, string> = {
  gerencia: "Ve las dos marcas y el consolidado, decide solicitudes de crédito y ajusta los supuestos de caja.",
  administracion: "Concilia: valida evidencias, registra la verificación de fondos y aplica pagos. Comparte estados de cuenta.",
  registro: "Revisa lo que lee la IA, corrige datos y valida evidencias. No verifica fondos ni aplica pagos.",
  vendedor: "Ve los clientes y pedidos de su marca, sigue la cobranza y solicita crédito para sus clientes.",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  validar: "Validar evidencias",
  verificar: "Registrar verificación de fondos",
  aplicar: "Aplicar pagos a pedidos",
  editar_evidencia: "Corregir datos leídos por la IA",
  descartar: "Descartar evidencias",
  solicitar_credito: "Solicitar crédito para un cliente",
  decidir_credito: "Aprobar o rechazar crédito",
  configurar: "Editar supuestos y plazos",
  compartir_estado: "Compartir estado de cuenta con el cliente",
  ver_resultado: "Ver margen y resultado",
  exportar: "Exportar CSV y reportes",
  cambiar_vista: "Cambiar entre marcas y consolidado",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];
