import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";
import * as owner from "../api/ownerClient.js";

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ownerClient — menú/promos/descuentos/crear/solicitudes", () => {
  it("createMenuItem hace POST al endpoint de menú con JSON", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ id: "m1", name: "Café" }, 201));
    const out = await owner.createMenuItem("b1", { name: "Café", price: 2500 });
    expect(spy).toHaveBeenCalledWith(
      "/admin/branches/b1/menu",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Café", price: 2500 }) })
    );
    expect(out.id).toBe("m1");
  });

  it("deleteMenuItem hace DELETE y no parsea body", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(new Response(null, { status: 204 }));
    await owner.deleteMenuItem("b1", "m1");
    expect(spy).toHaveBeenCalledWith("/admin/branches/b1/menu/m1", expect.objectContaining({ method: "DELETE" }));
  });

  it("createDiscount con scope chain", async () => {
    vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ id: "d1", branchId: null }, 201));
    const out = await owner.createDiscount("b1", { code: "X", type: "percent", value: 10, scope: "chain", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" });
    expect(out.branchId).toBeNull();
  });

  it("createBranch que excede límite lanza LimitError con code plan_limit_branches", async () => {
    vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ error: "plan_limit_branches" }, 403));
    await expect(
      owner.createBranch({ businessId: "biz", name: "N", category: "bar", address: "x", lat: -33, lng: -70 })
    ).rejects.toMatchObject({ code: "plan_limit_branches" });
  });

  it("requestUpgrade hace POST a /admin/upgrade-requests", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ id: "r1", status: "pending" }, 201));
    await owner.requestUpgrade("biz", "plan2", "más sucursales");
    expect(spy).toHaveBeenCalledWith(
      "/admin/upgrade-requests",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ businessId: "biz", requestedPlanId: "plan2", note: "más sucursales" }) })
    );
  });
});
