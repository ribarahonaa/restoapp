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
  return prisma.adRequest.create({
    data: { businessId: ctx.biz.id, branchId: ctx.branch.id, desiredStartsAt: new Date("2026-07-01"), desiredEndsAt: new Date("2026-07-31"), wantsPopup: true, createdBy: ctx.general.id },
  });
}

describe("superadmin · solicitudes de anuncio", () => {
  it("lista pendientes con business", async () => {
    await makeReq();
    const res = await request(app).get("/admin/superadmin/ad-requests").set("Authorization", await sa());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].business.id).toBe(ctx.biz.id);
  });

  it("aprobar marca approved", async () => {
    const r = await makeReq();
    const res = await request(app).post(`/admin/superadmin/ad-requests/${r.id}/approve`).set("Authorization", await sa());
    expect(res.status).toBe(200);
    const fresh = await prisma.adRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(fresh.status).toBe("approved");
    expect(fresh.reviewedBy).toBe(ctx.superadmin.id);
  });

  it("409 si ya fue revisada", async () => {
    const r = await makeReq();
    await request(app).post(`/admin/superadmin/ad-requests/${r.id}/reject`).set("Authorization", await sa());
    const again = await request(app).post(`/admin/superadmin/ad-requests/${r.id}/reject`).set("Authorization", await sa());
    expect(again.status).toBe(409);
  });
});
