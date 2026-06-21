import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";
import { ensureBucket, uploadFromUrl, publicUrl } from "../storage/minio.js";

// Imágenes fuente (Unsplash). Se descargan una vez y quedan servidas desde MinIO.
const SRC: Record<string, string> = {
  "branch-cafe": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=70",
  "branch-bar": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=70",
  "branch-pub": "https://images.unsplash.com/photo-1538488881038-e252a119ace7?auto=format&fit=crop&w=900&q=70",
  "branch-restaurant": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=70",
  "dish-1": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=70",
  "dish-2": "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=700&q=70",
  "dish-3": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=70",
  "drink-1": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=700&q=70",
  "drink-2": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=700&q=70",
  "coffee-1": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=70",
  "dessert-1": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=700&q=70",
  "promo-1": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=70",
  "promo-2": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=70",
};

// Sube todas las fuentes a MinIO (idempotente). Si alguna falla, queda en null
// y el frontend cae al gradiente por categoría.
async function uploadAssets(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const [key, url] of Object.entries(SRC)) {
    try {
      out[key] = await uploadFromUrl(url, `seed/${key}.jpg`);
    } catch (e) {
      console.warn(`  ⚠ no se pudo subir ${key}: ${(e as Error).message}`);
      out[key] = null;
    }
  }
  return out;
}

interface MenuSpec {
  name: string;
  description: string;
  price: string;
  category: string;
  img: string;
}

