import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb, seedAdminFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

beforeEach(async () => resetDb());
afterAll(async () => prisma.$disconnect());

describe("Business.planId", () => {
  it("el business primario queda ligado a un plan y se puede leer", async () => {
    const ctx = await seedAdminFixture();
    const biz = await prisma.business.findUniqueOrThrow({ where: { id: ctx.biz.id }, include: { plan: true } });
    expect(biz.plan?.id).toBe(ctx.free.id);
    expect(biz.plan?.maxBranches).toBe(1);
  });
});
