// Configuración pública (variables VITE_*: todo lo que se pone aquí llega al navegador).

const env = import.meta.env;

/**
 * Fuente de datos:
 * - "mock": semilla local de demostración (src/api/mock). Por defecto mientras Spring no está listo.
 * - "api": API Spring del contrato Backend/docs/openapi.yaml, con sesión de Supabase Auth.
 */
export const API_MODE: "mock" | "api" = env.VITE_API_MODE === "api" ? "api" : "mock";
export const IS_MOCK = API_MODE === "mock";

/** Base de la API Spring, sin barra final. Ej.: https://keptai-api.onrender.com */
export const API_BASE_URL = String(env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export const SUPABASE_URL = String(env.VITE_SUPABASE_URL ?? "");
export const SUPABASE_PUBLISHABLE_KEY = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "");
