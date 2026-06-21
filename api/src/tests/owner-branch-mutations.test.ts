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

describe("PATCH /admin/branches/:branchId — edit branch", () => {
  it("1. admin_general edits name → 200, new name in DB", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .patch(`/admin/branches/${ctx.branch.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nuevo Nombre" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nuevo Nombre");
    const inDb = await prisma.branch.findUniqueOrThrow({ where: { id: ctx.branch.id } });
    expect(inDb.name).toBe("Nuevo Nombre");
  });

  it("2. invalid category (pizzeria) → 400 validation_error", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .patch(`/admin/branches/${ctx.branch.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "pizzeria" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("3. admin_sucursal can edit → 200 ok", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app)
      .patch(`/admin/branches/${ctx.branch.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ address: "Nueva Dirección 123" });
    expect(res.status).toBe(200);
    expect(res.body.address).toBe("Nueva Dirección 123");
  });

  it("4. otro (other business owner) → 403", async () => {
    const token = await tokenFor("otro@demo.cl");
    const res = await request(app)
      .patch(`/admin/branches/${ctx.branch.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hack" });
    expect(res.status).toBe(403);
  });
});

describe("POST /admin/branches/:branchId/active — toggle active", () => {
  it("5. admin_general sets active=false → 200, { id, active: false }", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/active`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: ctx.branch.id, active: false });
  });

  it("6. admin_sucursal → 403 forbidden_role", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/active`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden_role");
  });

  it("7. otro → 403 (ownership)", async () => {
    const token = await tokenFor("otro@demo.cl");
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/active`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(res.status).toBe(403);
  });
});

describe("POST /admin/branches/:branchId/close — set closedUntil", () => {
  it("8. admin_general sets until=2099-12-31T00:00:00.000Z → 200, closedUntil not null", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/close`)
      .set("Authorization", `Bearer ${token}`)
      .send({ until: "2099-12-31T00:00:00.000Z" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ctx.branch.id);
    expect(res.body.closedUntil).not.toBeNull();
  });

  it("10. admin_sucursal can close → 200 ok", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/close`)
      .set("Authorization", `Bearer ${token}`)
      .send({ until: "2099-06-15T00:00:00.000Z" });
    expect(res.status).toBe(200);
    expect(res.body.closedUntil).not.toBeNull();
  });

  it("11. invalid until (not-a-date) → 400 validation_error", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/close`)
      .set("Authorization", `Bearer ${token}`)
      .send({ until: "not-a-date" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});

describe("POST /admin/branches/:branchId/reopen — clear closedUntil", () => {
  it("9. admin_general reopen → 200, closedUntil is null", async () => {
    const token = await tokenFor("general@demo.cl");
    // First close it
    await request(app)
      .post(`/admin/branches/${ctx.branch.id}/close`)
      .set("Authorization", `Bearer ${token}`)
      .send({ until: "2099-12-31T00:00:00.000Z" });

    // Then reopen
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/reopen`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: ctx.branch.id, closedUntil: null });
  });
});
