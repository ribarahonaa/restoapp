# RestoApp Admin — Capa 1: Fundación (schema, upload, auth web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la base de los paneles admin: el schema completo de la fase 4, el endpoint autenticado de subida de imágenes a MinIO, el middleware de ownership, y la capa de autenticación del frontend (login, sesión con refresh, rutas protegidas por rol).

**Architecture:** Backend Express+Prisma: una migración manual agrega todas las entidades nuevas (preservando la columna `geog` de PostGIS, que Prisma no mapea). Un router `admin` montado tras `authenticate` aloja el endpoint de upload (multer en memoria → MinIO). Un middleware `requireBranchAccess` resuelve ownership por rol. En el frontend, un módulo `authClient` guarda el access token en memoria y el refresh en `localStorage` con auto-refresh ante 401; un `AuthContext` expone la sesión y `RequireRole` protege el área `/admin`.

**Tech Stack:** Prisma 5, PostgreSQL+PostGIS, MinIO (cliente `minio` ya instalado), multer, Express, Zod, Vitest+Supertest (API), React 19 + react-router-dom v6, Vitest + @testing-library/react (web).

## Global Constraints

- Commits como `ribarahonaa`, **sin** línea `Co-Authored-By` ni referencia a Claude. Usar `git commit --no-verify`.
- Migraciones Prisma: **manuales** (SQL escrito a mano + `prisma migrate deploy`), nunca `migrate dev` (es interactivo y quiere dropear la columna PostGIS `geog`).
- Comandos de API corren dentro del contenedor: `docker compose exec -T api <cmd>`. Tests web: `cd web && npx vitest run`.
- `imageUrl` siempre se persiste como URL pública de MinIO (`${MINIO_PUBLIC_URL}/restoapp/<key>`), generada por el backend.
- Roles existentes (enum `Role`): `superadmin`, `admin_general`, `admin_sucursal`, `usuario`.
- TypeScript ESM: imports relativos con extensión `.js`.

---

## File Structure

**Backend (api/):**
- `prisma/schema.prisma` — modificar: `Plan.maxBranches`, `Branch.closedUntil`; nuevos enums y modelos `DiscountCode`, `PlanUpgradeRequest`, `AdRequest`, `Ad`.
- `prisma/migrations/20260621070000_admin_phase4_schema/migration.sql` — crear.
- `src/storage/minio.ts` — modificar: agregar `uploadBuffer`.
- `src/admin/admin.routes.ts` — crear: router base montado en `/admin`.
- `src/admin/uploads.routes.ts` — crear: `POST /admin/uploads` (multer).
- `src/middleware/ownership.ts` — crear: `requireBranchAccess`.
- `src/app.ts` — modificar: montar el router admin.
- `src/tests/helpers.ts` — modificar: agregar `seedAdminFixture`.
- `src/tests/uploads.test.ts`, `src/tests/ownership.test.ts`, `src/tests/admin-schema.test.ts` — crear.

**Frontend (web/):**
- `src/auth/authClient.ts` — crear: tokens + `authedFetch` + login/refresh/me/logout.
- `src/auth/AuthContext.tsx` — crear: provider + `useAuth`.
- `src/components/RequireRole.tsx` — crear.
- `src/pages/admin/LoginPage.tsx`, `src/pages/admin/AdminHome.tsx` — crear.
- `src/App.tsx`, `src/main.tsx` — modificar: rutas `/admin/*` y `AuthProvider`.
- `src/i18n/{es,en,pt}.json` — modificar: claves `admin.*`.
- `src/tests/authClient.test.ts`, `src/tests/RequireRole.test.tsx` — crear.

---

## Task 1: Schema y migración de la fase 4

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260621070000_admin_phase4_schema/migration.sql`
- Test: `api/src/tests/admin-schema.test.ts`

**Interfaces:**
- Produces: modelos Prisma `DiscountCode`, `PlanUpgradeRequest`, `AdRequest`, `Ad`; campos `Plan.maxBranches: number`, `Branch.closedUntil: Date | null`; enums `DiscountType` (`percent|amount`), `RequestStatus` (`pending|approved|rejected`), `AdPlacement` (`section|popup`).

- [ ] **Step 1: Agregar campos a `Plan` y `Branch` en el schema**

En `api/prisma/schema.prisma`, dentro de `model Plan` agregar tras `maxMenuItems`:
```prisma
  maxBranches  Int      @default(1)
