import { Lock } from "../ui/icons";
import type { Scope } from "../../api/model";
import { SCOPE_LABEL, useScope } from "../../context/ScopeContext";
import { cx } from "../../lib/format";

const OPTIONS = (["corpotex", "unicrack", "consolidado"] as Scope[]).map((v) => ({ value: v, label: SCOPE_LABEL[v] }));

export function ScopeSelector({ className, stretch }: { className?: string; stretch?: boolean }) {
  const { scope, setScope, locked } = useScope();

  if (locked) {
    return (
      <span
        title="Como vendedor ves solo tu marca"
        className={cx("h-11 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-ink", className ?? "inline-flex")}
      >
        <Lock size={14} className="text-muted" />
        {SCOPE_LABEL[scope]}
      </span>
    );
  }

  return (
    <label className={cx("items-center gap-2", className ?? "inline-flex", stretch && "w-full")}>
      <span className="sr-only">Vista de datos</span>
      <select aria-label="Vista de datos" value={scope} onChange={(e) => setScope(e.target.value as Scope)} className={cx("h-11 rounded-lg border border-line bg-card px-3 text-[13px] font-semibold text-ink", stretch && "w-full")}>
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
