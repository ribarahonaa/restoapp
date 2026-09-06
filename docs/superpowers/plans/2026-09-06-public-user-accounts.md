# Cuentas de usuario público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login/registro de usuarios finales, con reseñas atadas a la cuenta y verificadas por presencia (check-in GPS + espera), y favoritos sincronizados con la cuenta.

**Architecture:** Se reutiliza el auth existente (`/auth/*`, `AuthContext`, `authClient`, refresh con rotación). El backend agrega: `userId`+`verified` en `Review`, tablas `FavoriteBranch` y `Visit`, endpoints de favoritos, check-in y verificación de presencia en el POST de reseñas. El frontend agrega un modal de auth pública, gate de reseñas (login → GPS → check-in → espera → formulario) y favoritos con fuente dual (localStorage anónimo / servidor logueado, con merge al entrar).

**Tech Stack:** Express + Prisma + Postgres/PostGIS + TypeScript (tsx) en `api/`; React 19 + Vite + i18next en `web/`. Tests: vitest + supertest (api), vitest + testing-library (web).

**Spec:** `docs/superpowers/specs/2026-09-06-public-user-accounts-design.md`

## Global Constraints

- **Migraciones a mano** + `prisma migrate deploy` (NUNCA `migrate dev`: intenta dropear la columna `geog` de PostGIS). Timestamp de carpeta posterior a `20260905010000`.
- Tras cualquier corrida de tests: `docker compose exec -T api npm run seed:all` (los tests borran la DB de dev).
- Comandos corren dentro de los contenedores: `docker compose exec -T api ...` / `docker compose exec -T web ...`.
- Typecheck obligatorio por tarea: api `npx tsc --noEmit`, web `npx tsc -b --noEmit`.
- Commits sin línea de co-autor (convención del repo). Conventional Commits.
- i18n: toda copy nueva va en `web/src/i18n/{es,en,pt}.json`.
- Constantes de presencia con default y override por env: `PRESENCE_RADIUS_M=150`, `REVIEW_MIN_DWELL_MINUTES=20`.

---

## FASE A — Cuentas públicas + reseñas identificadas

### Task A1: Migración `Review.userId` + `Review.verified`

**Files:**
- Create: `api/prisma/migrations/20260906010000_review_user/migration.sql`
- Modify: `api/prisma/schema.prisma` (modelos `User` y `Review`)

**Interfaces:**
- Produces: columna `Review.userId` (nullable, FK User, `onDelete: SetNull`), `Review.verified` (boolean default false), índice único parcial `(userId, branchId) WHERE userId IS NOT NULL`, relación `User.reviews`.

- [ ] **Step 1: Escribir la migración SQL**

```sql
-- api/prisma/migrations/20260906010000_review_user/migration.sql
ALTER TABLE "Review" ADD COLUMN "userId" TEXT;
ALTER TABLE "Review" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Review_userId_idx" ON "Review"("userId");
CREATE UNIQUE INDEX "Review_userId_branchId_key"
  ON "Review"("userId", "branchId") WHERE "userId" IS NOT NULL;
```

- [ ] **Step 2: Actualizar el schema Prisma**

En `model Review` agregar (después de `authorName`):
```prisma
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  verified   Boolean  @default(false)
```
En `model User` agregar a las relaciones:
```prisma
  reviews         Review[]
```
(El índice único parcial no se declara en Prisma — no soporta `WHERE`; lo aplica la migración y lo respeta la DB.)

- [ ] **Step 3: Aplicar y regenerar**

Run:
```bash
docker compose exec -T api npx prisma migrate deploy
docker compose exec -T api npx prisma generate
```
Expected: "1 migration applied" (o "already applied") y client regenerado.

- [ ] **Step 4: Typecheck**

Run: `docker compose exec -T api npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/20260906010000_review_user
git commit -m "feat(api): Review.userId + verified (migración)"
```

---

### Task A2: Reseñas requieren sesión y quedan atadas al usuario

**Files:**
- Modify: `api/src/branches/branches.routes.ts` (ruta POST reviews)
- Modify: `api/src/branches/branches.service.ts` (`addReview`)
- Test: `api/src/tests/reviews.test.ts`

**Interfaces:**
- Consumes: `authenticate` (`api/src/middleware/authenticate.js`), `req.user.sub`.
- Produces: `addReview(branchId: string, userId: string, input: { rating: number; comment?: string })` que setea `authorName = user.name`, `verified = true`, y lanza `HttpError(409, "already_reviewed")` si el usuario ya reseñó el local.

- [ ] **Step 1: Reescribir el test de reseñas al nuevo contrato**

Reemplazar el `describe` de `reviews.test.ts` por (usa registro para obtener token de rol `usuario`):
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
afterAll(async () => prisma.$disconnect());

async function branchId(name: string) {
  return (await prisma.branch.findFirstOrThrow({ where: { name } })).id;
}
async function register(email = "u@u.cl", name = "Ana") {
  const res = await request(app).post("/auth/register").send({ email, password: "secret123", name });
  return res.body.accessToken as string;
}

