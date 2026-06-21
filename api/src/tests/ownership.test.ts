import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { resetDb, seedAdminFixture } from "./helpers.js";
import { prisma } from "../prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireBranchAccess } from "../middleware/ownership.js";
import { errorHandler } from "../middleware/error.js";
import { signAccessToken } from "../auth/tokens.js";

function appWith() {
  const app = express();
  app.use(express.json());
  app.get("/b/:branchId", authenticate, requireBranchAccess(), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof appWith>;
let ctx: Awaited<ReturnType<typeof seedAdminFixture>>;
beforeEach(async () => {
  await resetDb();
  ctx = await seedAdminFixture();
  app = appWith();
});
afterAll(async () => prisma.$disconnect());

const tok = (id: string, role: any) => signAccessToken({ sub: id, role });

describe("requireBranchAccess", () => {
  it("admin_general accede a un branch de su empresa", async () => {
    const res = await request(app).get(`/b/${ctx.branch.id}`).set("Authorization", `Bearer ${tok(ctx.general.id, "admin_general")}`);
    expect(res.status).toBe(200);
  });
  it("admin_general NO accede a un branch ajeno", async () => {
    const res = await request(app).get(`/b/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${tok(ctx.general.id, "admin_general")}`);
    expect(res.status).toBe(403);
  });
  it("admin_sucursal accede solo a su branch asignado", async () => {
    const ok = await request(app).get(`/b/${ctx.branch.id}`).set("Authorization", `Bearer ${tok(ctx.sucursal.id, "admin_sucursal")}`);
    expect(ok.status).toBe(200);
    const no = await request(app).get(`/b/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${tok(ctx.sucursal.id, "admin_sucursal")}`);
    expect(no.status).toBe(403);
  });
  it("superadmin accede a cualquiera", async () => {
    const res = await request(app).get(`/b/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${tok(ctx.general.id, "superadmin")}`);
    expect(res.status).toBe(200);
  });
  it("404 si el branch no existe", async () => {
    const res = await request(app).get(`/b/no-existe`).set("Authorization", `Bearer ${tok(ctx.general.id, "superadmin")}`);
    expect(res.status).toBe(404);
  });
});
