# RestoApp Capa 3A — Backend del panel superadmin + anuncios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la API privada del superadmin (provisionar empresas con su dueño, cuentas y sucursales, asignar planes, bandejas de solicitudes de upgrade y de anuncio, CRUD de anuncios con cupo de popups) y los endpoints públicos de anuncios geo-priorizados (`GET /ads` y `GET /ads/popup`).

**Architecture:** Un sub-router `superadmin` montado en `/admin/superadmin` detrás de `authenticate` + `authorize("superadmin")`. Cada recurso es un módulo `*.routes.ts` + lógica con Prisma. Los anuncios públicos viven en un router nuevo `/ads` (público, sin auth) que usa la columna PostGIS generada `Branch.geog` (igual que `nearby`) para ordenar por cercanía, vía `prisma.$queryRaw` con `Prisma.sql`. Los modelos `Ad`, `AdRequest`, `PlanUpgradeRequest`, `Business.planId` ya existen (capas 1 y 2A); esta capa solo agrega endpoints. Aprobar un `PlanUpgradeRequest` cambia `Business.planId`. El cupo de popups (`MAX_POPUPS_PER_DAY`) se valida al crear un Ad de popup.

**Tech Stack:** Express, Prisma 5 (Postgres+PostGIS), Zod, argon2, Vitest+Supertest. ESM/TypeScript.

## Global Constraints

- Commits: autor **ribarahonaa <ribarahonaa@gmail.com>**, fijado **por commit**: `git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "..."`. **NO** `Co-Authored-By` ni referencia a Claude. Verificar `git log -1 --pretty='%ae'` = `ribarahonaa@gmail.com` tras cada commit.
- Comandos de API dentro del contenedor: `docker compose exec -T api <cmd>`. Tests: `docker compose exec -T api npx vitest run <archivo>`.
- Sin migraciones nuevas (los modelos ya existen). Si en algún momento se requiere SQL, sería manual (`migrate deploy`, nunca `migrate dev` por la columna PostGIS `geog`).
- TypeScript ESM: imports relativos con extensión `.js`.
- Roles (enum `Role`): `superadmin`, `admin_general`, `admin_sucursal`, `usuario`. Todo el router superadmin va detrás de `authorize("superadmin")`.
- SQL crudo: usar `Prisma.sql` con binding `${...}` (nunca interpolar strings). Distancia con `ST_Distance(b."geog", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)`. La columna `geog` es generada (no mapeada por Prisma) — solo en SQL crudo.
- `errorHandler` ya mapea `ZodError`→400 y `HttpError(status,msg)`→status. Códigos de error nuevos: `email_taken` (409, ya existe), `popup_quota_full` (403).
- `hashPassword(plain)` de `../auth/password.js` (argon2). `signAccessToken({sub,role})` de `../auth/tokens.js`.
- Cuenta superadmin demo: `admin@restoapp.cl` / `admin12345`.

---

## File Structure

**Backend (api/):**
- `src/env.ts` — modificar: `MAX_POPUPS_PER_DAY` (default 3).
- `src/admin/superadmin/businesses.routes.ts` — crear.
- `src/admin/superadmin/accounts.routes.ts` — crear (usuarios, branch-admins, sucursales, plan).
- `src/admin/superadmin/upgrades.routes.ts` — crear.
- `src/admin/superadmin/ads.routes.ts` — crear (CRUD de Ad + cupo popup).
- `src/admin/superadmin/ad-requests.routes.ts` — crear.
- `src/admin/superadmin/superadmin.routes.ts` — crear: agrupa los sub-routers, montado en `/admin/superadmin`.
- `src/admin/admin.routes.ts` — modificar: montar `superadminRouter` con `authorize("superadmin")`.
- `src/ads/ads.sql.ts` — crear: query de anuncios por cercanía.
- `src/ads/ads.routes.ts` — crear: `GET /ads`, `GET /ads/popup` (público).
- `src/app.ts` — modificar: montar `adsRouter` en `/ads`.
- `src/tests/helpers.ts` — modificar: agregar `superadmin` a `seedAdminFixture`.
- `src/tests/sa-businesses.test.ts`, `sa-accounts.test.ts`, `sa-upgrades.test.ts`, `sa-ads.test.ts`, `sa-ad-requests.test.ts`, `ads-public.test.ts` — crear.

---

## Task 1: Router superadmin + gestión de empresas

**Files:**
- Modify: `api/src/tests/helpers.ts`
- Create: `api/src/admin/superadmin/businesses.routes.ts`
- Create: `api/src/admin/superadmin/superadmin.routes.ts`
- Modify: `api/src/admin/admin.routes.ts`
- Test: `api/src/tests/sa-businesses.test.ts`

**Interfaces:**
- Produces:
  - `superadminRouter` montado en `/admin/superadmin` tras `authorize("superadmin")`.
  - `POST /admin/superadmin/businesses` body `{ businessName, ownerEmail, ownerName, ownerPassword, planId? }` → crea el `User` (rol `admin_general`) + el `Business` (con `planId` opcional) en una transacción. 201 `{ business, owner }`. Si el email existe → 409 `email_taken`.
  - `GET /admin/superadmin/businesses` → lista jerárquica: `[{ id, name, plan, owner:{id,email,name}, branches:[{id,name,category,active}] }]`.
  - `PATCH /admin/superadmin/businesses/:id` body `{ name?, planId? }` → actualiza.
