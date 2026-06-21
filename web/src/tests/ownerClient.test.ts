import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";
import * as owner from "../api/ownerClient.js";

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ownerClient", () => {
  it("listBranches hace GET a /admin/branches y devuelve el array", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse([{ id: "b1", name: "Local" }]));
    const out = await owner.listBranches();
    expect(spy).toHaveBeenCalledWith("/admin/branches");
    expect(out[0].id).toBe("b1");
  });

  it("updateBranch hace PATCH con JSON body", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse({ ok: true }));
    await owner.updateBranch("b1", { name: "Nuevo" });
    expect(spy).toHaveBeenCalledWith(
      "/admin/branches/b1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nuevo" }),
      })
    );
  });

  it("uploadImage hace POST multipart y devuelve la url", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse({ url: "http://x/restoapp/a.jpg" }));
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const url = await owner.uploadImage(file);
    expect(url).toBe("http://x/restoapp/a.jpg");
    const [path, init] = spy.mock.calls[0];
    expect(path).toBe("/admin/uploads");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("lanza error si la respuesta no es ok", async () => {
    vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse({ error: "forbidden" }, 403));
    await expect(owner.listBranches()).rejects.toThrow();
  });
});
