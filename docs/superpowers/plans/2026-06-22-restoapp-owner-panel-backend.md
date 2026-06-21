# RestoApp Capa 2A — Backend del panel del dueño + discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir toda la API privada que el dueño usa para gestionar sus sucursales (datos, imagen, horarios, cierre temporal, menú, promos, códigos de descuento, crear sucursal y solicitudes de upgrade/anuncio) con límites por plan, más los cambios del discovery público (cupones en la ficha y `closedUntil` en cercanía/detalle).

**Architecture:** Sobre el router `admin` de capa 1 (ya protegido por `authenticate` + `authorize`) se montan sub-routers por recurso. Cada recurso de sucursal va bajo `/admin/branches/:branchId/...` con el middleware `requireBranchAccess` de capa 1 resolviendo ownership por rol. El plan vive en `Business` (`Business.planId`); los límites se cuentan contra `branch.business.plan`. Cada recurso es un módulo `*.service.ts` (lógica + Prisma) + `*.routes.ts` (Router + Zod), siguiendo el patrón existente de `branches`. El discovery suma `closedUntil` y los `DiscountCode` vigentes.

**Tech Stack:** Express, Prisma 5 (Postgres+PostGIS), Zod, Vitest+Supertest. ESM/TypeScript.

## Global Constraints

- Commits: autor **ribarahonaa <ribarahonaa@gmail.com>**, fijado **por commit** con `git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "..."`. **NO** incluir `Co-Authored-By` ni ninguna referencia a Claude/AI. (La config global del repo es otra cuenta; por eso se fija por commit.)
- Migraciones Prisma: **manuales** (SQL escrito a mano + `docker compose exec -T api npx prisma migrate deploy` + `npx prisma generate`). **Nunca** `migrate dev` (es interactivo y quiere dropear la columna PostGIS `geog`).
- Comandos de API corren dentro del contenedor: `docker compose exec -T api <cmd>`. El stack está levantado.
- `imageUrl` siempre se persiste como URL pública de MinIO; el cliente la sube por `POST /admin/uploads` (capa 1). Estos endpoints solo reciben/guardan el string `imageUrl`.
- Roles (enum `Role`): `superadmin`, `admin_general`, `admin_sucursal`, `usuario`.
- TypeScript ESM: imports relativos con extensión `.js`.
- El plan gobierna por **empresa**: `Business.planId`. `maxBranches` cuenta sucursales de la empresa; `maxPromos`/`maxMenuItems` cuentan por sucursal usando `branch.business.plan`. Si `business.plan` es `null` → sin límite (no se bloquea).
- Códigos de error de límite: `plan_limit_branches`, `plan_limit_promos`, `plan_limit_menu` (HttpError 403).

---

## File Structure

**Backend (api/):**
- `prisma/schema.prisma` — modificar: `Business.planId`/`plan` + `Plan.businesses`.
- `prisma/migrations/20260622070000_business_plan/migration.sql` — crear.
- `src/middleware/ownership.ts` — modificar: agregar `requireBusinessAccess`.
- `src/admin/owner.service.ts` — crear: helpers compartidos (`listManagedBranches`, `getManagedBranch`, `planLimitFor`).
- `src/admin/branches.routes.ts` — crear: leer/editar/activar/cerrar sucursal + crear sucursal + horarios.
- `src/admin/menu.routes.ts` — crear: CRUD de menú + límite.
- `src/admin/promotions.routes.ts` — crear: CRUD de promos + límite.
- `src/admin/discounts.routes.ts` — crear: CRUD de códigos de descuento.
- `src/admin/requests.routes.ts` — crear: crear solicitudes upgrade/anuncio.
- `src/admin/admin.routes.ts` — modificar: montar los sub-routers nuevos.
- `src/branches/nearby.sql.ts` — modificar: el filtro `open` considera `closedUntil`.
- `src/branches/branches.service.ts` — modificar: `getBranchDetail` devuelve `closedUntil` + `discountCodes` vigentes.
- `src/seed/seed-sample.ts` — modificar: asignar `planId` al business demo.
- `src/tests/helpers.ts` — modificar: extender `seedAdminFixture` (plan del business + plan `pro`).
- `src/tests/admin-business-plan.test.ts`, `owner-branches.test.ts`, `owner-branch-mutations.test.ts`, `owner-hours.test.ts`, `owner-menu.test.ts`, `owner-promotions.test.ts`, `owner-discounts.test.ts`, `owner-create-branch.test.ts`, `owner-requests.test.ts`, `discovery-closed-coupons.test.ts` — crear.

---

## Task 1: Schema — el plan vive en `Business`

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260622070000_business_plan/migration.sql`
- Modify: `api/src/seed/seed-sample.ts`
- Modify: `api/src/tests/helpers.ts`
- Test: `api/src/tests/admin-business-plan.test.ts`

**Interfaces:**
- Produces: `Business.planId: string | null` + relación `Business.plan`. `seedAdminFixture` ahora retorna además `pro: Plan` y el `biz` queda con `planId = free.id`.

- [ ] **Step 1: Agregar la relación de plan a `Business` y `Plan`**

En `api/prisma/schema.prisma`, dentro de `model Business`, tras `ownerUserId String` + su relación `owner`, agregar:
```prisma
  planId      String?
  plan        Plan?    @relation(fields: [planId], references: [id])
```
Y agregar al final de los `@@index` de `Business`:
```prisma
  @@index([planId])
```
Dentro de `model Plan`, junto a `branches Branch[]`, agregar:
```prisma
  businesses   Business[]
```

- [ ] **Step 2: Escribir la migración SQL a mano**

Crear `api/prisma/migrations/20260622070000_business_plan/migration.sql`:
```sql
ALTER TABLE "Business" ADD COLUMN "planId" TEXT;
CREATE INDEX "Business_planId_idx" ON "Business"("planId");
ALTER TABLE "Business" ADD CONSTRAINT "Business_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Aplicar migración y regenerar cliente**

Run:
```bash
docker compose exec -T api npx prisma migrate deploy
docker compose exec -T api npx prisma generate
```
Expected: "All migrations have been successfully applied." y cliente regenerado sin error.

- [ ] **Step 4: Asignar plan al business demo en el seed**