- `seedAdminFixture` ahora retorna además `superadmin: User` (rol superadmin, email `super@demo.cl`).

- [ ] **Step 1: Agregar un superadmin a `seedAdminFixture`**

En `api/src/tests/helpers.ts`, dentro de `seedAdminFixture`, tras crear `otro`, agregar:
```ts
  const superadmin = await prisma.user.create({
    data: { email: "super@demo.cl", name: "Super", role: "superadmin", passwordHash: await hashPassword("clave1234") },
  });
```
Y agregar `superadmin` al objeto retornado:
```ts
  return { general, sucursal, otro, superadmin, biz, otroBiz, branch, otherBranch, free, pro };
```

- [ ] **Step 2: Escribir el test (falla primero)**

Crear `api/src/tests/sa-businesses.test.ts`:
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

const sa = async () => `Bearer ${await tokenFor("super@demo.cl")}`;

describe("superadmin · empresas", () => {
  it("403 si no es superadmin", async () => {
    const res = await request(app).get("/admin/superadmin/businesses").set("Authorization", `Bearer ${await tokenFor("general@demo.cl")}`);
    expect(res.status).toBe(403);
  });

  it("crea una empresa con su dueño", async () => {
    const res = await request(app).post("/admin/superadmin/businesses").set("Authorization", await sa())
      .send({ businessName: "Nueva Cadena", ownerEmail: "nuevo@d.cl", ownerName: "Nuevo", ownerPassword: "clave1234", planId: ctx.pro.id });
    expect(res.status).toBe(201);
    expect(res.body.business.name).toBe("Nueva Cadena");
    expect(res.body.owner.role).toBe("admin_general");
    const u = await prisma.user.findUnique({ where: { email: "nuevo@d.cl" } });
    expect(u?.role).toBe("admin_general");
  });

  it("409 si el email del dueño ya existe", async () => {
    const res = await request(app).post("/admin/superadmin/businesses").set("Authorization", await sa())
      .send({ businessName: "X", ownerEmail: "general@demo.cl", ownerName: "Y", ownerPassword: "clave1234" });
    expect(res.status).toBe(409);
  });

  it("lista las empresas con sus sucursales y plan", async () => {
    const res = await request(app).get("/admin/superadmin/businesses").set("Authorization", await sa());
    expect(res.status).toBe(200);
    const mine = res.body.find((b: any) => b.id === ctx.biz.id);
    expect(mine.owner.email).toBe("general@demo.cl");
    expect(mine.plan.name).toBe("Free");
    expect(mine.branches.map((x: any) => x.id)).toContain(ctx.branch.id);
  });

  it("actualiza nombre y plan de una empresa", async () => {
    const res = await request(app).patch(`/admin/superadmin/businesses/${ctx.biz.id}`).set("Authorization", await sa())
      .send({ name: "Renombrada", planId: ctx.pro.id });
    expect(res.status).toBe(200);
    const fresh = await prisma.business.findUniqueOrThrow({ where: { id: ctx.biz.id } });
    expect(fresh.name).toBe("Renombrada");
    expect(fresh.planId).toBe(ctx.pro.id);
  });
});
```

- [ ] **Step 3: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-businesses.test.ts`
Expected: FAIL (404 — no existen las rutas).

- [ ] **Step 4: Implementar el router de empresas**

Crear `api/src/admin/superadmin/businesses.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";
import { hashPassword } from "../../auth/password.js";

export const businessesRouter = Router();

const createSchema = z.object({
  businessName: z.string().min(1).max(120),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
  ownerPassword: z.string().min(8).max(100),
  planId: z.string().optional(),
});

businessesRouter.post("/", async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: d.ownerEmail } });
    if (existing) throw new HttpError(409, "email_taken");
    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: { email: d.ownerEmail, name: d.ownerName, role: "admin_general", passwordHash: await hashPassword(d.ownerPassword) },
      });
      const business = await tx.business.create({
        data: { name: d.businessName, ownerUserId: owner.id, planId: d.planId ?? null },
      });
      return { business, owner };
    });
    res.status(201).json({
      business: result.business,
      owner: { id: result.owner.id, email: result.owner.email, name: result.owner.name, role: result.owner.role },
    });
  } catch (e) {
    next(e);
  }
});

businessesRouter.get("/", async (_req, res, next) => {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: { name: "asc" },
      include: {
        plan: { select: { id: true, name: true, maxBranches: true, maxPromos: true, maxMenuItems: true } },
        owner: { select: { id: true, email: true, name: true } },
        branches: { select: { id: true, name: true, category: true, active: true }, orderBy: { name: "asc" } },
      },
    });
    res.json(businesses);
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({ name: z.string().min(1).max(120).optional(), planId: z.string().nullable().optional() });

businessesRouter.patch("/:id", async (req, res, next) => {
  try {
    const d = updateSchema.parse(req.body);
    const exists = await prisma.business.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "business_not_found");
    const business = await prisma.business.update({ where: { id: req.params.id }, data: d });
    res.json(business);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 5: Crear el router superadmin y montarlo**

Crear `api/src/admin/superadmin/superadmin.routes.ts`:
```ts
import { Router } from "express";
import { businessesRouter } from "./businesses.routes.js";

