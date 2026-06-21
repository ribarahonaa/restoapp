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

const window = { desiredStartsAt: "2026-07-01T00:00:00.000Z", desiredEndsAt: "2026-07-31T00:00:00.000Z" };

describe("solicitudes", () => {
  it("admin_general crea una solicitud de upgrade", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/upgrade-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, requestedPlanId: ctx.pro.id, note: "necesito más sucursales" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "pending", createdBy: ctx.general.id });
  });

  it("rechaza upgrade en empresa ajena (403)", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/upgrade-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.otroBiz.id, requestedPlanId: ctx.pro.id });
    expect(res.status).toBe(403);
  });

  it("admin_sucursal crea solicitud de anuncio para su sucursal", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).post("/admin/ad-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, branchId: ctx.branch.id, wantsPopup: true, ...window });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "pending", wantsPopup: true, branchId: ctx.branch.id });
  });

  it("admin_sucursal NO puede solicitar anuncio de una sucursal ajena (403)", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).post("/admin/ad-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.otroBiz.id, branchId: ctx.otherBranch.id, ...window });
    expect(res.status).toBe(403);
  });
});
