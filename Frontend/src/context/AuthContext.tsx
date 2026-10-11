import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { getState, getVersion, subscribe } from "../api/store";
import type { Person } from "../api/schemas";

// Sesión de demostración. Se reemplaza por Supabase Auth en B1 (roadmap de Germán).
// Solo se guarda el id; la persona y su rol se leen siempre del store.

const KEY = "keptai-session-v2";

type AuthValue = {
  person: Person | null;
  /** true tras un cierre de sesión explícito: el login no debe volver a la página anterior. */
  signedOut: boolean;
  signIn: (email: string, password: string) => Promise<Person>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

function readId(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(readId);
  const [signedOut, setSignedOut] = useState(false);
  useSyncExternalStore(subscribe, getVersion);
  const person = userId ? (getState().people.find((p) => p.id === userId) ?? null) : null;

  const signIn = (email: string, password: string) =>
    new Promise<Person>((resolve, reject) => {
      setTimeout(() => {
        const p = getState().people.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!p || password.length < 6) {
          reject(new Error("Correo o contraseña incorrectos."));
          return;
        }
        try {
          sessionStorage.setItem(KEY, p.id);
        } catch {
          // La sesión vive solo en memoria.
        }
        setUserId(p.id);
        setSignedOut(false);
        resolve(p);
      }, 250);
    });

  const signOut = () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Nada que limpiar.
    }
    setSignedOut(true);
    setUserId(null);
  };

  return <AuthContext.Provider value={{ person, signedOut, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}

/** Persona autenticada; solo usar dentro de rutas protegidas. */
export function useMe() {
  const { person } = useAuth();
  if (!person) throw new Error("Sin sesión");
  return person;
}
