import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { getVersion, subscribe } from "../api/events";
import { getState } from "../api/mock/store";
import { endpoints } from "../api/contract/endpoints";
import { setAccessTokenProvider } from "../api/contract/http";
import type { Person } from "../api/model";
import { IS_MOCK } from "../config";
import { ROLE_FROM_API, ROLE_LABEL } from "../lib/permissions";
import { supabase } from "../lib/supabase";
import { todayIso } from "../lib/dates";

// Sesión.
// - mock: cuentas de demostración de la semilla (MOCK, eliminar al integrar). Solo se guarda el id.
// - api: Supabase Auth (signInWithPassword) → JWT como Bearer → GET /api/v1/me da el rol (MIG-03).

const KEY = "keptai-session-v2";

type AuthValue = {
  person: Person | null;
  /** false mientras se restaura la sesión de Supabase al abrir la app. */
  ready: boolean;
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

/* ---------- Modo mock ---------- */

function MockAuthProvider({ children }: { children: ReactNode }) {
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

  return <AuthContext.Provider value={{ person, ready: true, signedOut, signIn, signOut }}>{children}</AuthContext.Provider>;
}

/* ---------- Modo api (Supabase) ---------- */

async function loadPerson(email: string): Promise<Person> {
  const ctx = await endpoints.getMyContext();
  const role = ROLE_FROM_API[ctx.role];
  // El contrato no expone nombre ni marca del usuario: se usa el correo y la marca la filtra Spring/RLS.
  return { id: ctx.user_id, name: email.split("@")[0], email, role, title: ROLE_LABEL[role], brand: null, since: todayIso() };
}

function ApiAuthProvider({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [ready, setReady] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    setAccessTokenProvider(async () => (await (await supabase()).auth.getSession()).data.session?.access_token ?? null);
    let alive = true;
    supabase()
      .then((sb) => sb.auth.getSession())
      .then(async ({ data }) => {
        const email = data.session?.user.email;
        if (email) setPerson(await loadPerson(email));
      })
      .catch(() => alive && setPerson(null))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await (await supabase()).auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) throw new Error("Correo o contraseña incorrectos.");
    try {
      const p = await loadPerson(data.session.user.email ?? email);
      setPerson(p);
      setSignedOut(false);
      return p;
    } catch {
      await (await supabase()).auth.signOut();
      throw new Error("Tu usuario no tiene un rol asignado en KeptAI. Pídelo a gerencia.");
    }
  };

  const signOut = () => {
    void supabase().then((sb) => sb.auth.signOut());
    setSignedOut(true);
    setPerson(null);
  };

  return <AuthContext.Provider value={{ person, ready, signedOut, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const AuthProvider = IS_MOCK ? MockAuthProvider : ApiAuthProvider;

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
