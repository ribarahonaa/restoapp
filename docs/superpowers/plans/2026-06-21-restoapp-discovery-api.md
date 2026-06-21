# RestoApp Discovery API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer los endpoints públicos de descubrimiento de locales (`GET /branches/nearby` con los 5 filtros + geo PostGIS, `GET /branches/:id` ficha completa, `GET /purposes`) y sembrar datos de ejemplo para poder probar y para que el frontend (Plan 3) tenga pins reales.

**Architecture:** Se construye sobre la fundación (Express+TS, Prisma, Postgres+PostGIS). La query de cercanía usa SQL crudo via `prisma.$queryRaw` con `ST_DWithin`/`ST_Distance` sobre `geography(ST_MakePoint(lng,lat))`. Los filtros (categoría, propósito, promo activa, abierto ahora, radio) se componen como fragmentos `Prisma.sql` condicionales. La hora actual (weekday + HH:MM) y el `now` para promos se calculan en Node y se pasan como parámetros (control de timezone). Endpoints públicos, sin auth.

**Tech Stack:** Express, Prisma (`$queryRaw`, `Prisma.sql`), PostGIS, Zod (validación de query params), Vitest + Supertest.

---

## File Structure

```
api/src/
├── branches/
│   ├── branches.service.ts   # findNearby(filtros) + getBranchDetail(id)
│   ├── branches.routes.ts    # GET /branches/nearby, GET /branches/:id
│   └── nearby.sql.ts         # construcción de la query SQL de cercanía (fragmentos)
├── purposes/
│   └── purposes.routes.ts    # GET /purposes
├── seed/
│   └── seed-sample.ts        # datos demo: negocios, sucursales (geo Santiago), horarios, promos, tags
└── tests/
    ├── nearby.test.ts        # geo + cada filtro
    ├── branch-detail.test.ts # ficha + 404
    └── purposes.test.ts
```

**Responsabilidades:**
- `nearby.sql.ts` aísla la construcción de SQL (testeable, una sola responsabilidad).
- `branches.service.ts` orquesta query + forma de respuesta.
- `branches.routes.ts` valida params con Zod y delega.
- `seed-sample.ts` separado del `seed.ts` base (que tiene planes/tags/superadmin); este agrega contenido demo.

**Wiring:** `app.ts` ya existe; se le agregan `app.use("/branches", branchesRouter)` y `app.use("/purposes", purposesRouter)`.

---

## Task 1: Crear la geography column generada + índice GiST

La fundación dejó `lat`/`lng` como Float sin índice geo. Para que `ST_DWithin` use índice, agregamos una columna `geography` generada y un índice GiST mediante migración SQL.

**Files:**
- Create: `api/prisma/migrations/<timestamp>_branch_geography/migration.sql` (vía prisma migrate)
- Modify: `api/prisma/schema.prisma` (agregar campo no gestionado documentado)

- [ ] **Step 1: Crear migración vacía y editarla**

Run: `cd /home/ribacl/restoapp/api && DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx prisma migrate dev --create-only --name branch_geography`
Expected: crea el directorio de migración con un `migration.sql` (posiblemente vacío o con cambios pendientes; si no hay cambios de schema, queda vacío).

- [ ] **Step 2: Escribir el SQL de la columna generada + índice**

Contenido a poner en el `migration.sql` recién creado:

```sql
-- Columna geography generada desde lng/lat (WGS84) + índice GiST para ST_DWithin
ALTER TABLE "Branch"
  ADD COLUMN "geog" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED;

CREATE INDEX "Branch_geog_idx" ON "Branch" USING GIST ("geog");
```

- [ ] **Step 3: Aplicar la migración**

Run: `cd /home/ribacl/restoapp/api && DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx prisma migrate dev`
Expected: aplica la migración sin error. (La columna `geog` es generada; Prisma no la mapea en el client, se usa solo via SQL crudo.)

- [ ] **Step 4: Documentar la columna en schema.prisma**

En el modelo `Branch` de `api/prisma/schema.prisma`, agregar un comentario (NO un campo gestionado) justo después de `lng Float`:

