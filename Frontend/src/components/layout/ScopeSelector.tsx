import { Lock } from "../ui/icons";
import type { Scope } from "../../api/schemas";
import { SCOPE_LABEL, useScope } from "../../context/ScopeContext";
import { Segmented } from "../ui/Segmented";
import { cx } from "../../lib/format";

const OPTIONS = (["corpotex", "unicrack", "consolidado"] as Scope[]).map((v) => ({ value: v, label: SCOPE_LABEL[v] }));

export function ScopeSelector({ className, stretch }: { className?: string; stretch?: boolean }) {
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
    <Segmented
      label="Vista de datos"
      value={scope}
      onChange={setScope}
      options={OPTIONS}
      size="sm"
      className={cx(className ?? "inline-flex", stretch && "[&>button]:flex-1")}
    />
  );
}
