import { IS_MOCK } from "../config";

// Disponibilidad de módulos por modo de datos.
// - mock: toda la demostración está disponible (semilla local, explícita y separada).
// - api (INT-FE-API-001): los módulos de lectura y las acciones de crédito, pagos y despacho están conectados a Spring.
//   Queda pendiente solo "Carga manual": subir un voucher requiere el uploader privado de Storage (MIG-04), que aún no
//   tiene endpoint. Se muestra como no disponible y su pantalla no se carga.
// El bloqueo de la UI indica disponibilidad; no sustituye los permisos del backend.

export type ModuleKey = "inicio" | "resumen" | "pedidos" | "clientes" | "conciliacion" | "cobranza" | "taller" | "captura" | "resultado" | "perfil";

export const MODULE_LABEL: Record<ModuleKey, string> = {
  inicio: "Inicio",
  resumen: "Resumen",
  pedidos: "Pedidos",
  clientes: "Clientes",
  conciliacion: "Conciliación",
  cobranza: "Cobranza",
  taller: "Taller",
  captura: "Carga manual",
  resultado: "Resultado",
  perfil: "Perfil",
};

/** Módulos sin endpoint en Spring todavía. */
export const API_PENDING: ReadonlySet<ModuleKey> = new Set<ModuleKey>(["captura"]);

/** `mock` se inyecta solo en pruebas; por defecto es el modo configurado. */
export function isModuleAvailable(key: ModuleKey, mock: boolean = IS_MOCK): boolean {
  return mock || !API_PENDING.has(key);
}
