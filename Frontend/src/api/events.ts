// Bus de cambios: cualquier mutación (mock o API) incrementa la versión y las pantallas
// suscritas con useApi vuelven a pedir sus datos.

let version = 0;
const listeners = new Set<() => void>();

export function getVersion() {
  return version;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function bump() {
  version++;
  listeners.forEach((l) => l());
}
