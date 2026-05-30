/**
 * Typed HTTP client for the CyStar backend.
 *
 * - Resolves the base URL once at module load from NEXT_PUBLIC_API_URL.
 * - Attaches the access token from localStorage to every authenticated call.
 * - Surfaces backend error messages verbatim so toasts can render them.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "cystar.access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && "detail" in data && (data as { detail: unknown }).detail) ||
      res.statusText ||
      "Request failed";
    const message = Array.isArray(detail)
      ? detail.map((d) => (typeof d === "object" && d && "msg" in d ? (d as { msg: string }).msg : String(d))).join("; ")
      : String(detail);
    throw new ApiError(res.status, message);
  }

  return data as T;
}

// ---- Types (mirrors backend Pydantic schemas) ----

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
};

export type UserResponse = { id: string; email: string; full_name: string };

export type Credential = {
  id: string;
  credential_type: string;
  issuer_name: string;
  issuer_public_key: string;
  merkle_root: string;
  signature: string;
  claims: Record<string, unknown>;
  leaf_order: string[];
  issued_at: string;
};

export type ShareResponse = {
  share_token: string;
  share_url: string;
  expires_at: string;
  revealed_fields: string[];
};

export type Presentation = {
  credential_type: string;
  issuer_name: string;
  issuer_public_key: string;
  merkle_root: string;
  signature: string;
  leaf_order: string[];
  revealed_claims: Record<string, unknown>;
  salts: Record<string, string>;
  merkle_proofs: Record<string, Array<{ sibling: string; position: "L" | "R" }>>;
  issued_at: string;
  expires_at: string;
};

export type VerifyResponse = {
  verified: boolean;
  fields_verified: string[];
  failure_reason: string | null;
  issuer_name: string | null;
  issued_at: string | null;
  expires_at: string | null;
  revealed_claims: Record<string, unknown> | null;
  trust_score: number | null;
};

// ---- API surface ----

export const api = {
  register: (body: { email: string; password: string; full_name: string }) =>
    request<TokenResponse>("/api/auth/register", { body }),

  login: (body: { email: string; password: string }) =>
    request<TokenResponse>("/api/auth/login", { body }),

  me: () => request<UserResponse>("/api/auth/me", { auth: true }),

  issue: (body: { credential_type?: string; claims: Record<string, unknown> }) =>
    request<Credential>("/api/credentials/issue", { body, auth: true }),

  listCredentials: () => request<Credential[]>("/api/credentials", { auth: true }),

  getCredential: (id: string) =>
    request<Credential>(`/api/credentials/${id}`, { auth: true }),

  share: (body: { credential_id: string; fields: string[]; expires_in_minutes?: number }) =>
    request<ShareResponse>("/api/credentials/share", { body, auth: true }),

  fetchShare: (token: string) =>
    request<Presentation>(`/api/credentials/share/${token}`),

  verify: (body: { share_token?: string; presentation?: Presentation }) =>
    request<VerifyResponse>("/api/credentials/verify", { body }),
};