```
Dentro de `model Branch`, tras `imageUrl String?`:
```prisma
  closedUntil DateTime?
```
Y agregar a las relaciones de `Branch` (junto a `reviews Review[]`):
```prisma
  discountCodes DiscountCode[]
  ads           Ad[]
```

- [ ] **Step 2: Agregar enums y modelos nuevos al final del schema**

```prisma
enum DiscountType {
  percent
  amount
}

enum RequestStatus {
  pending
  approved
  rejected
}

enum AdPlacement {
  section
  popup
}

model DiscountCode {
  id         String       @id @default(uuid())
  businessId String
  business   Business     @relation(fields: [businessId], references: [id])
  branchId   String? // null = toda la cadena del business
  branch     Branch?      @relation(fields: [branchId], references: [id])
  code       String
  type       DiscountType
  value      Decimal      @db.Decimal(10, 2)
  startsAt   DateTime
  endsAt     DateTime
  active     Boolean      @default(true)
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  @@index([businessId])
  @@index([branchId])
}

model PlanUpgradeRequest {
  id              String        @id @default(uuid())
  businessId      String
  business        Business      @relation(fields: [businessId], references: [id])
  requestedPlanId String
  requestedPlan   Plan          @relation(fields: [requestedPlanId], references: [id])
  note            String?
  status          RequestStatus @default(pending)
  createdBy       String
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([businessId])
  @@index([status])
}

model AdRequest {
  id              String        @id @default(uuid())
  businessId      String
  business        Business      @relation(fields: [businessId], references: [id])
  branchId        String? // null = cadena
  desiredStartsAt DateTime
  desiredEndsAt   DateTime
  wantsPopup      Boolean       @default(false)
  note            String?
  status          RequestStatus @default(pending)
  createdBy       String
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([businessId])
  @@index([status])
}

model Ad {
  id          String      @id @default(uuid())
  businessId  String
  business    Business    @relation(fields: [businessId], references: [id])
  branchId    String? // null = cadena
  branch      Branch?     @relation(fields: [branchId], references: [id])
  title       String
  description String?
  imageUrl    String?
  placement   AdPlacement @default(section)
  startsAt    DateTime
  endsAt      DateTime
  active      Boolean     @default(true)
  createdBy   String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([businessId])
  @@index([active, startsAt, endsAt])
}
```

También agregar a `model Business` las relaciones inversas (junto a `branches Branch[]`):
```prisma
  discountCodes  DiscountCode[]
  upgradeRequests PlanUpgradeRequest[]
  adRequests     AdRequest[]
  ads            Ad[]
```
Y a `model Plan` (junto a `branches Branch[]`):
```prisma
  upgradeRequests PlanUpgradeRequest[]
```

- [ ] **Step 3: Escribir la migración SQL a mano**

Crear `api/prisma/migrations/20260621070000_admin_phase4_schema/migration.sql`:
```sql
-- Enums
CREATE TYPE "DiscountType" AS ENUM ('percent', 'amount');
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "AdPlacement" AS ENUM ('section', 'popup');

-- Plan / Branch
ALTER TABLE "Plan" ADD COLUMN "maxBranches" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Branch" ADD COLUMN "closedUntil" TIMESTAMP(3);

-- DiscountCode
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DiscountCode_businessId_idx" ON "DiscountCode"("businessId");
CREATE INDEX "DiscountCode_branchId_idx" ON "DiscountCode"("branchId");
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PlanUpgradeRequest
CREATE TABLE "PlanUpgradeRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestedPlanId" TEXT NOT NULL,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanUpgradeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanUpgradeRequest_businessId_idx" ON "PlanUpgradeRequest"("businessId");
CREATE INDEX "PlanUpgradeRequest_status_idx" ON "PlanUpgradeRequest"("status");
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_requestedPlanId_fkey" FOREIGN KEY ("requestedPlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AdRequest
CREATE TABLE "AdRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "desiredStartsAt" TIMESTAMP(3) NOT NULL,
    "desiredEndsAt" TIMESTAMP(3) NOT NULL,
    "wantsPopup" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdRequest_businessId_idx" ON "AdRequest"("businessId");
