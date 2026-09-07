# Menú lateral (drawer) + perfil con avatar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menú hamburguesa que abre un panel lateral izquierdo con perfil de usuario (avatar subible, editar nombre, cambiar contraseña), idioma y cerrar sesión; header despejado.

**Architecture:** Backend agrega `User.avatarUrl` + un router `/me` (PATCH nombre, POST password, POST/DELETE avatar) reutilizando la infra de subida (multer→minio) y argon2. Frontend agrega `Drawer` + `Avatar`, reestructura el header (hamburguesa izq + avatar der, sin idioma/cerrar-sesión) y mete el perfil en el drawer vía un `profileClient`.

**Tech Stack:** Express + Prisma + Postgres + minio + argon2 (api); React 19 + Vite + i18next + Tailwind (web). Tests: vitest + supertest (api), vitest + testing-library (web).

**Spec:** `docs/superpowers/specs/2026-09-06-menu-lateral-perfil-design.md`

## Global Constraints

- Migración a mano + `prisma migrate deploy` (NUNCA `migrate dev`). Timestamp posterior a `20260906030000`.
- Comandos dentro de contenedores: `docker compose exec -T api|web ...`. Tras correr tests de api, el controller re-siembra (`npm run seed:all`) — no re-sembrar por tarea.
- Typecheck por tarea: api `npx tsc --noEmit`, web `npx tsc -b --noEmit`.
- Commits sin línea co-author (convención del repo). Conventional Commits. Autor `ribarahonaa`.
- i18n: toda copy nueva en `web/src/i18n/{es,en,pt}.json` (en/pt traducidos, no copiar español).
- Reusar patrones: subida `api/src/admin/uploads.routes.ts` + `api/src/storage/minio.ts` (`uploadBuffer(buffer, mimetype, key) → url`); hash `api/src/auth/password.ts` (`hashPassword`/`verifyPassword`); modal `web/src/components/ItemSheet.tsx`; `SafeImg`.

---

## Task 1: Migración `User.avatarUrl` + exponerlo en `/auth/me`

**Files:**
- Create: `api/prisma/migrations/20260906040000_user_avatar/migration.sql`
- Modify: `api/prisma/schema.prisma` (model User)
- Modify: `api/src/auth/auth.routes.ts` (select de `/me`)
- Test: `api/src/tests/auth.test.ts` (agregar aserción avatarUrl)

**Interfaces:**
- Produces: columna `User.avatarUrl` (nullable); `GET /auth/me` devuelve `avatarUrl: string | null`.

- [ ] **Step 1: Migración SQL**
```sql
-- api/prisma/migrations/20260906040000_user_avatar/migration.sql
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
```

- [ ] **Step 2: Schema**
En `model User`, después de `preferredLang`:
```prisma
  avatarUrl     String?
```

- [ ] **Step 3: Exponer en `/auth/me`**
En `api/src/auth/auth.routes.ts`, en el handler `GET /me`, agregar `avatarUrl: true` al `select`:
```ts
      select: { id: true, email: true, name: true, role: true, preferredLang: true, avatarUrl: true },
```

- [ ] **Step 4: Aserción en test existente**
En `api/src/tests/auth.test.ts`, en el test que valida el body de `/auth/me` (buscar el que hace `get("/auth/me")`), agregar:
```ts
    expect(res.body).toHaveProperty("avatarUrl", null);
```
(Si el test compara el objeto completo con `toEqual`, agregar `avatarUrl: null` al objeto esperado.)

- [ ] **Step 5: Aplicar + generar + typecheck**
```bash
docker compose exec -T api npx prisma migrate deploy
docker compose exec -T api npx prisma generate
docker compose exec -T api npx tsc --noEmit
docker compose exec -T api npx vitest run src/tests/auth.test.ts
```
Expected: migración aplicada, tsc exit 0, auth.test verde.

- [ ] **Step 6: Commit**
```bash
git add api/prisma/schema.prisma api/prisma/migrations/20260906040000_user_avatar api/src/auth/auth.routes.ts api/src/tests/auth.test.ts
git commit -m "feat(api): User.avatarUrl expuesto en /auth/me (migración)"
```

---

## Task 2: Router `/me` — editar nombre y cambiar contraseña