async function main() {
  console.log("Asegurando bucket MinIO…");
  await ensureBucket();
  console.log("Subiendo imágenes a MinIO…");
  const img = await uploadAssets();

  const free = await prisma.plan.findUniqueOrThrow({ where: { name: "Free" } });
  const proPlan = await prisma.plan.findUnique({ where: { name: "Pro" } });

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
    update: { planId: proPlan?.id ?? null },
    create: { id: "demo-business", name: "Grupo Gastronómico Demo", ownerUserId: owner.id, planId: proPlan?.id ?? null },
  });

  const tags = await prisma.purposeTag.findMany();
  const tagBySlug = Object.fromEntries(tags.map((t) => [t.slug, t.id]));

  const allDayHours = Array.from({ length: 7 }, (_, wd) => ({
    weekday: wd,
    openTime: "08:00",
    closeTime: "23:59",
  }));

  // Menús por categoría de local
  const menus: Record<string, MenuSpec[]> = {
    cafe: [
      { name: "Café Latte", description: "Espresso doble con leche texturizada y arte latte.", price: "3500", category: "Bebidas", img: "coffee-1" },
      { name: "Tostado de Jamón y Queso", description: "Pan de masa madre, jamón serrano y queso fundido.", price: "5200", category: "Para comer", img: "dish-2" },
      { name: "Cheesecake de Frutos Rojos", description: "Base de galleta, crema suave y salsa de berries.", price: "4200", category: "Postres", img: "dessert-1" },
    ],
    restaurant: [
      { name: "Pizza Margherita", description: "Masa artesanal, tomate San Marzano, mozzarella y albahaca.", price: "9900", category: "Principales", img: "dish-1" },
      { name: "Risotto de Hongos", description: "Arroz carnaroli, mix de hongos y parmesano.", price: "10500", category: "Principales", img: "dish-3" },
      { name: "Tiramisú", description: "Clásico italiano con mascarpone y café.", price: "4800", category: "Postres", img: "dessert-1" },
    ],
    bar: [
      { name: "Cóctel de la Casa", description: "Gin, cítricos y un toque de romero.", price: "6500", category: "Tragos", img: "drink-1" },
      { name: "Tabla para Compartir", description: "Quesos, embutidos y encurtidos.", price: "11900", category: "Para picar", img: "dish-2" },
      { name: "Negroni", description: "Gin, vermouth rojo y bitter. Clásico amargo.", price: "6900", category: "Tragos", img: "drink-2" },
    ],
    pub: [
      { name: "Cerveza Artesanal IPA", description: "Lúpulo intenso, amarga y aromática. Pinta 500cc.", price: "4900", category: "Cervezas", img: "drink-2" },
      { name: "Hamburguesa Doble", description: "Doble carne, cheddar, tocino y papas rústicas.", price: "8900", category: "Para comer", img: "dish-2" },
      { name: "Alitas BBQ", description: "Alitas glaseadas en salsa BBQ ahumada.", price: "7200", category: "Para picar", img: "dish-3" },
    ],
  };

  const reviewsByVibe: { authorName: string; rating: number; comment: string }[][] = [
    [
      { authorName: "Camila R.", rating: 5, comment: "Excelente ambiente y atención. Volveré seguro." },
      { authorName: "Diego P.", rating: 4, comment: "Muy rico todo, un poco lleno los fines de semana." },
      { authorName: "Fran M.", rating: 5, comment: "De lo mejor del barrio." },
    ],
    [
      { authorName: "Valentina S.", rating: 4, comment: "Buena comida, precios justos." },
      { authorName: "Joaquín T.", rating: 3, comment: "Estuvo bien, la atención algo lenta." },
      { authorName: "Antonia L.", rating: 5, comment: "Me encantó, super recomendable." },
      { authorName: "Pedro G.", rating: 4, comment: "Rico y acogedor." },
    ],
  ];

  const samples = [
    { id: "b-cafe-centro", name: "Café Central", category: "cafe" as const, lat: -33.4378, lng: -70.6504, purposes: ["coffee", "lunch"], promo: true },
    { id: "b-bar-bellas", name: "Bar Bellavista", category: "bar" as const, lat: -33.433, lng: -70.635, purposes: ["drinks", "dinner"], promo: true },
    { id: "b-resto-lastarria", name: "Restaurante Lastarria", category: "restaurant" as const, lat: -33.438, lng: -70.64, purposes: ["lunch", "dinner"], promo: false },
    { id: "b-pub-italia", name: "Pub Barrio Italia", category: "pub" as const, lat: -33.455, lng: -70.628, purposes: ["drinks"], promo: false },
    { id: "b-cafe-prov", name: "Café Providencia", category: "cafe" as const, lat: -33.426, lng: -70.616, purposes: ["coffee"], promo: true },
    { id: "b-resto-maipu", name: "Restaurante Maipú", category: "restaurant" as const, lat: -33.511, lng: -70.758, purposes: ["lunch"], promo: false },
  ];

  const ids = samples.map((s) => s.id);
  // Limpieza de hijos demo para re-sembrar de forma idempotente.
  await prisma.review.deleteMany({ where: { branchId: { in: ids } } });
  await prisma.menuItem.deleteMany({ where: { branchId: { in: ids } } });
  await prisma.promotion.deleteMany({ where: { branchId: { in: ids } } });
  await prisma.serviceHours.deleteMany({ where: { branchId: { in: ids } } });
  await prisma.branchPurpose.deleteMany({ where: { branchId: { in: ids } } });

  for (const [i, s] of samples.entries()) {
    const menu = menus[s.category].map((m) => ({
      name: m.name,
      description: m.description,
      price: m.price,
      category: m.category,
      imageUrl: img[m.img],
    }));
    const reviews = reviewsByVibe[i % reviewsByVibe.length];
    const promotions = s.promo
      ? {
          create: [
            {
              title: "2x1 en Tragos",
              description: "Lleva dos y paga uno en toda la carta de tragos, de lunes a jueves.",
              imageUrl: img["promo-1"],
              startsAt: new Date("2020-01-01T00:00:00Z"),
              endsAt: new Date("2999-01-01T00:00:00Z"),
              active: true,
            },
            {
              title: "Happy Hour 18–20h",
              description: "Descuentos especiales en la previa. Todos los días.",
              imageUrl: img["promo-2"],
              startsAt: new Date("2020-01-01T00:00:00Z"),
              endsAt: new Date("2999-01-01T00:00:00Z"),
              active: true,
            },
          ],
        }
      : undefined;

    const children = {
      imageUrl: img[`branch-${s.category}`],
      hours: { create: allDayHours },
      purposes: { create: s.purposes.map((slug) => ({ tagId: tagBySlug[slug] })) },
      menuItems: { create: menu },
      reviews: { create: reviews },
      ...(promotions ? { promotions } : {}),
    };

    await prisma.branch.upsert({
      where: { id: s.id },
      update: children,
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
        ...children,
      },
    });
  }

  console.log(`Seed sample completo. Bucket público: ${publicUrl("seed/")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
