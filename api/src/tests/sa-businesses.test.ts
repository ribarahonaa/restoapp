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

const sa = async () => `Bearer ${await tokenFor("super@demo.cl")}`;

describe("superadmin · empresas", () => {
  it("403 si no es superadmin", async () => {
    const res = await request(app).get("/admin/superadmin/businesses").set("Authorization", `Bearer ${await tokenFor("general@demo.cl")}`);
    expect(res.status).toBe(403);
  });

  it("crea una empresa con su dueño", async () => {
    const res = await request(app).post("/admin/superadmin/businesses").set("Authorization", await sa())
      .send({ businessName: "Nueva Cadena", ownerEmail: "nuevo@d.cl", ownerName: "Nuevo", ownerPassword: "clave1234", planId: ctx.pro.id });
    expect(res.status).toBe(201);
    expect(res.body.business.name).toBe("Nueva Cadena");
    expect(res.body.owner.role).toBe("admin_general");
    const u = await prisma.user.findUnique({ where: { email: "nuevo@d.cl" } });
    expect(u?.role).toBe("admin_general");
  });

  it("409 si el email del dueño ya existe", async () => {
    const res = await request(app).post("/admin/superadmin/businesses").set("Authorization", await sa())
      .send({ businessName: "X", ownerEmail: "general@demo.cl", ownerName: "Y", ownerPassword: "clave1234" });
    expect(res.status).toBe(409);
  });

  it("lista las empresas con sus sucursales y plan", async () => {
    const res = await request(app).get("/admin/superadmin/businesses").set("Authorization", await sa());
    expect(res.status).toBe(200);
    const mine = res.body.find((b: any) => b.id === ctx.biz.id);
    expect(mine.owner.email).toBe("general@demo.cl");
    expect(mine.plan.name).toBe("Free");
    expect(mine.branches.map((x: any) => x.id)).toContain(ctx.branch.id);
  });

  it("actualiza nombre y plan de una empresa", async () => {
    const res = await request(app).patch(`/admin/superadmin/businesses/${ctx.biz.id}`).set("Authorization", await sa())
      .send({ name: "Renombrada", planId: ctx.pro.id });
    expect(res.status).toBe(200);
    const fresh = await prisma.business.findUniqueOrThrow({ where: { id: ctx.biz.id } });
    expect(fresh.name).toBe("Renombrada");
    expect(fresh.planId).toBe(ctx.pro.id);
  });
});
