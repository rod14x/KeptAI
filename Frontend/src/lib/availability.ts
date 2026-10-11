import { IS_MOCK } from "../config";

// Disponibilidad de módulos por modo de datos (AUTH-FE-03).
// - mock: toda la demostración está disponible (semilla local, explícita y separada).
// - api: solo el inicio de identidad, que usa únicamente GET /api/v1/me. El resto depende de endpoints de negocio
//   que aún no existen en Spring (ver Backend/docs/matriz-acceso.md): se muestra como no disponible y no se carga.
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

/** `mock` se inyecta solo en pruebas; por defecto es el modo configurado. */
export function isModuleAvailable(key: ModuleKey, mock: boolean = IS_MOCK): boolean {
  return mock || key === "inicio";
}