En `api/src/seed/seed-sample.ts`, localizar la creación/upsert del business demo (el que tiene `owner@demo.cl` como dueño). Asegurar que exista un plan "Pro" (creado en `seed.ts`) y setear `planId` del business demo a ese plan, para que la data demo (con 2 promos en algunas sucursales) no choque con el límite Free. Buscar `prisma.plan.findUnique`/`findFirst` por `name: "Pro"`; si el seed-sample no tiene referencia al plan, agregar al inicio (tras `ensureBucket()`):
```ts
const proPlan = await prisma.plan.findUnique({ where: { name: "Pro" } });
```
y en el upsert/creación del business demo agregar `planId: proPlan?.id ?? null` al `data`. Si el business se crea con `prisma.business.upsert`/`create`, incluir el campo en ambos `create` y `update`.

- [ ] **Step 5: Extender `seedAdminFixture` con plan del business y un plan `pro`**

En `api/src/tests/helpers.ts`, en `seedAdminFixture`, tras crear `free`, agregar un segundo plan y asignar el plan al business primario:
```ts
  const pro = await prisma.plan.create({ data: { name: "Pro", maxPromos: 100, maxMenuItems: 500, maxBranches: 5 } });
```
Cambiar la creación de `biz` para incluir el plan:
```ts
  const biz = await prisma.business.create({ data: { name: "Mi Empresa", ownerUserId: general.id, planId: free.id } });
```
Y agregar `pro` al objeto retornado:
```ts
  return { general, sucursal, otro, biz, otroBiz, branch, otherBranch, free, pro };
```
(No cambiar `otroBiz`: queda sin plan, útil para probar el caso "sin límite".)

- [ ] **Step 6: Escribir el test**

Crear `api/src/tests/admin-business-plan.test.ts`:
```ts
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
```

- [ ] **Step 7: Ejecutar el test**

