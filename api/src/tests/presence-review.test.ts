import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
const AT = { lat: -33.4380, lng: -70.6500 }; // = "Cercano Bar"
beforeEach(async () => { await resetDb(); await seedDiscoveryFixture(); });
afterAll(async () => prisma.$disconnect());
async function token() { return (await request(app).post("/auth/register").send({ email: "p@p.cl", password: "secret123", name: "Pia" })).body.accessToken; }
async function barId() { return (await prisma.branch.findFirstOrThrow({ where: { name: "Cercano Bar" } })).id; }

describe("presencia", () => {
  it("reseña sin check-in => 403 no_checkin", async () => {
    const t = await token(); const id = await barId();
    const r = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${t}`).send({ rating: 5, ...AT });
    expect(r.status).toBe(403); expect(r.body.error).toBe("no_checkin");
  });

  it("check-in lejos => 403 too_far", async () => {
    const t = await token(); const id = await barId();
    const r = await request(app).post(`/branches/${id}/checkin`).set("authorization", `Bearer ${t}`).send({ lat: -33.60, lng: -70.90 });
    expect(r.status).toBe(403); expect(r.body.error).toBe("too_far");
  });

  it("check-in reciente => reseña 403 too_soon", async () => {
    const t = await token(); const id = await barId();
    await request(app).post(`/branches/${id}/checkin`).set("authorization", `Bearer ${t}`).send(AT).expect(200);
    const r = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${t}`).send({ rating: 5, ...AT });
    expect(r.status).toBe(403); expect(r.body.error).toBe("too_soon");
  });

  it("check-in viejo + cerca => crea la reseña", async () => {
    const t = await token(); const id = await barId();
    await request(app).post(`/branches/${id}/checkin`).set("authorization", `Bearer ${t}`).send(AT).expect(200);
    const user = await prisma.user.findFirstOrThrow({ where: { email: "p@p.cl" } });
    await prisma.visit.update({ where: { userId_branchId: { userId: user.id, branchId: id } }, data: { startedAt: new Date(Date.now() - 60 * 60000) } });
    const r = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${t}`).send({ rating: 5, ...AT });
    expect(r.status).toBe(201);
  });
});