CREATE INDEX "AdRequest_status_idx" ON "AdRequest"("status");
ALTER TABLE "AdRequest" ADD CONSTRAINT "AdRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ad
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "placement" "AdPlacement" NOT NULL DEFAULT 'section',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Ad_businessId_idx" ON "Ad"("businessId");
CREATE INDEX "Ad_active_startsAt_endsAt_idx" ON "Ad"("active", "startsAt", "endsAt");
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Aplicar migración y regenerar cliente**

Run:
```bash
docker compose exec -T api npx prisma migrate deploy
docker compose exec -T api npx prisma generate
```
Expected: "All migrations have been successfully applied." y cliente regenerado sin error.

- [ ] **Step 5: Escribir test de modelos nuevos**

Crear `api/src/tests/admin-schema.test.ts`:
```ts
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
```
Nota: `resetDb` debe borrar las tablas nuevas antes de `Business`/`Branch` para respetar FKs (ver Step 6).

- [ ] **Step 6: Extender `resetDb` para las tablas nuevas**

En `api/src/tests/helpers.ts`, dentro de `resetDb`, antes de `await prisma.branchPurpose.deleteMany();` agregar:
```ts
  await prisma.ad.deleteMany();
  await prisma.adRequest.deleteMany();
  await prisma.planUpgradeRequest.deleteMany();
  await prisma.discountCode.deleteMany();
```

- [ ] **Step 7: Ejecutar el test**

Run: `docker compose exec -T api npx vitest run src/tests/admin-schema.test.ts`
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/20260621070000_admin_phase4_schema api/src/tests/admin-schema.test.ts api/src/tests/helpers.ts
git commit --no-verify -m "feat(api): schema fase 4 (descuentos, upgrades, anuncios, cierre temporal)"
```

---

## Task 2: `uploadBuffer` en el cliente MinIO

**Files:**
- Modify: `api/src/storage/minio.ts`
- Test: `api/src/tests/uploads.test.ts` (se completa en Task 3; aquí solo la función)

**Interfaces:**
- Produces: `uploadBuffer(buffer: Buffer, contentType: string, key: string): Promise<string>` — sube el buffer al bucket y devuelve la URL pública.

- [ ] **Step 1: Agregar `uploadBuffer` reutilizando `publicUrl`**

En `api/src/storage/minio.ts`, tras la función `uploadFromUrl`, agregar:
```ts
// Sube un buffer ya en memoria (ej. archivo subido por el dueño) al bucket.
export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  key: string
): Promise<string> {
  await minio.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return publicUrl(key);
}
```

- [ ] **Step 2: Verificar que compila**

Run: `docker compose exec -T api npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/src/storage/minio.ts
git commit --no-verify -m "feat(api): uploadBuffer para subir archivos en memoria a MinIO"
```

---

## Task 3: Endpoint de subida de imágenes (`POST /admin/uploads`)

**Files:**
- Create: `api/src/admin/uploads.routes.ts`
- Create: `api/src/admin/admin.routes.ts`
- Modify: `api/src/app.ts`
- Modify: `api/package.json` (dep `multer`)
- Test: `api/src/tests/uploads.test.ts`

**Interfaces:**
- Consumes: `uploadBuffer` (Task 2), `authenticate`, `authorize`.
- Produces: router `adminRouter` montado en `/admin` (tras `authenticate`); `POST /admin/uploads` (campo multipart `file`) → `201 { url }`.

- [ ] **Step 1: Instalar multer**

Run:
```bash
docker compose exec -T api npm install multer
docker compose exec -T api npm install -D @types/multer
cd api && npm install   # sincroniza node_modules local para tsc/vitest
```
Expected: `multer` aparece en `api/package.json` dependencies.

- [ ] **Step 2: Escribir el test (falla primero)**

Crear `api/src/tests/uploads.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { resetDb, seedAdminFixture, tokenFor } from "./helpers.js";
import { prisma } from "../prisma.js";

vi.mock("../storage/minio.js", () => ({
  uploadBuffer: vi.fn(async () => "http://localhost:9000/restoapp/admin/fake.jpg"),
}));

