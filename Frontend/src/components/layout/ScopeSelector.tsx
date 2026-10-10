import { Lock } from "@phosphor-icons/react";
import type { Scope } from "../../api/schemas";
import { SCOPE_LABEL, useScope } from "../../context/ScopeContext";
import { cx } from "../../lib/format";

const OPTIONS: Scope[] = ["corpotex", "unicrack", "consolidado"];

export function ScopeSelector({ className }: { className?: string }) {
  const { scope, setScope, locked } = useScope();

  if (locked) {
    return (
      <span
        title="Como vendedor ves solo tu marca"
        className={cx("h-11 items-center gap-2 rounded-full bg-line-soft px-4 text-[13px] font-semibold text-ink ring-1 ring-line/60", className ?? "inline-flex")}
      >
        <Lock size={14} className="text-muted" />
        {SCOPE_LABEL[scope]}
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label="Vista de datos" className={cx("rounded-full bg-line-soft p-1 ring-1 ring-line/60", className ?? "inline-flex")}>
      {OPTIONS.map((opt) => {
        const active = opt === scope;
        return (
          <button
            key={opt}
            role="radio"
            aria-checked={active}
            onClick={() => setScope(opt)}
            className={cx(
              "h-9 flex-1 rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200",
              active ? "bg-card text-ink shadow-[0_1px_3px_rgb(23_23_26/0.12)]" : "text-muted hover:text-ink",
            )}
          >
            {SCOPE_LABEL[opt]}
          </button>
        );
      })}
    </div>
  );
}