**Files:**
- Create: `api/src/me/profile.routes.ts`
- Modify: `api/src/app.ts` (montar `/me` con authenticate, DESPUÉS de `/me/favorites`)
- Test: `api/src/tests/profile.test.ts`

**Interfaces:**
- Consumes: `authenticate` (`req.user.sub`), `hashPassword`/`verifyPassword` (`../auth/password.js`), `HttpError`.
- Produces: `PATCH /me {name}` → `Me`; `POST /me/password {currentPassword,newPassword}` → 204.

- [ ] **Step 1: Test**
```ts
// api/src/tests/profile.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
beforeEach(async () => { await resetDb(); await seedDiscoveryFixture(); });
afterAll(async () => prisma.$disconnect());

async function tokenFor(email = "pf@pf.cl", name = "Peri") {
  const res = await request(app).post("/auth/register").send({ email, password: "secret123", name });
  return res.body.accessToken as string;
}

describe("PATCH /me", () => {
  it("sin token 401", async () => {
    expect((await request(app).patch("/me").send({ name: "X" })).status).toBe(401);
  });
  it("cambia el nombre y me lo refleja", async () => {
    const t = await tokenFor();
    const res = await request(app).patch("/me").set("authorization", `Bearer ${t}`).send({ name: "Nuevo Nombre" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nuevo Nombre");
    const me = await request(app).get("/auth/me").set("authorization", `Bearer ${t}`);
    expect(me.body.name).toBe("Nuevo Nombre");
  });
  it("400 con nombre vacío", async () => {
    const t = await tokenFor();
    expect((await request(app).patch("/me").set("authorization", `Bearer ${t}`).send({ name: "  " })).status).toBe(400);
  });
});

describe("POST /me/password", () => {
  it("400 con contraseña actual incorrecta", async () => {
    const t = await tokenFor("pw@pw.cl");
    const res = await request(app).post("/me/password").set("authorization", `Bearer ${t}`).send({ currentPassword: "mala1234", newPassword: "nuevo1234" });
    expect(res.status).toBe(400);
  });
  it("204 y permite login con la nueva contraseña", async () => {
    const t = await tokenFor("pw2@pw.cl");
    const ch = await request(app).post("/me/password").set("authorization", `Bearer ${t}`).send({ currentPassword: "secret123", newPassword: "nuevo1234" });
    expect(ch.status).toBe(204);
    const login = await request(app).post("/auth/login").send({ email: "pw2@pw.cl", password: "nuevo1234" });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
  });
});
```
> Nota: verificar el path real de login (`/auth/login`) y que register devuelve `accessToken` (ya usado en otros tests). Ajustar si difiere.

- [ ] **Step 2: Verlo fallar**
```bash
docker compose exec -T api npx vitest run src/tests/profile.test.ts
```
Expected: FAIL (404, router no montado).

- [ ] **Step 3: Router**
```ts
// api/src/me/profile.routes.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

export const profileRouter = Router();

const ME_SELECT = { id: true, email: true, name: true, role: true, preferredLang: true, avatarUrl: true } as const;

profileRouter.patch("/", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user!.sub }, data: { name }, select: ME_SELECT });
    res.json(user);
  } catch (e) { next(e); }
});

profileRouter.post("/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw new HttpError(401, "invalid_token");
    if (!(await verifyPassword(user.passwordHash, currentPassword))) throw new HttpError(400, "invalid_password");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    res.status(204).end();
  } catch (e) { next(e); }
});
```

- [ ] **Step 4: Montar en app.ts**
En `api/src/app.ts`, importar `profileRouter` y `authenticate` (si no está). Montar el perfil **después** del router de favoritos:
```ts
import { profileRouter } from "./me/profile.routes.js";
// ... (app.use("/me/favorites", authenticate, favoritesRouter) ya existe) ...
app.use("/me", authenticate, profileRouter);
```
Confirmar que `/me/favorites` se registra ANTES que `/me` para que no quede sombreado.

- [ ] **Step 5: Test + typecheck**
```bash
docker compose exec -T api npx vitest run src/tests/profile.test.ts
docker compose exec -T api npx tsc --noEmit
```
Expected: PASS + exit 0.

- [ ] **Step 6: Commit**
```bash
git add api/src/me/profile.routes.ts api/src/app.ts api/src/tests/profile.test.ts
git commit -m "feat(api): PATCH /me (nombre) y POST /me/password"
```