Run: `docker compose exec -T api npx vitest run src/tests/admin-business-plan.test.ts`
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/20260622070000_business_plan api/src/seed/seed-sample.ts api/src/tests/helpers.ts api/src/tests/admin-business-plan.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): el plan vive en Business (planId) para límites por empresa"
```

---

## Task 2: Leer las sucursales gestionadas

**Files:**
- Create: `api/src/admin/owner.service.ts`
- Create: `api/src/admin/branches.routes.ts`
- Modify: `api/src/admin/admin.routes.ts`
- Test: `api/src/tests/owner-branches.test.ts`

**Interfaces:**
- Consumes: `requireBranchAccess` (capa 1), `req.user` (`{ sub, role }`), `prisma`, `HttpError`.
- Produces:
  - `listManagedBranches(user: { sub: string; role: string }): Promise<ManagedBranch[]>` — sucursales que el usuario puede gestionar.
  - `getManagedBranch(branchId: string): Promise<BranchEditDetail>` — detalle editable de una sucursal.
  - `planLimitFor(branchId: string, kind: "menu" | "promos"): Promise<{ max: number | null; count: number }>` — usado por Tasks 5 y 6.
  - Router `ownerBranchesRouter` montado en `/admin/branches`.
  - `GET /admin/branches` → 200 lista; `GET /admin/branches/:branchId` → 200 detalle (403/404 por ownership).

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-branches.test.ts`:
```ts
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

describe("GET /admin/branches", () => {
  it("admin_general ve solo las sucursales de su empresa", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get("/admin/branches").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((b: any) => b.id);
    expect(ids).toContain(ctx.branch.id);
    expect(ids).not.toContain(ctx.otherBranch.id);
  });

  it("admin_sucursal ve solo su sucursal asignada", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).get("/admin/branches").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(ctx.branch.id);
  });

  it("la lista incluye límites del plan y conteos", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get("/admin/branches").set("Authorization", `Bearer ${token}`);
    const b = res.body.find((x: any) => x.id === ctx.branch.id);
    expect(b.plan).toMatchObject({ maxPromos: 1, maxMenuItems: 10, maxBranches: 1 });
    expect(b.counts).toEqual({ menuItems: 0, promotions: 0 });
  });
});

describe("GET /admin/branches/:branchId", () => {
  it("devuelve el detalle editable de una sucursal propia", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get(`/admin/branches/${ctx.branch.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: ctx.branch.id, name: "Mi Local" });
    expect(Array.isArray(res.body.hours)).toBe(true);
  });

  it("403 si la sucursal es de otra empresa", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get(`/admin/branches/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-branches.test.ts`
Expected: FAIL (404, no existen las rutas).

- [ ] **Step 3: Implementar el service**

Crear `api/src/admin/owner.service.ts`:
```ts
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";

interface SessionUser {
  sub: string;
  role: string;
}

// Sucursales que el usuario puede gestionar, con límites del plan de la empresa y conteos.
export async function listManagedBranches(user: SessionUser) {
  let where: Record<string, unknown>;
  if (user.role === "superadmin") {
    where = {};
  } else if (user.role === "admin_general") {
    where = { business: { ownerUserId: user.sub } };
  } else {
    where = { admins: { some: { userId: user.sub } } };
  }
  const branches = await prisma.branch.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      business: { select: { id: true, name: true, plan: true } },
      _count: { select: { menuItems: true, promotions: true } },
    },
  });
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    address: b.address,
    active: b.active,
    closedUntil: b.closedUntil,
    imageUrl: b.imageUrl,
    businessId: b.business.id,
    businessName: b.business.name,
    plan: b.business.plan
      ? { maxPromos: b.business.plan.maxPromos, maxMenuItems: b.business.plan.maxMenuItems, maxBranches: b.business.plan.maxBranches }
      : null,
    counts: { menuItems: b._count.menuItems, promotions: b._count.promotions },
  }));
}

// Detalle editable de una sucursal (datos + horarios + menú + promos + descuentos vigentes/no).
export async function getManagedBranch(branchId: string) {
  const b = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      hours: { orderBy: { weekday: "asc" } },
      menuItems: { orderBy: { updatedAt: "desc" } },
      promotions: { orderBy: { updatedAt: "desc" } },
      discountCodes: { orderBy: { createdAt: "desc" } },
      business: { select: { id: true, name: true, plan: true } },
    },
  });
  if (!b) throw new HttpError(404, "branch_not_found");
  return b;
}

// Límite del plan de la empresa para un recurso + conteo actual de la sucursal.
export async function planLimitFor(branchId: string, kind: "menu" | "promos") {
  const b = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      business: { select: { plan: { select: { maxMenuItems: true, maxPromos: true } } } },
      _count: { select: { menuItems: true, promotions: true } },
    },
  });
  if (!b) throw new HttpError(404, "branch_not_found");
  const plan = b.business.plan;
  if (kind === "menu") return { max: plan?.maxMenuItems ?? null, count: b._count.menuItems };
  return { max: plan?.maxPromos ?? null, count: b._count.promotions };
}
```

- [ ] **Step 4: Implementar las rutas de lectura**

Crear `api/src/admin/branches.routes.ts`:
```ts
import { Router } from "express";
import { requireBranchAccess } from "../middleware/ownership.js";
import { listManagedBranches, getManagedBranch } from "./owner.service.js";

export const ownerBranchesRouter = Router();

ownerBranchesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listManagedBranches(req.user!));
  } catch (e) {
    next(e);
  }
});

ownerBranchesRouter.get("/:branchId", requireBranchAccess(), async (req, res, next) => {
  try {
    res.json(await getManagedBranch(req.params.branchId));
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 5: Montar el router**

En `api/src/admin/admin.routes.ts`, agregar el import y montar (tras `adminRouter.use("/uploads", uploadsRouter);`):
```ts
import { ownerBranchesRouter } from "./branches.routes.js";
// ...
adminRouter.use("/branches", ownerBranchesRouter);
```

- [ ] **Step 6: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-branches.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add api/src/admin/owner.service.ts api/src/admin/branches.routes.ts api/src/admin/admin.routes.ts api/src/tests/owner-branches.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): listar y leer las sucursales gestionadas por el dueño"
```

---

## Task 3: Editar datos, activar/desactivar y cerrar/reabrir

**Files:**
- Modify: `api/src/admin/branches.routes.ts`
- Test: `api/src/tests/owner-branch-mutations.test.ts`

**Interfaces:**
- Consumes: `requireBranchAccess`, `req.user`, `prisma`, `HttpError`, Zod.
- Produces:
  - `PATCH /admin/branches/:branchId` (ambos roles) — actualiza `name, category, address, lat, lng, phone, description, imageUrl` (todos opcionales).
  - `POST /admin/branches/:branchId/active` body `{ active: boolean }` — solo `admin_general`/`superadmin` (admin_sucursal → 403 `forbidden_role`).
  - `POST /admin/branches/:branchId/close` body `{ until: ISO datetime string }` — ambos; set `closedUntil`.
  - `POST /admin/branches/:branchId/reopen` — ambos; set `closedUntil = null`.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-branch-mutations.test.ts`:
```ts
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

const auth = async (email: string) => `Bearer ${await tokenFor(email)}`;

describe("PATCH /admin/branches/:branchId", () => {
  it("actualiza datos de la sucursal", async () => {
    const res = await request(app)
      .patch(`/admin/branches/${ctx.branch.id}`)
      .set("Authorization", await auth("general@demo.cl"))
      .send({ name: "Nuevo Nombre", phone: "+56911112222" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nuevo Nombre");
    const fresh = await prisma.branch.findUniqueOrThrow({ where: { id: ctx.branch.id } });
    expect(fresh.phone).toBe("+56911112222");
  });

  it("admin_sucursal también puede editar su sucursal", async () => {
    const res = await request(app)
      .patch(`/admin/branches/${ctx.branch.id}`)
      .set("Authorization", await auth("sucursal@demo.cl"))
      .send({ description: "Editado por sucursal" });
    expect(res.status).toBe(200);
  });
});

describe("POST /admin/branches/:branchId/active", () => {
  it("admin_general desactiva la sucursal", async () => {
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/active`)
      .set("Authorization", await auth("general@demo.cl"))
      .send({ active: false });
    expect(res.status).toBe(200);
    const fresh = await prisma.branch.findUniqueOrThrow({ where: { id: ctx.branch.id } });
    expect(fresh.active).toBe(false);
  });

  it("admin_sucursal NO puede activar/desactivar (403)", async () => {
    const res = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/active`)
      .set("Authorization", await auth("sucursal@demo.cl"))
      .send({ active: false });
    expect(res.status).toBe(403);
  });
});

describe("cierre temporal", () => {
  it("close setea closedUntil y reopen lo limpia", async () => {
    const until = new Date(Date.now() + 3600_000).toISOString();
    const closed = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/close`)
      .set("Authorization", await auth("sucursal@demo.cl"))
      .send({ until });
    expect(closed.status).toBe(200);
    expect(new Date(closed.body.closedUntil).toISOString()).toBe(until);

    const reopened = await request(app)
      .post(`/admin/branches/${ctx.branch.id}/reopen`)
      .set("Authorization", await auth("sucursal@demo.cl"));
    expect(reopened.status).toBe(200);
    expect(reopened.body.closedUntil).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-branch-mutations.test.ts`
Expected: FAIL (404 en las rutas nuevas).

- [ ] **Step 3: Implementar las rutas**

En `api/src/admin/branches.routes.ts`, agregar imports al inicio:
```ts
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
```
Y agregar las rutas (tras la ruta `GET /:branchId`):
```ts
const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]).optional(),
  address: z.string().min(1).max(200).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

ownerBranchesRouter.patch("/:branchId", requireBranchAccess(), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const branch = await prisma.branch.update({ where: { id: req.params.branchId }, data });
    res.json(branch);
  } catch (e) {
    next(e);
  }
});

const activeSchema = z.object({ active: z.boolean() });

ownerBranchesRouter.post("/:branchId/active", requireBranchAccess(), async (req, res, next) => {
  try {
    if (req.user!.role === "admin_sucursal") throw new HttpError(403, "forbidden_role");
    const { active } = activeSchema.parse(req.body);
    const branch = await prisma.branch.update({ where: { id: req.params.branchId }, data: { active } });
    res.json(branch);
  } catch (e) {
    next(e);
  }
});

const closeSchema = z.object({ until: z.string().datetime() });

ownerBranchesRouter.post("/:branchId/close", requireBranchAccess(), async (req, res, next) => {
  try {
    const { until } = closeSchema.parse(req.body);
    const branch = await prisma.branch.update({
      where: { id: req.params.branchId },
      data: { closedUntil: new Date(until) },
    });
    res.json(branch);
  } catch (e) {
    next(e);
  }
});

ownerBranchesRouter.post("/:branchId/reopen", requireBranchAccess(), async (req, res, next) => {
  try {
    const branch = await prisma.branch.update({
      where: { id: req.params.branchId },
      data: { closedUntil: null },
    });
    res.json(branch);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-branch-mutations.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/admin/branches.routes.ts api/src/tests/owner-branch-mutations.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): editar, activar/desactivar y cerrar/reabrir sucursal"
```

---

## Task 4: Editor de horarios

**Files:**
- Modify: `api/src/admin/branches.routes.ts`
- Test: `api/src/tests/owner-hours.test.ts`

**Interfaces:**
- Produces: `PUT /admin/branches/:branchId/hours` body `{ hours: [{ weekday: 0..6, openTime: "HH:MM", closeTime: "HH:MM" }] }` — reemplaza TODOS los `ServiceHours` de la sucursal (borra + recrea) y devuelve la lista nueva ordenada por `weekday`.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-hours.test.ts`:
```ts
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

describe("PUT /admin/branches/:branchId/hours", () => {
  it("reemplaza los horarios de la sucursal", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app)
      .put(`/admin/branches/${ctx.branch.id}/hours`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hours: [
        { weekday: 1, openTime: "09:00", closeTime: "18:00" },
        { weekday: 2, openTime: "09:00", closeTime: "18:00" },
      ] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ weekday: 1, openTime: "09:00", closeTime: "18:00" });
    const count = await prisma.serviceHours.count({ where: { branchId: ctx.branch.id } });
    expect(count).toBe(2);
  });

  it("rechaza weekday fuera de rango (400)", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app)
      .put(`/admin/branches/${ctx.branch.id}/hours`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hours: [{ weekday: 9, openTime: "09:00", closeTime: "18:00" }] });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-hours.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar la ruta**

En `api/src/admin/branches.routes.ts`, agregar:
```ts
const hoursSchema = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .max(21),
});

ownerBranchesRouter.put("/:branchId/hours", requireBranchAccess(), async (req, res, next) => {
  try {
    const { hours } = hoursSchema.parse(req.body);
    const branchId = req.params.branchId;
    await prisma.$transaction([
      prisma.serviceHours.deleteMany({ where: { branchId } }),
      prisma.serviceHours.createMany({ data: hours.map((h) => ({ ...h, branchId })) }),
    ]);
    const fresh = await prisma.serviceHours.findMany({ where: { branchId }, orderBy: { weekday: "asc" } });
    res.json(fresh);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-hours.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/admin/branches.routes.ts api/src/tests/owner-hours.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): reemplazo de horarios de la sucursal"
```

---

## Task 5: CRUD de menú con límite de plan

**Files:**
- Create: `api/src/admin/menu.routes.ts`
- Modify: `api/src/admin/admin.routes.ts`
- Test: `api/src/tests/owner-menu.test.ts`

**Interfaces:**
- Consumes: `requireBranchAccess`, `planLimitFor` (Task 2), `prisma`, `HttpError`, Zod.
- Produces: router `menuRouter` (`Router({ mergeParams: true })`) montado en `/admin/branches/:branchId/menu` tras `requireBranchAccess()`.
  - `POST /` → crea ítem (cuenta contra `maxMenuItems`; excede → 403 `plan_limit_menu`). 201.
  - `PATCH /:itemId` → actualiza (verifica que el ítem pertenezca a la sucursal; si no → 404).
  - `DELETE /:itemId` → elimina. 204.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-menu.test.ts`:
```ts
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

const base = () => `/admin/branches/${ctx.branch.id}/menu`;
const auth = async () => `Bearer ${await tokenFor("sucursal@demo.cl")}`;

describe("CRUD de menú", () => {
  it("crea, edita y elimina un ítem", async () => {
    const created = await request(app).post(base()).set("Authorization", await auth())
      .send({ name: "Café", price: 2500, category: "Bebidas", description: "Espresso" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const patched = await request(app).patch(`${base()}/${id}`).set("Authorization", await auth())
      .send({ price: 3000 });
    expect(patched.status).toBe(200);
    expect(Number(patched.body.price)).toBe(3000);

    const del = await request(app).delete(`${base()}/${id}`).set("Authorization", await auth());
    expect(del.status).toBe(204);
    expect(await prisma.menuItem.count({ where: { branchId: ctx.branch.id } })).toBe(0);
  });

  it("bloquea al exceder maxMenuItems del plan (Free=10) → 403 plan_limit_menu", async () => {
    // El plan Free del business permite 10 ítems; sembrar 10 y el 11º debe fallar.
    await prisma.menuItem.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({ branchId: ctx.branch.id, name: `it${i}`, price: 1000 })),
    });
    const res = await request(app).post(base()).set("Authorization", await auth())
      .send({ name: "uno más", price: 1000 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("plan_limit_menu");
  });

  it("404 al editar un ítem de otra sucursal", async () => {
    const alien = await prisma.menuItem.create({ data: { branchId: ctx.otherBranch.id, name: "ajeno", price: 1 } });
    const res = await request(app).patch(`${base()}/${alien.id}`).set("Authorization", await auth()).send({ price: 2 });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-menu.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar el router de menú**

Crear `api/src/admin/menu.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { planLimitFor } from "./owner.service.js";

export const menuRouter = Router({ mergeParams: true });

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative(),
  category: z.string().max(60).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});
const updateSchema = createSchema.partial();

menuRouter.post("/", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const { max, count } = await planLimitFor(branchId, "menu");
    if (max != null && count >= max) throw new HttpError(403, "plan_limit_menu");
    const data = createSchema.parse(req.body);
    const item = await prisma.menuItem.create({ data: { ...data, branchId } });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

menuRouter.patch("/:itemId", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "item_not_found");
    const data = updateSchema.parse(req.body);
    const item = await prisma.menuItem.update({ where: { id: existing.id }, data });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

menuRouter.delete("/:itemId", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "item_not_found");
    await prisma.menuItem.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar el router bajo ownership**

En `api/src/admin/admin.routes.ts`, agregar imports y montar (tras `adminRouter.use("/branches", ownerBranchesRouter);`):
```ts
import { requireBranchAccess } from "../middleware/ownership.js";
import { menuRouter } from "./menu.routes.js";
// ...
adminRouter.use("/branches/:branchId/menu", requireBranchAccess(), menuRouter);
```

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-menu.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/menu.routes.ts api/src/admin/admin.routes.ts api/src/tests/owner-menu.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): CRUD de menú con límite de plan por empresa"
```

---

## Task 6: CRUD de promociones con límite de plan

**Files:**
- Create: `api/src/admin/promotions.routes.ts`
- Modify: `api/src/admin/admin.routes.ts`
- Test: `api/src/tests/owner-promotions.test.ts`

**Interfaces:**
- Consumes: `requireBranchAccess`, `planLimitFor`, `prisma`, `HttpError`, Zod.
- Produces: router `promotionsRouter` (`Router({ mergeParams: true })`) en `/admin/branches/:branchId/promotions`.
  - `POST /` → crea (cuenta contra `maxPromos`; excede → 403 `plan_limit_promos`). 201.
  - `PATCH /:promoId` → actualiza (404 si no es de la sucursal).
  - `DELETE /:promoId` → 204.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-promotions.test.ts`:
```ts
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

const base = () => `/admin/branches/${ctx.branch.id}/promotions`;
const auth = async () => `Bearer ${await tokenFor("general@demo.cl")}`;
const window = { startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2999-01-01T00:00:00.000Z" };

describe("CRUD de promociones", () => {
  it("crea y elimina una promo", async () => {
    const created = await request(app).post(base()).set("Authorization", await auth())
      .send({ title: "2x1", description: "Tardes", ...window });
    expect(created.status).toBe(201);
    const del = await request(app).delete(`${base()}/${created.body.id}`).set("Authorization", await auth());
    expect(del.status).toBe(204);
  });

  it("bloquea al exceder maxPromos del plan (Free=1) → 403 plan_limit_promos", async () => {
    await prisma.promotion.create({ data: { branchId: ctx.branch.id, title: "ya", startsAt: new Date(), endsAt: new Date() } });
    const res = await request(app).post(base()).set("Authorization", await auth())
      .send({ title: "otra", ...window });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("plan_limit_promos");
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-promotions.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar el router de promociones**

Crear `api/src/admin/promotions.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { planLimitFor } from "./owner.service.js";

export const promotionsRouter = Router({ mergeParams: true });

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean().optional(),
});
const updateSchema = createSchema.partial();

promotionsRouter.post("/", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const { max, count } = await planLimitFor(branchId, "promos");
    if (max != null && count >= max) throw new HttpError(403, "plan_limit_promos");
    const d = createSchema.parse(req.body);
    const promo = await prisma.promotion.create({
      data: { branchId, title: d.title, description: d.description, imageUrl: d.imageUrl, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), active: d.active ?? true },
    });
    res.status(201).json(promo);
  } catch (e) {
    next(e);
  }
});

promotionsRouter.patch("/:promoId", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.promoId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "promo_not_found");
    const d = updateSchema.parse(req.body);
    const promo = await prisma.promotion.update({
      where: { id: existing.id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
        ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
        ...(d.endsAt !== undefined ? { endsAt: new Date(d.endsAt) } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    res.json(promo);
  } catch (e) {
    next(e);
  }
});

promotionsRouter.delete("/:promoId", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.promoId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "promo_not_found");
    await prisma.promotion.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar el router**

En `api/src/admin/admin.routes.ts`, agregar:
```ts
import { promotionsRouter } from "./promotions.routes.js";
// ...
adminRouter.use("/branches/:branchId/promotions", requireBranchAccess(), promotionsRouter);
```

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-promotions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/promotions.routes.ts api/src/admin/admin.routes.ts api/src/tests/owner-promotions.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): CRUD de promociones con límite de plan por empresa"
```

---

## Task 7: CRUD de códigos de descuento

**Files:**
- Create: `api/src/admin/discounts.routes.ts`
- Modify: `api/src/admin/admin.routes.ts`
- Test: `api/src/tests/owner-discounts.test.ts`

**Interfaces:**
- Consumes: `requireBranchAccess`, `req.user`, `prisma`, `HttpError`, Zod.
- Produces: router `discountsRouter` (`Router({ mergeParams: true })`) en `/admin/branches/:branchId/discounts`.
  - `GET /` → lista códigos visibles para la sucursal: los de su `branchId` MÁS los de su `business` con `branchId = null` (cadena).
  - `POST /` body `{ code, type: "percent"|"amount", value: number, startsAt, endsAt, scope: "branch"|"chain" }` — crea. `scope="chain"` exige rol `admin_general`/`superadmin` (admin_sucursal → 403 `forbidden_role`); guarda `branchId = null`. `scope="branch"` guarda `branchId` de la ruta. `businessId` se deriva del branch.
  - `PATCH /:codeId`, `DELETE /:codeId` — solo si el código pertenece al `business` del branch; además `admin_sucursal` solo puede tocar códigos con `branchId == branchId` de la ruta (no los de cadena) → si no, 403 `forbidden_role`. 404 si el código no existe o es de otro business.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-discounts.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-discounts.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar el router de descuentos**

Crear `api/src/admin/discounts.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";

export const discountsRouter = Router({ mergeParams: true });

async function businessIdOf(branchId: string): Promise<string> {
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
  if (!b) throw new HttpError(404, "branch_not_found");
  return b.businessId;
}

const createSchema = z.object({
  code: z.string().min(1).max(40),
  type: z.enum(["percent", "amount"]),
  value: z.number().nonnegative(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  scope: z.enum(["branch", "chain"]),
});
const updateSchema = z.object({
  code: z.string().min(1).max(40).optional(),
  type: z.enum(["percent", "amount"]).optional(),
  value: z.number().nonnegative().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

discountsRouter.get("/", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const businessId = await businessIdOf(branchId);
    const codes = await prisma.discountCode.findMany({
      where: { businessId, OR: [{ branchId }, { branchId: null }] },
      orderBy: { createdAt: "desc" },
    });
    res.json(codes);
  } catch (e) {
    next(e);
  }
});

discountsRouter.post("/", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const d = createSchema.parse(req.body);
    if (d.scope === "chain" && req.user!.role === "admin_sucursal") throw new HttpError(403, "forbidden_role");
    const businessId = await businessIdOf(branchId);
    const code = await prisma.discountCode.create({
      data: {
        businessId,
        branchId: d.scope === "chain" ? null : branchId,
        code: d.code,
        type: d.type,
        value: d.value,
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
      },
    });
    res.status(201).json(code);
  } catch (e) {
    next(e);
  }
});

async function loadOwnedCode(req: { params: Record<string, string>; user?: { role: string } }) {
  const branchId = req.params.branchId;
  const businessId = await businessIdOf(branchId);
  const code = await prisma.discountCode.findUnique({ where: { id: req.params.codeId } });
  if (!code || code.businessId !== businessId) throw new HttpError(404, "code_not_found");
  // admin_sucursal no puede tocar códigos de cadena
  if (req.user?.role === "admin_sucursal" && code.branchId !== branchId) throw new HttpError(403, "forbidden_role");
  return code;
}

discountsRouter.patch("/:codeId", async (req, res, next) => {
  try {
    const code = await loadOwnedCode(req as never);
    const d = updateSchema.parse(req.body);
    const updated = await prisma.discountCode.update({
      where: { id: code.id },
      data: {
        ...(d.code !== undefined ? { code: d.code } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.value !== undefined ? { value: d.value } : {}),
        ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
        ...(d.endsAt !== undefined ? { endsAt: new Date(d.endsAt) } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

discountsRouter.delete("/:codeId", async (req, res, next) => {
  try {
    const code = await loadOwnedCode(req as never);
    await prisma.discountCode.delete({ where: { id: code.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar el router**

En `api/src/admin/admin.routes.ts`:
```ts
import { discountsRouter } from "./discounts.routes.js";
// ...
adminRouter.use("/branches/:branchId/discounts", requireBranchAccess(), discountsRouter);
```

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-discounts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/discounts.routes.ts api/src/admin/admin.routes.ts api/src/tests/owner-discounts.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): CRUD de códigos de descuento (sucursal y cadena)"
```

---

## Task 8: Crear sucursal con límite `maxBranches` + `requireBusinessAccess`

**Files:**
- Modify: `api/src/middleware/ownership.ts`
- Modify: `api/src/admin/branches.routes.ts`
- Test: `api/src/tests/owner-create-branch.test.ts`

**Interfaces:**
- Produces:
  - `requireBusinessAccess(param = "businessId")` — middleware: `superadmin` pasa; `admin_general` pasa si es dueño del business; cualquier otro → 403. 404 si el business no existe. Lee el id de `req.params[param]` o, si no está, de `req.body[param]`.
  - `POST /admin/branches` body `{ businessId, name, category, address, lat, lng, phone?, description?, imageUrl? }` — crea sucursal en el business. Cuenta sucursales del business contra `business.plan.maxBranches`; excede → 403 `plan_limit_branches`. La nueva sucursal hereda `planId = business.planId`. 201.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-create-branch.test.ts`:
```ts
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

const newBranch = { name: "Sucursal 2", category: "bar", address: "Calle 2", lat: -33.45, lng: -70.66 };

describe("POST /admin/branches", () => {
  it("admin_general crea una sucursal cuando el plan lo permite", async () => {
    // El business primario tiene plan Free (maxBranches=1) y ya 1 sucursal → subir a 'pro' (maxBranches=5).
    await prisma.business.update({ where: { id: ctx.biz.id }, data: { planId: ctx.pro.id } });
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, ...newBranch });
    expect(res.status).toBe(201);
    expect(res.body.businessId).toBe(ctx.biz.id);
    expect(res.body.planId).toBe(ctx.pro.id);
  });

  it("bloquea al exceder maxBranches (Free=1, ya hay 1) → 403 plan_limit_branches", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, ...newBranch });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("plan_limit_branches");
  });

  it("admin_general NO puede crear sucursal en una empresa ajena (403)", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.otroBiz.id, ...newBranch });
    expect(res.status).toBe(403);
  });

  it("admin_sucursal NO puede crear sucursales (403)", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).post("/admin/branches").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, ...newBranch });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-create-branch.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Agregar `requireBusinessAccess`**

En `api/src/middleware/ownership.ts`, agregar al final:
```ts
// Permite continuar solo si el usuario puede gestionar el business indicado (params o body).
export function requireBusinessAccess(param = "businessId") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new HttpError(401, "unauthenticated");
      const businessId = req.params[param] ?? (req.body as Record<string, string>)?.[param];
      if (!businessId) throw new HttpError(400, "business_required");
      const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerUserId: true } });
      if (!business) throw new HttpError(404, "business_not_found");
      if (user.role === "superadmin") return next();
      if (user.role === "admin_general" && business.ownerUserId === user.sub) return next();
      throw new HttpError(403, "forbidden");
    } catch (e) {
      next(e);
    }
  };
}
```

- [ ] **Step 4: Implementar `POST /admin/branches`**

En `api/src/admin/branches.routes.ts`, agregar el import del middleware al inicio (junto al `requireBranchAccess` ya importado):
```ts
import { requireBranchAccess, requireBusinessAccess } from "../middleware/ownership.js";
```
(Si el import actual es solo `requireBranchAccess`, reemplazarlo por la línea de arriba.)
Agregar la ruta (puede ir antes de `GET /:branchId` para evitar colisión de paths; `POST /` no colisiona con `GET /:branchId`, pero mantener orden claro):
```ts
const createBranchSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(120),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]),
  address: z.string().min(1).max(200),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

ownerBranchesRouter.post("/", requireBusinessAccess(), async (req, res, next) => {
  try {
    const d = createBranchSchema.parse(req.body);
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: d.businessId },
      include: { plan: true, _count: { select: { branches: true } } },
    });
    const max = business.plan?.maxBranches ?? null;
    if (max != null && business._count.branches >= max) throw new HttpError(403, "plan_limit_branches");
    const branch = await prisma.branch.create({
      data: {
        businessId: d.businessId,
        name: d.name,
        category: d.category,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        phone: d.phone ?? null,
        description: d.description ?? null,
        imageUrl: d.imageUrl ?? null,
        planId: business.planId,
      },
    });
    res.status(201).json(branch);
  } catch (e) {
    next(e);
  }
});
```
Nota: `createBranchSchema.parse` corre DESPUÉS de `requireBusinessAccess`, que ya leyó `businessId` del body; el orden es correcto porque `express.json()` ya parseó el body antes de los middlewares de la ruta.

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-create-branch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/middleware/ownership.ts api/src/admin/branches.routes.ts api/src/tests/owner-create-branch.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): crear sucursal con límite maxBranches y acceso por empresa"
```

---

## Task 9: Solicitudes de upgrade y de anuncio

**Files:**
- Create: `api/src/admin/requests.routes.ts`
- Modify: `api/src/admin/admin.routes.ts`
- Test: `api/src/tests/owner-requests.test.ts`

**Interfaces:**
- Consumes: `requireBusinessAccess` (Task 8), `requireBranchAccess`, `req.user`, `prisma`, `HttpError`, Zod.
- Produces: router `requestsRouter` montado en `/admin`.
  - `POST /admin/upgrade-requests` body `{ businessId, requestedPlanId, note? }` (admin_general dueño/superadmin vía `requireBusinessAccess`) → crea `PlanUpgradeRequest` con `status="pending"`, `createdBy = sub`. 201.
  - `POST /admin/ad-requests` body `{ businessId, branchId?, desiredStartsAt, desiredEndsAt, wantsPopup?, note? }` → crea `AdRequest`. Acceso: si `branchId` viene, el usuario debe tener acceso a ESE branch (admin_general dueño o admin_sucursal asignado); si no, debe ser dueño del business. La verificación se hace en el handler. 201.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-requests.test.ts`:
```ts
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

const window = { desiredStartsAt: "2026-07-01T00:00:00.000Z", desiredEndsAt: "2026-07-31T00:00:00.000Z" };

describe("solicitudes", () => {
  it("admin_general crea una solicitud de upgrade", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/upgrade-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, requestedPlanId: ctx.pro.id, note: "necesito más sucursales" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "pending", createdBy: ctx.general.id });
  });

  it("rechaza upgrade en empresa ajena (403)", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).post("/admin/upgrade-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.otroBiz.id, requestedPlanId: ctx.pro.id });
    expect(res.status).toBe(403);
  });

  it("admin_sucursal crea solicitud de anuncio para su sucursal", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).post("/admin/ad-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.biz.id, branchId: ctx.branch.id, wantsPopup: true, ...window });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "pending", wantsPopup: true, branchId: ctx.branch.id });
  });

  it("admin_sucursal NO puede solicitar anuncio de una sucursal ajena (403)", async () => {
    const token = await tokenFor("sucursal@demo.cl");
    const res = await request(app).post("/admin/ad-requests").set("Authorization", `Bearer ${token}`)
      .send({ businessId: ctx.otroBiz.id, branchId: ctx.otherBranch.id, ...window });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-requests.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar el router de solicitudes**

Crear `api/src/admin/requests.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { requireBusinessAccess } from "../middleware/ownership.js";

export const requestsRouter = Router();

const upgradeSchema = z.object({
  businessId: z.string().min(1),
  requestedPlanId: z.string().min(1),
  note: z.string().max(1000).nullable().optional(),
});

requestsRouter.post("/upgrade-requests", requireBusinessAccess(), async (req, res, next) => {
  try {
    const d = upgradeSchema.parse(req.body);
    const reqRow = await prisma.planUpgradeRequest.create({
      data: { businessId: d.businessId, requestedPlanId: d.requestedPlanId, note: d.note ?? null, createdBy: req.user!.sub },
    });
    res.status(201).json(reqRow);
  } catch (e) {
    next(e);
  }
});

const adReqSchema = z.object({
  businessId: z.string().min(1),
  branchId: z.string().min(1).nullable().optional(),
  desiredStartsAt: z.string().datetime(),
  desiredEndsAt: z.string().datetime(),
  wantsPopup: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
});

// Acceso a anuncio: con branchId → acceso a ese branch (dueño o sucursal asignada); sin branchId → dueño del business.
async function canRequestAd(user: { sub: string; role: string }, businessId: string, branchId?: string | null) {
  if (user.role === "superadmin") return true;
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true, business: { select: { ownerUserId: true } } } });
    if (!branch || branch.businessId !== businessId) return false;
    if (user.role === "admin_general") return branch.business.ownerUserId === user.sub;
    const link = await prisma.branchAdmin.findUnique({ where: { userId_branchId: { userId: user.sub, branchId } } });
    return !!link;
  }
  if (user.role === "admin_general") {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerUserId: true } });
    return !!biz && biz.ownerUserId === user.sub;
  }
  return false;
}

