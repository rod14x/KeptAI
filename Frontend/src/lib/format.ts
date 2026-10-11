const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });
const moneyShort = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 });

/** Céntimos enteros a "S/ 1,234.00". El signo va delante del símbolo. null = sin dato ("—"), nunca cero. */
export function formatMoney(cents: number | null, opts: { short?: boolean; signed?: boolean } = {}) {
  if (cents == null) return "—";
  const fmt = opts.short ? moneyShort : money;
  const abs = fmt.format(Math.abs(cents) / 100);
  if (cents < 0) return `-${abs}`;
  if (opts.signed && cents > 0) return `+${abs}`;
  return abs;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-05" o un ISO completo a "05/10/2026". */
export function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateShort(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export function formatDateTime(iso: string) {
  return `${formatDate(iso)} ${iso.slice(11, 16)}`;
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
