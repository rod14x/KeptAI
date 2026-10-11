// Fechas de negocio (date, zona America/Lima). Utilidades puras compartidas por la UI y las fuentes de datos.

export const DAY_MS = 86_400_000;

export function parseDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  return toIsoDate(new Date(parseDate(iso).getTime() + days * DAY_MS));
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((parseDate(toIso).getTime() - parseDate(fromIso).getTime()) / DAY_MS);
}

/** Las 4 semanas proyectadas desde la fecha de corte. */
export function weekWindows(cutDate: string) {
  const start = parseDate(cutDate);
  return [0, 1, 2, 3].map((i) => {
    const from = new Date(start.getTime() + i * 7 * DAY_MS);
    const to = new Date(from.getTime() + 6 * DAY_MS);
    return { index: i, from, to };
  });
}

/** Fecha local de hoy en ISO (yyyy-mm-dd). */
export function todayIso() {
  return toIsoDate(new Date());
}
