import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { popVariants } from "../motion/primitives";
import { getState } from "../../api/store";
import { cx, formatMoney } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";

type Hit = { id: string; label: string; detail: string; href: string };

function hitBrand(s: ReturnType<typeof getState>, href: string) {
  const id = href.split("/").pop() ?? "";
  return s.customers.find((c) => c.id === id)?.brand ?? s.orders.find((o) => o.id === id)?.brand ?? s.evidences.find((e) => e.id === id)?.brand;
}

function search(q: string, brand: string | null): Hit[] {
  const s = getState();
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const customer = (id: string) => s.customers.find((c) => c.id === id)?.name ?? "";
  const orders = s.orders
    .filter((o) => o.id.toLowerCase().includes(term) || customer(o.customerId).toLowerCase().includes(term))
    .map((o) => ({ id: o.id, label: `${o.id} · ${customer(o.customerId)}`, detail: `Orden ${formatMoney(o.saleCents)}`, href: `/pedidos/${o.id}` }));
  const evs = s.evidences
    .filter((e) => e.id.toLowerCase().includes(term) || (e.fields.payer ?? "").toLowerCase().includes(term) || (e.fields.operationRef ?? "").includes(term))
    .map((e) => ({
      id: e.id,
      label: `${e.id} · ${e.fields.payer ?? "Sin remitente"}`,
      detail: `${e.fields.channel ?? "Evidencia"} ${e.fields.amountCents != null ? formatMoney(e.fields.amountCents) : ""}`,
      href: `/conciliacion/${e.id}`,
    }));
  const customers = s.customers
    .filter((c) => c.name.toLowerCase().includes(term))
    .map((c) => ({ id: c.id, label: c.name, detail: `Cliente ${c.brand === "corpotex" ? "Corpotex" : "Unicrack"}`, href: `/clientes/${c.id}` }));
  return [...customers, ...orders, ...evs].filter((h) => !brand || hitBrand(s, h.href) === brand).slice(0, 7);
}

export function SearchBox({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { person } = useAuth();
  const brand = person?.role === "vendedor" ? person.brand : null;
  const hits = useMemo(() => search(q, brand), [q, brand]);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (hit: Hit) => {
    navigate(hit.href);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className={cx("relative", className)}>
      <label className="flex h-11 items-center gap-2 rounded-full bg-card px-4 shadow-[0_1px_2px_rgb(23_23_26/0.04)] ring-1 ring-line focus-within:ring-2 focus-within:ring-violet">
        <MagnifyingGlass size={18} className="shrink-0 text-faint" />
        <span className="sr-only">Buscar pedido, comprobante o cliente</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && hits[active]) go(hits[active]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Buscar cliente, ORD-002 o V-003"
          className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          role="combobox"
          aria-expanded={open && q.length > 0}
          aria-controls="search-results"
        />
      </label>
      <AnimatePresence>
      {open && q.trim() && (
        <motion.ul
          id="search-results"
          role="listbox"
          variants={popVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{ transformOrigin: "top center" }}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl bg-card p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-line">
          {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin resultados para “{q}”.</li>}
          {hits.map((h, i) => (
            <li key={h.href} role="option" aria-selected={i === active}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(h)}
                className={cx("flex w-full flex-col rounded-xl px-3 py-2 text-left", i === active ? "bg-violet-wash" : "hover:bg-panel")}
              >
                <span className="text-sm font-semibold">{h.label}</span>
                <span className="tabular text-xs text-muted">{h.detail}</span>
              </button>
            </li>
          ))}
        </motion.ul>
      )}
      </AnimatePresence>
    </div>
  );
}