---

## Task 3: Avatar `POST /me/avatar` + `DELETE /me/avatar`

**Files:**
- Modify: `api/src/me/profile.routes.ts`
- Test: `api/src/tests/profile.test.ts` (agregar describe avatar)

**Interfaces:**
- Consumes: patrón `uploadSingle` de `api/src/admin/uploads.routes.ts`, `uploadBuffer` de `../storage/minio.js`.
- Produces: `POST /me/avatar` (multipart `file`) → `{avatarUrl}` 201; `DELETE /me/avatar` → 204.

- [ ] **Step 1: Test (agregar al final de profile.test.ts)**
Revisar primero `api/src/tests/uploads.test.ts` para el patrón exacto de `.attach(...)`. Agregar:
```ts
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082", "hex");

describe("avatar", () => {
  it("sube el avatar y me lo refleja; DELETE lo limpia", async () => {
    const t = await tokenFor("av@av.cl");
    const up = await request(app).post("/me/avatar").set("authorization", `Bearer ${t}`).attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(up.status).toBe(201);
    expect(typeof up.body.avatarUrl).toBe("string");
    const me = await request(app).get("/auth/me").set("authorization", `Bearer ${t}`);
    expect(me.body.avatarUrl).toBe(up.body.avatarUrl);
    const del = await request(app).delete("/me/avatar").set("authorization", `Bearer ${t}`);
    expect(del.status).toBe(204);
    const me2 = await request(app).get("/auth/me").set("authorization", `Bearer ${t}`);
    expect(me2.body.avatarUrl).toBeNull();
  });
  it("400 con tipo inválido", async () => {
    const t = await tokenFor("av2@av.cl");
    const up = await request(app).post("/me/avatar").set("authorization", `Bearer ${t}`).attach("file", Buffer.from("hola"), { filename: "a.txt", contentType: "text/plain" });
    expect(up.status).toBe(400);
  });
});
```

- [ ] **Step 2: Verlo fallar**
```bash
docker compose exec -T api npx vitest run src/tests/profile.test.ts
```
Expected: FAIL en el describe avatar (rutas no existen).

- [ ] **Step 3: Implementar en profile.routes.ts**
Agregar imports y rutas (replicar `uploadSingle` local — mismo patrón que uploads.routes.ts):
```ts
import multer, { MulterError } from "multer";
import { randomUUID } from "node:crypto";
import { uploadBuffer } from "../storage/minio.js";
import type { Request, Response, NextFunction } from "express";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err) => {
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return next(new HttpError(400, "file_too_large"));
      return next(new HttpError(400, "upload_error"));
    }
    next(err);
  });
}

profileRouter.post("/avatar", uploadSingle, async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new HttpError(400, "file_required");
    if (!ALLOWED.has(file.mimetype)) throw new HttpError(400, "invalid_type");
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `avatars/${req.user!.sub}-${randomUUID()}.${ext}`;
    const avatarUrl = await uploadBuffer(file.buffer, file.mimetype, key);
    await prisma.user.update({ where: { id: req.user!.sub }, data: { avatarUrl } });
    res.status(201).json({ avatarUrl });
  } catch (e) { next(e); }
});

profileRouter.delete("/avatar", async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.user!.sub }, data: { avatarUrl: null } });
    res.status(204).end();
  } catch (e) { next(e); }
});
```

- [ ] **Step 4: Test + typecheck**
```bash
docker compose exec -T api npx vitest run src/tests/profile.test.ts
docker compose exec -T api npx tsc --noEmit
```
Expected: PASS + exit 0.

- [ ] **Step 5: Commit**
```bash
git add api/src/me/profile.routes.ts api/src/tests/profile.test.ts
git commit -m "feat(api): subir/quitar avatar (POST/DELETE /me/avatar)"
```

---

## Task 4: `Me.avatarUrl` + `profileClient` + refresco en AuthContext

**Files:**
- Modify: `web/src/auth/authClient.ts` (interface `Me`)
- Create: `web/src/api/profileClient.ts`
- Modify: `web/src/auth/AuthContext.tsx` (exponer `refreshUser`/`setUser` uso)

