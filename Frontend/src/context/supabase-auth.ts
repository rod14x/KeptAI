import type { AuthClient, AuthEvent, AuthSession } from "./session";

/** Puerto mínimo del SDK: el adaptador puede probarse sin cuenta real ni React. */
type SdkSession = { access_token: string; user: { id: string; email?: string } };
type SdkError = { status?: number; code?: string; name?: string };
export interface SupabaseAuthPort {
  getSession(): Promise<{ data: { session: SdkSession | null }; error: SdkError | null }>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: { session: SdkSession | null }; error: SdkError | null }>;
  signOut(options: { scope: "local" }): Promise<{ error: SdkError | null }>;
  onAuthStateChange(callback: (event: AuthEvent | string, session: SdkSession | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
}

export function createSupabaseAuthClient(auth: SupabaseAuthPort): AuthClient {
  const map = (s: SdkSession | null): AuthSession | null =>
    s ? { accessToken: s.access_token, userId: s.user.id, email: s.user.email ?? null } : null;
  return {
    getSession: async () => {
      const { data, error } = await auth.getSession();
      if (error) throw error;
      return map(data.session);
    },
    signInWithPassword: async (email, password) => {
      const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.code === "invalid_credentials" ||
            [400, 401, 403, 422].includes(error.status ?? 0)) return null;
        // El SDK también devuelve errores de red, 429 y 5xx como resultado, sin lanzar.
        throw error;
      }
      return map(data.session);
    },
    signOut: async () => {
      const { error } = await auth.signOut({ scope: "local" });
      if (error) throw error;
    },
    onAuthStateChange: (cb) => {
      const { data } = auth.onAuthStateChange((event, session) => cb(event as AuthEvent, map(session)));
      return () => data.subscription.unsubscribe();
    },
  };
}
