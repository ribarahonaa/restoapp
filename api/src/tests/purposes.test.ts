import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  await seedDiscoveryFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /purposes", () => {
  it("devuelve los tags con labels traducidos", async () => {
    const res = await request(app).get("/purposes");
    expect(res.status).toBe(200);
    const slugs = res.body.map((t: any) => t.slug);
    expect(slugs).toContain("lunch");
    expect(slugs).toContain("drinks");
    const lunch = res.body.find((t: any) => t.slug === "lunch");
    expect(lunch.labelEs).toBe("Almuerzo");
    expect(lunch.labelEn).toBe("Lunch");
    expect(lunch.labelPt).toBe("Almoço");
  });
});
