import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
const AT = { lat: -33.4380, lng: -70.6500 }; // = "Cercano Bar"

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

// Hace check-in en AT y envejece la visita para satisfacer la precondición de presencia.
async function ageCheckIn(app: ReturnType<typeof createApp>, token: string, id: string, email: string) {
  await request(app).post(`/branches/${id}/checkin`).set("authorization", `Bearer ${token}`).send(AT).expect(200);
  const user = await prisma.user.findFirstOrThrow({ where: { email } });
  await prisma.visit.update({
    where: { userId_branchId: { userId: user.id, branchId: id } },
    data: { startedAt: new Date(Date.now() - 60 * 60000) },
  });
}

describe("POST /branches/:id/reviews", () => {
  it("sin token devuelve 401", async () => {
    const id = await branchId("Cercano Bar");
    expect((await request(app).post(`/branches/${id}/reviews`).send({ rating: 5, ...AT })).status).toBe(401);
  });

  it("con token crea la reseña ligada al usuario, verified, authorName = nombre de la cuenta", async () => {
    const token = await register("ana@u.cl", "Ana Pérez");
    const id = await branchId("Cercano Bar");
    await ageCheckIn(app, token, id, "ana@u.cl");
    const res = await request(app).post(`/branches/${id}/reviews`)
      .set("authorization", `Bearer ${token}`).send({ rating: 5, comment: "Excelente", ...AT });
    expect(res.status).toBe(201);
    const row = await prisma.review.findFirstOrThrow({ where: { branchId: id } });
    expect(row.authorName).toBe("Ana Pérez");
    expect(row.verified).toBe(true);
    expect(row.userId).not.toBeNull();
  });

  it("segunda reseña del mismo usuario en el local devuelve 409", async () => {
    const token = await register("ana@u.cl", "Ana");
    const id = await branchId("Cercano Bar");
    await ageCheckIn(app, token, id, "ana@u.cl");
    await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 5, ...AT });
    const dup = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 3, ...AT });
    expect(dup.status).toBe(409);
  });

  it("400 con rating fuera de rango", async () => {
    const token = await register();
    const id = await branchId("Cercano Bar");
    expect((await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 9, ...AT })).status).toBe(400);
  });
});
