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

describe("PUT /admin/branches/:branchId/hours", () => {
  it("reemplaza los horarios de la sucursal", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app)
      .put(`/admin/branches/${ctx.branch.id}/hours`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hours: [
        { weekday: 1, openTime: "09:00", closeTime: "18:00" },
        { weekday: 2, openTime: "09:00", closeTime: "18:00" },
      ] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ weekday: 1, openTime: "09:00", closeTime: "18:00" });
    const count = await prisma.serviceHours.count({ where: { branchId: ctx.branch.id } });
    expect(count).toBe(2);
  });

  it("rechaza weekday fuera de rango (400)", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app)
      .put(`/admin/branches/${ctx.branch.id}/hours`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hours: [{ weekday: 9, openTime: "09:00", closeTime: "18:00" }] });
    expect(res.status).toBe(400);
  });
});
