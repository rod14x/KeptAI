import { ArrowLeft, ArrowRight } from "./icons";

export const PAGE_SIZE = 7;

export function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const last = Math.ceil(total / PAGE_SIZE) - 1;
  return <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
    <p className="tabular text-xs text-muted">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</p>
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 0} aria-label="Página anterior" className="flex size-11 items-center justify-center rounded-lg border border-line text-muted hover:bg-panel disabled:opacity-40"><ArrowLeft size={16} /></button>
      <span className="tabular px-2 text-xs text-muted">{page + 1} / {last + 1}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page === last} aria-label="Página siguiente" className="flex size-11 items-center justify-center rounded-lg border border-line text-muted hover:bg-panel disabled:opacity-40"><ArrowRight size={16} /></button>
    </div>
  </nav>;
}