export const superadminRouter = Router();

superadminRouter.use("/businesses", businessesRouter);
```
En `api/src/admin/admin.routes.ts`, agregar el import y montar (con `authorize("superadmin")` específico, tras los `adminRouter.use(authenticate)`/`authorize(...)` generales):
```ts
import { superadminRouter } from "./superadmin/superadmin.routes.js";
// ...
adminRouter.use("/superadmin", authorize("superadmin"), superadminRouter);
```
(El `authorize("superadmin")` aquí restringe el área superadmin aunque el `authorize` general ya permita los 3 roles admin.)

- [ ] **Step 6: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-businesses.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add api/src/tests/helpers.ts api/src/admin/superadmin/businesses.routes.ts api/src/admin/superadmin/superadmin.routes.ts api/src/admin/admin.routes.ts api/src/tests/sa-businesses.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): superadmin gestiona empresas (crear con dueño, listar jerárquico, editar)"
```

---

## Task 2: Cuentas, sucursales y plan (superadmin)

**Files:**
- Create: `api/src/admin/superadmin/accounts.routes.ts`
- Modify: `api/src/admin/superadmin/superadmin.routes.ts`
- Test: `api/src/tests/sa-accounts.test.ts`

**Interfaces:**
- Produces (todas bajo `/admin/superadmin`, montadas en la raíz del superadminRouter):
  - `POST /admin/superadmin/users` body `{ email, name, password, role: "admin_general"|"admin_sucursal" }` → crea usuario. 201 `{ id, email, name, role }`. 409 si email existe.
  - `POST /admin/superadmin/businesses/:businessId/branches` body `{ name, category, address, lat, lng, phone?, description?, imageUrl?, planId? }` → crea sucursal **sin** límite de plan (provisión superadmin). 201.
  - `POST /admin/superadmin/branch-admins` body `{ userId, branchId }` → crea el vínculo `BranchAdmin` (idempotente). 201.
  - `POST /admin/superadmin/branches/:id/active` body `{ active: boolean }` → activa/desactiva cualquier sucursal. 200.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/sa-accounts.test.ts`:
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

const sa = async () => `Bearer ${await tokenFor("super@demo.cl")}`;

describe("superadmin · cuentas y sucursales", () => {
  it("crea un usuario admin_sucursal", async () => {
    const res = await request(app).post("/admin/superadmin/users").set("Authorization", await sa())
      .send({ email: "suc2@d.cl", name: "Suc2", password: "clave1234", role: "admin_sucursal" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("admin_sucursal");
  });

  it("crea una sucursal en una empresa sin tope de plan", async () => {
    // biz tiene plan Free (maxBranches 1) y ya 1 sucursal; superadmin igual puede crear
    const res = await request(app).post(`/admin/superadmin/businesses/${ctx.biz.id}/branches`).set("Authorization", await sa())
      .send({ name: "Suc Provisionada", category: "bar", address: "z", lat: -33.45, lng: -70.66 });
    expect(res.status).toBe(201);
    expect(res.body.businessId).toBe(ctx.biz.id);
  });

  it("asigna un admin_sucursal a una sucursal", async () => {
    const res = await request(app).post("/admin/superadmin/branch-admins").set("Authorization", await sa())
      .send({ userId: ctx.sucursal.id, branchId: ctx.otherBranch.id });
    expect(res.status).toBe(201);
    const link = await prisma.branchAdmin.findUnique({ where: { userId_branchId: { userId: ctx.sucursal.id, branchId: ctx.otherBranch.id } } });
    expect(link).not.toBeNull();
  });

  it("activa/desactiva cualquier sucursal", async () => {
    const res = await request(app).post(`/admin/superadmin/branches/${ctx.otherBranch.id}/active`).set("Authorization", await sa())
      .send({ active: false });
    expect(res.status).toBe(200);
    const fresh = await prisma.branch.findUniqueOrThrow({ where: { id: ctx.otherBranch.id } });
    expect(fresh.active).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-accounts.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar el router de cuentas**

Crear `api/src/admin/superadmin/accounts.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";
import { hashPassword } from "../../auth/password.js";

export const accountsRouter = Router();

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(100),
  role: z.enum(["admin_general", "admin_sucursal"]),
});

accountsRouter.post("/users", async (req, res, next) => {
  try {
    const d = userSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing) throw new HttpError(409, "email_taken");
    const u = await prisma.user.create({
      data: { email: d.email, name: d.name, role: d.role, passwordHash: await hashPassword(d.password) },
    });
    res.status(201).json({ id: u.id, email: u.email, name: u.name, role: u.role });
  } catch (e) {
    next(e);
  }
});

const branchSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]),
  address: z.string().min(1).max(200),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  planId: z.string().nullable().optional(),
});

