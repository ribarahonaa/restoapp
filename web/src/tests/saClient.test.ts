import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";
import * as sa from "../api/saClient.js";

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("saClient", () => {
  it("listBusinesses hace GET a /admin/superadmin/businesses", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok([{ id: "b1" }]));
    const out = await sa.listBusinesses();
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/businesses");
    expect(out[0].id).toBe("b1");
  });

  it("createBusiness POST con JSON", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ business: { id: "b" }, owner: { id: "u" } }, 201));
    await sa.createBusiness({ businessName: "X", ownerEmail: "o@d.cl", ownerName: "O", ownerPassword: "clave1234" });
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/businesses", expect.objectContaining({ method: "POST" }));
  });

  it("approveUpgrade POST al endpoint correcto", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ status: "approved" }));
    await sa.approveUpgrade("r1");
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/upgrade-requests/r1/approve", expect.objectContaining({ method: "POST" }));
  });

  it("deleteAd hace DELETE", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(new Response(null, { status: 204 }));
    await sa.deleteAd("a1");
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/ads/a1", expect.objectContaining({ method: "DELETE" }));
  });
});
