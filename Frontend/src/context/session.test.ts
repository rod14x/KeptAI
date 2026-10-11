import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../api/contract/http";
import { UserContext, type UserContextT } from "../api/contract/schemas";
import { SessionController, SessionFailure, classify, type AuthClient, type AuthEvent, type AuthSession, type SessionState } from "./session";

// FIXTURES: ninguna prueba usa Supabase Auth real ni Spring real. Verifican la lógica de sesión del frontend
// (identidad de /me, token vigente, errores, logout y respuestas tardías) con un AuthClient y un /me simulados.

const ORG = "10000000-0000-4000-8000-0000000000a1";
const ORG_B = "10000000-0000-4000-8000-0000000000b2";
const USER = "c0000000-0000-4000-8000-0000000000a1"; // fila usuario de PostgreSQL
const USER_B = "c0000000-0000-4000-8000-0000000000b1";
const SUB = "a0000000-0000-4000-8000-0000000000a1"; // sub de Auth: distinto de user_id
const SUB_B = "a0000000-0000-4000-8000-0000000000b1";

const me = (over: Partial<UserContextT> = {}): UserContextT => ({ user_id: USER, organization_id: ORG, role: "VENDEDOR", ...over });
const session = (over: Partial<AuthSession> = {}): AuthSession => ({ accessToken: "token-1", userId: SUB, email: "rosa@example.test", ...over });
const http = (status: number, code = `HTTP_${status}`) => new HttpError(status, { code, message: "x", request_id: "r-1" });

const flush = () => new Promise<void>((r) => setTimeout(r, 5));

/** AuthClient controlable; anota cualquier llamada a Auth hecha mientras se ejecuta un callback de onAuthStateChange. */
function fakeAuth(initial: AuthSession | null = null) {
  const f = {
    session: initial,
    credentials: true,
    signOutCalls: 0,
    getSessionCalls: 0,
    listeners: new Set<(e: AuthEvent, s: AuthSession | null) => void>(),
    inCallback: false,
    callsInsideCallback: [] as string[],
    emit(event: AuthEvent, s: AuthSession | null) {
      f.inCallback = true;
      try {
        for (const l of [...f.listeners]) l(event, s);
      } finally {
        f.inCallback = false;
      }
    },
  };
  const note = (name: string) => {
    if (f.inCallback) f.callsInsideCallback.push(name);
  };
  const client: AuthClient = {
    async getSession() {
      note("getSession");
      f.getSessionCalls++;
      return f.session;
    },
    async signInWithPassword() {
      note("signIn");
      return f.credentials ? (f.session ??= session()) : null;
    },
    async signOut() {
      note("signOut");
      f.signOutCalls++;
      f.session = null;
    },
    onAuthStateChange(cb) {
      f.listeners.add(cb);
      return () => f.listeners.delete(cb);
    },
  };
  return { f, client };
}

/** /me cuyas respuestas se resuelven a mano, para ordenar las respuestas tardías. */
function deferredMe() {
  const calls: { resolve: (v: UserContextT) => void; reject: (e: unknown) => void; token: string | null }[] = [];
  let tokenProvider: () => Promise<string | null> = async () => null;
  const getMe = vi.fn(
    () =>
      new Promise<UserContextT>((resolve, reject) => {
        void tokenProvider().then((token) => calls.push({ resolve, reject, token }));
      }),
  );
  return { calls, getMe, bind: (c: SessionController) => (tokenProvider = c.accessToken) };
}

function make(opts: { initial?: AuthSession | null; getMe?: () => Promise<UserContextT> } = {}) {
  const auth = fakeAuth(opts.initial ?? null);
  const getMe = vi.fn(opts.getMe ?? (async () => me()));
  const controller = new SessionController({ auth: auth.client, getMe });
  const states: SessionState[] = [];
  controller.subscribe(() => states.push(controller.getSnapshot()));
  return { auth, getMe, controller, states, state: () => controller.getSnapshot() };
}

