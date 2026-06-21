import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

beforeEach(async () => {
  await resetDb();
  await seedDiscoveryFixture();
});
afterAll(async () => prisma.$disconnect());

describe("schema fase 4", () => {
  it("crea un Ad y un DiscountCode ligados a un business", async () => {
    const biz = await prisma.business.findFirstOrThrow();
    const ad = await prisma.ad.create({
      data: {
        businessId: biz.id,
        title: "Promo verano",
        placement: "section",
        startsAt: new Date("2020-01-01"),
        endsAt: new Date("2999-01-01"),
        createdBy: "tester",
      },
    });
    expect(ad.active).toBe(true);
    const code = await prisma.discountCode.create({
      data: {
        businessId: biz.id,
        code: "VERANO20",
        type: "percent",
        value: "20",
        startsAt: new Date("2020-01-01"),
        endsAt: new Date("2999-01-01"),
      },
    });
    expect(code.type).toBe("percent");
  });
});