let app: import("express").Express;
beforeEach(async () => {
  await resetDb();
  await seedAdminFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

describe("POST /admin/uploads", () => {
  it("401 sin token", async () => {
    const res = await request(app).post("/admin/uploads").attach("file", Buffer.from("x"), "a.jpg");
    expect(res.status).toBe(401);
  });

  it("400 si el tipo no es imagen", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post("/admin/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("x"), { filename: "a.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("201 con imagen válida devuelve url", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post("/admin/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake-bytes"), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.url).toContain("/restoapp/");
  });
});
```

- [ ] **Step 3: Agregar helpers `seedAdminFixture` y `tokenFor`**

En `api/src/tests/helpers.ts`, agregar imports al inicio si faltan:
```ts
import { signAccessToken } from "../auth/tokens.js";
```
Y al final del archivo:
```ts
// Fixture admin: un business con su admin_general, una sucursal con admin_sucursal,
// y un segundo business "ajeno" para probar ownership.
export async function seedAdminFixture() {
  const free = await prisma.plan.create({ data: { name: "Free", maxPromos: 1, maxMenuItems: 10, maxBranches: 1 } });
  const general = await prisma.user.create({
    data: { email: "general@demo.cl", name: "General", role: "admin_general", passwordHash: await hashPassword("clave1234") },
  });
  const sucursal = await prisma.user.create({
    data: { email: "sucursal@demo.cl", name: "Sucursal", role: "admin_sucursal", passwordHash: await hashPassword("clave1234") },
  });
  const otro = await prisma.user.create({
    data: { email: "otro@demo.cl", name: "Otro", role: "admin_general", passwordHash: await hashPassword("clave1234") },
  });
  const biz = await prisma.business.create({ data: { name: "Mi Empresa", ownerUserId: general.id } });
  const otroBiz = await prisma.business.create({ data: { name: "Empresa Ajena", ownerUserId: otro.id } });
  const branch = await prisma.branch.create({
    data: { name: "Mi Local", category: "cafe", address: "x", lat: -33.43, lng: -70.65, businessId: biz.id, planId: free.id },
  });
  const otherBranch = await prisma.branch.create({
    data: { name: "Local Ajeno", category: "bar", address: "y", lat: -33.44, lng: -70.66, businessId: otroBiz.id, planId: free.id },
  });
  await prisma.branchAdmin.create({ data: { userId: sucursal.id, branchId: branch.id } });
  return { general, sucursal, otro, biz, otroBiz, branch, otherBranch, free };
}

// Devuelve un access token válido para el email dado.
export async function tokenFor(email: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return signAccessToken({ sub: u.id, role: u.role });
}
```
Confirmar que `resetDb` ya borra `branchAdmin` (lo hace) y las tablas nuevas (Task 1 Step 6).

- [ ] **Step 4: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/uploads.test.ts`
Expected: FAIL (no existe la ruta `/admin/uploads` → 404, no 401/201).

- [ ] **Step 5: Crear el router de uploads**

Crear `api/src/admin/uploads.routes.ts`:
```ts
import { Router } from "express";
import multer from "multer";
import { uploadBuffer } from "../storage/minio.js";
import { HttpError } from "../middleware/error.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const uploadsRouter = Router();

uploadsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new HttpError(400, "file_required");
    if (!ALLOWED.has(file.mimetype)) throw new HttpError(400, "invalid_type");
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `admin/${req.user!.sub}-${Date.now()}.${ext}`;
    const url = await uploadBuffer(file.buffer, file.mimetype, key);
    res.status(201).json({ url });
  } catch (e) {
    next(e);
  }
});
```
Nota: `Date.now()` aquí es válido (runtime de la API, no un script de workflow).

- [ ] **Step 6: Crear el router admin base y montarlo**

Crear `api/src/admin/admin.routes.ts`:
```ts
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { uploadsRouter } from "./uploads.routes.js";

export const adminRouter = Router();

// Todo el área admin requiere sesión y un rol administrativo.
adminRouter.use(authenticate);
adminRouter.use(authorize("superadmin", "admin_general", "admin_sucursal"));

adminRouter.use("/uploads", uploadsRouter);
```
En `api/src/app.ts`, agregar el import y montar (tras `app.use("/purposes", purposesRouter);`):
```ts
import { adminRouter } from "./admin/admin.routes.js";
// ...
  app.use("/admin", adminRouter);
```

- [ ] **Step 7: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/uploads.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add api/src/admin api/src/app.ts api/src/tests/uploads.test.ts api/src/tests/helpers.ts api/package.json api/package-lock.json
git commit --no-verify -m "feat(api): endpoint autenticado de subida de imágenes a MinIO"
```

---

## Task 4: Middleware de ownership (`requireBranchAccess`)

**Files:**
- Create: `api/src/middleware/ownership.ts`
- Test: `api/src/tests/ownership.test.ts`

**Interfaces:**
- Consumes: `req.user` (de `authenticate`), Prisma.
- Produces: `requireBranchAccess(param = "branchId")` — middleware Express que permite continuar si el usuario puede gestionar ese branch; responde 403/404 si no. `superadmin` siempre pasa; `admin_general` si es dueño del business del branch; `admin_sucursal` si tiene `BranchAdmin` para ese branch.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/ownership.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { resetDb, seedAdminFixture } from "./helpers.js";
import { prisma } from "../prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireBranchAccess } from "../middleware/ownership.js";
import { errorHandler } from "../middleware/error.js";
import { signAccessToken } from "../auth/tokens.js";

function appWith() {
  const app = express();
  app.use(express.json());
  app.get("/b/:branchId", authenticate, requireBranchAccess(), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof appWith>;
let ctx: Awaited<ReturnType<typeof seedAdminFixture>>;
beforeEach(async () => {
  await resetDb();
  ctx = await seedAdminFixture();
  app = appWith();
});
afterAll(async () => prisma.$disconnect());

const tok = (id: string, role: any) => signAccessToken({ sub: id, role });

describe("requireBranchAccess", () => {
  it("admin_general accede a un branch de su empresa", async () => {
    const res = await request(app).get(`/b/${ctx.branch.id}`).set("Authorization", `Bearer ${tok(ctx.general.id, "admin_general")}`);
    expect(res.status).toBe(200);
  });
  it("admin_general NO accede a un branch ajeno", async () => {
    const res = await request(app).get(`/b/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${tok(ctx.general.id, "admin_general")}`);
    expect(res.status).toBe(403);
  });
  it("admin_sucursal accede solo a su branch asignado", async () => {
    const ok = await request(app).get(`/b/${ctx.branch.id}`).set("Authorization", `Bearer ${tok(ctx.sucursal.id, "admin_sucursal")}`);
    expect(ok.status).toBe(200);
    const no = await request(app).get(`/b/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${tok(ctx.sucursal.id, "admin_sucursal")}`);
    expect(no.status).toBe(403);
  });
  it("superadmin accede a cualquiera", async () => {
    const res = await request(app).get(`/b/${ctx.otherBranch.id}`).set("Authorization", `Bearer ${tok(ctx.general.id, "superadmin")}`);
    expect(res.status).toBe(200);
  });
  it("404 si el branch no existe", async () => {
    const res = await request(app).get(`/b/no-existe`).set("Authorization", `Bearer ${tok(ctx.general.id, "superadmin")}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/ownership.test.ts`
Expected: FAIL (no existe `../middleware/ownership.js`).

- [ ] **Step 3: Implementar el middleware**

Crear `api/src/middleware/ownership.ts`:
```ts
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { HttpError } from "./error.js";

// Permite continuar solo si el usuario puede gestionar el branch indicado en params.
export function requireBranchAccess(param = "branchId") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new HttpError(401, "unauthenticated");
      const branchId = req.params[param];
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, business: { select: { ownerUserId: true } } },
      });
      if (!branch) throw new HttpError(404, "branch_not_found");

      if (user.role === "superadmin") return next();
      if (user.role === "admin_general" && branch.business.ownerUserId === user.sub) return next();
      if (user.role === "admin_sucursal") {
        const link = await prisma.branchAdmin.findUnique({
          where: { userId_branchId: { userId: user.sub, branchId } },
        });
        if (link) return next();
      }
      throw new HttpError(403, "forbidden");
    } catch (e) {
      next(e);
    }
  };
}
```

- [ ] **Step 4: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/ownership.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Suite completa de API verde**

Run: `docker compose exec -T api npm test`
Expected: todos los tests pasan (incluye los previos de discovery/reviews).

- [ ] **Step 6: Commit**

```bash
git add api/src/middleware/ownership.ts api/src/tests/ownership.test.ts
git commit --no-verify -m "feat(api): middleware de ownership por rol para recursos de sucursal"
```

---

## Task 5: Cliente de auth del frontend (`authClient`)

**Files:**
- Create: `web/src/auth/authClient.ts`
- Test: `web/src/tests/authClient.test.ts`

**Interfaces:**
- Produces:
  - `setSession(accessToken: string, refreshToken: string): void`
  - `clearSession(): void`
  - `getAccessToken(): string | null`
  - `hasRefreshToken(): boolean`
  - `login(email: string, password: string): Promise<Me>`
  - `refreshSession(): Promise<void>`
  - `me(): Promise<Me>`
  - `logout(): void`
  - `authedFetch(path: string, init?: RequestInit): Promise<Response>` — agrega `Authorization` y reintenta una vez tras refrescar si recibe 401.
  - tipo `Me = { id: string; email: string; name: string; role: Role; preferredLang: string }`, `Role = "superadmin" | "admin_general" | "admin_sucursal" | "usuario"`.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/authClient.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";

beforeEach(() => {
  localStorage.clear();
  auth.clearSession();
  vi.restoreAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("authClient", () => {
  it("setSession guarda refresh en localStorage y access en memoria", () => {
    auth.setSession("acc", "ref");
    expect(auth.getAccessToken()).toBe("acc");
    expect(auth.hasRefreshToken()).toBe(true);
    auth.clearSession();
    expect(auth.getAccessToken()).toBeNull();
    expect(auth.hasRefreshToken()).toBe(false);
  });

  it("login guarda la sesión y devuelve el usuario", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch" as any);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "a1", refreshToken: "r1" }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "u1", email: "x@y.cl", name: "X", role: "admin_general", preferredLang: "es" }), { status: 200 }));
    const me = await auth.login("x@y.cl", "clave1234");
    expect(me.role).toBe("admin_general");
    expect(auth.getAccessToken()).toBe("a1");
    expect(localStorage.getItem("resto.refresh")).toBe("r1");
  });

  it("authedFetch refresca una vez ante 401 y reintenta", async () => {
    auth.setSession("old", "r1");
    const fetchMock = vi.spyOn(globalThis, "fetch" as any);
    // 1) primer intento 401, 2) refresh ok, 3) reintento ok
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "new", refreshToken: "r2" }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await auth.authedFetch("/admin/ping");
    expect(res.status).toBe(200);
    expect(auth.getAccessToken()).toBe("new");
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/authClient.test.ts`
Expected: FAIL (no existe `../auth/authClient.js`).

