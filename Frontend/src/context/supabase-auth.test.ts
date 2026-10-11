import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthClient, type SupabaseAuthPort } from "./supabase-auth";

function port(): SupabaseAuthPort {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({data:{subscription:{unsubscribe:vi.fn()}}}),
  };
}
describe("adaptador Supabase sin conexiones reales", () => {
  it.each([0, 429, 500, 503])("el error %s del SDK se propaga como fallo temporal, no como credenciales inválidas", async (status) => {
    const auth=port();
    const error={status,name:"AuthRetryableFetchError"};
    vi.mocked(auth.signInWithPassword).mockResolvedValue({data:{session:null},error});
    await expect(createSupabaseAuthClient(auth).signInWithPassword("a@test.example","fixture")).rejects.toBe(error);
  });
  it("credenciales inválidas siguen siendo rechazo normal", async () => {
    const auth=port();
    vi.mocked(auth.signInWithPassword).mockResolvedValue({data:{session:null},error:{status:400,code:"invalid_credentials"}});
    await expect(createSupabaseAuthClient(auth).signInWithPassword("a@test.example","fixture")).resolves.toBeNull();
  });
  it("getSession no ignora el error del SDK", async () => {
    const auth=port(),error={status:503};
    vi.mocked(auth.getSession).mockResolvedValue({data:{session:null},error});
    await expect(createSupabaseAuthClient(auth).getSession()).rejects.toBe(error);
  });
  it("el cierre es local, sin revocar otras sesiones", async () => {
    const auth=port();
    await createSupabaseAuthClient(auth).signOut();
    expect(auth.signOut).toHaveBeenCalledWith({scope:"local"});
  });
});
