// Cliente HTTP da API Moments: guarda os tokens, injeta o Bearer e renova o
// access token automaticamente via refresh quando recebe 401.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const TOKENS_KEY = "moments_tokens";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  status: string;
}

let tokens: Tokens | null = loadTokens();

function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}
function saveTokens(t: Tokens | null) {
  tokens = t;
  try {
    if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSession() {
  return !!tokens;
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.error || `http_${status}`);
    this.status = status;
    this.body = body;
  }
}

async function raw(path: string, init: RequestInit & { auth?: boolean } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.auth !== false && tokens?.accessToken) {
    headers.authorization = `Bearer ${tokens.accessToken}`;
  }
  const res = await fetch(API_URL + path, { ...init, headers: { ...headers, ...(init.headers as any) } });
  return res;
}

async function tryRefresh(): Promise<boolean> {
  if (!tokens?.refreshToken) return false;
  const res = await raw("/auth/refresh", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    saveTokens(null);
    return false;
  }
  saveTokens((await res.json()) as Tokens);
  return true;
}

async function request<T = any>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && init.auth !== false && tokens?.refreshToken) {
    if (await tryRefresh()) res = await raw(path, init);
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export const api = {
  async register(email: string, name: string, password: string) {
    const r = await request<{ user: PublicUser } & Tokens>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, name, password, deviceName: "Web" }),
    });
    saveTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    return r.user;
  },
  async login(email: string, password: string) {
    const r = await request<{ user: PublicUser } & Tokens>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password, deviceName: "Web" }),
    });
    saveTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    return r.user;
  },
  async me() {
    const r = await request<{ user: PublicUser }>("/auth/me");
    return r.user;
  },
  async logout() {
    try {
      if (tokens?.refreshToken) {
        await request("/auth/logout", {
          method: "POST",
          auth: false,
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      }
    } finally {
      saveTokens(null);
    }
  },
  pull(cursor: number) {
    return request<{ changes: Record<string, any[]>; cursor: number }>("/sync/pull", {
      method: "POST",
      body: JSON.stringify({ cursor }),
    });
  },
  push(changes: Record<string, any[]>) {
    return request<{ applied: any[]; conflicts: any[]; rejected: any[]; cursor: number }>("/sync/push", {
      method: "POST",
      body: JSON.stringify({ changes }),
    });
  },
  activity() {
    return request<{ activity: any[] }>("/shares/activity");
  },
};