accountsRouter.post("/businesses/:businessId/branches", async (req, res, next) => {
  try {
    const d = branchSchema.parse(req.body);
    const biz = await prisma.business.findUnique({ where: { id: req.params.businessId }, select: { id: true, planId: true } });
    if (!biz) throw new HttpError(404, "business_not_found");
    const branch = await prisma.branch.create({
      data: {
        businessId: biz.id,
        name: d.name, category: d.category, address: d.address, lat: d.lat, lng: d.lng,
        phone: d.phone ?? null, description: d.description ?? null, imageUrl: d.imageUrl ?? null,
        planId: d.planId ?? biz.planId,
      },
    });
    res.status(201).json(branch);
  } catch (e) {
    next(e);
  }
});

const linkSchema = z.object({ userId: z.string().min(1), branchId: z.string().min(1) });

accountsRouter.post("/branch-admins", async (req, res, next) => {
  try {
    const d = linkSchema.parse(req.body);
    const link = await prisma.branchAdmin.upsert({
      where: { userId_branchId: { userId: d.userId, branchId: d.branchId } },
      update: {},
      create: { userId: d.userId, branchId: d.branchId },
    });
    res.status(201).json(link);
  } catch (e) {
    next(e);
  }
});

const activeSchema = z.object({ active: z.boolean() });

accountsRouter.post("/branches/:id/active", async (req, res, next) => {
  try {
    const { active } = activeSchema.parse(req.body);
    const exists = await prisma.branch.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "branch_not_found");
    const branch = await prisma.branch.update({ where: { id: req.params.id }, data: { active } });
    res.json(branch);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar en el superadminRouter**

En `api/src/admin/superadmin/superadmin.routes.ts`, agregar:
```ts
import { accountsRouter } from "./accounts.routes.js";
// ...
superadminRouter.use("/", accountsRouter);
```

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-accounts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/superadmin/accounts.routes.ts api/src/admin/superadmin/superadmin.routes.ts api/src/tests/sa-accounts.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): superadmin crea cuentas, sucursales y asigna admins"
```

---

## Task 3: Bandeja de solicitudes de upgrade

**Files:**
- Create: `api/src/admin/superadmin/upgrades.routes.ts`
- Modify: `api/src/admin/superadmin/superadmin.routes.ts`
- Test: `api/src/tests/sa-upgrades.test.ts`

**Interfaces:**
- Produces:
  - `GET /admin/superadmin/upgrade-requests?status=` → lista (default `pending`), con `business{id,name}` y `requestedPlan{id,name}`.
  - `POST /admin/superadmin/upgrade-requests/:id/approve` → set `status=approved`, `reviewedBy=sub`, `reviewedAt=now`, y **cambia `Business.planId = requestedPlanId`**. 200.
  - `POST /admin/superadmin/upgrade-requests/:id/reject` → set `status=rejected`, `reviewedBy`, `reviewedAt`. 200.
  - Solo se puede aprobar/rechazar una solicitud `pending` (si no → 409 `already_reviewed`).

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/sa-upgrades.test.ts`:
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

const sa = async () => `Bearer ${await tokenFor("super@demo.cl")}`;
async function makeReq() {
  return prisma.planUpgradeRequest.create({
    data: { businessId: ctx.biz.id, requestedPlanId: ctx.pro.id, createdBy: ctx.general.id },
  });
}

describe("superadmin · upgrades", () => {
  it("lista pendientes con business y plan", async () => {
    await makeReq();
    const res = await request(app).get("/admin/superadmin/upgrade-requests").set("Authorization", await sa());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].business.id).toBe(ctx.biz.id);
    expect(res.body[0].requestedPlan.name).toBe("Pro");
  });

  it("aprobar cambia el plan del business", async () => {
    const r = await makeReq();
    const res = await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/approve`).set("Authorization", await sa());
    expect(res.status).toBe(200);
    const biz = await prisma.business.findUniqueOrThrow({ where: { id: ctx.biz.id } });
    expect(biz.planId).toBe(ctx.pro.id);
    const fresh = await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(fresh.status).toBe("approved");
  });

  it("rechazar no cambia el plan", async () => {
    const r = await makeReq();
    const res = await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/reject`).set("Authorization", await sa());
    expect(res.status).toBe(200);
    const biz = await prisma.business.findUniqueOrThrow({ where: { id: ctx.biz.id } });
    expect(biz.planId).toBe(ctx.free.id);
  });

  it("409 si ya fue revisada", async () => {
    const r = await makeReq();
    await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/approve`).set("Authorization", await sa());
    const again = await request(app).post(`/admin/superadmin/upgrade-requests/${r.id}/approve`).set("Authorization", await sa());
    expect(again.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-upgrades.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar el router**

Crear `api/src/admin/superadmin/upgrades.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";

export const upgradesRouter = Router();

const listSchema = z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() });

