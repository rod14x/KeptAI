import { ZodError } from "zod";
import { HttpError } from "../api/contract/http";
import type { UserContextT } from "../api/contract/schemas";

// Controlador de la sesión real (modo api), sin React ni Supabase directo: AuthContext lo conecta a ambos.
// Identidad y rol proceden solo de GET /api/v1/me (backend); nunca de claims ni de cuentas mock.
// Reglas:
// - El Bearer es el del último evento de Supabase; el proveedor de token no llama a Auth (evita reentrancia).
// - onAuthStateChange no ejecuta llamadas Auth dentro del callback: el trabajo se difiere con setTimeout(0).
// - Cada cambio de identidad incrementa `generation`; una respuesta de /me con otra generación se descarta.
// - Un fallo temporal (503, red) conserva la sesión de Supabase y permite reintentar; nunca se elige organización.

export type AuthErrorKind = "invalid-credentials" | "invalid-session" | "no-membership" | "multiple-organizations" | "unavailable" | "invalid-response";

export type SessionError = { kind: AuthErrorKind; message: string; retryable: boolean };

export const SESSION_MESSAGES: Record<AuthErrorKind, string> = {
  "invalid-credentials": "Correo o contraseña incorrectos.",
  "invalid-session": "Tu sesión ya no es válida. Inicia sesión de nuevo.",
  "no-membership": "Tu usuario no tiene un rol asignado en KeptAI. Pídelo a gerencia.",
  "multiple-organizations": "Tu usuario pertenece a varias organizaciones y esta versión aún no permite elegir una. Pide ayuda a gerencia.",
  unavailable: "El servicio no está disponible por ahora. Tu sesión sigue abierta: reintenta en unos segundos.",
  "invalid-response": "El servidor respondió algo inesperado. Reintenta; si continúa, avisa a soporte.",
};

export function sessionError(kind: AuthErrorKind): SessionError {
  return { kind, message: SESSION_MESSAGES[kind], retryable: kind === "unavailable" || kind === "invalid-response" };
}

/** Falla de signIn con su causa ya clasificada. */
export class SessionFailure extends Error {
  readonly error: SessionError;
  constructor(error: SessionError) {
    super(error.message);
    this.error = error;
  }
}

/** `name` y `organizationName` vienen de /me (usuario.nombre, organizacion.nombre); null si el backend no los envía. */
export type SessionIdentity = {
  userId: string;
  organizationId: string;
  role: UserContextT["role"];
  email: string;
  name: string | null;
  organizationName: string | null;
};

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out"; explicit: boolean; error: SessionError | null }
  | { status: "authenticated"; identity: SessionIdentity }
  /** Hay sesión de Supabase pero /me no pudo resolver la identidad por ahora (temporal): no hay acceso. */
  | { status: "degraded"; email: string; error: SessionError };

/** Sesión mínima de Supabase usada por el controlador. */
export type AuthSession = { accessToken: string; userId: string; email: string | null };

export type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED" | "PASSWORD_RECOVERY";

export interface AuthClient {
  getSession(): Promise<AuthSession | null>;
  /** Devuelve la sesión o null si las credenciales no son válidas. */
  signInWithPassword(email: string, password: string): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  /** Registra el callback y devuelve la función que lo cancela. */
  onAuthStateChange(cb: (event: AuthEvent, session: AuthSession | null) => void): () => void;
}

export type SessionDeps = {
  auth: AuthClient;
  /** GET /api/v1/me ya validado con Zod; lanza HttpError, ZodError o errores de red. */
  getMe: () => Promise<UserContextT>;
};

export function classify(error: unknown): SessionError {
  if (error instanceof HttpError) {
    if (error.status === 401) return sessionError("invalid-session");
    if (error.status === 403) return sessionError("no-membership");
    if (error.status === 409) return sessionError("multiple-organizations");
    if (error.status >= 500 || error.status === 408 || error.status === 429) return sessionError("unavailable");
    return sessionError("invalid-response");
  }
  if (error instanceof ZodError || error instanceof SyntaxError) return sessionError("invalid-response");
  // Red caída, CORS, timeouts u otros fallos sin respuesta del servidor: temporal.
  return sessionError("unavailable");
}

