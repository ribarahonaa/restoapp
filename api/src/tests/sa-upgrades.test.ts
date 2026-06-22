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

const sa = async () => `Bearer ${await tokenFor("super@demo.cl")}`;
async function makeReq() {
  return prisma.planUpgradeRequest.create({
    data: { businessId: ctx.biz.id, requestedPlanId: ctx.pro.id, createdBy: ctx.general.id },
  });
}

describe("superadmin · upgrades", () => {
  it("lista pendientes con business y plan", async () => {
    await makeReq();
    const res = await request(app).get("/admin/superadmin/upgrade-requests").set("Authorization", await sa());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].business.id).toBe(ctx.biz.id);
    expect(res.body[0].requestedPlan.name).toBe("Pro");
  });

  it("aprobar cambia el plan del business", async () => {
    const r = await makeReq();
    const res = await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/approve`).set("Authorization", await sa());
    expect(res.status).toBe(200);
    const biz = await prisma.business.findUniqueOrThrow({ where: { id: ctx.biz.id } });
    expect(biz.planId).toBe(ctx.pro.id);
    const fresh = await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(fresh.status).toBe("approved");
  });

  it("rechazar no cambia el plan", async () => {
    const r = await makeReq();
    const res = await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/reject`).set("Authorization", await sa());
    expect(res.status).toBe(200);
    const biz = await prisma.business.findUniqueOrThrow({ where: { id: ctx.biz.id } });
    expect(biz.planId).toBe(ctx.free.id);
  });

  it("409 si ya fue revisada", async () => {
    const r = await makeReq();
    await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/approve`).set("Authorization", await sa());
    const again = await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/approve`).set("Authorization", await sa());
    expect(again.status).toBe(409);
  });
});
