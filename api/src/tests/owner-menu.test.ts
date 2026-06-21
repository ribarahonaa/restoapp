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

const base = () => `/admin/branches/${ctx.branch.id}/menu`;
const auth = async () => `Bearer ${await tokenFor("sucursal@demo.cl")}`;

describe("CRUD de menú", () => {
  it("crea, edita y elimina un ítem", async () => {
    const created = await request(app).post(base()).set("Authorization", await auth())
      .send({ name: "Café", price: 2500, category: "Bebidas", description: "Espresso" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const patched = await request(app).patch(`${base()}/${id}`).set("Authorization", await auth())
      .send({ price: 3000 });
    expect(patched.status).toBe(200);
    expect(Number(patched.body.price)).toBe(3000);

    const del = await request(app).delete(`${base()}/${id}`).set("Authorization", await auth());
    expect(del.status).toBe(204);
    expect(await prisma.menuItem.count({ where: { branchId: ctx.branch.id } })).toBe(0);
  });

  it("bloquea al exceder maxMenuItems del plan (Free=10) → 403 plan_limit_menu", async () => {
    // El plan Free del business permite 10 ítems; sembrar 10 y el 11º debe fallar.
    await prisma.menuItem.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({ branchId: ctx.branch.id, name: `it${i}`, price: 1000 })),
    });
    const res = await request(app).post(base()).set("Authorization", await auth())
      .send({ name: "uno más", price: 1000 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("plan_limit_menu");
  });

  it("404 al editar un ítem de otra sucursal", async () => {
    const alien = await prisma.menuItem.create({ data: { branchId: ctx.otherBranch.id, name: "ajeno", price: 1 } });
    const res = await request(app).patch(`${base()}/${alien.id}`).set("Authorization", await auth()).send({ price: 2 });
    expect(res.status).toBe(404);
  });
});