export class SessionController {
  private deps: SessionDeps;
  private state: SessionState = { status: "loading" };
  private listeners = new Set<() => void>();
  private token: string | null = null;
  private generation = 0;
  private running = false;
  private unsubscribeAuth: (() => void) | null = null;
  private loadingUser: string | null = null;
  private currentUser: string | null = null;
  private lastSession: AuthSession | null = null;
  /** signIn en curso: Supabase emite SIGNED_IN antes de que resuelva; ese evento no debe invalidar la operación. */
  private signingIn = false;

  constructor(deps: SessionDeps) {
    this.deps = deps;
  }

  /* ---- Store para useSyncExternalStore ---- */

  getSnapshot = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Proveedor del Bearer para el cliente HTTP: el token del último evento, sin llamar a Auth. */
  accessToken = async (): Promise<string | null> => this.token;

  private set(next: SessionState) {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }

  /* ---- Ciclo de vida ---- */

  /** Idempotente; reiniciable (StrictMode monta, desmonta y vuelve a montar). Devuelve la limpieza. */
  start(): () => void {
    if (this.running) return () => this.stop();
    this.running = true;
    const gen = ++this.generation;
    this.set({ status: "loading" });
    this.unsubscribeAuth = this.deps.auth.onAuthStateChange((event, session) => this.onAuthEvent(event, session));
    void this.deps.auth
      .getSession()
      .then((session) => {
        if (!this.isCurrent(gen)) return;
        const latest = this.lastSession ?? session;
        if (!latest) return this.setSignedOut(false, null);
        return this.establish(latest, gen).then(() => undefined, () => undefined); // el estado ya refleja el resultado
      })
      .catch(() => {
        if (this.isCurrent(gen)) this.set({ status: "signed-out", explicit: false, error: sessionError("unavailable") });
      });
    return () => this.stop();
  }

  stop() {
    this.running = false;
    this.generation++;
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
    this.loadingUser = null;
    this.currentUser = null;
    this.lastSession = null;
    this.token = null;
    this.signingIn = false;
  }

  private isCurrent(gen: number) {
    return this.running && gen === this.generation;
  }

  /* ---- Eventos de Supabase (sin llamadas Auth dentro del callback) ---- */