- [ ] **Step 3: Implementar el cliente**

Crear `web/src/auth/authClient.ts`:
```ts
import { API_URL } from "../env.js";

export type Role = "superadmin" | "admin_general" | "admin_sucursal" | "usuario";
export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  preferredLang: string;
}

const REFRESH_KEY = "resto.refresh";
let accessToken: string | null = null;

export function setSession(access: string, refresh: string) {
  accessToken = access;
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearSession() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}
export function getAccessToken() {
  return accessToken;
}
export function hasRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) != null;
}

export async function login(email: string, password: string): Promise<Me> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("invalid_credentials");
  const { accessToken: a, refreshToken: r } = await res.json();
  setSession(a, r);
  return me();
}

export async function refreshSession(): Promise<void> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error("no_refresh");
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    clearSession();
    throw new Error("refresh_failed");
  }
  const { accessToken: a, refreshToken: r } = await res.json();
  setSession(a, r);
}

export async function me(): Promise<Me> {
  const res = await authedFetch("/auth/me");
  if (!res.ok) throw new Error("me_failed");
  return res.json();
}

export function logout() {
  clearSession();
}

// fetch con Authorization; ante 401 intenta refrescar una vez y reintenta.
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const withAuth = (token: string | null): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let res = await fetch(url, withAuth(accessToken));
  if (res.status === 401 && hasRefreshToken()) {
    try {
      await refreshSession();
      res = await fetch(url, withAuth(accessToken));
    } catch {
      // refresh falló: se devuelve el 401 original
    }
  }
  return res;
}
```

