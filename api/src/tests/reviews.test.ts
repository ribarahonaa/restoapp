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
afterAll(async () => prisma.$disconnect());

async function branchId(name: string) {
  return (await prisma.branch.findFirstOrThrow({ where: { name } })).id;
}
async function register(email = "u@u.cl", name = "Ana") {
  const res = await request(app).post("/auth/register").send({ email, password: "secret123", name });
  return res.body.accessToken as string;
}

describe("POST /branches/:id/reviews", () => {
  it("sin token devuelve 401", async () => {
    const id = await branchId("Cercano Bar");
    expect((await request(app).post(`/branches/${id}/reviews`).send({ rating: 5 })).status).toBe(401);
  });

  it("con token crea la reseña ligada al usuario, verified, authorName = nombre de la cuenta", async () => {
    const token = await register("ana@u.cl", "Ana Pérez");
    const id = await branchId("Cercano Bar");
    const res = await request(app).post(`/branches/${id}/reviews`)
      .set("authorization", `Bearer ${token}`).send({ rating: 5, comment: "Excelente" });
    expect(res.status).toBe(201);
    const row = await prisma.review.findFirstOrThrow({ where: { branchId: id } });
    expect(row.authorName).toBe("Ana Pérez");
    expect(row.verified).toBe(true);
    expect(row.userId).not.toBeNull();
  });

  it("segunda reseña del mismo usuario en el local devuelve 409", async () => {
    const token = await register("ana@u.cl", "Ana");
    const id = await branchId("Cercano Bar");
    await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 5 });
    const dup = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 3 });
    expect(dup.status).toBe(409);
  });

  it("400 con rating fuera de rango", async () => {
    const token = await register();
    const id = await branchId("Cercano Bar");
    expect((await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 9 })).status).toBe(400);
  });
});
