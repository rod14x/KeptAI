import { cx, initials } from "../../lib/format";

const TONES = [
  "bg-[#ece6fb] text-[#4a3399]",
  "bg-[#dff2e7] text-[#1b6644]",
  "bg-[#fbeccd] text-[#7a520a]",
  "bg-[#e1ebfa] text-[#244f8f]",
  "bg-[#f9e1e6] text-[#8f2a40]",
  "bg-[#e3f0f2] text-[#21606a]",
];

function tone(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ name, size = "md", ring = false }: { name: string; size?: "sm" | "md" | "lg"; ring?: boolean }) {
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs";
  return (
    <span
      title={name}
      aria-hidden="true"
      className={cx("inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold", dims, tone(name), ring && "ring-2 ring-white")}
    >
      {initials(name)}
    </span>
  );
}