**Interfaces:**
- Consumes: `authedFetch`, `me` de authClient.
- Produces: `Me` con `avatarUrl: string | null`; `profileClient`: `updateName(name): Promise<Me>`, `changePassword(current, next): Promise<void>`, `uploadAvatar(file): Promise<{avatarUrl:string}>`, `removeAvatar(): Promise<void>`; `useAuth().refreshUser(): Promise<void>` (o reuso de `setUser`).

- [ ] **Step 1: `Me` gana avatarUrl**
En `web/src/auth/authClient.ts`, en `interface Me`, agregar:
```ts
  avatarUrl: string | null;
```

- [ ] **Step 2: profileClient**
```ts
// web/src/api/profileClient.ts
import { authedFetch, type Me } from "../auth/authClient.js";

export async function updateName(name: string): Promise<Me> {
  const res = await authedFetch("/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Me>;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await authedFetch("/me/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
  if (!res.ok) throw new Error(res.status === 400 ? "invalid_password" : `HTTP ${res.status}`);
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authedFetch("/me/avatar", { method: "POST", body: fd });
  if (!res.ok) throw new Error(res.status === 400 ? "avatar_invalid" : `HTTP ${res.status}`);
  return res.json() as Promise<{ avatarUrl: string }>;
}

export async function removeAvatar(): Promise<void> {
  const res = await authedFetch("/me/avatar", { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
```
> Nota: `authedFetch` NO debe forzar `Content-Type` cuando el body es `FormData` (el browser pone el boundary). Verificar en authClient.ts que `authedFetch` no inyecta un `Content-Type: application/json` fijo; si lo hace, ajustarlo para respetar el header ausente cuando el body es FormData.

- [ ] **Step 3: `refreshUser` en AuthContext**
En `web/src/auth/AuthContext.tsx`, agregar a `AuthValue` y al provider un helper para refrescar el usuario tras cambios de perfil:
```ts
  refreshUser: () => Promise<void>;
```
```ts
  const refreshUser = async () => {
    try { setUser(await me()); } catch { /* ignora */ }
  };
```
Incluir `refreshUser` en el value. (Import `me` ya presente; si no, importarlo de authClient.)

- [ ] **Step 4: Typecheck**
```bash
docker compose exec -T web npx tsc -b --noEmit
```
Expected: exit 0.

- [ ] **Step 5: Commit**
```bash
git add web/src/auth/authClient.ts web/src/api/profileClient.ts web/src/auth/AuthContext.tsx
git commit -m "feat(web): Me.avatarUrl + profileClient + refreshUser"
```

---

## Task 5: Componentes `Avatar` y `Drawer`

**Files:**
- Create: `web/src/components/Avatar.tsx`
- Create: `web/src/components/Drawer.tsx`
- Test: `web/src/tests/Drawer.test.tsx`

**Interfaces:**
- Consumes: `SafeImg`.
- Produces: `<Avatar name={string} url={string|null} size={number} />`; `<Drawer open onClose>{children}</Drawer>` (panel izquierdo).

- [ ] **Step 1: Test del Drawer**
```tsx
// web/src/tests/Drawer.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Drawer } from "../components/Drawer.js";

describe("Drawer", () => {
  it("no renderiza contenido cuando cerrado", () => {
    render(<Drawer open={false} onClose={() => {}}><p>hola</p></Drawer>);
    expect(screen.queryByText("hola")).toBeNull();
  });
  it("muestra contenido y cierra con overlay + Escape", () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose}><p>hola</p></Drawer>);
    expect(screen.getByText("hola")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verlo fallar**
```bash
docker compose exec -T web npx vitest run src/tests/Drawer.test.tsx
```
Expected: FAIL (no existe Drawer).

- [ ] **Step 3: Avatar**
```tsx
// web/src/components/Avatar.tsx
import { SafeImg } from "./SafeImg.js";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 45%)`;
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const s = { width: size, height: size };
  if (url) {
    return (
      <span className="inline-block overflow-hidden rounded-full bg-bg" style={s}>
        <SafeImg src={url} alt={name} className="h-full w-full object-cover"
          fallback={<Fallback name={name} size={size} />} />
      </span>
    );
  }
  return <Fallback name={name} size={size} />;
}

function Fallback({ name, size }: { name: string; size: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}
```

