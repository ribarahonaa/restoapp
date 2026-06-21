import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";

// Centro de referencia: Plaza de Armas, Santiago (-33.4378, -70.6504)
async function main() {
  const free = await prisma.plan.findUniqueOrThrow({ where: { name: "Free" } });

  // Dueño demo (admin_general)
  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.cl" },
    update: {},
    create: {
      email: "owner@demo.cl",
      name: "Dueño Demo",
      role: "admin_general",
      passwordHash: await hashPassword("owner12345"),
    },
  });

  const business = await prisma.business.upsert({
    where: { id: "demo-business" },
    update: {},
    create: { id: "demo-business", name: "Grupo Gastronómico Demo", ownerUserId: owner.id },
  });

  const tags = await prisma.purposeTag.findMany();
  const tagBySlug = Object.fromEntries(tags.map((t) => [t.slug, t.id]));

  // weekday 0=domingo..6=sábado; horario amplio para que "abierto ahora" sea fácil de ver
  const allDayHours = Array.from({ length: 7 }, (_, wd) => ({
    weekday: wd,
    openTime: "08:00",
    closeTime: "23:59",
  }));

  const samples = [
    { id: "b-cafe-centro", name: "Café Central", category: "cafe" as const,
      lat: -33.4378, lng: -70.6504, purposes: ["coffee", "lunch"], promo: true },
    { id: "b-bar-bellas", name: "Bar Bellavista", category: "bar" as const,
      lat: -33.4330, lng: -70.6350, purposes: ["drinks", "dinner"], promo: true },
    { id: "b-resto-lastarria", name: "Restaurante Lastarria", category: "restaurant" as const,
      lat: -33.4380, lng: -70.6400, purposes: ["lunch", "dinner"], promo: false },
    { id: "b-pub-italia", name: "Pub Barrio Italia", category: "pub" as const,
      lat: -33.4550, lng: -70.6280, purposes: ["drinks"], promo: false },
    { id: "b-cafe-prov", name: "Café Providencia", category: "cafe" as const,
      lat: -33.4260, lng: -70.6160, purposes: ["coffee"], promo: true },
    // Lejano (>5km) para validar el filtro de radio:
    { id: "b-resto-maipu", name: "Restaurante Maipú", category: "restaurant" as const,
      lat: -33.5110, lng: -70.7580, purposes: ["lunch"], promo: false },
  ];

  for (const s of samples) {
    await prisma.branch.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        businessId: business.id,
        name: s.name,
        category: s.category,
        address: `${s.name}, Santiago`,
        lat: s.lat,
        lng: s.lng,
        planId: free.id,
        active: true,
        hours: { create: allDayHours },
        purposes: { create: s.purposes.map((slug) => ({ tagId: tagBySlug[slug] })) },
        menuItems: {
          create: [
            { name: "Plato del día", description: "Demo", price: "6990" },
            { name: "Bebida", description: "Demo", price: "1990" },
          ],
        },
        promotions: s.promo
          ? {
              create: [
                {
                  title: "2x1 Demo",
                  description: "Promo activa de ejemplo",
                  startsAt: new Date("2020-01-01T00:00:00Z"),
                  endsAt: new Date("2999-01-01T00:00:00Z"),
                  active: true,
                },
              ],
            }
          : undefined,
      },
    });
  }

  console.log("Seed sample completo.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