describe("POST /branches/:id/reviews", () => {
  it("sin token devuelve 401", async () => {
    const id = await branchId("Cercano Bar");
    expect((await request(app).post(`/branches/${id}/reviews`).send({ rating: 5 })).status).toBe(401);
  });

  it("con token crea la reseña ligada al usuario, verified, authorName = nombre de la cuenta", async () => {
    const token = await register("ana@u.cl", "Ana Pérez");
    const id = await branchId("Cercano Bar");
    const res = await request(app).post(`/branches/${id}/reviews`)
      .set("authorization", `Bearer ${token}`).send({ rating: 5, comment: "Excelente" });
    expect(res.status).toBe(201);
    const row = await prisma.review.findFirstOrThrow({ where: { branchId: id } });
    expect(row.authorName).toBe("Ana Pérez");
    expect(row.verified).toBe(true);
    expect(row.userId).not.toBeNull();
  });

  it("segunda reseña del mismo usuario en el local devuelve 409", async () => {
    const token = await register("ana@u.cl", "Ana");
    const id = await branchId("Cercano Bar");
    await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 5 });
    const dup = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 3 });
    expect(dup.status).toBe(409);
  });

  it("400 con rating fuera de rango", async () => {
    const token = await register();
    const id = await branchId("Cercano Bar");
    expect((await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${token}`).send({ rating: 9 })).status).toBe(400);
  });
});
```

> Nota Fase C: cuando se implemente presencia, este test agrega `lat/lng` + check-in. En Fase A el POST no verifica presencia todavía.

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `docker compose exec -T api npx vitest run src/tests/reviews.test.ts`
Expected: FAIL (hoy la ruta es anónima y pide `authorName`).

- [ ] **Step 3: Proteger la ruta y ajustar el body**

En `branches.routes.ts`: importar `authenticate`, cambiar `reviewSchema` a `{ rating, comment? }` y la ruta:
```ts
import { authenticate } from "../middleware/authenticate.js";

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

branchesRouter.post("/:id/reviews", authenticate, async (req, res, next) => {
  try {
    const body = reviewSchema.parse(req.body);
    res.status(201).json(await addReview(req.params.id, req.user!.sub, body));
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Reescribir `addReview` en el servicio**

Reemplazar la firma y cuerpo actuales por:
```ts
export async function addReview(
  branchId: string,
  userId: string,
  input: { rating: number; comment?: string }
) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, active: true } });
  if (!branch) throw new HttpError(404, "branch_not_found");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "invalid_token");

  const existing = await prisma.review.findFirst({ where: { branchId, userId } });
  if (existing) throw new HttpError(409, "already_reviewed");

  const review = await prisma.review.create({
    data: { branchId, userId, authorName: user.name, rating: input.rating, comment: input.comment ?? null, verified: true },
  });
  const agg = await prisma.review.aggregate({ where: { branchId }, _avg: { rating: true }, _count: true });
  return { review, ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count };
}
```
Borrar la constante `DUPLICATE_REVIEW_WINDOW_MS` y su bloque (ya no aplica). Ajustar la interfaz `ReviewInput` si quedó huérfana (eliminarla o dejar `{ rating; comment? }`).

- [ ] **Step 5: Correr tests y verlos pasar; typecheck**

Run:
```bash
docker compose exec -T api npx vitest run src/tests/reviews.test.ts
docker compose exec -T api npx tsc --noEmit
```
Expected: PASS + exit 0.

- [ ] **Step 6: Exponer `verified` en el detalle**

En `getBranchDetail` (mismo archivo), el `include.reviews` ya trae la fila completa; verificar que el objeto de reseña devuelto incluya `verified` (Prisma lo incluye por defecto al no usar `select`). No requiere cambio si no hay `select` en reviews. Si hubiera `select`, agregar `verified: true`.

- [ ] **Step 7: Commit**

```bash
git add api/src/branches/branches.routes.ts api/src/branches/branches.service.ts api/src/tests/reviews.test.ts
git commit -m "feat(api): reseñas requieren sesión y quedan atadas al usuario"
```

---

### Task A3: `signUp` en el cliente web y el AuthContext

**Files:**
- Modify: `web/src/auth/authClient.ts`
- Modify: `web/src/auth/AuthContext.tsx`

**Interfaces:**
- Produces: `register(name, email, password): Promise<Me>` en authClient; `signUp(name, email, password): Promise<void>` en `useAuth()`.

- [ ] **Step 1: Agregar `register` a authClient**

Después de `login(...)`:
```ts
export async function register(name: string, email: string, password: string): Promise<Me> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error(res.status === 409 ? "email_taken" : "register_failed");
  const { accessToken: a, refreshToken: r } = await res.json();
  setSession(a, r);
  return me();
}
```

- [ ] **Step 2: Exponer `signUp` en AuthContext**

Importar `register as apiRegister`; agregar a `AuthValue`:
```ts
  signUp: (name: string, email: string, password: string) => Promise<void>;
```
y en el provider:
```ts
  const signUp = async (name: string, email: string, password: string) => {
    const u = await apiRegister(name, email, password);
    setUser(u); setStatus("authed");
  };
