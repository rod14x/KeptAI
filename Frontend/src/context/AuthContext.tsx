import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { getVersion, subscribe } from "../api/events";
import { getState } from "../api/mock/store";
import { endpoints } from "../api/contract/endpoints";
import { setAccessTokenProvider } from "../api/contract/http";
import type { Person } from "../api/model";
import { IS_MOCK } from "../config";
import { ROLE_FROM_API, ROLE_LABEL } from "../lib/permissions";
import { supabase } from "../lib/supabase";
import { SESSION_MESSAGES, SessionController, SessionFailure, type AuthClient, type SessionError, type SessionIdentity } from "./session";
import { createSupabaseAuthClient } from "./supabase-auth";

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
  /** Identidad resuelta por /me (user_id, organization_id y role del backend); null en mock y sin sesión. */
  identity: SessionIdentity | null;
  /** Último problema de sesión (credenciales aparte): sesión inválida, sin membresía, varias organizaciones, servicio no disponible... */
  error: SessionError | null;
  /** Reintenta /me tras un fallo temporal conservando la sesión. */
  retry: () => void;
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

  return <AuthContext.Provider value={{ person, ready: true, signedOut, signIn, signOut, identity: null, error: null, retry: () => undefined }}>{children}</AuthContext.Provider>;
}

/* ---------- Modo api (Supabase) ---------- */

// La lógica de sesión vive en session.ts (SessionController, probado con fixtures). Aquí solo se conecta a
// Supabase Auth, al cliente HTTP y a React.

async function supabaseAuthClient(): Promise<AuthClient> {
  return createSupabaseAuthClient((await supabase()).auth);
}

/** El cliente de Supabase se carga bajo demanda; el controlador lo espera sin llamar a Auth antes de tiempo. */
const lazyAuth: AuthClient = (() => {
  let inner: Promise<AuthClient> | null = null;
  const get = () => (inner ??= supabaseAuthClient().catch((error) => {
    inner = null;
    throw error;
  }));
  return {
    getSession: async () => (await get()).getSession(),
    signInWithPassword: async (e, p) => (await get()).signInWithPassword(e, p),
    signOut: async () => (await get()).signOut(),
    onAuthStateChange: (cb) => {
      let off: (() => void) | null = null;
      let cancelled = false;
      void get().then((c) => {
        if (!cancelled) off = c.onAuthStateChange(cb);
      }).catch(() => undefined);
      return () => {
        cancelled = true;
        off?.();
      };
    },
  };
})();

function personFrom(identity: SessionIdentity): Person {
  const role = ROLE_FROM_API[identity.role];
  // El contrato no expone nombre, marca ni fecha de alta: el nombre visible sale del correo de la sesión; marca y fecha quedan sin dato.
  return { id: identity.userId, name: identity.email.split("@")[0] || "Usuario", email: identity.email, role, title: ROLE_LABEL[role], brand: null, since: null };
}

function ApiAuthProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => {
    const c = new SessionController({ auth: lazyAuth, getMe: () => endpoints.getMyContext() });
    setAccessTokenProvider(c.accessToken); // antes de cualquier llamada a /me
    return c;
  });
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => controller.start(), [controller]);

  const person = useMemo(() => (state.status === "authenticated" ? personFrom(state.identity) : null), [state]);
  const value: AuthValue = {
    person,
    identity: state.status === "authenticated" ? state.identity : null,
    ready: state.status !== "loading",
    signedOut: state.status === "signed-out" && state.explicit,
    error: state.status === "signed-out" || state.status === "degraded" ? state.error : null,
    signIn: async (email, password) => {
      try {
        return personFrom(await controller.signIn(email, password));
      } catch (e) {
        throw new Error(e instanceof SessionFailure ? e.error.message : SESSION_MESSAGES.unavailable);
      }
    },
    signOut: () => controller.signOut(),
    retry: () => void controller.retry(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