describe("restauración y identidad", () => {
  it("conserva user_id, organization_id y role de /me, no el sub ni claims de la sesión", async () => {
    const { controller, state } = make({ initial: session({ accessToken: "ey.claims-role-ADMIN.sig" }) });
    expect(state().status).toBe("loading");
    controller.start();
    await flush();
    const s = state();
    expect(s.status).toBe("authenticated");
    if (s.status !== "authenticated") return;
    expect(s.identity).toEqual({ userId: USER, organizationId: ORG, role: "VENDEDOR", email: "rosa@example.test" });
    expect(s.identity.userId).not.toBe(SUB);
    controller.stop();
  });

  it("sin sesión de Supabase queda desconectado sin error y sin llamar a /me", async () => {
    const { controller, state, getMe } = make();
    controller.start();
    await flush();
    expect(state()).toEqual({ status: "signed-out", explicit: false, error: null });
    expect(getMe).not.toHaveBeenCalled();
    controller.stop();
  });

  it("el rol es siempre el que devuelve el backend, para cada rol del contrato", async () => {
    for (const role of ["VENDEDOR", "ADMIN", "GERENTE", "JEFE_TALLER"] as const) {
      const { controller, state } = make({ initial: session(), getMe: async () => me({ role, organization_id: ORG_B }) });
      controller.start();
      await flush();
      const s = state();
      expect(s.status === "authenticated" && s.identity.role === role && s.identity.organizationId === ORG_B).toBe(true);
      controller.stop();
    }
  });
});

describe("Bearer actualizado y eventos de Auth", () => {
  it("el proveedor devuelve el token del último evento sin llamar a Auth", async () => {
    const { controller, auth, getMe } = make({ initial: session({ accessToken: "t1" }) });
    controller.start();
    await flush();
    expect(await controller.accessToken()).toBe("t1");
    const before = auth.f.getSessionCalls;
    auth.f.emit("TOKEN_REFRESHED", session({ accessToken: "t2" }));
    expect(await controller.accessToken()).toBe("t2");
    expect(auth.f.getSessionCalls).toBe(before);
    expect(getMe).toHaveBeenCalledTimes(1); // misma identidad: solo se renueva el Bearer
    expect(controller.getSnapshot().status).toBe("authenticated");
    controller.stop();
  });

  it("/me se pide con el token vigente del evento", async () => {
    const d = deferredMe();
    const auth = fakeAuth(session({ accessToken: "t1" }));
    const controller = new SessionController({ auth: auth.client, getMe: d.getMe });
    d.bind(controller);
    controller.start();
    await flush();
    expect(d.calls.map((c) => c.token)).toEqual(["t1"]);
    controller.stop();
  });

  it("SIGNED_OUT externo limpia token e identidad", async () => {
    const { controller, auth, state } = make({ initial: session() });
    controller.start();
    await flush();
    auth.f.emit("SIGNED_OUT", null);
    expect(state()).toEqual({ status: "signed-out", explicit: false, error: null });
    expect(await controller.accessToken()).toBeNull();
    controller.stop();
  });

  it("SIGNED_IN repetido del mismo usuario (volver a la pestaña) no repite /me", async () => {
    const { controller, auth, getMe } = make({ initial: session() });
    controller.start();
    await flush();
    auth.f.emit("SIGNED_IN", session({ accessToken: "t9" }));
    await flush();
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(await controller.accessToken()).toBe("t9");
    controller.stop();
  });

  it("no hace llamadas Auth ni /me dentro del callback de onAuthStateChange (sin reentrancia)", async () => {
    const { controller, auth, getMe } = make({ initial: session() });
    controller.start();
    await flush();
    getMe.mockClear();
    auth.f.emit("SIGNED_IN", session({ userId: SUB_B, accessToken: "tb" }));
    expect(auth.f.callsInsideCallback).toEqual([]);
    expect(getMe).not.toHaveBeenCalled(); // diferido fuera del callback
    await flush();
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(auth.f.callsInsideCallback).toEqual([]);
    controller.stop();
  });

  it("la suscripción se limpia al detener y el reinicio (StrictMode) deja una sola activa", async () => {
    const { controller, auth, state } = make({ initial: session() });
    controller.start();
    controller.stop();
    expect(auth.f.listeners.size).toBe(0);
    controller.start();
    expect(auth.f.listeners.size).toBe(1);
    await flush();
    expect(state().status).toBe("authenticated");
    controller.stop();
    expect(auth.f.listeners.size).toBe(0);
  });
});

