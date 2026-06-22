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

describe("superadmin · cuentas y sucursales", () => {
  it("crea un usuario admin_sucursal", async () => {
    const res = await request(app).post("/admin/superadmin/users").set("Authorization", await sa())
      .send({ email: "suc2@d.cl", name: "Suc2", password: "clave1234", role: "admin_sucursal" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("admin_sucursal");
  });

  it("crea una sucursal en una empresa sin tope de plan", async () => {
    const res = await request(app).post(`/admin/superadmin/businesses/${ctx.biz.id}/branches`).set("Authorization", await sa())
      .send({ name: "Suc Provisionada", category: "bar", address: "z", lat: -33.45, lng: -70.66 });
    expect(res.status).toBe(201);
    expect(res.body.businessId).toBe(ctx.biz.id);
  });

  it("asigna un admin_sucursal a una sucursal", async () => {
    const res = await request(app).post("/admin/superadmin/branch-admins").set("Authorization", await sa())
      .send({ userId: ctx.sucursal.id, branchId: ctx.otherBranch.id });
    expect(res.status).toBe(201);
    const link = await prisma.branchAdmin.findUnique({ where: { userId_branchId: { userId: ctx.sucursal.id, branchId: ctx.otherBranch.id } } });
    expect(link).not.toBeNull();
  });

  it("activa/desactiva cualquier sucursal", async () => {
    const res = await request(app).post(`/admin/superadmin/branches/${ctx.otherBranch.id}/active`).set("Authorization", await sa())
      .send({ active: false });
    expect(res.status).toBe(200);
    const fresh = await prisma.branch.findUniqueOrThrow({ where: { id: ctx.otherBranch.id } });
    expect(fresh.active).toBe(false);
  });
});
