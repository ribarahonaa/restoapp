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

const newBranch = { name: "Sucursal 2", category: "bar", address: "Calle 2", lat: -33.45, lng: -70.66 };

describe("POST /admin/branches", () => {
  it("admin_general crea una sucursal cuando el plan lo permite", async () => {
    // El business primario tiene plan Free (maxBranches=1) y ya 1 sucursal → subir a 'pro' (maxBranches=5).
    await prisma.business.update({ where: { id: ctx.biz.id }, data: { planId: ctx.pro.id } });
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, ...newBranch });
    expect(res.status).toBe(201);
    expect(res.body.businessId).toBe(ctx.biz.id);
    expect(res.body.planId).toBe(ctx.pro.id);
  });

  it("bloquea al exceder maxBranches (Free=1, ya hay 1) → 403 plan_limit_branches", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, ...newBranch });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("plan_limit_branches");
  });

  it("admin_general NO puede crear sucursal en una empresa ajena (403)", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.otroBiz.id, ...newBranch });
    expect(res.status).toBe(403);
  });

  it("admin_sucursal NO puede crear sucursales (403)", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, ...newBranch });
    expect(res.status).toBe(403);
  });
});
