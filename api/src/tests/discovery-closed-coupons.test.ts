import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

let app: import("express").Express;
beforeEach(async () => {
  await resetDb();
  await seedDiscoveryFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

describe("discovery: cierre temporal y cupones", () => {
  it("la ficha incluye closedUntil y los cupones vigentes (branch + cadena)", async () => {
    const branch = await prisma.branch.findFirstOrThrow();
    const biz = await prisma.business.findFirstOrThrow();
    await prisma.discountCode.create({ data: { businessId: biz.id, branchId: branch.id, code: "FICHA10", type: "percent", value: "10", startsAt: new Date("2020-01-01"), endsAt: new Date("2999-01-01"), active: true } });
    await prisma.discountCode.create({ data: { businessId: biz.id, branchId: null, code: "CADENA", type: "amount", value: "500", startsAt: new Date("2020-01-01"), endsAt: new Date("2999-01-01"), active: true } });
    // cupón vencido: no debe aparecer
    await prisma.discountCode.create({ data: { businessId: biz.id, branchId: branch.id, code: "VENCIDO", type: "percent", value: "5", startsAt: new Date("2000-01-01"), endsAt: new Date("2001-01-01"), active: true } });

    const res = await request(app).get(`/branches/${branch.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("closedUntil");
    const codes = res.body.discountCodes.map((c: any) => c.code).sort();
    expect(codes).toEqual(["CADENA", "FICHA10"]);
  });

  it("nearby con open=true excluye una sucursal cerrada temporalmente", async () => {
    // "Cercano Lunch Promo" tiene horarios 00:00-23:59 todos los días,
    // así que está abierta por horario. La exclusión se debe SOLO a closedUntil.
    const branch = await prisma.branch.findFirstOrThrow({ where: { name: "Cercano Lunch Promo" } });
    // marcar cerrada hasta el futuro
    await prisma.branch.update({ where: { id: branch.id }, data: { closedUntil: new Date(Date.now() + 3600_000) } });
    const res = await request(app).get(`/branches/nearby?lat=${branch.lat}&lng=${branch.lng}&open=true`);
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.id)).not.toContain(branch.id);
  });
});