```prisma
  lat         Float
  lng         Float
  // geog: geography(Point,4326) generada desde lng/lat (ver migración branch_geography).
  //       No mapeada por Prisma; usada solo en SQL crudo para ST_DWithin/ST_Distance.
```

- [ ] **Step 5: Verificar que el client sigue compilando**

Run: `cd /home/ribacl/restoapp/api && npx prisma generate && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat: add generated geography column and gist index to branch"
```

---

## Task 2: Seed de datos de ejemplo

Necesario ANTES de los tests de nearby (para tener locales reales con geo, horarios y promos). Coordenadas alrededor de Santiago de Chile.

**Files:**
- Create: `api/src/seed/seed-sample.ts`

- [ ] **Step 1: Implementar `api/src/seed/seed-sample.ts`**

```ts
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
```

- [ ] **Step 2: Correr el seed base y luego el sample**

Run:
```
cd /home/ribacl/restoapp/api && \
DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx tsx src/seed/seed.ts && \
DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx tsx src/seed/seed-sample.ts
```
Expected: imprime "Seed completo." y "Seed sample completo.".

- [ ] **Step 3: Verificar sucursales sembradas**

Run: `docker compose -f /home/ribacl/restoapp/docker-compose.yml exec -T postgres psql -U resto -d restoapp -c 'SELECT name, category FROM "Branch" ORDER BY name;'`
Expected: 6 sucursales.

- [ ] **Step 4: Commit**

```bash
git add api/src/seed/seed-sample.ts
git commit -m "feat: add sample seed with santiago branches, hours and promos"
```

---

## Task 3: Construcción de la query de cercanía (nearby.sql.ts)

**Files:**
- Create: `api/src/branches/nearby.sql.ts`
- Test: `api/src/tests/nearby-sql.test.ts`

- [ ] **Step 1: Escribir test que falla**

```ts
// api/src/tests/nearby-sql.test.ts
import { describe, it, expect } from "vitest";
import { buildNearbyQuery } from "../branches/nearby.sql.js";

const base = {
  lat: -33.4378,
  lng: -70.6504,
  radius: 5000,
  now: new Date("2026-06-21T15:00:00Z"),
  weekday: 0,
  hhmm: "12:00",
};

describe("buildNearbyQuery", () => {
  it("incluye ST_DWithin con lat/lng/radio como parámetros", () => {
    const q = buildNearbyQuery(base);
    // Prisma.Sql expone .sql (texto con placeholders) y .values
    expect(q.sql).toContain("ST_DWithin");
    expect(q.sql).toContain("ORDER BY distance");
    expect(q.values).toContain(5000);
  });

  it("agrega filtro de categoría cuando se entrega", () => {
    const q = buildNearbyQuery({ ...base, category: "bar" });
    expect(q.sql).toContain('"category"');
    expect(q.values).toContain("bar");
  });

  it("agrega filtro de propósito (slug) cuando se entrega", () => {
    const q = buildNearbyQuery({ ...base, purpose: "drinks" });
    expect(q.sql).toContain("BranchPurpose");
    expect(q.values).toContain("drinks");
  });

  it("agrega filtro de promo activa cuando promo=true", () => {
    const q = buildNearbyQuery({ ...base, promo: true });
    expect(q.sql).toContain("Promotion");
  });

  it("agrega filtro de abierto ahora cuando open=true", () => {
    const q = buildNearbyQuery({ ...base, open: true });
    expect(q.sql).toContain("ServiceHours");
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

Run: `cd /home/ribacl/restoapp/api && npx vitest run src/tests/nearby-sql.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `api/src/branches/nearby.sql.ts`**

