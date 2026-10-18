import { useRef, type ChangeEvent } from "react";
import { MagnifyingGlass, XCircle } from "../ui/icons";
import { cx } from "../../lib/format";

export interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  autoFocus,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className={cx("relative flex items-center", className)}>
      <MagnifyingGlass
        size={16}
        weight="bold"
        className="pointer-events-none absolute left-3.5 text-muted"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cx(
          "h-10 w-full rounded-md bg-panel pl-9 pr-9 text-sm text-ink placeholder:text-muted outline-none transition-all",
          "border border-line focus:border-brand-blue focus:bg-card focus:ring-2 focus:ring-brand-blue/20"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 text-muted hover:text-ink cursor-pointer"
        >
          <XCircle size={16} weight="fill" />
        </button>
      )}
    </div>
  );
}
