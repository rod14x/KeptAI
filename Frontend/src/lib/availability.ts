import { IS_MOCK } from "../config";

// Disponibilidad de módulos por modo de datos.
// - mock: toda la demostración está disponible (semilla local, explícita y separada).
// - api (INT-FE-API-001): los módulos de lectura y las acciones de crédito, pagos, despacho y carga manual están conectados a Spring.
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

/** Módulos sin endpoint en Spring todavía. Fase 0: captura desbloqueado para subida de comprobantes reales. */
export const API_PENDING: ReadonlySet<ModuleKey> = new Set<ModuleKey>([]);

/** `mock` se inyecta solo en pruebas; por defecto es el modo configurado. */
export function isModuleAvailable(key: ModuleKey, mock: boolean = IS_MOCK): boolean {
  return mock || !API_PENDING.has(key);
}