```ts
import { Prisma } from "@prisma/client";

export interface NearbyParams {
  lat: number;
  lng: number;
  radius: number; // metros
  now: Date;
  weekday: number; // 0=domingo..6=sábado
  hhmm: string; // "HH:MM"
  category?: string;
  purpose?: string; // slug
  promo?: boolean;
  open?: boolean;
}

export function buildNearbyQuery(p: NearbyParams): Prisma.Sql {
  const origin = Prisma.sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`;

  const filters: Prisma.Sql[] = [Prisma.sql`b."active" = true`];
  filters.push(Prisma.sql`ST_DWithin(b."geog", ${origin}, ${p.radius})`);

  if (p.category) {
    filters.push(Prisma.sql`b."category" = ${p.category}::"Category"`);
  }
  if (p.purpose) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "BranchPurpose" bp
      JOIN "PurposeTag" pt ON pt."id" = bp."tagId"
      WHERE bp."branchId" = b."id" AND pt."slug" = ${p.purpose}
    )`);
  }
  if (p.promo) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Promotion" pr
      WHERE pr."branchId" = b."id" AND pr."active" = true
        AND ${p.now} BETWEEN pr."startsAt" AND pr."endsAt"
    )`);
  }
  if (p.open) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ServiceHours" sh
      WHERE sh."branchId" = b."id" AND sh."weekday" = ${p.weekday}
        AND ${p.hhmm} >= sh."openTime" AND ${p.hhmm} <= sh."closeTime"
    )`);
  }

  const where = Prisma.join(filters, " AND ");

  return Prisma.sql`
    SELECT b."id", b."name", b."category", b."address", b."lat", b."lng",
           b."phone", b."description",
           ST_Distance(b."geog", ${origin}) AS distance
    FROM "Branch" b
    WHERE ${where}
    ORDER BY distance ASC
    LIMIT 100
  `;
}
```

- [ ] **Step 4: Correr test, verificar que pasa**

Run: `cd /home/ribacl/restoapp/api && npx vitest run src/tests/nearby-sql.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/branches/nearby.sql.ts api/src/tests/nearby-sql.test.ts
git commit -m "feat: add composable nearby sql query builder"
```

---

## Task 4: branches.service.ts (findNearby + getBranchDetail)

**Files:**
- Create: `api/src/branches/branches.service.ts`

- [ ] **Step 1: Implementar `api/src/branches/branches.service.ts`**

```ts
import { prisma } from "../prisma.js";
import { buildNearbyQuery, type NearbyParams } from "./nearby.sql.js";
import { HttpError } from "../middleware/error.js";

export interface NearbyFilters {
  lat: number;
  lng: number;
  radius: number;
  category?: string;
  purpose?: string;
  promo?: boolean;
  open?: boolean;
}

export interface NearbyRow {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  distance: number;
}

export async function findNearby(f: NearbyFilters): Promise<NearbyRow[]> {
  const now = new Date();
  // weekday/hhmm en hora de Chile (America/Santiago) para "abierto ahora"
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = weekdayMap[parts.weekday as string] ?? 0;
  const hhmm = `${parts.hour}:${parts.minute}`;

  const query = buildNearbyQuery({ ...f, now, weekday, hhmm } as NearbyParams);
  return prisma.$queryRaw<NearbyRow[]>(query);
}

export async function getBranchDetail(id: string) {
  const now = new Date();
  const branch = await prisma.branch.findFirst({
    where: { id, active: true },
    include: {
      hours: { orderBy: { weekday: "asc" } },
      menuItems: true,
      promotions: {
        where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      },
      purposes: { include: { tag: true } },
    },
  });
  if (!branch) throw new HttpError(404, "branch_not_found");
  return branch;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd /home/ribacl/restoapp/api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/src/branches/branches.service.ts
git commit -m "feat: add branches service findNearby and getBranchDetail"
```

---

## Task 5: branches.routes.ts + purposes.routes.ts + wiring

**Files:**
- Create: `api/src/branches/branches.routes.ts`
- Create: `api/src/purposes/purposes.routes.ts`
- Modify: `api/src/app.ts`

- [ ] **Step 1: Implementar `api/src/branches/branches.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { findNearby, getBranchDetail } from "./branches.service.js";

export const branchesRouter = Router();

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50000).default(5000),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]).optional(),
  purpose: z.string().min(1).optional(),
  promo: z.coerce.boolean().optional(),
  open: z.coerce.boolean().optional(),
});

branchesRouter.get("/nearby", async (req, res, next) => {
  try {
    const f = nearbySchema.parse(req.query);
    res.json(await findNearby(f));
  } catch (e) {
    next(e);
  }
});

branchesRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await getBranchDetail(req.params.id));
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 2: Implementar `api/src/purposes/purposes.routes.ts`**

```ts
import { Router } from "express";
import { prisma } from "../prisma.js";

