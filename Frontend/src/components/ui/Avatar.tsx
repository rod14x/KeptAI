import { cx, initials } from "../../lib/format";

export function Avatar({ name, size = "md", ring = false }: { name: string; size?: "sm" | "md" | "lg"; ring?: boolean }) {
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs";
  return (
    <span
      title={name}
      aria-hidden="true"
      className={cx("inline-flex shrink-0 select-none items-center justify-center rounded-lg bg-violet-tint font-semibold text-violet-ink", dims, ring && "ring-2 ring-card")}
    >
      {initials(name)}
    </span>
  );
}
