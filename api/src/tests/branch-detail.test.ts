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

describe("GET /branches/:id", () => {
  it("devuelve la ficha con horarios, carta, promos activas y propósitos", async () => {
    const branch = await prisma.branch.findFirstOrThrow({ where: { name: "Cercano Lunch Promo" } });
    const res = await request(app).get(`/branches/${branch.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Cercano Lunch Promo");
    expect(res.body.hours.length).toBe(7);
    expect(res.body.promotions.length).toBe(1);
    expect(res.body.purposes.length).toBe(1);
    expect(res.body.purposes[0].tag.slug).toBe("lunch");
  });

  it("404 si la sucursal no existe", async () => {
    const res = await request(app).get("/branches/no-existe");
    expect(res.status).toBe(404);
  });

  it("404 si la sucursal está inactiva", async () => {
    const branch = await prisma.branch.findFirstOrThrow({ where: { name: "Inactivo" } });
    const res = await request(app).get(`/branches/${branch.id}`);
    expect(res.status).toBe(404);
  });
});
