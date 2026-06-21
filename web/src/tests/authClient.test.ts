import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";

beforeEach(() => {
  localStorage.clear();
  auth.clearSession();
  vi.restoreAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("authClient", () => {
  it("setSession guarda refresh en localStorage y access en memoria", () => {
    auth.setSession("acc", "ref");
    expect(auth.getAccessToken()).toBe("acc");
    expect(auth.hasRefreshToken()).toBe(true);
    auth.clearSession();
    expect(auth.getAccessToken()).toBeNull();
    expect(auth.hasRefreshToken()).toBe(false);
  });

  it("login guarda la sesión y devuelve el usuario", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch" as any);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "a1", refreshToken: "r1" }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "u1", email: "x@y.cl", name: "X", role: "admin_general", preferredLang: "es" }), { status: 200 }));
    const me = await auth.login("x@y.cl", "clave1234");
    expect(me.role).toBe("admin_general");
    expect(auth.getAccessToken()).toBe("a1");
    expect(localStorage.getItem("resto.refresh")).toBe("r1");
  });

  it("authedFetch refresca una vez ante 401 y reintenta", async () => {
    auth.setSession("old", "r1");
    const fetchMock = vi.spyOn(globalThis, "fetch" as any);
    // 1) primer intento 401, 2) refresh ok, 3) reintento ok
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "new", refreshToken: "r2" }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await auth.authedFetch("/admin/ping");
    expect(res.status).toBe(200);
    expect(auth.getAccessToken()).toBe("new");
  });
});