upgradesRouter.get("/upgrade-requests", async (req, res, next) => {
  try {
    const { status } = listSchema.parse(req.query);
    const rows = await prisma.planUpgradeRequest.findMany({
      where: { status: status ?? "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        business: { select: { id: true, name: true } },
        requestedPlan: { select: { id: true, name: true, maxBranches: true, maxPromos: true, maxMenuItems: true } },
      },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

async function loadPending(id: string) {
  const r = await prisma.planUpgradeRequest.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "request_not_found");
  if (r.status !== "pending") throw new HttpError(409, "already_reviewed");
  return r;
}

upgradesRouter.post("/upgrade-requests/:id/approve", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.business.update({ where: { id: r.businessId }, data: { planId: r.requestedPlanId } });
      return tx.planUpgradeRequest.update({
        where: { id: r.id },
        data: { status: "approved", reviewedBy: req.user!.sub, reviewedAt: new Date() },
      });
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

upgradesRouter.post("/upgrade-requests/:id/reject", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.planUpgradeRequest.update({
      where: { id: r.id },
      data: { status: "rejected", reviewedBy: req.user!.sub, reviewedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar en el superadminRouter**

En `superadmin.routes.ts`:
```ts
import { upgradesRouter } from "./upgrades.routes.js";
// ...
superadminRouter.use("/", upgradesRouter);
```

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-upgrades.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/superadmin/upgrades.routes.ts api/src/admin/superadmin/superadmin.routes.ts api/src/tests/sa-upgrades.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): superadmin aprueba/rechaza solicitudes de upgrade (cambia el plan)"
```

---

## Task 4: CRUD de anuncios + cupo de popups

**Files:**
- Modify: `api/src/env.ts`
- Create: `api/src/admin/superadmin/ads.routes.ts`
- Modify: `api/src/admin/superadmin/superadmin.routes.ts`
- Test: `api/src/tests/sa-ads.test.ts`

**Interfaces:**
- Produces:
  - `POST /admin/superadmin/ads` body `{ businessId, branchId?, title, description?, imageUrl?, placement: "section"|"popup", startsAt, endsAt, active? }` → crea Ad (`createdBy=sub`). Si `placement="popup"` y ya hay `>= MAX_POPUPS_PER_DAY` anuncios popup activos cuyo rango `[startsAt,endsAt]` se solapa con el nuevo → 403 `popup_quota_full`. 201.
  - `GET /admin/superadmin/ads` → lista todos (con `business{name}`), orden `createdAt desc`.
  - `PATCH /admin/superadmin/ads/:id` → actualiza campos (incluido `active`).
  - `DELETE /admin/superadmin/ads/:id` → 204.
- `env.MAX_POPUPS_PER_DAY` (number, default 3).

- [ ] **Step 1: Agregar `MAX_POPUPS_PER_DAY` al env**

En `api/src/env.ts`, dentro del `z.object({...})`, agregar antes del cierre:
```ts
  MAX_POPUPS_PER_DAY: z.coerce.number().default(3),
```

- [ ] **Step 2: Escribir el test (falla primero)**

Crear `api/src/tests/sa-ads.test.ts`:
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

const sa = async () => `Bearer ${await tokenFor("super@demo.cl")}`;
const win = { startsAt: "2026-07-01T00:00:00.000Z", endsAt: "2026-07-31T00:00:00.000Z" };

describe("superadmin · anuncios", () => {
  it("crea un anuncio de sección", async () => {
    const res = await request(app).post("/admin/superadmin/ads").set("Authorization", await sa())
      .send({ businessId: ctx.biz.id, title: "Promo", placement: "section", ...win });
    expect(res.status).toBe(201);
    expect(res.body.placement).toBe("section");
  });

  it("bloquea el 4º popup solapado (cupo 3) → 403 popup_quota_full", async () => {
    // crear 3 popups activos solapados con la misma ventana
    for (let i = 0; i < 3; i++) {
      await prisma.ad.create({ data: { businessId: ctx.biz.id, title: `p${i}`, placement: "popup", startsAt: new Date(win.startsAt), endsAt: new Date(win.endsAt), active: true, createdBy: ctx.superadmin.id } });
    }
    const res = await request(app).post("/admin/superadmin/ads").set("Authorization", await sa())
      .send({ businessId: ctx.biz.id, title: "popup4", placement: "popup", ...win });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("popup_quota_full");
  });

  it("lista, edita y elimina", async () => {
    const ad = await prisma.ad.create({ data: { businessId: ctx.biz.id, title: "A", placement: "section", startsAt: new Date(win.startsAt), endsAt: new Date(win.endsAt), createdBy: ctx.superadmin.id } });
    const list = await request(app).get("/admin/superadmin/ads").set("Authorization", await sa());
    expect(list.body.map((a: any) => a.id)).toContain(ad.id);
    const patched = await request(app).patch(`/admin/superadmin/ads/${ad.id}`).set("Authorization", await sa()).send({ active: false });
    expect(patched.body.active).toBe(false);
    const del = await request(app).delete(`/admin/superadmin/ads/${ad.id}`).set("Authorization", await sa());
    expect(del.status).toBe(204);
  });
});
```

- [ ] **Step 3: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-ads.test.ts`
Expected: FAIL (404).

- [ ] **Step 4: Implementar el router de anuncios**

Crear `api/src/admin/superadmin/ads.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";
import { env } from "../../env.js";

export const adsRouter = Router();

const createSchema = z.object({
  businessId: z.string().min(1),
  branchId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  placement: z.enum(["section", "popup"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean().optional(),
});

adsRouter.post("/ads", async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const startsAt = new Date(d.startsAt);
    const endsAt = new Date(d.endsAt);
    if (d.placement === "popup") {
      // Cuenta popups activos cuyo rango se solapa con [startsAt, endsAt].
      const overlapping = await prisma.ad.count({
        where: { placement: "popup", active: true, startsAt: { lte: endsAt }, endsAt: { gte: startsAt } },
      });
      if (overlapping >= env.MAX_POPUPS_PER_DAY) throw new HttpError(403, "popup_quota_full");
    }
    const ad = await prisma.ad.create({
      data: {
        businessId: d.businessId, branchId: d.branchId ?? null, title: d.title,
        description: d.description ?? null, imageUrl: d.imageUrl ?? null, placement: d.placement,
        startsAt, endsAt, active: d.active ?? true, createdBy: req.user!.sub,
      },
    });
    res.status(201).json(ad);
  } catch (e) {
    next(e);
  }
});

adsRouter.get("/ads", async (_req, res, next) => {
  try {
    const ads = await prisma.ad.findMany({
      orderBy: { createdAt: "desc" },
      include: { business: { select: { id: true, name: true } } },
    });
    res.json(ads);
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

adsRouter.patch("/ads/:id", async (req, res, next) => {
  try {
    const d = updateSchema.parse(req.body);
    const exists = await prisma.ad.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "ad_not_found");
    const ad = await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
        ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
        ...(d.endsAt !== undefined ? { endsAt: new Date(d.endsAt) } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    res.json(ad);
  } catch (e) {
    next(e);
  }
});

adsRouter.delete("/ads/:id", async (req, res, next) => {
  try {
    const exists = await prisma.ad.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "ad_not_found");
    await prisma.ad.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
```
Nota: este router se llama `adsRouter` pero vive en `superadmin/ads.routes.ts` y sus paths incluyen `/ads`; NO confundir con el router PÚBLICO de Task 6 (`src/ads/ads.routes.ts`). Al importarlo en `superadmin.routes.ts`, renombrar en el import para evitar choque: `import { adsRouter as superadminAdsRouter } from "./ads.routes.js";`.

- [ ] **Step 5: Montar en el superadminRouter**

En `superadmin.routes.ts`:
```ts
import { adsRouter as superadminAdsRouter } from "./ads.routes.js";
// ...
superadminRouter.use("/", superadminAdsRouter);
```

- [ ] **Step 6: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-ads.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add api/src/env.ts api/src/admin/superadmin/ads.routes.ts api/src/admin/superadmin/superadmin.routes.ts api/src/tests/sa-ads.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): superadmin CRUD de anuncios con cupo diario de popups"
```

---

## Task 5: Bandeja de solicitudes de anuncio

**Files:**
- Create: `api/src/admin/superadmin/ad-requests.routes.ts`
- Modify: `api/src/admin/superadmin/superadmin.routes.ts`
- Test: `api/src/tests/sa-ad-requests.test.ts`

**Interfaces:**
- Produces:
  - `GET /admin/superadmin/ad-requests?status=` → lista (default `pending`) con `business{id,name}`.
  - `POST /admin/superadmin/ad-requests/:id/approve` → set `status=approved`, `reviewedBy`, `reviewedAt`. (NO crea el Ad automáticamente — el superadmin lo crea con el form de Task 4, pre-llenado en el frontend a partir de la solicitud.) 200.
  - `POST /admin/superadmin/ad-requests/:id/reject` → set `status=rejected`. 200.
  - Solo `pending` se puede revisar (si no → 409 `already_reviewed`).

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/sa-ad-requests.test.ts`:
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

const sa = async () => `Bearer ${await tokenFor("super@demo.cl")}`;
async function makeReq() {
  return prisma.adRequest.create({
    data: { businessId: ctx.biz.id, branchId: ctx.branch.id, desiredStartsAt: new Date("2026-07-01"), desiredEndsAt: new Date("2026-07-31"), wantsPopup: true, createdBy: ctx.general.id },
  });
}

describe("superadmin · solicitudes de anuncio", () => {
  it("lista pendientes con business", async () => {
    await makeReq();
    const res = await request(app).get("/admin/superadmin/ad-requests").set("Authorization", await sa());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].business.id).toBe(ctx.biz.id);
  });

  it("aprobar marca approved", async () => {
    const r = await makeReq();
    const res = await request(app).post(`/admin/superadmin/ad-requests/${r.id}/approve`).set("Authorization", await sa());
    expect(res.status).toBe(200);
    const fresh = await prisma.adRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(fresh.status).toBe("approved");
    expect(fresh.reviewedBy).toBe(ctx.superadmin.id);
  });

  it("409 si ya fue revisada", async () => {
    const r = await makeReq();
    await request(app).post(`/admin/superadmin/ad-requests/${r.id}/reject`).set("Authorization", await sa());
    const again = await request(app).post(`/admin/superadmin/ad-requests/${r.id}/reject`).set("Authorization", await sa());
    expect(again.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-ad-requests.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implementar el router**

Crear `api/src/admin/superadmin/ad-requests.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";

export const adRequestsRouter = Router();

const listSchema = z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() });

adRequestsRouter.get("/ad-requests", async (req, res, next) => {
  try {
    const { status } = listSchema.parse(req.query);
    const rows = await prisma.adRequest.findMany({
      where: { status: status ?? "pending" },
      orderBy: { createdAt: "desc" },
      include: { business: { select: { id: true, name: true } } },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

async function loadPending(id: string) {
  const r = await prisma.adRequest.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "request_not_found");
  if (r.status !== "pending") throw new HttpError(409, "already_reviewed");
  return r;
}

adRequestsRouter.post("/ad-requests/:id/approve", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.adRequest.update({
      where: { id: r.id },
      data: { status: "approved", reviewedBy: req.user!.sub, reviewedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

adRequestsRouter.post("/ad-requests/:id/reject", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.adRequest.update({
      where: { id: r.id },
      data: { status: "rejected", reviewedBy: req.user!.sub, reviewedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar en el superadminRouter**

En `superadmin.routes.ts`:
```ts
import { adRequestsRouter } from "./ad-requests.routes.js";
// ...
superadminRouter.use("/", adRequestsRouter);
```

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/sa-ad-requests.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/superadmin/ad-requests.routes.ts api/src/admin/superadmin/superadmin.routes.ts api/src/tests/sa-ad-requests.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): superadmin aprueba/rechaza solicitudes de anuncio"
```

---

## Task 6: Anuncios públicos por cercanía (`GET /ads`, `GET /ads/popup`)

**Files:**
- Create: `api/src/ads/ads.sql.ts`
- Create: `api/src/ads/ads.routes.ts`
- Modify: `api/src/app.ts`
- Test: `api/src/tests/ads-public.test.ts`

**Interfaces:**
- Produces (PÚBLICO, sin auth):
  - `GET /ads?lat&lng` → anuncios `placement=section`, `active`, vigentes (`now ∈ [startsAt,endsAt]`), ordenados por **distancia** del usuario a la sucursal del anuncio (o a la sucursal más cercana del business si `branchId` es null). Limit 20.
  - `GET /ads/popup?lat&lng` → **un** anuncio `placement=popup` vigente, el más cercano (o `null` si no hay). Devuelve `{ ad: Ad | null }`.
  - Ambos devuelven, por anuncio: `id, businessId, branchId, title, description, imageUrl, startsAt, endsAt, distance`.

**Nota de exploración (el implementador DEBE leer antes):** abrir `api/src/branches/nearby.sql.ts` para ver el patrón exacto de `Prisma.sql`, el `origin` (`ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography`) y cómo `branches.service.ts` invoca `prisma.$queryRaw<Row[]>(query)`. Replicar ese patrón.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/ads-public.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedAdminFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

let app: import("express").Express;
let ctx: Awaited<ReturnType<typeof seedAdminFixture>>;
beforeEach(async () => {
  await resetDb();
  ctx = await seedAdminFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

const vig = { startsAt: new Date("2020-01-01"), endsAt: new Date("2999-01-01") };

describe("ads públicos", () => {
  it("GET /ads devuelve anuncios de sección vigentes ordenados por cercanía", async () => {
    // ctx.branch en (-33.43,-70.65), ctx.otherBranch en (-33.44,-70.66)
    await prisma.ad.create({ data: { businessId: ctx.biz.id, branchId: ctx.branch.id, title: "Cerca", placement: "section", active: true, createdBy: ctx.superadmin.id, ...vig } });
    await prisma.ad.create({ data: { businessId: ctx.otroBiz.id, branchId: ctx.otherBranch.id, title: "Lejos", placement: "section", active: true, createdBy: ctx.superadmin.id, ...vig } });
    // vencido: no aparece
    await prisma.ad.create({ data: { businessId: ctx.biz.id, branchId: ctx.branch.id, title: "Vencido", placement: "section", active: true, createdBy: ctx.superadmin.id, startsAt: new Date("2000-01-01"), endsAt: new Date("2001-01-01") } });

    const res = await request(app).get("/ads?lat=-33.43&lng=-70.65");
    expect(res.status).toBe(200);
    const titles = res.body.map((a: any) => a.title);
    expect(titles).toContain("Cerca");
    expect(titles).toContain("Lejos");
    expect(titles).not.toContain("Vencido");
    expect(titles[0]).toBe("Cerca"); // el más cercano primero
  });

  it("GET /ads/popup devuelve el popup más cercano o null", async () => {
    const empty = await request(app).get("/ads/popup?lat=-33.43&lng=-70.65");
    expect(empty.status).toBe(200);
    expect(empty.body.ad).toBeNull();

    await prisma.ad.create({ data: { businessId: ctx.biz.id, branchId: ctx.branch.id, title: "Popup", placement: "popup", active: true, createdBy: ctx.superadmin.id, ...vig } });
    const res = await request(app).get("/ads/popup?lat=-33.43&lng=-70.65");
    expect(res.body.ad.title).toBe("Popup");
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/ads-public.test.ts`
Expected: FAIL (404 — no existe `/ads`).

- [ ] **Step 3: Implementar la query**

Crear `api/src/ads/ads.sql.ts`:
```ts
import { Prisma } from "@prisma/client";

// Anuncios vigentes de un placement, ordenados por distancia del usuario a la sucursal del
// anuncio (o a la sucursal más cercana del business si branchId es null). Usa la columna PostGIS geog.
export function buildAdsQuery(lat: number, lng: number, placement: "section" | "popup", limit: number): Prisma.Sql {
  const origin = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  return Prisma.sql`
    SELECT a."id", a."businessId", a."branchId", a."title", a."description", a."imageUrl",
           a."startsAt", a."endsAt",
           COALESCE(
             ST_Distance(b."geog", ${origin}),
             (SELECT MIN(ST_Distance(bb."geog", ${origin})) FROM "Branch" bb WHERE bb."businessId" = a."businessId")
           ) AS distance
    FROM "Ad" a
    LEFT JOIN "Branch" b ON b."id" = a."branchId"
    WHERE a."active" = true
      AND a."placement" = ${placement}::"AdPlacement"
      AND a."startsAt" <= now()
      AND a."endsAt" >= now()
    ORDER BY distance ASC NULLS LAST
    LIMIT ${limit}
  `;
}
```

- [ ] **Step 4: Implementar el router público**

Crear `api/src/ads/ads.routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { buildAdsQuery } from "./ads.sql.js";

export const adsRouter = Router();

interface AdRow {
  id: string;
  businessId: string;
  branchId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  distance: number | null;
}

const geoSchema = z.object({ lat: z.coerce.number(), lng: z.coerce.number() });

adsRouter.get("/", async (req, res, next) => {
  try {
    const { lat, lng } = geoSchema.parse(req.query);
    const rows = await prisma.$queryRaw<AdRow[]>(buildAdsQuery(lat, lng, "section", 20));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

adsRouter.get("/popup", async (req, res, next) => {
  try {
    const { lat, lng } = geoSchema.parse(req.query);
    const rows = await prisma.$queryRaw<AdRow[]>(buildAdsQuery(lat, lng, "popup", env.MAX_POPUPS_PER_DAY));
    res.json({ ad: rows[0] ?? null });
  } catch (e) {
    next(e);
  }
});
```
Nota: `GET /ads/popup` toma el más cercano del pool (a lo más `MAX_POPUPS_PER_DAY` candidatos vigentes). El front lo muestra una vez por sesión (capa 3B).

- [ ] **Step 5: Montar el router público en `app.ts`**

En `api/src/app.ts`, agregar el import y montar ANTES de `/admin` (público, sin auth):
```ts
import { adsRouter } from "./ads/ads.routes.js";
// ...
  app.use("/ads", adsRouter);
```

- [ ] **Step 6: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/ads-public.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Suite completa de API verde**

Run: `docker compose exec -T api npm test`
Expected: toda la suite pasa (discovery, capas 1/2A, superadmin, ads).
**Importante:** `npm test` (resetDb) deja la DB vacía. Tras terminar: `docker compose exec -T api npm run seed:all` para restaurar la data demo (ver [[restoapp-test-db-reset]]).

- [ ] **Step 8: Commit**

```bash
git add api/src/ads/ads.sql.ts api/src/ads/ads.routes.ts api/src/app.ts api/src/tests/ads-public.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): anuncios públicos por cercanía (GET /ads y /ads/popup)"
```

---

## Verificación final de la capa 3A

- `docker compose exec -T api npm test` → toda la suite API verde. Luego `docker compose exec -T api npm run seed:all`.
- `docker compose exec -T api npx tsc --noEmit` → sin errores.
- Flujo manual (token de `admin@restoapp.cl`/`admin12345`):
  1. `GET /admin/superadmin/businesses` → lista jerárquica de empresas con sus sucursales y plan.
  2. `POST /admin/superadmin/businesses` → crea empresa+dueño; `POST /admin/superadmin/users` → crea admin_sucursal; `POST /admin/superadmin/branch-admins` → asígnalo.
  3. Crear un `PlanUpgradeRequest` (como dueño) y aprobarlo → el plan del business cambia.
  4. `POST /admin/superadmin/ads` (section y popup) → el 4º popup solapado da 403; `GET /ads?lat&lng` lista por cercanía; `GET /ads/popup?lat&lng` devuelve el más cercano.

## Self-review (cobertura, capa 3A)

- Router superadmin + empresas (crear con dueño, listar jerárquico, editar) → Task 1. ✓
- Cuentas, sucursales (sin tope) y asignación de admins → Task 2. ✓
- Bandeja de upgrades (aprobar cambia `Business.planId`) → Task 3. ✓
- CRUD de anuncios + cupo de popups → Task 4. ✓
- Bandeja de solicitudes de anuncio → Task 5. ✓
- Anuncios públicos por cercanía + popup → Task 6. ✓
- **Sigue capa 3B** (frontend superadmin): vista jerárquica empresa→locales, formularios de empresa/cuenta/sucursal, asignar plan, bandejas de solicitudes (aprobar/rechazar), CRUD de anuncios (form de Ad pre-llenado al aprobar una solicitud), y en el discovery público `AdSection` (carrusel home, consume `GET /ads`) + `AdPopup` (consume `GET /ads/popup`, se muestra 1 vez por sesión con `sessionStorage`).
