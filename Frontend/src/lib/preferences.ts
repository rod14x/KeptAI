import type { Scope } from "../api/model";

// Preferencias por persona en este navegador. No son datos de negocio: si el
// almacenamiento no está disponible, se usan los valores por defecto.

export type Preferences = {
  defaultScope: Scope;
  notify: { vencimientos: boolean; duplicados: boolean; credito: boolean; sinPedido: boolean };
};

export const DEFAULT_PREFS: Preferences = {
  defaultScope: "consolidado",
  notify: { vencimientos: true, duplicados: true, credito: true, sinPedido: true },
};

const key = (userId: string) => `keptai-prefs-${userId}`;

export function readPrefs(userId: string): Preferences {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULT_PREFS, ...p, notify: { ...DEFAULT_PREFS.notify, ...p.notify } };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(userId: string, prefs: Preferences) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
