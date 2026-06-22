import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedAdminFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

let app: import("express").Express;
let ctx: Awaited<ReturnType<typeof seedAdminFixture>>;
beforeEach(async () => {
  await resetDb();
  ctx = await seedAdminFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

const vig = { startsAt: new Date("2020-01-01"), endsAt: new Date("2999-01-01") };

describe("ads públicos", () => {
  it("GET /ads devuelve anuncios de sección vigentes ordenados por cercanía", async () => {
    await prisma.ad.create({ data: { businessId: ctx.biz.id, branchId: ctx.branch.id, title: "Cerca", placement: "section", active: true, createdBy: ctx.superadmin.id, ...vig } });
    await prisma.ad.create({ data: { businessId: ctx.otroBiz.id, branchId: ctx.otherBranch.id, title: "Lejos", placement: "section", active: true, createdBy: ctx.superadmin.id, ...vig } });
    await prisma.ad.create({ data: { businessId: ctx.biz.id, branchId: ctx.branch.id, title: "Vencido", placement: "section", active: true, createdBy: ctx.superadmin.id, startsAt: new Date("2000-01-01"), endsAt: new Date("2001-01-01") } });

    const res = await request(app).get("/ads?lat=-33.43&lng=-70.65");
    expect(res.status).toBe(200);
    const titles = res.body.map((a: any) => a.title);
    expect(titles).toContain("Cerca");
    expect(titles).toContain("Lejos");
    expect(titles).not.toContain("Vencido");
    expect(titles[0]).toBe("Cerca");
  });

  it("GET /ads/popup devuelve el popup más cercano o null", async () => {
    const empty = await request(app).get("/ads/popup?lat=-33.43&lng=-70.65");
    expect(empty.status).toBe(200);
    expect(empty.body.ad).toBeNull();

    await prisma.ad.create({ data: { businessId: ctx.biz.id, branchId: ctx.branch.id, title: "Popup", placement: "popup", active: true, createdBy: ctx.superadmin.id, ...vig } });
    const res = await request(app).get("/ads/popup?lat=-33.43&lng=-70.65");
    expect(res.body.ad.title).toBe("Popup");
  });
});