export const purposesRouter = Router();

purposesRouter.get("/", async (_req, res, next) => {
  try {
    const tags = await prisma.purposeTag.findMany({
      select: { slug: true, labelEs: true, labelEn: true, labelPt: true },
      orderBy: { slug: "asc" },
    });
    res.json(tags);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 3: Wire en `api/src/app.ts`**

Editar `createApp()` para registrar los routers ANTES de `app.use(errorHandler)`. El archivo resultante:

```ts
import express from "express";
import cors from "cors";
import { authRouter } from "./auth/auth.routes.js";
import { branchesRouter } from "./branches/branches.routes.js";
import { purposesRouter } from "./purposes/purposes.routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/branches", branchesRouter);
  app.use("/purposes", purposesRouter);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 4: Verificar que compila**

Run: `cd /home/ribacl/restoapp/api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add api/src/branches/branches.routes.ts api/src/purposes/purposes.routes.ts api/src/app.ts
git commit -m "feat: add discovery and purposes routes"
```

---

## Task 6: Tests de integración de nearby (geo + filtros)

**Files:**
- Create: `api/src/tests/nearby.test.ts`
- Modify: `api/src/tests/helpers.ts` (agregar helper de seed sample para tests)

- [ ] **Step 1: Agregar helper de seed a `api/src/tests/helpers.ts`**

Agregar al final del archivo (mantener `resetDb` existente):

```ts
import { hashPassword } from "../auth/password.js";

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
```

- [ ] **Step 2: Escribir `api/src/tests/nearby.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
const origin = { lat: "-33.4378", lng: "-70.6504" };

beforeEach(async () => {
  await resetDb();
  await seedDiscoveryFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /branches/nearby", () => {
  it("devuelve sucursales dentro del radio, ordenadas por distancia, sin inactivas", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000 });
    expect(res.status).toBe(200);
    const names = res.body.map((b: any) => b.name);
    expect(names).toContain("Cercano Lunch Promo");
    expect(names).toContain("Cercano Bar");
    expect(names).not.toContain("Lejano");
    expect(names).not.toContain("Inactivo");
    // distancia ascendente
    const dists = res.body.map((b: any) => b.distance);
    expect(dists).toEqual([...dists].sort((a, b) => a - b));
  });

  it("filtra por categoría", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, category: "bar" });
    expect(res.body.map((b: any) => b.name)).toEqual(["Cercano Bar"]);
  });

  it("filtra por propósito (slug)", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, purpose: "lunch" });
    expect(res.body.map((b: any) => b.name)).toEqual(["Cercano Lunch Promo"]);
  });

  it("filtra por promo activa", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, promo: "true" });
    expect(res.body.map((b: any) => b.name)).toEqual(["Cercano Lunch Promo"]);
  });

  it("incluye el lejano si el radio es grande", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 50000 });
    expect(res.body.map((b: any) => b.name)).toContain("Lejano");
  });

  it("400 si faltan lat/lng", async () => {
    const res = await request(app).get("/branches/nearby").query({ radius: 5000 });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Correr tests, verificar que pasan**

Run: `cd /home/ribacl/restoapp/api && npx vitest run src/tests/nearby.test.ts`
Expected: PASS (6 tests). (Postgres corriendo.)

- [ ] **Step 4: Commit**

```bash
git add api/src/tests/nearby.test.ts api/src/tests/helpers.ts
git commit -m "test: add nearby discovery integration tests"
```

---

## Task 7: Tests de ficha de sucursal y purposes

**Files:**
- Create: `api/src/tests/branch-detail.test.ts`
- Create: `api/src/tests/purposes.test.ts`

- [ ] **Step 1: Escribir `api/src/tests/branch-detail.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  await seedDiscoveryFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /branches/:id", () => {
  it("devuelve la ficha con horarios, carta, promos activas y propósitos", async () => {
    const branch = await prisma.branch.findFirstOrThrow({ where: { name: "Cercano Lunch Promo" } });
    const res = await request(app).get(`/branches/${branch.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Cercano Lunch Promo");
    expect(res.body.hours.length).toBe(7);
    expect(res.body.promotions.length).toBe(1);
    expect(res.body.purposes.length).toBe(1);
    expect(res.body.purposes[0].tag.slug).toBe("lunch");
  });

  it("404 si la sucursal no existe", async () => {
    const res = await request(app).get("/branches/no-existe");
    expect(res.status).toBe(404);
  });

  it("404 si la sucursal está inactiva", async () => {
    const branch = await prisma.branch.findFirstOrThrow({ where: { name: "Inactivo" } });
    const res = await request(app).get(`/branches/${branch.id}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Escribir `api/src/tests/purposes.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  await seedDiscoveryFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /purposes", () => {
  it("devuelve los tags con labels traducidos", async () => {
    const res = await request(app).get("/purposes");
    expect(res.status).toBe(200);
    const slugs = res.body.map((t: any) => t.slug);
    expect(slugs).toContain("lunch");
    expect(slugs).toContain("drinks");
    const lunch = res.body.find((t: any) => t.slug === "lunch");
    expect(lunch.labelEs).toBe("Almuerzo");
    expect(lunch.labelEn).toBe("Lunch");
    expect(lunch.labelPt).toBe("Almoço");
  });
});
```

- [ ] **Step 3: Correr tests, verificar que pasan**

Run: `cd /home/ribacl/restoapp/api && npx vitest run src/tests/branch-detail.test.ts src/tests/purposes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add api/src/tests/branch-detail.test.ts api/src/tests/purposes.test.ts
git commit -m "test: add branch detail and purposes tests"
```

---

## Task 8: Verificación final del discovery API

- [ ] **Step 1: Correr toda la suite**

Run: `cd /home/ribacl/restoapp/api && npx vitest run`
Expected: PASS — fundación (13) + discovery (nearby 6 + detail 3 + purposes 1 + nearby-sql 5 = 15) = 28 tests.

- [ ] **Step 2: Rebuild y levantar stack**

Run: `cd /home/ribacl/restoapp && docker compose up -d --build`
Expected: api/postgres/minio corriendo.

- [ ] **Step 3: Re-seed (base + sample) tras posibles wipes de tests**

Run:
```
cd /home/ribacl/restoapp/api && \
DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx tsx src/seed/seed.ts && \
DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx tsx src/seed/seed-sample.ts
```
Expected: "Seed completo." y "Seed sample completo.".

- [ ] **Step 4: Probar nearby en el navegador / curl (GET, sí funciona en browser)**

Run: `curl -s "http://localhost:3000/branches/nearby?lat=-33.4378&lng=-70.6504&radius=5000" | head -c 600`
Expected: JSON array con sucursales cercanas (Café Central, Bar Bellavista, etc.), cada una con `distance`. URL abrible en browser.

- [ ] **Step 5: Probar filtros**

Run:
```
curl -s "http://localhost:3000/branches/nearby?lat=-33.4378&lng=-70.6504&radius=5000&category=bar" | head -c 300
echo
curl -s "http://localhost:3000/branches/nearby?lat=-33.4378&lng=-70.6504&radius=5000&promo=true" | head -c 300
echo
curl -s "http://localhost:3000/purposes"
```
Expected: bar → solo bares; promo=true → solo con promo activa; purposes → 4 tags traducidos.

- [ ] **Step 6: Commit final (si quedaron cambios)**

```bash
cd /home/ribacl/restoapp && git add -A && git commit -m "chore: discovery api verified" || echo "nada que commitear"
```

---

## Notas para Plan 3 (frontend web PWA)

- Endpoints listos para el front: `GET /branches/nearby` (browser-abrible), `GET /branches/:id`, `GET /purposes`.
- El front consume estos para: mapa con pins (Leaflet+OSM), barra de filtros (categoría/propósito/promo/abierto/radio), ficha de sucursal.
- `distance` viene en metros — el front lo formatea (m/km).
- CORS ya está abierto (`cors()`), el front en :5173 podrá llamar al API en :3000 sin problema en dev.
- Datos demo ya sembrados (6 sucursales en Santiago) para ver pins reales.
```