```
Incluir `signUp` en el value.

- [ ] **Step 3: Typecheck**

Run: `docker compose exec -T web npx tsc -b --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/auth/authClient.ts web/src/auth/AuthContext.tsx
git commit -m "feat(web): signUp (registro público) en authClient y AuthContext"
```

---

### Task A4: Modal de auth pública `AuthSheet` + botón de cuenta en el header

**Files:**
- Create: `web/src/components/auth/AuthSheet.tsx`
- Create: `web/src/components/auth/AccountButton.tsx`
- Modify: `web/src/pages/HomePage.tsx` (header)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/AuthSheet.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`signIn`, `signUp`, `user`, `status`, `signOut`).
- Produces: `<AuthSheet open onClose />` (modal login/registro); `<AccountButton />` (abre el modal o muestra el nombre + cerrar sesión).

- [ ] **Step 1: i18n**

Agregar en cada idioma un bloque `account` (es mostrado):
```json
"account": {
  "signIn": "Ingresar", "signOut": "Cerrar sesión",
  "tabLogin": "Ingresar", "tabRegister": "Crear cuenta",
  "name": "Nombre", "email": "Correo", "password": "Contraseña",
  "submitLogin": "Entrar", "submitRegister": "Crear cuenta",
  "errorLogin": "Credenciales inválidas", "errorRegister": "No se pudo crear la cuenta",
  "emailTaken": "Ese correo ya está registrado"
}
```
(en/pt: traducir los valores.)

- [ ] **Step 2: Escribir el test del AuthSheet**

```tsx
// web/src/tests/AuthSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "../i18n/index.js";
import { AuthSheet } from "../components/auth/AuthSheet.js";
import { AuthProvider } from "../auth/AuthContext.js";
import * as authClient from "../auth/authClient.js";

beforeEach(async () => { await i18n.changeLanguage("es"); vi.restoreAllMocks(); });