describe("errores de /me", () => {
  const cases: [string, unknown, string, boolean][] = [
    ["401 sesión inválida", http(401, "UNAUTHORIZED"), "invalid-session", false],
    ["403 sin membresía", http(403, "FORBIDDEN"), "no-membership", false],
    ["409 varias organizaciones", http(409, "ORGANIZATION_SELECTION_REQUIRED"), "multiple-organizations", false],
  ];
  it.each(cases)("%s: cierra la sesión local, sin identidad ni organización elegida", async (_n, error, kind) => {
    const { controller, state, auth } = make({ initial: session(), getMe: async () => Promise.reject(error) });
    controller.start();
    await flush();
    const s = state();
    expect(s.status).toBe("signed-out");
    if (s.status === "signed-out") expect(s.error?.kind).toBe(kind);
    // El cierre de Auth está diferido: esperar su efecto, no una pausa arbitraria de 5ms.
    await vi.waitFor(() => expect(auth.f.signOutCalls).toBe(1));
    expect(await controller.accessToken()).toBeNull();
    controller.stop();
  });

  const temporary: [string, unknown, string][] = [
    ["503", http(503, "SERVICE_UNAVAILABLE"), "unavailable"],
    ["500", http(500), "unavailable"],
    ["red caída (TypeError de fetch)", new TypeError("Failed to fetch"), "unavailable"],
    ["respuesta inválida (Zod)", (() => { try { UserContext.parse({ user_id: USER }); } catch (e) { return e; } })(), "invalid-response"],
    ["rol desconocido (strict)", (() => { try { UserContext.parse({ user_id: USER, organization_id: ORG, role: "ROOT" }); } catch (e) { return e; } })(), "invalid-response"],
    ["campo extra (strict)", (() => { try { UserContext.parse({ ...me(), name: "x" }); } catch (e) { return e; } })(), "invalid-response"],
    ["JSON ilegible", new SyntaxError("Unexpected token <"), "invalid-response"],
    ["HTTP 400 inesperado", http(400), "invalid-response"],
  ];
  it.each(temporary)("%s: conserva la sesión de Supabase, no concede identidad y permite reintentar", async (_n, error, kind) => {
    let fail = true;
    const { controller, state, auth } = make({ initial: session(), getMe: async () => (fail ? Promise.reject(error) : me()) });
    controller.start();
    await flush();
    const s = state();
    expect(s.status).toBe("degraded");
    if (s.status === "degraded") {
      expect(s.error.kind).toBe(kind);
      expect(s.error.retryable).toBe(true);
    }
    expect(auth.f.signOutCalls).toBe(0);
    expect(auth.f.session).not.toBeNull();
    expect(await controller.accessToken()).toBe("token-1");
    fail = false;
    const identity = await controller.retry();
    expect(identity?.userId).toBe(USER);
    expect(state().status).toBe("authenticated");
    controller.stop();
  });

  it("un fallo temporal persistente deja reintentar varias veces sin cerrar la sesión", async () => {
    const { controller, state, auth } = make({ initial: session(), getMe: async () => Promise.reject(http(503)) });
    controller.start();
    await flush();
    expect(await controller.retry()).toBeNull();
    expect(await controller.retry()).toBeNull();
    expect(state().status).toBe("degraded");
    expect(auth.f.signOutCalls).toBe(0);
    controller.stop();
  });

  it("classify distingue cada causa", () => {
    expect(classify(http(401)).kind).toBe("invalid-session");
    expect(classify(http(403)).kind).toBe("no-membership");
    expect(classify(http(409)).kind).toBe("multiple-organizations");
    expect(classify(http(503)).kind).toBe("unavailable");
    expect(classify(new TypeError("x")).kind).toBe("unavailable");
    expect(classify(new SyntaxError("x")).kind).toBe("invalid-response");
    expect(classify(http(401)).message).not.toBe(classify(http(403)).message);
  });
});

