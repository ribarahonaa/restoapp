import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";

export async function resetDb() {
  // orden respeta FKs
  await prisma.placeSuggestion.deleteMany();
  await prisma.review.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adRequest.deleteMany();
  await prisma.planUpgradeRequest.deleteMany();
  await prisma.discountCode.deleteMany();
  await prisma.branchPurpose.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.serviceHours.deleteMany();
  await prisma.branchAdmin.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.business.deleteMany();
  await prisma.purposeTag.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();
}

// Siembra un conjunto mínimo y determinista para tests de discovery.
export async function seedDiscoveryFixture() {
  const free = await prisma.plan.create({ data: { name: "Free", maxPromos: 1, maxMenuItems: 10 } });
  const lunch = await prisma.purposeTag.create({
    data: { slug: "lunch", labelEs: "Almuerzo", labelEn: "Lunch", labelPt: "Almoço" },
  });
  const drinks = await prisma.purposeTag.create({
    data: { slug: "drinks", labelEs: "Tragos", labelEn: "Drinks", labelPt: "Drinks" },
  });
  const owner = await prisma.user.create({
    data: { email: "o@t.cl", name: "O", role: "admin_general", passwordHash: await hashPassword("clave1234") },
  });
  const biz = await prisma.business.create({ data: { name: "Biz", ownerUserId: owner.id } });

  // cercano con promo activa + abierto todos los días + tag lunch
  await prisma.branch.create({
    data: {
      name: "Cercano Lunch Promo", category: "restaurant", address: "x",
      lat: -33.4378, lng: -70.6504, planId: free.id, businessId: biz.id,
      hours: { create: Array.from({ length: 7 }, (_, wd) => ({ weekday: wd, openTime: "00:00", closeTime: "23:59" })) },
      purposes: { create: [{ tagId: lunch.id }] },
      promotions: { create: [{ title: "Promo", startsAt: new Date("2000-01-01"), endsAt: new Date("2999-01-01"), active: true }] },
    },
  });
  // cercano bar con tag drinks, SIN promo, cerrado (sin horarios)
  await prisma.branch.create({
    data: {
      name: "Cercano Bar", category: "bar", address: "x",
      lat: -33.4380, lng: -70.6500, planId: free.id, businessId: biz.id,
      purposes: { create: [{ tagId: drinks.id }] },
    },
  });
  // lejano (>5km)
  await prisma.branch.create({
    data: {
      name: "Lejano", category: "restaurant", address: "x",
      lat: -33.5110, lng: -70.7580, planId: free.id, businessId: biz.id,
    },
  });
  // inactivo (no debe aparecer nunca)
  await prisma.branch.create({
    data: {
      name: "Inactivo", category: "restaurant", address: "x",
      lat: -33.4379, lng: -70.6505, planId: free.id, businessId: biz.id, active: false,
    },
  });
}
