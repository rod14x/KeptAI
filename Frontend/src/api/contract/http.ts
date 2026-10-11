import type { z } from "zod";
import { API_BASE_URL } from "../../config";
import { ApiError as ApiErrorSchema, type ApiErrorT } from "./schemas";

// Cliente HTTP del panel: JWT de Supabase como Bearer, Idempotency-Key en escrituras,
// errores ApiError del backend y validación Zod de cada respuesta.

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;

/** AuthContext registra aquí cómo obtener el access_token vigente de Supabase. */
export function setAccessTokenProvider(fn: TokenProvider) {
  tokenProvider = fn;
}

export class HttpError extends Error {
  readonly status: number;
  readonly body: ApiErrorT | null;
  constructor(status: number, body: ApiErrorT | null) {
    super(body?.message ?? `Error ${status} del servidor`);
    this.status = status;
    this.body = body;
  }
  get code() {
    return this.body?.code ?? `HTTP_${this.status}`;
  }
  get requestId() {
    return this.body?.request_id ?? null;
  }
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

type Query = Record<string, string | number | boolean | null | undefined>;

function url(path: string, query?: Query) {
  if (!API_BASE_URL) throw new Error("Falta VITE_API_BASE_URL para el modo api.");
  const u = new URL(`${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  return u.toString();
}

async function send(method: string, path: string, opts: { query?: Query; body?: unknown; form?: FormData; idempotent?: boolean; accept?: string } = {}) {
  const token = await tokenProvider();
  const headers: Record<string, string> = { Accept: opts.accept ?? "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.idempotent) headers["Idempotency-Key"] = newIdempotencyKey();
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(url(path, opts.query), { method, headers, body });
  if (!res.ok) {
    let parsed: ApiErrorT | null = null;
    try {
      const r = ApiErrorSchema.safeParse(await res.json());
      parsed = r.success ? r.data : null;
    } catch {
      parsed = null;
    }
    throw new HttpError(res.status, parsed);
  }
  return res;
}

export async function getJson<S extends z.ZodTypeAny>(schema: S, path: string, query?: Query): Promise<z.infer<S>> {
  const res = await send("GET", path, { query });
  return schema.parse(await res.json());
}

export async function sendJson<S extends z.ZodTypeAny>(schema: S, method: "POST" | "PATCH", path: string, body: unknown, idempotent = true): Promise<z.infer<S>> {
  const res = await send(method, path, { body, idempotent });
  return schema.parse(await res.json());
}

export async function sendForm<S extends z.ZodTypeAny>(schema: S, path: string, form: FormData): Promise<z.infer<S>> {
  const res = await send("POST", path, { form, idempotent: true });
  return schema.parse(await res.json());
}

export async function getText(path: string, query?: Query) {
  const res = await send("GET", path, { query, accept: "text/csv" });
  return res.text();
}

/** Recorre la paginación por cursor (next_cursor) hasta el final o un tope de seguridad. */
export async function getAll<T>(fetchPage: (cursor: string | null) => Promise<{ items: T[]; page: { next_cursor: string | null } }>, max = 1000): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  do {
    const pg = await fetchPage(cursor);
    out.push(...pg.items);
    cursor = pg.page.next_cursor;
  } while (cursor && out.length < max);
  return out;
}
