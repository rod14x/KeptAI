import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Scope } from "../api/model";
import { useAuth } from "./AuthContext";
import { readPrefs } from "../lib/preferences";

const ScopeContext = createContext<{ scope: Scope; setScope: (s: Scope) => void; locked: boolean } | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { person } = useAuth();
  const [chosen, setChosen] = useState<Scope>("consolidado");

  // Al cambiar de persona, arrancar en su vista preferida.
  useEffect(() => {
    if (person) setChosen(readPrefs(person.id).defaultScope);
  }, [person?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un vendedor solo ve su marca: la vista queda fija.
  const locked = person?.role === "vendedor" && person.brand != null;
  const scope: Scope = locked && person?.brand ? person.brand : chosen;

  return <ScopeContext.Provider value={{ scope, setScope: (s) => !locked && setChosen(s), locked }}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope fuera de ScopeProvider");
  return ctx;
}

export const SCOPE_LABEL: Record<Scope, string> = {
  corpotex: "Corpotex",
  unicrack: "Unicrack",
  consolidado: "Consolidado",
};
