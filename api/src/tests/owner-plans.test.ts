import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedAdminFixture, tokenFor } from "./helpers.js";
import { prisma } from "../prisma.js";

let app: import("express").Express;
beforeEach(async () => {
  await resetDb();
  await seedAdminFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

describe("GET /admin/plans", () => {
  it("lista los planes disponibles", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get("/admin/plans").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.map((p: any) => p.name).sort();
    expect(names).toContain("Free");
    expect(names).toContain("Pro");
    expect(res.body[0]).toHaveProperty("maxBranches");
  });

  it("401 sin token", async () => {
    const res = await request(app).get("/admin/plans");
    expect(res.status).toBe(401);
  });
});