it("registra creando cuenta y cierra el modal", async () => {
  vi.spyOn(authClient, "register").mockResolvedValue({ id: "u1", email: "a@a.cl", name: "Ana", role: "usuario", preferredLang: "es" });
  const onClose = vi.fn();
  render(<AuthProvider><AuthSheet open onClose={onClose} /></AuthProvider>);
  fireEvent.click(screen.getByRole("tab", { name: /crear cuenta/i }));
  fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "Ana" } });
  fireEvent.change(screen.getByPlaceholderText("Correo"), { target: { value: "a@a.cl" } });
  fireEvent.change(screen.getByPlaceholderText("Contraseña"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
```

- [ ] **Step 3: Verlo fallar**

Run: `docker compose exec -T web npx vitest run src/tests/AuthSheet.test.tsx`
Expected: FAIL (no existe AuthSheet).

- [ ] **Step 4: Implementar `AuthSheet`**

Modal (patrón de `ItemSheet`: overlay `bg-ink/50`, panel `animate-sheet-up`, cierre por Escape/overlay). Dos tabs con `role="tab"`. En login: email+password → `signIn`; en registro: name+email+password → `signUp`. Ambos: `await`, en éxito `onClose()`; en error, set mensaje (`emailTaken` si `err.message === "email_taken"`). Inputs con `placeholder` = `t("account.name/email/password")`. Botón submit con `t("account.submitLogin/Register")`.

- [ ] **Step 5: Implementar `AccountButton`**

Si `status === "authed"`: muestra el nombre del usuario y un botón `signOut` (`t("account.signOut")`). Si no: botón `t("account.signIn")` que setea `open` y renderiza `<AuthSheet open onClose=.../>`. Estado `open` local con `useState`.

- [ ] **Step 6: Montar en el header de HomePage**

En el header (junto a `<LanguageSwitcher />`), agregar `<AccountButton />`.

- [ ] **Step 7: Correr test + typecheck**

Run:
```bash
docker compose exec -T web npx vitest run src/tests/AuthSheet.test.tsx
docker compose exec -T web npx tsc -b --noEmit
```
Expected: PASS + exit 0.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/auth web/src/pages/HomePage.tsx web/src/i18n web/src/tests/AuthSheet.test.tsx
git commit -m "feat(web): modal de login/registro público + botón de cuenta"
```

---

### Task A5: `ReviewForm` con gate de login

**Files:**
- Modify: `web/src/components/ReviewForm.tsx`
- Modify: `web/src/api/client.ts` (`addReview` manda solo rating+comment, con auth)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Modify: `web/src/tests/BranchDetailPage.coupons.test.tsx` (si asume form anónimo)

**Interfaces:**
- Consumes: `useAuth()`, `authedFetch` (para mandar el token).
- Produces: `ReviewForm` que si `status !== "authed"` muestra aviso + botón que abre `AuthSheet`; si autenticado muestra estrellas + comentario (sin nombre).

- [ ] **Step 1: `addReview` del cliente usa authedFetch y nuevo body**

```ts
import { authedFetch } from "../auth/authClient.js";
export async function addReview(id: string, input: { rating: number; comment?: string }): Promise<ReviewResult> {
  const res = await authedFetch(`/branches/${id}/reviews`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(res.status === 409 ? "already_reviewed" : `HTTP ${res.status}`);
  return res.json() as Promise<ReviewResult>;
}
```
(Actualizar `ReviewInput`/tipos si hace falta: `{ rating; comment? }`.)

- [ ] **Step 2: i18n del gate**

En `review`: `"loginGate": "Inicia sesión para dejar tu reseña", "loginCta": "Ingresar"` (en/pt traducidos). `already_reviewed` reusa `review.duplicate` (ya existe).

- [ ] **Step 3: Gate en ReviewForm**

Al inicio del componente:
```tsx
const { status } = useAuth();
const [authOpen, setAuthOpen] = useState(false);
if (status !== "authed") {
  return (
    <div className="rounded-2xl bg-surface p-4 text-center shadow-sm ring-1 ring-line">
      <p className="mb-2 text-sm text-mute">{t("review.loginGate")}</p>
      <button type="button" onClick={() => setAuthOpen(true)}
        className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">{t("review.loginCta")}</button>
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
```
Quitar el campo `name` del formulario autenticado y su estado; `addReview` ya no lo manda. `canSubmit = rating >= 1 && !busy`.

- [ ] **Step 4: Typecheck + tests afectados**

Run:
```bash
docker compose exec -T web npx tsc -b --noEmit
docker compose exec -T web npx vitest run
```
Expected: exit 0; ajustar cualquier test que asuma el form anónimo (envolver en `AuthProvider` con sesión, o testear el gate anónimo).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReviewForm.tsx web/src/api/client.ts web/src/i18n web/src/tests
git commit -m "feat(web): reseñar requiere iniciar sesión (gate + form autenticado)"
```

---

### Cierre Fase A

- [ ] Re-sembrar: `docker compose exec -T api npm run seed:all`
- [ ] Suite completa: `docker compose exec -T api npx vitest run` y `docker compose exec -T web npx vitest run`
- [ ] `git push origin main`

---

## FASE B — Favoritos sincronizados

### Task B1: Migración `FavoriteBranch`

**Files:**
- Create: `api/prisma/migrations/20260906020000_favorite_branch/migration.sql`
- Modify: `api/prisma/schema.prisma`

**Interfaces:**
- Produces: tabla `FavoriteBranch(userId, branchId, createdAt)` PK compuesta, FKs cascade; relaciones `User.favorites`, `Branch.favorites`.

- [ ] **Step 1: SQL**

```sql
CREATE TABLE "FavoriteBranch" (
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FavoriteBranch_pkey" PRIMARY KEY ("userId","branchId")
);
CREATE INDEX "FavoriteBranch_userId_idx" ON "FavoriteBranch"("userId");
ALTER TABLE "FavoriteBranch" ADD CONSTRAINT "FavoriteBranch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteBranch" ADD CONSTRAINT "FavoriteBranch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 2: Schema**

```prisma
model FavoriteBranch {
  userId    String
  branchId  String
  createdAt DateTime @default(now())
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch    Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  @@id([userId, branchId])
  @@index([userId])
}
```
Agregar `favorites FavoriteBranch[]` a `User` y a `Branch`.

- [ ] **Step 3: Aplicar + generar + typecheck**

```bash
docker compose exec -T api npx prisma migrate deploy
docker compose exec -T api npx prisma generate
docker compose exec -T api npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/20260906020000_favorite_branch
git commit -m "feat(api): tabla FavoriteBranch (migración)"
```

---

### Task B2: Router `/me/favorites` (list/add/delete/merge)

**Files:**
- Create: `api/src/me/favorites.routes.ts`
- Modify: `api/src/app.ts` (montar `/me` con authenticate)
- Test: `api/src/tests/favorites.test.ts`

**Interfaces:**
- Consumes: `authenticate`, `req.user.sub`, `prisma.favoriteBranch`.
- Produces: `GET /me/favorites` → `string[]` (branchIds); `POST /me/favorites/:branchId` → 204; `DELETE /me/favorites/:branchId` → 204; `POST /me/favorites/merge` `{ids:string[]}` → `string[]`.

- [ ] **Step 1: Test**

```ts
// api/src/tests/favorites.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
beforeEach(async () => { await resetDb(); await seedDiscoveryFixture(); });
afterAll(async () => prisma.$disconnect());

async function token() {
  return (await request(app).post("/auth/register").send({ email: "f@f.cl", password: "secret123", name: "Fav" })).body.accessToken;
}
async function branchId(name: string) { return (await prisma.branch.findFirstOrThrow({ where: { name } })).id; }

describe("/me/favorites", () => {
  it("sin token 401", async () => { expect((await request(app).get("/me/favorites")).status).toBe(401); });

  it("add, list y delete idempotentes", async () => {
    const t = await token(); const id = await branchId("Cercano Bar");
    await request(app).post(`/me/favorites/${id}`).set("authorization", `Bearer ${t}`).expect(204);
    await request(app).post(`/me/favorites/${id}`).set("authorization", `Bearer ${t}`).expect(204); // idempotente
    const list = await request(app).get("/me/favorites").set("authorization", `Bearer ${t}`);
    expect(list.body).toEqual([id]);
    await request(app).delete(`/me/favorites/${id}`).set("authorization", `Bearer ${t}`).expect(204);
    expect((await request(app).get("/me/favorites").set("authorization", `Bearer ${t}`)).body).toEqual([]);
  });

  it("merge fusiona, deduplica e ignora ids inexistentes", async () => {
    const t = await token(); const a = await branchId("Cercano Bar"); const b = await branchId("Cercano Lunch Promo");
    await request(app).post(`/me/favorites/${a}`).set("authorization", `Bearer ${t}`).expect(204);
    const res = await request(app).post(`/me/favorites/merge`).set("authorization", `Bearer ${t}`).send({ ids: [a, b, "no-existe"] });
    expect(res.status).toBe(200);
    expect(res.body.sort()).toEqual([a, b].sort());
  });
});
```

- [ ] **Step 2: Verlo fallar**

Run: `docker compose exec -T api npx vitest run src/tests/favorites.test.ts`
Expected: FAIL (404, router no montado).

- [ ] **Step 3: Implementar el router**

```ts
// api/src/me/favorites.routes.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const favoritesRouter = Router();

favoritesRouter.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.favoriteBranch.findMany({ where: { userId: req.user!.sub }, select: { branchId: true }, orderBy: { createdAt: "desc" } });
    res.json(rows.map((r) => r.branchId));
  } catch (e) { next(e); }
});

favoritesRouter.post("/:branchId", async (req, res, next) => {
  try {
    await prisma.favoriteBranch.upsert({
      where: { userId_branchId: { userId: req.user!.sub, branchId: req.params.branchId } },
      update: {}, create: { userId: req.user!.sub, branchId: req.params.branchId },
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

favoritesRouter.delete("/:branchId", async (req, res, next) => {
  try {
    await prisma.favoriteBranch.deleteMany({ where: { userId: req.user!.sub, branchId: req.params.branchId } });
    res.status(204).end();
  } catch (e) { next(e); }
});

favoritesRouter.post("/merge", async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()).max(500) }).parse(req.body);
    const valid = await prisma.branch.findMany({ where: { id: { in: ids } }, select: { id: true } });
    await prisma.favoriteBranch.createMany({
      data: valid.map((b) => ({ userId: req.user!.sub, branchId: b.id })), skipDuplicates: true,
    });
    const rows = await prisma.favoriteBranch.findMany({ where: { userId: req.user!.sub }, select: { branchId: true } });
    res.json(rows.map((r) => r.branchId));
  } catch (e) { next(e); }
});
```
> `merge` va ANTES de `/:branchId` no aplica (métodos distintos: POST `/merge` vs POST `/:branchId` — Express distingue por path, pero `/:branchId` captura "merge" en POST). **Montar `/merge` antes de `/:branchId`** para evitar colisión.

Corregir el orden en el archivo: definir `post("/merge")` **antes** de `post("/:branchId")`.

- [ ] **Step 4: Montar en app.ts**

```ts
import { authenticate } from "./middleware/authenticate.js";
import { favoritesRouter } from "./me/favorites.routes.js";
// ...
app.use("/me/favorites", authenticate, favoritesRouter);
```

- [ ] **Step 5: Test + typecheck**

```bash
docker compose exec -T api npx vitest run src/tests/favorites.test.ts
docker compose exec -T api npx tsc --noEmit
```
Expected: PASS + exit 0.

- [ ] **Step 6: Commit**

```bash
git add api/src/me api/src/app.ts api/src/tests/favorites.test.ts
git commit -m "feat(api): endpoints /me/favorites (list/add/delete/merge)"
```

---

### Task B3: Favoritos con fuente dual en el web + merge al entrar

**Files:**
- Modify: `web/src/lib/favorites.ts`
- Create: `web/src/api/favoritesClient.ts`
- Modify: `web/src/auth/AuthContext.tsx` (merge + recarga al iniciar/cerrar sesión)
- Test: `web/src/tests/favorites.test.tsx` (opcional, store)

**Interfaces:**
- Consumes: `authedFetch`.
- Produces: en `favorites.ts` — `setFavoritesFromServer(ids: string[])`, `syncOnSignIn()`, `resetToLocal()`; `useFavorites()` sin cambio de API (`favorites`, `isFavorite`, `toggle`, `count`).

- [ ] **Step 1: Cliente de favoritos**

```ts
// web/src/api/favoritesClient.ts
import { authedFetch } from "../auth/authClient.js";
export const fetchFavorites = async (): Promise<string[]> => (await authedFetch("/me/favorites")).json();
export const addFavorite = (id: string) => authedFetch(`/me/favorites/${id}`, { method: "POST" });
export const removeFavorite = (id: string) => authedFetch(`/me/favorites/${id}`, { method: "DELETE" });
export const mergeFavorites = async (ids: string[]): Promise<string[]> =>
  (await authedFetch("/me/favorites/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })).json();
```

- [ ] **Step 2: Fuente dual en el store**

Refactor `favorites.ts`: mantener el `Set` reactivo (useSyncExternalStore) y una bandera `mode: "local" | "server"`.
- `toggle(id)`: actualiza el Set y emite; si `mode==="local"` persiste en localStorage; si `mode==="server"` hace `addFavorite`/`removeFavorite` (optimista, sin await para el render).
- `setFavoritesFromServer(ids)`: `favs = new Set(ids); mode="server"; emit()`.
- `resetToLocal()`: recarga de localStorage; `mode="local"; emit()`.
- `getLocalIds()`: helper para el merge.

- [ ] **Step 3: Sincronizar en AuthContext**

- Al pasar a `authed` (en el `.then` del `me()` inicial y en `signIn`/`signUp`): `const ids = getLocalIds(); const merged = await mergeFavorites(ids); setFavoritesFromServer(merged);`
- En `signOut`: `resetToLocal()`.

- [ ] **Step 4: Typecheck + suite web**

```bash
docker compose exec -T web npx tsc -b --noEmit
docker compose exec -T web npx vitest run
```
Expected: exit 0; ajustar mocks si algún test usa favoritos.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/favorites.ts web/src/api/favoritesClient.ts web/src/auth/AuthContext.tsx web/src/tests
git commit -m "feat(web): favoritos sincronizados con la cuenta (fuente dual + merge)"
```

---

### Cierre Fase B

- [ ] Re-sembrar; suites api+web verdes; `git push origin main`.

---

## FASE C — Reseñas verificadas por presencia

### Task C1: Migración `Visit` + constantes de presencia

**Files:**
- Create: `api/prisma/migrations/20260906030000_visit/migration.sql`
- Modify: `api/prisma/schema.prisma`
- Modify: `api/src/env.ts`

**Interfaces:**
- Produces: tabla `Visit(userId, branchId, startedAt, lastSeenAt)` PK compuesta; `env.PRESENCE_RADIUS_M`, `env.REVIEW_MIN_DWELL_MINUTES`.

- [ ] **Step 1: SQL**

```sql
CREATE TABLE "Visit" (
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Visit_pkey" PRIMARY KEY ("userId","branchId")
);
CREATE INDEX "Visit_userId_idx" ON "Visit"("userId");
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 2: Schema + env**

Schema:
```prisma
model Visit {
  userId     String
  branchId   String
  startedAt  DateTime @default(now())
  lastSeenAt DateTime @default(now())
  user       User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch     Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  @@id([userId, branchId])
  @@index([userId])
}
```
Agregar `visits Visit[]` a `User` y `Branch`. En `env.ts`:
```ts
  PRESENCE_RADIUS_M: z.coerce.number().default(150),
  REVIEW_MIN_DWELL_MINUTES: z.coerce.number().default(20),
```

- [ ] **Step 3: Aplicar + generar + typecheck + commit**

```bash
docker compose exec -T api npx prisma migrate deploy
docker compose exec -T api npx prisma generate
docker compose exec -T api npx tsc --noEmit
git add api/prisma/schema.prisma api/prisma/migrations/20260906030000_visit api/src/env.ts
git commit -m "feat(api): tabla Visit + constantes de presencia (migración)"
```

---

### Task C2: Helper de distancia + servicio de presencia

**Files:**
- Create: `api/src/branches/presence.ts`
- Test: `api/src/tests/presence.test.ts`

**Interfaces:**
- Produces: `distanceMeters(a, b): number` (haversine); `checkIn(userId, branchId, lat, lng): Promise<{ startedAt: Date; canReviewAt: Date }>` (throws `HttpError(403,"too_far")` / `404`); `assertCanReview(userId, branchId, lat, lng): Promise<void>` (throws 403 `too_far`/`no_checkin`/`too_soon`).

- [ ] **Step 1: Test unitario de distancia y presencia**

```ts
// api/src/tests/presence.test.ts
import { describe, it, expect } from "vitest";
import { distanceMeters } from "../branches/presence.js";

describe("distanceMeters", () => {
  it("0 para el mismo punto", () => {
    expect(distanceMeters({ lat: -33.4378, lng: -70.6504 }, { lat: -33.4378, lng: -70.6504 })).toBeLessThan(1);
  });
  it("~cientos de metros entre puntos cercanos", () => {
    const d = distanceMeters({ lat: -33.4378, lng: -70.6504 }, { lat: -33.4380, lng: -70.6500 });
    expect(d).toBeGreaterThan(20); expect(d).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Run: `docker compose exec -T api npx vitest run src/tests/presence.test.ts`
Expected: FAIL (no existe presence.ts).

- [ ] **Step 3: Implementar presence.ts**

```ts
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { HttpError } from "../middleware/error.js";

interface LatLng { lat: number; lng: number; }

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function branchOrThrow(branchId: string) {
  const b = await prisma.branch.findFirst({ where: { id: branchId, active: true } });
  if (!b) throw new HttpError(404, "branch_not_found");
  return b;
}

export async function checkIn(userId: string, branchId: string, lat: number, lng: number) {
  const b = await branchOrThrow(branchId);
  if (distanceMeters({ lat, lng }, { lat: b.lat, lng: b.lng }) > env.PRESENCE_RADIUS_M) throw new HttpError(403, "too_far");
  const now = new Date();
  const visit = await prisma.visit.upsert({
    where: { userId_branchId: { userId, branchId } },
    update: { lastSeenAt: now },
    create: { userId, branchId, startedAt: now, lastSeenAt: now },
  });
  const canReviewAt = new Date(visit.startedAt.getTime() + env.REVIEW_MIN_DWELL_MINUTES * 60000);
  return { startedAt: visit.startedAt, canReviewAt };
}

export async function reviewEligibility(userId: string, branchId: string, lat: number, lng: number):
  Promise<{ eligible: boolean; reason?: string; canReviewAt?: Date }> {
  const b = await branchOrThrow(branchId);
  if (distanceMeters({ lat, lng }, { lat: b.lat, lng: b.lng }) > env.PRESENCE_RADIUS_M) return { eligible: false, reason: "too_far" };
  const visit = await prisma.visit.findUnique({ where: { userId_branchId: { userId, branchId } } });
  if (!visit) return { eligible: false, reason: "no_checkin" };
  const canReviewAt = new Date(visit.startedAt.getTime() + env.REVIEW_MIN_DWELL_MINUTES * 60000);
  if (canReviewAt > new Date()) return { eligible: false, reason: "too_soon", canReviewAt };
  return { eligible: true, canReviewAt };
}

export async function assertCanReview(userId: string, branchId: string, lat: number, lng: number) {
  const r = await reviewEligibility(userId, branchId, lat, lng);
  if (!r.eligible) throw new HttpError(403, r.reason!);
}
```

- [ ] **Step 4: Test + typecheck**

```bash
docker compose exec -T api npx vitest run src/tests/presence.test.ts
docker compose exec -T api npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add api/src/branches/presence.ts api/src/tests/presence.test.ts
git commit -m "feat(api): helper de presencia (haversine, check-in, elegibilidad)"
```

---

### Task C3: Endpoints check-in / eligibility + presencia en el POST de reseñas

**Files:**
- Modify: `api/src/branches/branches.routes.ts`
- Modify: `api/src/branches/branches.service.ts` (`addReview` recibe lat/lng y verifica)
- Test: `api/src/tests/presence-review.test.ts`

**Interfaces:**
- Consumes: `checkIn`, `reviewEligibility`, `assertCanReview` de `presence.ts`.
- Produces: `POST /branches/:id/checkin {lat,lng}` → `{startedAt, canReviewAt}`; `GET /branches/:id/review-eligibility?lat&lng` → `{eligible, reason?, canReviewAt?}`; POST reviews exige `{rating, comment?, lat, lng}` y llama `assertCanReview`.

- [ ] **Step 1: Test de flujo de presencia**

```ts
// api/src/tests/presence-review.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
const AT = { lat: -33.4380, lng: -70.6500 }; // = "Cercano Bar"
beforeEach(async () => { await resetDb(); await seedDiscoveryFixture(); });
afterAll(async () => prisma.$disconnect());
async function token() { return (await request(app).post("/auth/register").send({ email: "p@p.cl", password: "secret123", name: "Pia" })).body.accessToken; }
async function barId() { return (await prisma.branch.findFirstOrThrow({ where: { name: "Cercano Bar" } })).id; }

describe("presencia", () => {
  it("reseña sin check-in => 403 no_checkin", async () => {
    const t = await token(); const id = await barId();
    const r = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${t}`).send({ rating: 5, ...AT });
    expect(r.status).toBe(403); expect(r.body.error).toBe("no_checkin");
  });

  it("check-in lejos => 403 too_far", async () => {
    const t = await token(); const id = await barId();
    const r = await request(app).post(`/branches/${id}/checkin`).set("authorization", `Bearer ${t}`).send({ lat: -33.60, lng: -70.90 });
    expect(r.status).toBe(403); expect(r.body.error).toBe("too_far");
  });

  it("check-in reciente => reseña 403 too_soon", async () => {
    const t = await token(); const id = await barId();
    await request(app).post(`/branches/${id}/checkin`).set("authorization", `Bearer ${t}`).send(AT).expect(200);
    const r = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${t}`).send({ rating: 5, ...AT });
    expect(r.status).toBe(403); expect(r.body.error).toBe("too_soon");
  });

  it("check-in viejo + cerca => crea la reseña", async () => {
    const t = await token(); const id = await barId();
    await request(app).post(`/branches/${id}/checkin`).set("authorization", `Bearer ${t}`).send(AT).expect(200);
    const user = await prisma.user.findFirstOrThrow({ where: { email: "p@p.cl" } });
    await prisma.visit.update({ where: { userId_branchId: { userId: user.id, branchId: id } }, data: { startedAt: new Date(Date.now() - 60 * 60000) } });
    const r = await request(app).post(`/branches/${id}/reviews`).set("authorization", `Bearer ${t}`).send({ rating: 5, ...AT });
    expect(r.status).toBe(201);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Run: `docker compose exec -T api npx vitest run src/tests/presence-review.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rutas de check-in y eligibility**

En `branches.routes.ts`:
```ts
import { checkIn, reviewEligibility } from "./presence.js";
const coordsSchema = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

branchesRouter.post("/:id/checkin", authenticate, async (req, res, next) => {
  try {
    const { lat, lng } = coordsSchema.parse(req.body);
    res.json(await checkIn(req.user!.sub, req.params.id, lat, lng));
  } catch (e) { next(e); }
});

branchesRouter.get("/:id/review-eligibility", authenticate, async (req, res, next) => {
  try {
    const { lat, lng } = coordsSchema.parse(req.query);
    res.json(await reviewEligibility(req.user!.sub, req.params.id, lat, lng));
  } catch (e) { next(e); }
});
```

- [ ] **Step 4: `reviewSchema` + `addReview` con presencia**

`reviewSchema` pasa a `{ rating, comment?, lat, lng }`. En la ruta POST reviews, pasar coords a `addReview`. En el servicio:
```ts
import { assertCanReview } from "./presence.js";
export async function addReview(branchId, userId, input: { rating: number; comment?: string; lat: number; lng: number }) {
  await assertCanReview(userId, branchId, input.lat, input.lng);
  // ...resto igual (verified: true)...
}
```

- [ ] **Step 5: Test + typecheck**

```bash
docker compose exec -T api npx vitest run src/tests/presence-review.test.ts src/tests/reviews.test.ts
docker compose exec -T api npx tsc --noEmit
```
Expected: PASS. Actualizar `reviews.test.ts` de Fase A para incluir un check-in viejo antes de crear (o mover esa aserción a este archivo).

- [ ] **Step 6: Commit**

```bash
git add api/src/branches/branches.routes.ts api/src/branches/branches.service.ts api/src/tests
git commit -m "feat(api): check-in, elegibilidad y presencia obligatoria al reseñar"
```

---

### Task C4: UI de check-in + gate de presencia + badge verificado

**Files:**
- Modify: `web/src/api/client.ts` (checkIn, reviewEligibility; addReview manda lat/lng)
- Modify: `web/src/components/ReviewForm.tsx` (estados de presencia)
- Modify: `web/src/pages/BranchDetailPage.tsx` (badge "Visita verificada")
- Modify: `web/src/api/types.ts` (`Review.verified: boolean`)
- Modify: `web/src/i18n/{es,en,pt}.json`

**Interfaces:**
- Consumes: `useGeolocation` (posición), `useAuth`, `authedFetch`.
- Produces: `checkIn(id, lat, lng)`, `getReviewEligibility(id, lat, lng)` en client; `ReviewForm` con estados sin-GPS / sin-checkin / falta-tiempo / elegible; badge por reseña.

- [ ] **Step 1: Client + tipos**

En `client.ts`:
```ts
export const checkIn = async (id: string, lat: number, lng: number) =>
  (await authedFetch(`/branches/${id}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng }) })).json();
export const getReviewEligibility = async (id: string, lat: number, lng: number) =>
  (await authedFetch(`/branches/${id}/review-eligibility?lat=${lat}&lng=${lng}`)).json() as Promise<{ eligible: boolean; reason?: string; canReviewAt?: string }>;
```
`addReview` manda `{ rating, comment, lat, lng }`. En `types.ts`, `Review` gana `verified: boolean`.

- [ ] **Step 2: i18n de presencia**

En `review`:
```json
"needGps": "Activa la ubicación para poder reseñar",
"checkin": "Estoy aquí (check-in)", "tooFar": "Acércate al local para hacer check-in",
"wait": "Podrás reseñar en ~{{min}} min", "verified": "Visita verificada"
```
(en/pt traducidos.)

- [ ] **Step 3: Estados en ReviewForm**

Tras el gate de login (Fase A), agregar (usa `useGeolocation`):
- `geo.status !== "ready"` → aviso `review.needGps` (no muestra form).
- Si `ready`: al montar, `getReviewEligibility(branchId, geo.lat, geo.lng)`:
  - `too_far`/`no_checkin` → botón `review.checkin` → `checkIn(...)`; en `too_far` mostrar `review.tooFar`. Tras check-in, re-consultar eligibility.
  - `too_soon` → `review.wait` con minutos = `ceil((canReviewAt - now)/60000)`.
  - `eligible` → formulario (estrellas + comentario). Al enviar, `addReview` con `geo.lat/lng`.

- [ ] **Step 4: Badge en las reseñas**

En `BranchDetailPage`, en cada reseña, si `r.verified` mostrar una píldora `review.verified` (estilo `OpenBadge`, verde con ícono check).

- [ ] **Step 5: Typecheck + suite web**

```bash
docker compose exec -T web npx tsc -b --noEmit
docker compose exec -T web npx vitest run
```
Actualizar mocks de `Review` para incluir `verified`.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/client.ts web/src/api/types.ts web/src/components/ReviewForm.tsx web/src/pages/BranchDetailPage.tsx web/src/i18n web/src/tests
git commit -m "feat(web): check-in y reseñas verificadas por presencia + badge"
```

---

### Cierre Fase C

- [ ] Re-sembrar; suites api+web verdes; `git push origin main`.
- [ ] Verificación visual con Playwright (registro → login → detalle → check-in → gate de espera).

---

## Self-Review (cobertura del spec)

- Auth pública (register/login/logout) → A3, A4. ✓
- Reseñas atadas al usuario + verified → A1, A2. ✓
- Gate de login en reseñas → A5. ✓
- Favoritos servidor + merge → B1, B2, B3. ✓
- Presencia (Visit, check-in, radio/tiempo, gate, badge) → C1–C4. ✓
- Migraciones a mano + deploy → A1, B1, C1. ✓
- Constantes por env → C1. ✓
- Tests backend (401/409/403 reasons, favoritos, merge, presencia) → A2, B2, C2, C3. ✓
- i18n es/en/pt → A4, A5, C4. ✓
