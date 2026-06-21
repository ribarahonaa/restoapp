import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";

async function main() {
  // Planes
  await prisma.plan.upsert({
    where: { name: "Free" },
    update: {},
    create: { name: "Free", maxPromos: 1, maxMenuItems: 10 },
  });
  await prisma.plan.upsert({
    where: { name: "Pro" },
    update: {},
    create: { name: "Pro", maxPromos: 100, maxMenuItems: 500 },
  });

  // Purpose tags
  const tags = [
    { slug: "lunch", labelEs: "Almuerzo", labelEn: "Lunch", labelPt: "Almoço" },
    { slug: "drinks", labelEs: "Tragos", labelEn: "Drinks", labelPt: "Drinks" },
    { slug: "dinner", labelEs: "Cena", labelEn: "Dinner", labelPt: "Jantar" },
    { slug: "coffee", labelEs: "Café", labelEn: "Coffee", labelPt: "Café" },
  ];
  for (const t of tags) {
    await prisma.purposeTag.upsert({
      where: { slug: t.slug },
      update: t,
      create: t,
    });
  }

  // Superadmin
  const email = "admin@restoapp.cl";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Super Admin",
      role: "superadmin",
      passwordHash: await hashPassword("admin12345"),
    },
  });

  console.log("Seed completo.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
