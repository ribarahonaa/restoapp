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

async function branchId(name: string) {
  const b = await prisma.branch.findFirstOrThrow({ where: { name } });
  return b.id;
}

describe("POST /branches/:id/reviews", () => {
  it("crea reseña y recalcula el promedio", async () => {
    const id = await branchId("Cercano Lunch Promo");
    const r1 = await request(app).post(`/branches/${id}/reviews`).send({ authorName: "Ana", rating: 5 });
    expect(r1.status).toBe(201);
    expect(r1.body.ratingAvg).toBe(5);
    expect(r1.body.ratingCount).toBe(1);

    const r2 = await request(app)
      .post(`/branches/${id}/reviews`)
      .send({ authorName: "Beto", rating: 3, comment: "Ok" });
    expect(r2.status).toBe(201);
    expect(r2.body.ratingAvg).toBe(4); // (5+3)/2
    expect(r2.body.ratingCount).toBe(2);
  });

  it("aparece en el detalle con ratingAvg/ratingCount", async () => {
    const id = await branchId("Cercano Bar");
    await request(app).post(`/branches/${id}/reviews`).send({ authorName: "Ana", rating: 4 });
    const res = await request(app).get(`/branches/${id}`);
    expect(res.body.ratingCount).toBe(1);
    expect(res.body.ratingAvg).toBe(4);
    expect(res.body.reviews).toHaveLength(1);
  });

  it("400 con rating fuera de rango", async () => {
    const id = await branchId("Cercano Bar");
    expect((await request(app).post(`/branches/${id}/reviews`).send({ authorName: "X", rating: 9 })).status).toBe(400);
    expect((await request(app).post(`/branches/${id}/reviews`).send({ authorName: "", rating: 4 })).status).toBe(400);
  });

  it("404 en local inexistente", async () => {
    const res = await request(app).post(`/branches/no-existe/reviews`).send({ authorName: "X", rating: 4 });
    expect(res.status).toBe(404);
  });
});
