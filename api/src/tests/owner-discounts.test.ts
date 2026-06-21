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

const base = () => `/admin/branches/${ctx.branch.id}/discounts`;
const window = { startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2999-01-01T00:00:00.000Z" };

describe("CRUD de códigos de descuento", () => {
  it("admin_general crea un código de cadena (branchId null)", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post(base()).set("Authorization", `Bearer ${token}`)
      .send({ code: "CADENA10", type: "percent", value: 10, scope: "chain", ...window });
    expect(res.status).toBe(201);
    expect(res.body.branchId).toBeNull();
    expect(res.body.businessId).toBe(ctx.biz.id);
  });

  it("admin_sucursal crea código de su sucursal pero NO de cadena", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const ok = await request(app).post(base()).set("Authorization", `Bearer ${token}`)
      .send({ code: "LOCAL5", type: "amount", value: 500, scope: "branch", ...window });
    expect(ok.status).toBe(201);
    expect(ok.body.branchId).toBe(ctx.branch.id);

    const no = await request(app).post(base()).set("Authorization", `Bearer ${token}`)
      .send({ code: "NO", type: "percent", value: 10, scope: "chain", ...window });
    expect(no.status).toBe(403);
  });

  it("GET lista los del branch + los de cadena del business", async () => {
    await prisma.discountCode.create({ data: { businessId: ctx.biz.id, branchId: null, code: "CHAIN", type: "percent", value: "10", startsAt: new Date(), endsAt: new Date() } });
    await prisma.discountCode.create({ data: { businessId: ctx.biz.id, branchId: ctx.branch.id, code: "BR", type: "percent", value: "5", startsAt: new Date(), endsAt: new Date() } });
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).get(base()).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((c: any) => c.code).sort()).toEqual(["BR", "CHAIN"]);
  });
});
