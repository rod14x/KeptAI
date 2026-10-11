// Precarga de pantallas cuando el navegador está ocioso: al navegar, el código ya está en caché.
// Las rutas usan los mismos import() que App.tsx, así que comparten el chunk.

type Idle = (cb: () => void) => void;
const whenIdle: Idle = (cb) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 2000 });
  else setTimeout(cb, 300);
};

export const loaders = {
  dashboard: () => import("../pages/DashboardPage"),
  pedidos: () => import("../pages/PedidosPage"),
  orden: () => import("../pages/OrdenDetailPage"),
  clientes: () => import("../pages/ClientesPage"),
  cliente: () => import("../pages/ClienteDetailPage"),
  conciliacion: () => import("../pages/ConciliacionPage"),
  cobranza: () => import("../pages/CobranzaPage"),
  taller: () => import("../pages/TallerPage"),
  captura: () => import("../pages/CapturaPage"),
  resultado: () => import("../pages/ResultadoPage"),
  perfil: () => import("../pages/PerfilPage"),
};

export function prefetch(keys: Array<keyof typeof loaders>) {
  whenIdle(() => keys.forEach((k) => void loaders[k]().catch(() => {})));
}