describe("signIn", () => {
  it("credenciales incorrectas: error propio, sin /me ni estado de error de sesión", async () => {
    const { controller, auth, getMe, state } = make();
    auth.f.credentials = false;
    controller.start();
    await flush();
    const err = await controller.signIn("a@b.test", "mala").catch((e) => e);
    expect(err).toBeInstanceOf(SessionFailure);
    expect(err.error.kind).toBe("invalid-credentials");
    expect(getMe).not.toHaveBeenCalled();
    expect(state()).toEqual({ status: "signed-out", explicit: false, error: null });
    controller.stop();
  });

  it("login correcto resuelve la identidad de /me una sola vez aunque llegue SIGNED_IN", async () => {
    const { controller, auth, getMe, state } = make();
    controller.start();
    await flush();
    const p = controller.signIn("rosa@example.test", "clave-correcta");
    auth.f.emit("SIGNED_IN", session()); // Supabase emite el evento mientras signIn resuelve
    const identity = await p;
    await flush();
    expect(identity).toMatchObject({ userId: USER, organizationId: ORG, role: "VENDEDOR" });
    expect(state().status).toBe("authenticated");
    expect(getMe).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it.each([
    [http(403), "no-membership", 1],
    [http(409), "multiple-organizations", 1],
    [http(401), "invalid-session", 1],
  ])("login válido pero /me %s: error propio y sesión local cerrada", async (error, kind, signOuts) => {
    const { controller, auth, state } = make({ getMe: async () => Promise.reject(error) });
    controller.start();
    await flush();
    const err = await controller.signIn("a@b.test", "clave-correcta").catch((e) => e);
    await flush();
    expect(err.error.kind).toBe(kind);
    expect(state().status).toBe("signed-out");
    expect(auth.f.signOutCalls).toBe(signOuts);
    controller.stop();
  });

  it("login válido con /me 503: no cierra la sesión válida y se puede reintentar", async () => {
    let fail = true;
    const { controller, auth, state } = make({ getMe: async () => (fail ? Promise.reject(http(503)) : me()) });
    controller.start();
    await flush();
    const err = await controller.signIn("a@b.test", "clave-correcta").catch((e) => e);
    expect(err.error.kind).toBe("unavailable");
    expect(state().status).toBe("degraded");
    expect(auth.f.signOutCalls).toBe(0);
    fail = false;
    await controller.retry();
    expect(state().status).toBe("authenticated");
    controller.stop();
  });
});

describe("logout, desmontaje y respuestas tardías", () => {
  it("logout explícito limpia estado, token y llama a Auth", async () => {
    const { controller, state, auth } = make({ initial: session() });
    controller.start();
    await flush();
    controller.signOut();
    expect(state()).toEqual({ status: "signed-out", explicit: true, error: null });
    expect(await controller.accessToken()).toBeNull();
    await flush();
    expect(auth.f.signOutCalls).toBe(1);
    controller.stop();
  });

  it("un /me tardío tras el logout no restaura la identidad", async () => {
    const d = deferredMe();
    const auth = fakeAuth(session());
    const controller = new SessionController({ auth: auth.client, getMe: d.getMe });
    d.bind(controller);
    controller.start();
    await flush();
    controller.signOut();
    d.calls[0].resolve(me());
    await flush();
    expect(controller.getSnapshot()).toEqual({ status: "signed-out", explicit: true, error: null });
    controller.stop();
  });

  it("un signIn en vuelo cancelado por logout falla sin restaurar la sesión", async () => {
    const d = deferredMe();
    const auth = fakeAuth();
    const controller = new SessionController({ auth: auth.client, getMe: d.getMe });
    d.bind(controller);
    controller.start();
    await flush();
    const p = controller.signIn("a@b.test", "clave-correcta").catch((e) => e);
    await flush();
    controller.signOut();
    d.calls[0].resolve(me());
    const err = await p;
    expect(err).toBeInstanceOf(SessionFailure);
    expect(controller.getSnapshot().status).toBe("signed-out");
    controller.stop();
  });

  it("tras desmontar no hay notificaciones ni cambios de estado por respuestas tardías", async () => {
    const d = deferredMe();
    const auth = fakeAuth(session());
    const controller = new SessionController({ auth: auth.client, getMe: d.getMe });
    d.bind(controller);
    const listener = vi.fn();
    controller.start();
    await flush();
    controller.subscribe(listener);
    controller.stop();
    d.calls[0].resolve(me());
    await flush();
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe("loading");
  });

  it("un /me tardío con error 401 de un usuario anterior no cierra la sesión del usuario nuevo", async () => {
    const d = deferredMe();
    const auth = fakeAuth(session({ userId: SUB, accessToken: "ta" }));
    const controller = new SessionController({ auth: auth.client, getMe: d.getMe });
    d.bind(controller);
    controller.start();
    await flush(); // /me del usuario A en vuelo (calls[0])
    auth.f.emit("SIGNED_IN", session({ userId: SUB_B, accessToken: "tb", email: "luis@example.test" }));
    expect(controller.getSnapshot().status).toBe("loading"); // la identidad anterior deja de valer de inmediato
    await flush(); // /me del usuario B (calls[1])
    expect(d.calls.map((c) => c.token)).toEqual(["ta", "tb"]);
    d.calls[1].resolve(me({ user_id: USER_B, organization_id: ORG_B, role: "GERENTE" }));
    await flush();
    d.calls[0].reject(http(401)); // llega tarde la respuesta del usuario A
    await flush();
    const s = controller.getSnapshot();
    expect(s.status).toBe("authenticated");
    if (s.status === "authenticated") expect(s.identity).toEqual({ userId: USER_B, organizationId: ORG_B, role: "GERENTE", email: "luis@example.test" });
    expect(auth.f.signOutCalls).toBe(0);
    controller.stop();
  });

  it("un /me tardío exitoso del usuario anterior no pisa la identidad del nuevo", async () => {
    const d = deferredMe();
    const auth = fakeAuth(session({ userId: SUB, accessToken: "ta" }));
    const controller = new SessionController({ auth: auth.client, getMe: d.getMe });
    d.bind(controller);
    controller.start();
    await flush();
    auth.f.emit("SIGNED_IN", session({ userId: SUB_B, accessToken: "tb", email: "luis@example.test" }));
    await flush();
    d.calls[1].resolve(me({ user_id: USER_B, organization_id: ORG_B, role: "ADMIN" }));
    await flush();
    d.calls[0].resolve(me({ role: "GERENTE" })); // respuesta antigua del usuario A
    await flush();
    const s = controller.getSnapshot();
    expect(s.status === "authenticated" && s.identity.userId === USER_B && s.identity.role === "ADMIN").toBe(true);
    controller.stop();
  });
});

describe("regresiones de revisión de sesión", () => {
  it("SIGNED_OUT conserva el cierre explícito y el motivo de rechazo local", async () => {
    const {controller, auth, state} = make({ initial: session() });
    controller.start(); await flush();
    controller.signOut();
    auth.f.emit("SIGNED_OUT", null);
    expect(state()).toEqual({status:"signed-out", explicit:true, error:null});
    controller.stop();

    const rejected = make({ initial:session(), getMe:async () => Promise.reject(http(403)) });
    rejected.controller.start(); await flush();
    rejected.auth.f.emit("SIGNED_OUT", null);
    const s=rejected.state();
    expect(s.status === "signed-out" && s.error?.kind === "no-membership").toBe(true);
    rejected.controller.stop();
  });

  it("un cierre diferido por 401 no llama a Auth después de otro login", async () => {
    vi.useFakeTimers();
    const d=deferredMe();
    const auth=fakeAuth(session());
    const controller=new SessionController({auth:auth.client,getMe:d.getMe});
    d.bind(controller);
    try {
      controller.start(); await vi.advanceTimersByTimeAsync(1);
      d.calls[0].reject(http(401));
      await Promise.resolve(); await Promise.resolve();
      expect(controller.getSnapshot().status).toBe("signed-out");
      auth.f.emit("SIGNED_IN", session({userId:SUB_B,accessToken:"tb"}));
      await vi.advanceTimersByTimeAsync(1);
      expect(auth.f.signOutCalls).toBe(0);
      d.calls[1].resolve(me({user_id:USER_B,organization_id:ORG_B}));
      await vi.advanceTimersByTimeAsync(1);
      expect(controller.getSnapshot().status).toBe("authenticated");
    } finally { controller.stop(); vi.useRealTimers(); }
  });

  it("la restauración tardía no sustituye el Bearer ya renovado por un token antiguo", async () => {
    const auth=fakeAuth();
    let resolve!: (s:AuthSession|null)=>void;
    auth.client.getSession=()=>new Promise(r=>{resolve=r;});
    const controller=new SessionController({auth:auth.client,getMe:async()=>me()});
    controller.start();
    auth.f.emit("TOKEN_REFRESHED",session({accessToken:"nuevo"}));
    resolve(session({accessToken:"antiguo"}));
    await flush();
    expect(await controller.accessToken()).toBe("nuevo");
    controller.stop();
    expect(await controller.accessToken()).toBeNull();
  });

  it("reintenta también una restauración que falló antes de obtener la sesión", async () => {
    const auth=fakeAuth(session());
    auth.client.getSession=vi.fn().mockRejectedValueOnce(new TypeError("red")).mockResolvedValue(session());
    const controller=new SessionController({auth:auth.client,getMe:async()=>me()});
    controller.start(); await flush();
    expect(controller.getSnapshot().status).toBe("signed-out");
    await controller.retry();
    expect(controller.getSnapshot().status).toBe("authenticated");
    controller.stop();
  });
});

describe("identidad durante un nuevo login", () => {
  it("retira identidad y Bearer anteriores mientras otra autenticación está en vuelo", async () => {
    const auth=fakeAuth(session());
    let resolve!: (s:AuthSession|null)=>void;
    auth.client.signInWithPassword=()=>new Promise(r=>{resolve=r;});
    const controller=new SessionController({auth:auth.client,getMe:async()=>me()});
    controller.start(); await flush();
    const pending=controller.signIn("otro@example.test","fixture");
    expect(controller.getSnapshot().status).toBe("loading");
    expect(await controller.accessToken()).toBeNull();
    resolve(null);
    await pending.catch(()=>undefined);
    expect(controller.getSnapshot().status).toBe("signed-out");
    controller.stop();
  });
});