  private onAuthEvent(event: AuthEvent, session: AuthSession | null) {
    if (!this.running) return;
    if (event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY") return; // la restauración inicial usa getSession()
    if (event === "SIGNED_OUT" || !session) {
      this.token = null;
      this.lastSession = null;
      if (this.state.status !== "signed-out") this.setSignedOut(false, null);
      return;
    }
    this.token = session.accessToken;
    this.lastSession = session;
    if (event === "TOKEN_REFRESHED") return; // misma identidad: solo se renueva el Bearer
    if (event === "SIGNED_IN" && this.signingIn) return; // signIn() resolverá la identidad con esta misma sesión
    const sameUser = session.userId === this.currentUser || session.userId === this.loadingUser;
    if (event === "SIGNED_IN" && sameUser) return; // SIGNED_IN se repite al volver a la pestaña
    // Usuario distinto o USER_UPDATED: la identidad anterior deja de valer y se resuelve de nuevo, fuera del callback.
    const gen = ++this.generation;
    this.currentUser = null;
    this.set({ status: "loading" });
    setTimeout(() => {
      if (this.isCurrent(gen)) void this.establish(session, gen).catch(() => undefined);
    }, 0);
  }

  /* ---- Resolución de identidad ---- */

  private setSignedOut(explicit: boolean, error: SessionError | null) {
    this.generation++;
    this.currentUser = null;
    this.loadingUser = null;
    this.set({ status: "signed-out", explicit, error });
  }

  /** Pide /me para esta sesión. Una respuesta de otra generación se descarta sin tocar el estado. */
  private async establish(session: AuthSession, gen: number): Promise<SessionIdentity> {
    this.token = session.accessToken;
    this.lastSession = session;
    this.loadingUser = session.userId;
    let me: UserContextT;
    try {
      me = await this.deps.getMe();
    } catch (e) {
      if (!this.isCurrent(gen)) throw new SessionFailure(sessionError("invalid-session"));
      const error = classify(e);
      this.loadingUser = null;
      if (error.retryable) {
        // Temporal o respuesta ilegible: se conserva la sesión de Supabase y no se concede identidad.
        this.set({ status: "degraded", email: session.email ?? "", error });
      } else {
        // 401 / 403 / 409: no hay identidad utilizable. Se cierra la sesión local, sin elegir organización.
        this.token = null;
        this.lastSession = null;
        const rejectedGeneration = this.generation + 1;
        this.setSignedOut(false, error);
        setTimeout(() => {
          if (this.isCurrent(rejectedGeneration) && this.state.status === "signed-out") {
            void this.deps.auth.signOut().catch(() => undefined);
          }
        }, 0);
      }
      throw new SessionFailure(error);
    }
    if (!this.isCurrent(gen)) throw new SessionFailure(sessionError("invalid-session"));
    const identity: SessionIdentity = {
      userId: me.user_id,
      organizationId: me.organization_id,
      role: me.role,
      email: session.email ?? "",
      name: me.name ?? null,
      organizationName: me.organization_name ?? null,
    };
    this.loadingUser = null;
    this.currentUser = session.userId;
    this.set({ status: "authenticated", identity });
    return identity;
  }

  /* ---- Acciones ---- */

  async signIn(email: string, password: string): Promise<SessionIdentity> {
    const gen = ++this.generation;
    this.currentUser = null;
    this.loadingUser = null;
    this.token = null;
    this.lastSession = null;
    this.set({ status: "loading" });
    let session: AuthSession | null;
    this.signingIn = true;
    try {
      session = await this.deps.auth.signInWithPassword(email, password);
    } catch (e) {
      this.signingIn = false;
      if (this.isCurrent(gen)) this.set({ status: "signed-out", explicit: false, error: null });
      throw new SessionFailure(classifyAuth(e));
    }
    this.signingIn = false;
    if (!this.isCurrent(gen)) throw new SessionFailure(sessionError("invalid-session"));
    if (!session) {
      this.set({ status: "signed-out", explicit: false, error: null });
      throw new SessionFailure(sessionError("invalid-credentials"));
    }
    this.set({ status: "loading" });
    return this.establish(session, gen);
  }

  signOut() {
    this.generation++;
    this.token = null;
    this.lastSession = null;
    this.setSignedOut(true, null);
    void this.deps.auth.signOut().catch(() => undefined);
  }

  /** Reintenta /me con la sesión conservada tras un fallo temporal. */
  async retry(): Promise<SessionIdentity | null> {
    if (!this.running) return null;
    if (this.state.status === "signed-out" && this.state.error?.retryable) {
      const gen = ++this.generation;
      this.set({ status: "loading" });
      try {
        const session = await this.deps.auth.getSession();
        if (!this.isCurrent(gen)) return null;
        const latest = this.lastSession ?? session;
        if (!latest) {
          this.setSignedOut(false, null);
          return null;
        }
        return await this.establish(latest, gen);
      } catch (e) {
        if (this.isCurrent(gen) && this.getSnapshot().status === "loading") {
          this.setSignedOut(false, classify(e));
        }
        return null;
      }
    }
    if (this.state.status !== "degraded" || !this.lastSession) return null;
    const gen = ++this.generation;
    this.set({ status: "loading" });
    try {
      return await this.establish(this.lastSession, gen);
    } catch {
      return null;
    }
  }
}

/** Supabase devuelve null ante credenciales incorrectas; una excepción es red u otro fallo temporal, no credenciales. */
function classifyAuth(_e: unknown): SessionError {
  return sessionError("unavailable");
}
