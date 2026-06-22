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
const win = { startsAt: "2026-07-01T00:00:00.000Z", endsAt: "2026-07-31T00:00:00.000Z" };

describe("superadmin · anuncios", () => {
  it("crea un anuncio de sección", async () => {
    const res = await request(app).post("/admin/superadmin/ads").set("Authorization", await sa())
      .send({ businessId: ctx.biz.id, title: "Promo", placement: "section", ...win });
    expect(res.status).toBe(201);
    expect(res.body.placement).toBe("section");
  });

  it("rechaza un Ad con branchId de otra empresa (400)", async () => {
    const res = await request(app).post("/admin/superadmin/ads").set("Authorization", await sa())
      .send({ businessId: ctx.biz.id, branchId: ctx.otherBranch.id, title: "X", placement: "section", ...win });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("branch_business_mismatch");
  });

  it("bloquea el 4º popup solapado (cupo 3) → 403 popup_quota_full", async () => {
    for (let i = 0; i < 3; i++) {
      await prisma.ad.create({ data: { businessId: ctx.biz.id, title: `p${i}`, placement: "popup", startsAt: new Date(win.startsAt), endsAt: new Date(win.endsAt), active: true, createdBy: ctx.superadmin.id } });
    }
    const res = await request(app).post("/admin/superadmin/ads").set("Authorization", await sa())
      .send({ businessId: ctx.biz.id, title: "popup4", placement: "popup", ...win });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("popup_quota_full");
  });

  it("lista, edita y elimina", async () => {
    const ad = await prisma.ad.create({ data: { businessId: ctx.biz.id, title: "A", placement: "section", startsAt: new Date(win.startsAt), endsAt: new Date(win.endsAt), createdBy: ctx.superadmin.id } });
    const list = await request(app).get("/admin/superadmin/ads").set("Authorization", await sa());
    expect(list.body.map((a: any) => a.id)).toContain(ad.id);
    const patched = await request(app).patch(`/admin/superadmin/ads/${ad.id}`).set("Authorization", await sa()).send({ active: false });
    expect(patched.body.active).toBe(false);
    const del = await request(app).delete(`/admin/superadmin/ads/${ad.id}`).set("Authorization", await sa());
    expect(del.status).toBe(204);
  });
});
