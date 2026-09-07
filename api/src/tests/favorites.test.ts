// api/src/tests/favorites.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
beforeEach(async () => { await resetDb(); await seedDiscoveryFixture(); });
afterAll(async () => prisma.$disconnect());

async function token() {
  return (await request(app).post("/auth/register").send({ email: "f@f.cl", password: "secret123", name: "Fav" })).body.accessToken;
}
async function branchId(name: string) { return (await prisma.branch.findFirstOrThrow({ where: { name } })).id; }

describe("/me/favorites", () => {
  it("sin token 401", async () => { expect((await request(app).get("/me/favorites")).status).toBe(401); });

  it("add, list y delete idempotentes", async () => {
    const t = await token(); const id = await branchId("Cercano Bar");
    await request(app).post(`/me/favorites/${id}`).set("authorization", `Bearer ${t}`).expect(204);
    await request(app).post(`/me/favorites/${id}`).set("authorization", `Bearer ${t}`).expect(204); // idempotente
    const list = await request(app).get("/me/favorites").set("authorization", `Bearer ${t}`);
    expect(list.body).toEqual([id]);
    await request(app).delete(`/me/favorites/${id}`).set("authorization", `Bearer ${t}`).expect(204);
    expect((await request(app).get("/me/favorites").set("authorization", `Bearer ${t}`)).body).toEqual([]);
  });

  it("merge fusiona, deduplica e ignora ids inexistentes", async () => {
    const t = await token(); const a = await branchId("Cercano Bar"); const b = await branchId("Cercano Lunch Promo");
    await request(app).post(`/me/favorites/${a}`).set("authorization", `Bearer ${t}`).expect(204);
    const res = await request(app).post(`/me/favorites/merge`).set("authorization", `Bearer ${t}`).send({ ids: [a, b, "no-existe"] });
    expect(res.status).toBe(200);
    expect(res.body.sort()).toEqual([a, b].sort());
  });
});