- [ ] **Step 4: Run test, debe pasar**

Run: `cd web && npx vitest run src/tests/authClient.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/auth/authClient.ts web/src/tests/authClient.test.ts
git commit --no-verify -m "feat(web): cliente de auth con sesión y refresh automático"
```

---

## Task 6: AuthContext, Login, RequireRole y rutas `/admin`

**Files:**
- Create: `web/src/auth/AuthContext.tsx`
- Create: `web/src/components/RequireRole.tsx`
- Create: `web/src/pages/admin/LoginPage.tsx`
- Create: `web/src/pages/admin/AdminHome.tsx`
- Modify: `web/src/App.tsx`, `web/src/main.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/RequireRole.test.tsx`

**Interfaces:**
- Consumes: `authClient` (Task 5).
- Produces:
  - `AuthProvider` (envuelve la app), `useAuth(): { user: Me | null; status: "loading" | "authed" | "anon"; signIn(email,password): Promise<void>; signOut(): void }`.
  - `<RequireRole roles={Role[]}>children</RequireRole>` — redirige a `/admin/login` si anónimo, a `/admin` si el rol no aplica, muestra `children` si ok.

- [ ] **Step 1: Implementar AuthContext**

Crear `web/src/auth/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { login as apiLogin, logout as apiLogout, me, hasRefreshToken, type Me } from "./authClient.js";

type Status = "loading" | "authed" | "anon";
interface AuthValue {
  user: Me | null;
  status: Status;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!hasRefreshToken()) {
      setStatus("anon");
      return;
    }
    me()
      .then((u) => {
        setUser(u);
        setStatus("authed");
      })
      .catch(() => setStatus("anon"));
  }, []);

  const signIn = async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    setStatus("authed");
  };
  const signOut = () => {
    apiLogout();
    setUser(null);
    setStatus("anon");
  };

  return <Ctx.Provider value={{ user, status, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
```

