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

const base = () => `/admin/branches/${ctx.branch.id}/promotions`;
const auth = async () => `Bearer ${await tokenFor("general@demo.cl")}`;
const window = { startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2999-01-01T00:00:00.000Z" };

describe("CRUD de promociones", () => {
  it("crea y elimina una promo", async () => {
    const created = await request(app).post(base()).set("Authorization", await auth())
      .send({ title: "2x1", description: "Tardes", ...window });
    expect(created.status).toBe(201);
    const del = await request(app).delete(`${base()}/${created.body.id}`).set("Authorization", await auth());
    expect(del.status).toBe(204);
  });

  it("bloquea al exceder maxPromos del plan (Free=1) → 403 plan_limit_promos", async () => {
    await prisma.promotion.create({ data: { branchId: ctx.branch.id, title: "ya", startsAt: new Date(), endsAt: new Date() } });
    const res = await request(app).post(base()).set("Authorization", await auth())
      .send({ title: "otra", ...window });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("plan_limit_promos");
  });
});
