import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedAdminFixture, tokenFor } from "./helpers.js";
import { prisma } from "../prisma.js";

let app: import("express").Express;
let ctx: Awaited<ReturnType<typeof seedAdminFixture>>;
beforeEach(async () => {
  await resetDb();
  ctx = await seedAdminFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

describe("GET /admin/branches", () => {
  it("admin_general ve solo las sucursales de su empresa", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get("/admin/branches").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((b: any) => b.id);
    expect(ids).toContain(ctx.branch.id);
    expect(ids).not.toContain(ctx.otherBranch.id);
  });

  it("admin_sucursal ve solo su sucursal asignada", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).get("/admin/branches").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(ctx.branch.id);
  });

  it("la lista incluye límites del plan y conteos", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get("/admin/branches").set("Authorization", `Bearer ${token}`);
    const b = res.body.find((x: any) => x.id === ctx.branch.id);
    expect(b.plan).toMatchObject({ maxPromos: 1, maxMenuItems: 10, maxBranches: 1 });
    expect(b.counts).toEqual({ menuItems: 0, promotions: 0 });
  });
});

describe("GET /admin/branches/:branchId", () => {
  it("devuelve el detalle editable de una sucursal propia", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get(`/admin/branches/${ctx.branch.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: ctx.branch.id, name: "Mi Local" });
    expect(Array.isArray(res.body.hours)).toBe(true);
  });

  it("403 si la sucursal es de otra empresa", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get(`/admin/branches/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