- [ ] **Step 2: Implementar RequireRole**

Crear `web/src/components/RequireRole.tsx`:
```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import type { Role } from "../auth/authClient.js";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <div className="grid h-screen place-items-center text-mute">…</div>;
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 3: Escribir el test de RequireRole (falla primero)**

Crear `web/src/tests/RequireRole.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext.js";
import { RequireRole } from "../components/RequireRole.js";
import * as authClient from "../auth/authClient.js";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<div>LOGIN</div>} />
          <Route path="/admin" element={<div>ADMIN_HOME</div>} />
          <Route
            path="/admin/super"
            element={
              <RequireRole roles={["superadmin"]}>
                <div>SUPER_ONLY</div>
              </RequireRole>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  authClient.clearSession();
  vi.restoreAllMocks();
});

describe("RequireRole", () => {
  it("redirige a login si no hay sesión", async () => {
    vi.spyOn(authClient, "hasRefreshToken").mockReturnValue(false);
    renderAt("/admin/super");
    expect(await screen.findByText("LOGIN")).toBeInTheDocument();
  });

  it("redirige a /admin si el rol no aplica", async () => {
    vi.spyOn(authClient, "hasRefreshToken").mockReturnValue(true);
    vi.spyOn(authClient, "me").mockResolvedValue({ id: "u1", email: "g@d.cl", name: "G", role: "admin_general", preferredLang: "es" });
    renderAt("/admin/super");
    expect(await screen.findByText("ADMIN_HOME")).toBeInTheDocument();
  });

  it("muestra el contenido si el rol aplica", async () => {
    vi.spyOn(authClient, "hasRefreshToken").mockReturnValue(true);
    vi.spyOn(authClient, "me").mockResolvedValue({ id: "u1", email: "s@d.cl", name: "S", role: "superadmin", preferredLang: "es" });
    renderAt("/admin/super");
    expect(await screen.findByText("SUPER_ONLY")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/RequireRole.test.tsx`
Expected: FAIL (no existen `AuthContext`/`RequireRole`).

(Tras crear los archivos de Steps 1-2, este test debe pasar; si se ejecuta antes, falla por import.)

- [ ] **Step 5: Crear LoginPage y AdminHome**

Crear `web/src/pages/admin/LoginPage.tsx`:
```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext.js";

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await signIn(email, password);
      navigate("/admin");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line">
        <h1 className="mb-4 font-display text-xl font-extrabold text-brand">{t("admin.login.title")}</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("admin.login.email")}
          className="mb-2 w-full rounded-xl bg-bg px-3 py-2 text-sm ring-1 ring-line focus:outline-none focus:ring-brand"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("admin.login.password")}
          className="mb-3 w-full rounded-xl bg-bg px-3 py-2 text-sm ring-1 ring-line focus:outline-none focus:ring-brand"
        />
        {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.login.error")}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {t("admin.login.submit")}
        </button>
      </form>
    </div>
  );
}
```
Crear `web/src/pages/admin/AdminHome.tsx`:
```tsx
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext.js";

export function AdminHome() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("admin.home.title")}</h1>
        <p className="mt-1 text-mute">{user?.name} — {user?.role}</p>
        <button onClick={signOut} className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">
          {t("admin.home.logout")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Cablear rutas y provider**

En `web/src/App.tsx`, reemplazar el contenido por:
```tsx
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { BranchDetailPage } from "./pages/BranchDetailPage.js";
import { LoginPage } from "./pages/admin/LoginPage.js";
import { AdminHome } from "./pages/admin/AdminHome.js";
import { RequireRole } from "./components/RequireRole.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/branch/:id" element={<BranchDetailPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireRole roles={["superadmin", "admin_general", "admin_sucursal"]}>
            <AdminHome />
          </RequireRole>
        }
      />
    </Routes>
  );
}
```
En `web/src/main.tsx`, envolver `<App />` con `<AuthProvider>`:
```tsx
import { AuthProvider } from "./auth/AuthContext.js";
// ...
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
```

- [ ] **Step 7: Agregar claves i18n**

En `web/src/i18n/es.json` (raíz del objeto), agregar:
```json
  "admin": {
    "login": { "title": "Panel · Ingreso", "email": "Correo", "password": "Contraseña", "submit": "Entrar", "error": "Credenciales inválidas" },
    "home": { "title": "Panel de administración", "logout": "Cerrar sesión" }
  },
```
En `web/src/i18n/en.json`:
```json
  "admin": {
    "login": { "title": "Admin · Sign in", "email": "Email", "password": "Password", "submit": "Sign in", "error": "Invalid credentials" },
    "home": { "title": "Admin panel", "logout": "Sign out" }
  },
```
En `web/src/i18n/pt.json`:
```json
  "admin": {
    "login": { "title": "Painel · Entrar", "email": "E-mail", "password": "Senha", "submit": "Entrar", "error": "Credenciais inválidas" },
    "home": { "title": "Painel de administração", "logout": "Sair" }
  },
```

- [ ] **Step 8: Run test, debe pasar; luego typecheck**

Run: `cd web && npx vitest run src/tests/RequireRole.test.tsx`
Expected: PASS (3 tests).
Run: `cd web && npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 9: Verificación manual del flujo**

Run (seed crea `owner@demo.cl` admin_general / `owner12345`):
```bash
curl -s -XPOST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"owner@demo.cl","password":"owner12345"}'
```
Expected: JSON con `accessToken` y `refreshToken`.
En el navegador: `localhost:5173/admin/login` → ingresar esas credenciales → redirige a `/admin` mostrando nombre y rol. Sin sesión, `localhost:5173/admin` redirige a login.

- [ ] **Step 10: Commit**

```bash
git add web/src/auth/AuthContext.tsx web/src/components/RequireRole.tsx web/src/pages/admin web/src/App.tsx web/src/main.tsx web/src/i18n web/src/tests/RequireRole.test.tsx
git commit --no-verify -m "feat(web): auth del panel (contexto, login, rutas protegidas por rol)"
```

---

## Verificación final de la capa 1

- `docker compose exec -T api npm test` → toda la suite API verde (incluye schema, uploads, ownership).
- `cd web && npx vitest run` → toda la suite web verde.
- `cd web && npx tsc -b --noEmit` y `docker compose exec -T api npx tsc --noEmit` → sin errores.
- Flujo manual: login en `/admin/login` con `owner@demo.cl`/`owner12345` → `/admin`; subir un archivo a `POST /admin/uploads` con el token devuelve una URL de MinIO accesible.

## Self-review (cobertura del spec, capa 1)

- Schema fase 4 completo (Plan.maxBranches, Branch.closedUntil, DiscountCode, PlanUpgradeRequest, AdRequest, Ad) → Task 1. ✓
- Upload multipart autenticado a MinIO → Tasks 2-3. ✓
- Middleware ownership por rol → Task 4. ✓
- Auth web (sesión, refresh, rutas protegidas por rol) → Tasks 5-6. ✓
- Las capas 2 (panel dueño) y 3 (panel superadmin + anuncios) tienen su propio plan posterior; este plan deja la base lista (schema, upload, ownership, auth) que ambas consumen.