- [ ] **Step 4: Drawer**
Seguir el patrón de `ItemSheet.tsx` (overlay + cierre Escape/overlay + bloqueo de scroll), pero panel a la izquierda.
```tsx
// web/src/components/Drawer.tsx
import { useEffect, type ReactNode } from "react";

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 animate-backdrop-in" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-surface shadow-2xl animate-drawer-in">
        {children}
      </div>
    </div>
  );
}
```
Si `animate-backdrop-in` no existe, reusar la clase de animación que use `ItemSheet`. Agregar (si falta) un keyframe `animate-drawer-in` en el CSS global (`web/src/index.css` o donde estén las animaciones) que traslade de `-100%` a `0` en X:
```css
@keyframes drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
.animate-drawer-in { animation: drawer-in .22s ease-out; }
```

- [ ] **Step 5: Test + typecheck**
```bash
docker compose exec -T web npx vitest run src/tests/Drawer.test.tsx
docker compose exec -T web npx tsc -b --noEmit
```
Expected: PASS + exit 0.

- [ ] **Step 6: Commit**
```bash
git add web/src/components/Avatar.tsx web/src/components/Drawer.tsx web/src/tests/Drawer.test.tsx
git commit -m "feat(web): componentes Avatar y Drawer"
```

---

## Task 6: Header con hamburguesa + avatar; shell del drawer

**Files:**
- Modify: `web/src/pages/HomePage.tsx` (header + estado del drawer)
- Create: `web/src/components/SideMenu.tsx` (contenido del drawer)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/SideMenu.test.tsx`

**Interfaces:**
- Consumes: `Drawer`, `Avatar`, `useAuth` (`status`, `user`, `signOut`), `AuthSheet`, `LanguageSwitcher`.
- Produces: `<SideMenu open onClose />` (drawer + contenido: perfil authed / CTA anon + idioma + cerrar sesión). Header con hamburguesa (izq) y avatar/Ingresar (der).

- [ ] **Step 1: i18n (bloque `menu` + `profile.title`)**
ES:
```json
"menu": { "open": "Abrir menú", "close": "Cerrar menú" },
"profile": { "title": "Tu perfil", "signInPrompt": "Inicia sesión para ver tu perfil" }
```
(en/pt traducidos; el resto de claves `profile.*` de acciones se agregan en la Task 7.)

- [ ] **Step 2: Test del SideMenu**
```tsx
// web/src/tests/SideMenu.test.tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../i18n/index.js";
import { SideMenu } from "../components/SideMenu.js";
import { AuthProvider } from "../auth/AuthContext.js";

beforeEach(async () => { await i18n.changeLanguage("es"); vi.restoreAllMocks(); });

