import { Moon, Sun } from "../ui/icons";
import { useTheme } from "../../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === "light" ? "Usar tema oscuro" : "Usar tema claro";
  return <button type="button" onClick={toggle} aria-label={label} title={label} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-line-soft hover:text-ink">
    {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
  </button>;
}