requestsRouter.post("/ad-requests", async (req, res, next) => {
  try {
    const d = adReqSchema.parse(req.body);
    const ok = await canRequestAd(req.user!, d.businessId, d.branchId ?? null);
    if (!ok) throw new HttpError(403, "forbidden");
    const reqRow = await prisma.adRequest.create({
      data: {
        businessId: d.businessId,
        branchId: d.branchId ?? null,
        desiredStartsAt: new Date(d.desiredStartsAt),
        desiredEndsAt: new Date(d.desiredEndsAt),
        wantsPopup: d.wantsPopup ?? false,
        note: d.note ?? null,
        createdBy: req.user!.sub,
      },
    });
    res.status(201).json(reqRow);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar el router**

En `api/src/admin/admin.routes.ts`:
```ts
import { requestsRouter } from "./requests.routes.js";
// ...
adminRouter.use("/", requestsRouter);
```
(Va montado en la raíz de `/admin` porque sus paths ya incluyen `/upgrade-requests` y `/ad-requests`.)

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-requests.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/requests.routes.ts api/src/admin/admin.routes.ts api/src/tests/owner-requests.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): solicitudes de upgrade de plan y de anuncio"
```

---

## Task 10: Discovery — `closedUntil` y cupones en la ficha

**Files:**
- Modify: `api/src/branches/nearby.sql.ts`
- Modify: `api/src/branches/branches.service.ts`
- Test: `api/src/tests/discovery-closed-coupons.test.ts`

**Interfaces:**
- Consumes: `prisma`, el SQL de `nearby`.
- Produces:
  - `GET /branches/nearby?...&open=true` excluye sucursales con `closedUntil` futuro (cerradas ahora), además de las que su horario regular indique cerradas.
  - `GET /branches/:id` (`getBranchDetail`) devuelve `closedUntil` y `discountCodes`: los `DiscountCode` `active`, dentro de `[startsAt, endsAt]`, del `branchId` de la sucursal MÁS los del `business` con `branchId = null`.

**Nota de exploración previa (el implementador DEBE leer antes de codear):** abrir `api/src/branches/nearby.sql.ts` para ver cómo se arma el filtro `open` (la condición sobre `ServiceHours`/hora actual). El cierre temporal se suma como una condición extra `AND ("closedUntil" IS NULL OR "closedUntil" <= now())`. Abrir `getBranchDetail` en `branches.service.ts` para ver la forma actual del objeto retornado (incluye `hours`, `menuItems`, `promotions`, `reviews`, `ratingAvg`, etc.); agregar `closedUntil` (ya es un campo del modelo, basta incluirlo si se hace `select` explícito — si usa `include`, `closedUntil` ya viene) y una consulta de `discountCodes`.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/discovery-closed-coupons.test.ts`:
```ts
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
    const branch = await prisma.branch.findFirstOrThrow();
    // marcar cerrada hasta el futuro
    await prisma.branch.update({ where: { id: branch.id }, data: { closedUntil: new Date(Date.now() + 3600_000) } });
    const res = await request(app).get(`/branches/nearby?lat=${branch.lat}&lng=${branch.lng}&open=true`);
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.id)).not.toContain(branch.id);
  });
});
```
Nota: si `seedDiscoveryFixture` no crea horarios que hagan a la sucursal "abierta ahora", el segundo test podría pasar trivialmente. Para que sea significativo, el implementador debe confirmar (leyendo `seedDiscoveryFixture`) que la sucursal queda abierta por horario; si no, **agregar en el test** un `ServiceHours` que cubra el día/hora actual antes de marcar `closedUntil`, de modo que la exclusión se deba SOLO al cierre temporal. Documentar el ajuste en el reporte.

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/discovery-closed-coupons.test.ts`
Expected: FAIL (no hay `discountCodes` en la respuesta y/o la sucursal cerrada sigue apareciendo).

- [ ] **Step 3: Sumar `closedUntil` al filtro `open` del SQL**

En `api/src/branches/nearby.sql.ts`, localizar la cláusula que filtra por horario cuando `open` es true. Añadir a esa condición (dentro del mismo `AND (...)` que exige estar abierto por horario) el requisito de no estar en cierre temporal:
```sql
AND (b."closedUntil" IS NULL OR b."closedUntil" <= now())
```
El alias de la tabla `Branch` (`b` en este ejemplo) debe coincidir con el que ya usa el query. Si el filtro `open` se arma condicionalmente en TS (concatenando strings), agregar este fragmento SOLO cuando `open` está activo, junto a la condición de horario existente.

- [ ] **Step 4: Devolver `closedUntil` y `discountCodes` en el detalle**

En `api/src/branches/branches.service.ts`, en `getBranchDetail`:
1. Asegurar que el objeto retornado incluya `closedUntil` (si el `findUnique` usa `include`, `closedUntil` ya está en el branch base; si arma un objeto manual con campos elegidos, agregar `closedUntil: branch.closedUntil`).
2. Tras obtener el branch, consultar los cupones vigentes y agregarlos al retorno:
```ts
const now = new Date();
const discountCodes = await prisma.discountCode.findMany({
  where: {
    businessId: branch.businessId,
    active: true,
    startsAt: { lte: now },
    endsAt: { gte: now },
    OR: [{ branchId: branch.id }, { branchId: null }],
  },
  orderBy: { createdAt: "desc" },
  select: { id: true, code: true, type: true, value: true, startsAt: true, endsAt: true, branchId: true },
});
```
y agregar `discountCodes` al objeto que retorna la función. (El nombre `branch.businessId` y `branch.id` deben tomarse del registro ya cargado; si la función no tiene `businessId` a mano, incluirlo en el `select`/`include` del `findUnique`.)

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/discovery-closed-coupons.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Suite completa de API verde**

Run: `docker compose exec -T api npm test`
Expected: toda la suite pasa (incluye discovery previo, capa 1, y todo lo de capa 2A).
**Importante:** `npm test` (resetDb) deja la DB vacía. Tras terminar, re-sembrar para que el discovery local vuelva a tener data: `docker compose exec -T api npm run seed:all` (ver memoria `restoapp-test-db-reset`).

- [ ] **Step 7: Commit**

```bash
git add api/src/branches/nearby.sql.ts api/src/branches/branches.service.ts api/src/tests/discovery-closed-coupons.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): discovery considera cierre temporal y expone cupones vigentes en la ficha"
```

---

## Verificación final de la capa 2A

- `docker compose exec -T api npm test` → toda la suite API verde. Luego `docker compose exec -T api npm run seed:all` para restaurar data demo.
- `docker compose exec -T api npx tsc --noEmit` → sin errores.
- Flujo manual con `owner@demo.cl` / `owner12345` (admin_general del business demo):
  1. `curl -s -XPOST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"owner@demo.cl","password":"owner12345"}'` → tomar `accessToken`.
  2. `GET /admin/branches` con `Authorization: Bearer <token>` → lista sus 6 sucursales con `plan` y `counts`.
  3. `PATCH /admin/branches/<id>` cambia un dato; `POST /admin/branches/<id>/close` con `{"until": "...futuro..."}` → la ficha pública refleja cierre y `nearby?open=true` lo excluye.
  4. Crear un `DiscountCode` y verlo en `GET /branches/<id>` (`discountCodes`).
  5. Crear menú/promo hasta el límite del plan (el business demo es Pro → límites altos; para probar el bloqueo, asignar Free temporalmente).

## Self-review (cobertura del spec, capa 2A)

- Plan por empresa (`Business.planId`) → Task 1. ✓
- Listar/editar/activar/cerrar sucursal → Tasks 2-3. ✓
- Horarios → Task 4. ✓
- Menú CRUD + límite `maxMenuItems` → Task 5. ✓
- Promos CRUD + límite `maxPromos` → Task 6. ✓
- Códigos de descuento (sucursal y cadena) → Task 7. ✓
- Crear sucursal + límite `maxBranches` → Task 8. ✓
- Solicitudes upgrade/anuncio → Task 9. ✓
- Discovery: `closedUntil` + cupones en la ficha → Task 10. ✓
- El **frontend** del panel del dueño (consumir estos endpoints, ImageUploader, MapPicker, pantallas) es el plan **capa 2B**, posterior. El panel del superadmin (aprobar solicitudes, CRUD de anuncios, endpoints `GET /ads`/popup) es **capa 3**.