it("anónimo: muestra CTA de ingresar", () => {
  render(<AuthProvider><SideMenu open onClose={() => {}} /></AuthProvider>);
  expect(screen.getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Verlo fallar**
```bash
docker compose exec -T web npx vitest run src/tests/SideMenu.test.tsx
```
Expected: FAIL (no existe SideMenu).

- [ ] **Step 4: SideMenu (shell)**
```tsx
// web/src/components/SideMenu.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext.js";
import { Drawer } from "./Drawer.js";
import { Avatar } from "./Avatar.js";
import { AuthSheet } from "./auth/AuthSheet.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";

export function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { status, user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="flex flex-col gap-4 p-4">
        {status === "authed" && user ? (
          <div className="flex items-center gap-3">
            <Avatar name={user.name} url={user.avatarUrl} size={56} />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-ink">{user.name}</p>
              <p className="truncate text-xs text-mute">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-bg p-4 text-center">
            <p className="mb-2 text-sm text-mute">{t("profile.signInPrompt")}</p>
            <button type="button" onClick={() => setAuthOpen(true)}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">{t("account.signIn")}</button>
          </div>
        )}

        {/* Sección de perfil (acciones) se agrega en Task 7 */}

        <div className="border-t border-line pt-3">
          <LanguageSwitcher />
        </div>

        {status === "authed" && (
          <button type="button" onClick={() => { signOut(); onClose(); }}
            className="rounded-xl bg-bg px-4 py-2 text-sm font-bold text-ink ring-1 ring-line">
            {t("account.signOut")}
          </button>
        )}
      </div>
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
    </Drawer>
  );
}
```

- [ ] **Step 5: Reestructurar el header de HomePage**
En `web/src/pages/HomePage.tsx`:
- Agregar estado `const [menuOpen, setMenuOpen] = useState(false);` e import de `SideMenu`, `Avatar`, `Menu` de `lucide-react`, y `useAuth`.
- Reemplazar el contenido del `<header>` por: botón hamburguesa (izq, `aria-label={t("menu.open")}`, abre menú) + bloque marca + a la derecha: si `status === "authed"` un botón con `<Avatar name={user.name} url={user.avatarUrl} size={32} />` que abre el menú; si no, botón `t("account.signIn")` que abre el menú (o AuthSheet).
- **Quitar del header** el `<LanguageSwitcher />` y cualquier `AccountButton`/cerrar-sesión previos (ahora viven en el SideMenu).
- Renderizar `<SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />` al final del árbol.

Ejemplo del header:
```tsx
<header className="z-20 shrink-0 bg-surface px-4 pt-3 pb-2 shadow-sm">
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2 min-w-0">
      <button type="button" aria-label={t("menu.open")} onClick={() => setMenuOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-full text-ink ring-1 ring-line active:scale-95">
        <Menu size={18} strokeWidth={2.5} />
      </button>
      <div className="min-w-0">
        <h1 className="font-display text-lg font-extrabold tracking-tight text-brand">{t("appName")}</h1>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-mute">
          <MapPin size={13} strokeWidth={2.5} className="text-brand" />{t("nearYou")}
        </p>
      </div>
    </div>
    <button type="button" onClick={() => setMenuOpen(true)} className="shrink-0" aria-label={t("menu.open")}>
      {status === "authed" && user
        ? <Avatar name={user.name} url={user.avatarUrl} size={32} />
        : <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white">{t("account.signIn")}</span>}
    </button>
  </div>
</header>
```
(Traer `status`/`user` desde `useAuth()`.)

- [ ] **Step 6: Test + typecheck + suite web**
```bash
docker compose exec -T web npx vitest run src/tests/SideMenu.test.tsx
docker compose exec -T web npx tsc -b --noEmit
docker compose exec -T web npx vitest run
```
Expected: PASS + exit 0; ajustar tests que referenciaban el header viejo (p.ej. si algún test buscaba `AccountButton`/LanguageSwitcher en el header de HomePage). No dejar tests rojos.

- [ ] **Step 7: Commit**
```bash
git add web/src/pages/HomePage.tsx web/src/components/SideMenu.tsx web/src/i18n web/src/tests/SideMenu.test.tsx
git commit -m "feat(web): header con hamburguesa + avatar y menú lateral"
```

---

## Task 7: Acciones de perfil en el drawer (nombre, contraseña, avatar)

**Files:**
- Create: `web/src/components/ProfileSection.tsx`
- Modify: `web/src/components/SideMenu.tsx` (montar ProfileSection cuando authed)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/ProfileSection.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`user`, `refreshUser`, `setUser`), `profileClient` (`updateName`, `changePassword`, `uploadAvatar`, `removeAvatar`), `Avatar`.
- Produces: `<ProfileSection />` con editar nombre, cambiar/quitar foto, cambiar contraseña.

- [ ] **Step 1: i18n (acciones `profile.*`)**
ES (agregar al bloque `profile`):
```json
"editName": "Editar nombre",
"save": "Guardar",
"email": "Correo",
"changePhoto": "Cambiar foto",
"removePhoto": "Quitar foto",
"changePassword": "Cambiar contraseña",
"currentPassword": "Contraseña actual",
"newPassword": "Nueva contraseña",
"passwordChanged": "Contraseña actualizada",
"wrongPassword": "La contraseña actual no es correcta",
"avatarError": "No se pudo actualizar la foto"
```
(en/pt traducidos.)

- [ ] **Step 2: Test**
```tsx
// web/src/tests/ProfileSection.test.tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "../i18n/index.js";
import { ProfileSection } from "../components/ProfileSection.js";
import * as profileClient from "../api/profileClient.js";

const user = { id: "u1", email: "a@a.cl", name: "Ana", role: "usuario", preferredLang: "es", avatarUrl: null };
vi.mock("../auth/AuthContext.js", () => ({
  useAuth: () => ({ user, status: "authed", refreshUser: vi.fn(), setUser: vi.fn() }),
}));

beforeEach(async () => { await i18n.changeLanguage("es"); vi.restoreAllMocks(); });

it("editar nombre invoca updateName", async () => {
  const spy = vi.spyOn(profileClient, "updateName").mockResolvedValue({ ...user, name: "Ana2" });
  render(<ProfileSection />);
  fireEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
  fireEvent.change(screen.getByDisplayValue("Ana"), { target: { value: "Ana2" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(spy).toHaveBeenCalledWith("Ana2"));
});
```
> Nota: ajustar el mock de `useAuth` a la forma real que consuma `ProfileSection` (si usa `setUser` vs `refreshUser`). Mantener el mock coherente con la implementación.

- [ ] **Step 3: Verlo fallar**
```bash
docker compose exec -T web npx vitest run src/tests/ProfileSection.test.tsx
```
Expected: FAIL (no existe ProfileSection).

- [ ] **Step 4: Implementar ProfileSection**
Componente con tres bloques. Estado local para modo edición del nombre, campos de contraseña, y carga. Usa `useAuth().user` y refresca vía `refreshUser()` (o `setUser` con la respuesta de `updateName`/`uploadAvatar`).
- **Avatar + foto:** muestra `<Avatar name url size={64} />`; `<input type="file" accept="image/*">` oculto disparado por botón `profile.changePhoto` → `uploadAvatar(file)` → `refreshUser()`; botón `profile.removePhoto` (si `user.avatarUrl`) → `removeAvatar()` → `refreshUser()`; en error set `profile.avatarError`.
- **Editar nombre:** botón `profile.editName` revela input (valor inicial `user.name`) + botón `profile.save` → `updateName(v)` → `refreshUser()` (o `setUser`).
- **Cambiar contraseña:** botón `profile.changePassword` revela form (currentPassword, newPassword) → `changePassword(...)`; éxito → mensaje `profile.passwordChanged` + limpia; error `invalid_password` → `profile.wrongPassword`.
Manejar carga/errores sin romper el render (try/catch, mensajes locales). Placeholders/labels con las claves i18n de la Step 1.

- [ ] **Step 5: Montar en SideMenu**
En `web/src/components/SideMenu.tsx`, donde dice `{/* Sección de perfil (acciones) se agrega en Task 7 */}`, cuando `status === "authed"` renderizar `<ProfileSection />` (quitar el bloque inline de nombre/correo si `ProfileSection` ya lo muestra, o dejar la cabecera simple y que `ProfileSection` tenga las acciones — evitar duplicar el nombre/correo).

- [ ] **Step 6: Test + typecheck + suite web**
```bash
docker compose exec -T web npx vitest run src/tests/ProfileSection.test.tsx
docker compose exec -T web npx tsc -b --noEmit
docker compose exec -T web npx vitest run
```
Expected: PASS + exit 0; suite completa verde.

- [ ] **Step 7: Commit**
```bash
git add web/src/components/ProfileSection.tsx web/src/components/SideMenu.tsx web/src/i18n web/src/tests/ProfileSection.test.tsx
git commit -m "feat(web): sección de perfil (editar nombre, contraseña, avatar)"
```

---

## Cierre

- [ ] Re-sembrar: `docker compose exec -T api npm run seed:all`
- [ ] Suites completas: `docker compose exec -T api npx vitest run` y `docker compose exec -T web npx vitest run`
- [ ] `git push origin main`
- [ ] (Opcional) Verificación visual con Playwright: abrir menú → login → editar nombre → subir avatar → ver avatar en header.

## Self-Review (cobertura del spec)

- Migración `User.avatarUrl` + `/auth/me` → Task 1. ✓
- PATCH nombre + POST password → Task 2. ✓
- POST/DELETE avatar (reusa uploadSingle/minio) → Task 3. ✓
- `Me.avatarUrl` + profileClient + refreshUser → Task 4. ✓
- Drawer izquierdo + Avatar (iniciales fallback) → Task 5. ✓
- Header hamburguesa + avatar; quita idioma/cerrar-sesión del header; shell drawer (anon CTA / authed) + idioma + cerrar sesión → Task 6. ✓
- Acciones de perfil (nombre, contraseña, cambiar/quitar foto) → Task 7. ✓
- i18n es/en/pt → Tasks 6, 7. ✓
- Montaje `/me` tras `/me/favorites` → Task 2. ✓
- Migración a mano + deploy → Task 1. ✓
