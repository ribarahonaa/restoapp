import { API_URL } from "../env.js";

export type Role = "superadmin" | "admin_general" | "admin_sucursal" | "usuario";
export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  preferredLang: string;
  avatarUrl: string | null;
}

const REFRESH_KEY = "resto.refresh";
let accessToken: string | null = null;

export function setSession(access: string, refresh: string) {
  accessToken = access;
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearSession() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}
export function getAccessToken() {
  return accessToken;
}
export function hasRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) != null;
}

export async function login(email: string, password: string): Promise<Me> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("invalid_credentials");
  const { accessToken: a, refreshToken: r } = await res.json();
  setSession(a, r);
  return me();
}

export async function register(name: string, email: string, password: string): Promise<Me> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error(res.status === 409 ? "email_taken" : "register_failed");
  const { accessToken: a, refreshToken: r } = await res.json();
  setSession(a, r);
  return me();
}

export async function refreshSession(): Promise<void> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error("no_refresh");
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    clearSession();
    throw new Error("refresh_failed");
  }
  const { accessToken: a, refreshToken: r } = await res.json();
  setSession(a, r);
}

export async function me(): Promise<Me> {
  const res = await authedFetch("/auth/me");
  if (!res.ok) throw new Error("me_failed");
  return res.json();
}

export async function logout() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (refresh) {
    // revoca el refresh en el servidor (best-effort)
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => {});
  }
  clearSession();
}

// fetch con Authorization; ante 401 intenta refrescar una vez y reintenta.
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const withAuth = (token: string | null): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let res = await fetch(url, withAuth(accessToken));
  if (res.status === 401 && hasRefreshToken()) {
    try {
      await refreshSession();
      res = await fetch(url, withAuth(accessToken));
    } catch {
      // refresh falló: se devuelve el 401 original
    }
  }
  return res;
}
