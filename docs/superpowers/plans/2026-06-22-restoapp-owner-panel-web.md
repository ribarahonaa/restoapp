# RestoApp Capa 2B — Frontend del panel del dueño (fundación + gestión de sucursal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el panel web del dueño para gestionar sus sucursales: un cliente API tipado sobre la API de capa 2A, componentes reutilizables (subida de imagen a MinIO y selector de mapa), un layout `/admin` con navegación, la lista "mis locales", y el editor de una sucursal (datos, imagen, ubicación, activar/desactivar, cierre temporal y horarios).

**Architecture:** React 19 + react-router-dom v6. Un módulo `ownerClient.ts` envuelve `authedFetch` (de capa 1) con funciones tipadas por endpoint y DTOs propios (el frontend define la forma que consume, sin depender del shape crudo de Prisma). Componentes `ImageUploader` (sube por `POST /admin/uploads` y devuelve la URL pública) y `MapPicker` (react-leaflet, clic fija lat/lng). Las rutas privadas viven bajo `/admin/*` envueltas en `RequireRole` + un `AdminLayout` con navegación. Las pantallas consumen `ownerClient` y `useAuth`.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind v4 (tokens bg/surface/line/ink/mute/brand/brand-dark/brand-soft/open), react-router-dom 6.28, react-leaflet 5 + leaflet 1.9, react-i18next 15, Vitest 2 + @testing-library/react 16 (jsdom, globals, jest-dom).

## Global Constraints

- Commits: autor **ribarahonaa <ribarahonaa@gmail.com>**, fijado **por commit**: `git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "..."`. **NO** `Co-Authored-By` ni referencia a Claude. (Config global del repo es otra cuenta.) Verificar `git log -1 --pretty='%ae'` = `ribarahonaa@gmail.com` tras cada commit.
- TypeScript ESM: imports relativos con extensión `.js` (incluso para `.tsx` → `./Foo.js`).
- Tests web corren en el HOST (no en docker): `cd web && npx vitest run <archivo>` y typecheck `cd web && npx tsc -b --noEmit`.
- Tokens Tailwind existentes: `bg` (#f6f6f7), `surface` (#fff), `line` (#ededf0), `ink` (#1b1b1f), `mute` (#6b6b74), `brand` (#ff4d2e), `brand-dark` (#e63916), `brand-soft` (#ffece7), `open` (#1aa251). Fuentes `font-display` (Sora), `font-sans` (Plus Jakarta).
- Patrón de input: `w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand`. Botón primario: `rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-40`. Card: `rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line`.
- En tests: importar `../i18n/index.js` antes de renderizar componentes con i18n; fijar idioma con `i18n.changeLanguage("es")`; usar `MemoryRouter` para componentes con router; mockear módulos con `vi.mock`.
- La API de capa 2A ya está en `main`. Endpoints del dueño bajo `/admin/...` detrás de `authenticate`. `authedFetch(path, init?)` (de `../auth/authClient.js`) antepone `API_URL`, agrega `Authorization`, reintenta una vez ante 401. Devuelve `Response` cruda (el caller hace `.json()`).
- Cuentas demo para prueba manual: dueño `owner@demo.cl` / `owner12345` (admin_general de los 6 locales `b-*`); superadmin `admin@restoapp.cl` / `admin12345`.

---

## File Structure

**Backend (api/):**
- `src/admin/plans.routes.ts` — crear: `GET /admin/plans` (lista de planes para el modal de upgrade en 2C; ya se necesita el endpoint).
- `src/admin/admin.routes.ts` — modificar: montar `plansRouter`.
- `src/tests/owner-plans.test.ts` — crear.

**Frontend (web/):**
- `src/api/ownerTypes.ts` — crear: DTOs del panel (OwnerBranchSummary, OwnerBranchDetail, PlanInfo, inputs).
- `src/api/ownerClient.ts` — crear: funciones tipadas sobre `authedFetch`.
- `src/components/admin/ImageUploader.tsx` — crear.
- `src/components/admin/MapPicker.tsx` — crear.
- `src/components/admin/AdminLayout.tsx` — crear.
- `src/pages/admin/OwnerBranchesPage.tsx` — crear.
- `src/pages/admin/BranchEditorPage.tsx` — crear.
- `src/components/admin/HoursEditor.tsx` — crear.
- `src/App.tsx` — modificar: rutas anidadas `/admin/*` con `AdminLayout`.
- `src/i18n/{es,en,pt}.json` — modificar: claves `admin.owner.*`.
- `src/tests/ownerClient.test.ts`, `ImageUploader.test.tsx`, `MapPicker.test.tsx`, `OwnerBranchesPage.test.tsx`, `BranchEditorPage.test.tsx`, `HoursEditor.test.tsx` — crear.

---

## Task 1: Backend — `GET /admin/plans`

**Files:**
- Create: `api/src/admin/plans.routes.ts`
- Modify: `api/src/admin/admin.routes.ts`
- Test: `api/src/tests/owner-plans.test.ts`

**Interfaces:**
- Produces: `GET /admin/plans` → `200` array de `{ id, name, maxPromos, maxMenuItems, maxBranches }`, ordenado por `maxBranches asc`. Disponible para cualquier rol admin (ya filtrado por el `authorize` del router admin).

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `api/src/tests/owner-plans.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedAdminFixture, tokenFor } from "./helpers.js";
import { prisma } from "../prisma.js";

let app: import("express").Express;
beforeEach(async () => {
  await resetDb();
  await seedAdminFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

describe("GET /admin/plans", () => {
  it("lista los planes disponibles", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app).get("/admin/plans").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.map((p: any) => p.name).sort();
    expect(names).toContain("Free");
    expect(names).toContain("Pro");
    expect(res.body[0]).toHaveProperty("maxBranches");
  });

  it("401 sin token", async () => {
    const res = await request(app).get("/admin/plans");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-plans.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Crear el router de planes**

Crear `api/src/admin/plans.routes.ts`:
```ts
import { Router } from "express";
import { prisma } from "../prisma.js";

export const plansRouter = Router();

plansRouter.get("/", async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { maxBranches: "asc" },
      select: { id: true, name: true, maxPromos: true, maxMenuItems: true, maxBranches: true },
    });
    res.json(plans);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Montar el router**

En `api/src/admin/admin.routes.ts`, agregar el import y montar (junto a los otros mounts):
```ts
import { plansRouter } from "./plans.routes.js";
// ...
adminRouter.use("/plans", plansRouter);
```

- [ ] **Step 5: Run test, debe pasar**

Run: `docker compose exec -T api npx vitest run src/tests/owner-plans.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/admin/plans.routes.ts api/src/admin/admin.routes.ts api/src/tests/owner-plans.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(api): GET /admin/plans para el panel del dueño"
```

---

## Task 2: Cliente API del panel (`ownerClient`)

**Files:**
- Create: `web/src/api/ownerTypes.ts`
- Create: `web/src/api/ownerClient.ts`
- Test: `web/src/tests/ownerClient.test.ts`

**Interfaces:**
- Consumes: `authedFetch` de `../auth/authClient.js`.
- Produces (en `ownerClient.ts`):
  - `listBranches(): Promise<OwnerBranchSummary[]>` — GET `/admin/branches`.
  - `getOwnerBranch(id): Promise<OwnerBranchDetail>` — GET `/admin/branches/:id`.
  - `updateBranch(id, data: BranchUpdate): Promise<unknown>` — PATCH `/admin/branches/:id`.
  - `setBranchActive(id, active: boolean): Promise<unknown>` — POST `/admin/branches/:id/active`.
  - `closeBranch(id, untilISO: string): Promise<unknown>` — POST `/admin/branches/:id/close`.
  - `reopenBranch(id): Promise<unknown>` — POST `/admin/branches/:id/reopen`.
  - `replaceHours(id, hours: HourInput[]): Promise<HourInput[]>` — PUT `/admin/branches/:id/hours`.
  - `uploadImage(file: File): Promise<string>` — POST `/admin/uploads` (multipart) → devuelve `url`.
  - `listPlans(): Promise<PlanInfo[]>` — GET `/admin/plans`.
  - tipos en `ownerTypes.ts`.

- [ ] **Step 1: Definir los DTOs**

Crear `web/src/api/ownerTypes.ts`:
```ts
import type { Category } from "./types.js";

// Re-exportar Category para que las pantallas del panel lo importen desde un solo módulo.
export type { Category };

export interface PlanInfo {
  id: string;
  name: string;
  maxPromos: number;
  maxMenuItems: number;
  maxBranches: number;
}

export interface OwnerBranchSummary {
  id: string;
  name: string;
  category: Category;
  address: string;
  active: boolean;
  closedUntil: string | null;
  imageUrl: string | null;
  businessId: string;
  businessName: string;
  plan: { maxPromos: number; maxMenuItems: number; maxBranches: number } | null;
  counts: { menuItems: number; promotions: number };
}

export interface OwnerHour {
  id: string;
  weekday: number;
  openTime: string;
  closeTime: string;
}
export interface OwnerMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  imageUrl: string | null;
}
export interface OwnerPromotion {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
}
export interface OwnerDiscountCode {
  id: string;
  code: string;
  type: "percent" | "amount";
  value: string;
  startsAt: string;
  endsAt: string;
  branchId: string | null;
  active: boolean;
}

export interface OwnerBranchDetail {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  imageUrl: string | null;
  closedUntil: string | null;
  active: boolean;
  businessId: string;
  business: { id: string; name: string; plan: PlanInfo | null };
  hours: OwnerHour[];
  menuItems: OwnerMenuItem[];
  promotions: OwnerPromotion[];
  discountCodes: OwnerDiscountCode[];
}

export interface BranchUpdate {
  name?: string;
  category?: Category;
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface HourInput {
  weekday: number;
  openTime: string;
  closeTime: string;
}
```

- [ ] **Step 2: Escribir el test (falla primero)**

Crear `web/src/tests/ownerClient.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";
import * as owner from "../api/ownerClient.js";

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ownerClient", () => {
  it("listBranches hace GET a /admin/branches y devuelve el array", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse([{ id: "b1", name: "Local" }]));
    const out = await owner.listBranches();
    expect(spy).toHaveBeenCalledWith("/admin/branches");
    expect(out[0].id).toBe("b1");
  });

  it("updateBranch hace PATCH con JSON body", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse({ ok: true }));
    await owner.updateBranch("b1", { name: "Nuevo" });
    expect(spy).toHaveBeenCalledWith(
      "/admin/branches/b1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nuevo" }),
      })
    );
  });

  it("uploadImage hace POST multipart y devuelve la url", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse({ url: "http://x/restoapp/a.jpg" }));
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const url = await owner.uploadImage(file);
    expect(url).toBe("http://x/restoapp/a.jpg");
    const [path, init] = spy.mock.calls[0];
    expect(path).toBe("/admin/uploads");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("lanza error si la respuesta no es ok", async () => {
    vi.spyOn(auth, "authedFetch").mockResolvedValue(jsonResponse({ error: "forbidden" }, 403));
    await expect(owner.listBranches()).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/ownerClient.test.ts`
Expected: FAIL (no existe `ownerClient.js`).

- [ ] **Step 4: Implementar el cliente**

Crear `web/src/api/ownerClient.ts`:
```ts
import { authedFetch } from "../auth/authClient.js";
import type {
  OwnerBranchSummary,
  OwnerBranchDetail,
  BranchUpdate,
  HourInput,
  PlanInfo,
} from "./ownerTypes.js";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return res.json() as Promise<T>;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function listBranches(): Promise<OwnerBranchSummary[]> {
  return jsonOrThrow(await authedFetch("/admin/branches"));
}

export async function getOwnerBranch(id: string): Promise<OwnerBranchDetail> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}`));
}

export async function updateBranch(id: string, data: BranchUpdate): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}`, jsonInit("PATCH", data)));
}

export async function setBranchActive(id: string, active: boolean): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/active`, jsonInit("POST", { active })));
}

export async function closeBranch(id: string, untilISO: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/close`, jsonInit("POST", { until: untilISO })));
}

export async function reopenBranch(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/reopen`, { method: "POST" }));
}

export async function replaceHours(id: string, hours: HourInput[]): Promise<HourInput[]> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/hours`, jsonInit("PUT", { hours })));
}

export async function listPlans(): Promise<PlanInfo[]> {
  return jsonOrThrow(await authedFetch("/admin/plans"));
}

// Sube un archivo al endpoint multipart de la API y devuelve la URL pública de MinIO.
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await authedFetch("/admin/uploads", { method: "POST", body: form });
  const { url } = await jsonOrThrow<{ url: string }>(res);
  return url;
}
```

- [ ] **Step 5: Run test, debe pasar**

Run: `cd web && npx vitest run src/tests/ownerClient.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/api/ownerTypes.ts web/src/api/ownerClient.ts web/src/tests/ownerClient.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): cliente API tipado del panel del dueño"
```

---

## Task 3: Componentes `ImageUploader` y `MapPicker`

**Files:**
- Create: `web/src/components/admin/ImageUploader.tsx`
- Create: `web/src/components/admin/MapPicker.tsx`
- Test: `web/src/tests/ImageUploader.test.tsx`, `web/src/tests/MapPicker.test.tsx`

**Interfaces:**
- Produces:
  - `<ImageUploader value={string|null} onChange={(url:string)=>void} label={string} />` — botón para elegir archivo → sube por `uploadImage` → muestra preview y llama `onChange(url)`. Muestra estado "subiendo".
  - `<MapPicker lat={number} lng={number} onChange={(lat:number,lng:number)=>void} />` — mapa Leaflet; clic mueve el marcador y llama `onChange`.

- [ ] **Step 1: Escribir los tests (fallan primero)**

Crear `web/src/tests/ImageUploader.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { ImageUploader } from "../components/admin/ImageUploader.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

describe("ImageUploader", () => {
  it("sube el archivo elegido y llama onChange con la url", async () => {
    vi.spyOn(owner, "uploadImage").mockResolvedValue("http://x/restoapp/foto.jpg");
    const onChange = vi.fn();
    render(<ImageUploader value={null} onChange={onChange} label="Imagen" />);
    const input = screen.getByLabelText(/imagen/i) as HTMLInputElement;
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("http://x/restoapp/foto.jpg"));
  });

  it("muestra preview cuando hay value", () => {
    render(<ImageUploader value="http://x/restoapp/y.jpg" onChange={() => {}} label="Imagen" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "http://x/restoapp/y.jpg");
  });
});
```

Crear `web/src/tests/MapPicker.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock react-leaflet para no depender del DOM de Leaflet en jsdom.
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ position }: any) => <div data-testid="marker">{position.join(",")}</div>,
  useMapEvents: (handlers: any) => {
    // expone el handler de click para invocarlo desde el test
    (globalThis as any).__mapClick = handlers.click;
    return null;
  },
}));

beforeEach(() => vi.restoreAllMocks());

describe("MapPicker", () => {
  it("renderiza el marcador en la posición dada y reacciona al click", async () => {
    const { MapPicker } = await import("../components/admin/MapPicker.js");
    const onChange = vi.fn();
    render(<MapPicker lat={-33.45} lng={-70.66} onChange={onChange} />);
    expect(screen.getByTestId("marker")).toHaveTextContent("-33.45,-70.66");
    // simular un click en el mapa
    (globalThis as any).__mapClick({ latlng: { lat: -33.4, lng: -70.6 } });
    expect(onChange).toHaveBeenCalledWith(-33.4, -70.6);
  });
});
```

- [ ] **Step 2: Run tests, deben fallar**

Run: `cd web && npx vitest run src/tests/ImageUploader.test.tsx src/tests/MapPicker.test.tsx`
Expected: FAIL (componentes no existen).

- [ ] **Step 3: Implementar `ImageUploader`**

Crear `web/src/components/admin/ImageUploader.tsx`:
```tsx
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";
import { uploadImage } from "../../api/ownerClient.js";

export function ImageUploader({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (url: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-semibold text-mute">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg ring-1 ring-line">
          {value && <img src={value} alt={label} className="h-full w-full object-cover" />}
        </div>
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-bg px-3 py-2 text-sm font-semibold text-ink ring-1 ring-line transition hover:ring-ink/30"
        >
          <ImagePlus size={16} strokeWidth={2.25} />
          {busy ? t("admin.owner.uploading") : t("admin.owner.chooseImage")}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={label}
          className="sr-only"
          onChange={handleFile}
          disabled={busy}
        />
      </div>
      {error && <p className="mt-1 text-xs text-brand-dark">{t("admin.owner.uploadError")}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Implementar `MapPicker`**

Crear `web/src/components/admin/MapPicker.tsx`:
```tsx
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <div className="h-56 w-full overflow-hidden rounded-xl ring-1 ring-line">
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[lat, lng]} />
        <ClickHandler onChange={onChange} />
      </MapContainer>
    </div>
  );
}
```
Nota: el `Marker` por defecto de Leaflet necesita su icono; el proyecto ya usa `L.divIcon` en `MapView`. Si el marcador default no aparece (icono roto en Leaflet con bundlers), pasar un `icon` con `L.divIcon` igual que en `MapView.tsx` (HTML de un punto). El test mockea `react-leaflet`, así que esto no afecta al test; verificarlo en la prueba manual.

- [ ] **Step 5: Run tests, deben pasar**

Run: `cd web && npx vitest run src/tests/ImageUploader.test.tsx src/tests/MapPicker.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Agregar claves i18n usadas (parciales)**

En `web/src/i18n/es.json`, dentro de `admin`, agregar (se completa en Task 4; aquí lo mínimo que usan los componentes):
```json
    "owner": {
      "chooseImage": "Elegir imagen",
      "uploading": "Subiendo…",
      "uploadError": "No se pudo subir la imagen"
    }
```
Replicar las MISMAS claves en `en.json` ("Choose image"/"Uploading…"/"Could not upload the image") y `pt.json` ("Escolher imagem"/"Enviando…"/"Não foi possível enviar a imagem"). Mantener JSON válido (comas correctas; `owner` queda como objeto hermano de `login`/`home` dentro de `admin`).

- [ ] **Step 7: Typecheck y commit**

Run: `cd web && npx tsc -b --noEmit` → sin errores.
```bash
git add web/src/components/admin/ImageUploader.tsx web/src/components/admin/MapPicker.tsx web/src/tests/ImageUploader.test.tsx web/src/tests/MapPicker.test.tsx web/src/i18n
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): componentes ImageUploader (MinIO) y MapPicker (Leaflet)"
```

---

## Task 4: Layout `/admin` y lista "mis locales"

**Files:**
- Create: `web/src/components/admin/AdminLayout.tsx`
- Create: `web/src/pages/admin/OwnerBranchesPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/OwnerBranchesPage.test.tsx`

**Interfaces:**
- Consumes: `ownerClient.listBranches`, `useAuth`.
- Produces: `<AdminLayout>` (header con nombre/rol + logout + link a "Mis locales", renderiza `<Outlet/>` o children); `OwnerBranchesPage` (lista de tarjetas con estado y link a `/admin/branches/:id`). Rutas `/admin`, `/admin/branches`, `/admin/branches/:id` anidadas bajo `RequireRole` + `AdminLayout`.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/OwnerBranchesPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { OwnerBranchesPage } from "../pages/admin/OwnerBranchesPage.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

const sample = [
  { id: "b1", name: "Café Central", category: "cafe", address: "Plaza 1", active: true, closedUntil: null, imageUrl: null, businessId: "biz", businessName: "Grupo", plan: { maxPromos: 100, maxMenuItems: 500, maxBranches: 5 }, counts: { menuItems: 3, promotions: 2 } },
  { id: "b2", name: "Bar Norte", category: "bar", address: "Norte 2", active: false, closedUntil: null, imageUrl: null, businessId: "biz", businessName: "Grupo", plan: null, counts: { menuItems: 0, promotions: 0 } },
];

describe("OwnerBranchesPage", () => {
  it("lista las sucursales del dueño", async () => {
    vi.spyOn(owner, "listBranches").mockResolvedValue(sample as never);
    render(
      <MemoryRouter>
        <OwnerBranchesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("Café Central")).toBeInTheDocument();
    expect(screen.getByText("Bar Norte")).toBeInTheDocument();
    // cada tarjeta enlaza al editor
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/admin/branches/b1")).toBe(true);
  });

  it("muestra estado inactivo", async () => {
    vi.spyOn(owner, "listBranches").mockResolvedValue(sample as never);
    render(
      <MemoryRouter>
        <OwnerBranchesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Bar Norte")).toBeInTheDocument());
    expect(screen.getByText(/inactiv/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/OwnerBranchesPage.test.tsx`
Expected: FAIL (no existe la página).

- [ ] **Step 3: Implementar `AdminLayout`**

Crear `web/src/components/admin/AdminLayout.tsx`:
```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store, LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.js";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-surface px-4 py-3 shadow-sm">
        <Link to="/admin/branches" className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-brand">
          <Store size={20} strokeWidth={2.5} />
          {t("admin.owner.title")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-mute sm:inline">
            {user?.name} · {user?.role}
          </span>
          <button
            onClick={signOut}
            aria-label={t("admin.home.logout")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-sm font-bold text-white transition active:scale-95"
          >
            <LogOut size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">{t("admin.home.logout")}</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `OwnerBranchesPage`**

Crear `web/src/pages/admin/OwnerBranchesPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, MapPin } from "lucide-react";
import { listBranches } from "../../api/ownerClient.js";
import type { OwnerBranchSummary } from "../../api/ownerTypes.js";

export function OwnerBranchesPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<OwnerBranchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-4 font-display text-xl font-extrabold text-ink">{t("admin.owner.myBranches")}</h1>
      {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{t("errors.loadFailed")}</p>}
      {loading ? (
        <p className="text-mute">…</p>
      ) : (
        <ul className="space-y-2">
          {branches.map((b) => (
            <li key={b.id}>
              <Link
                to={`/admin/branches/${b.id}`}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line transition hover:ring-ink/20"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bg">
                  {b.imageUrl && <img src={b.imageUrl} alt={b.name} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">{b.name}</span>
                    {!b.active && (
                      <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold text-mute">
                        {t("admin.owner.inactive")}
                      </span>
                    )}
                    {b.closedUntil && new Date(b.closedUntil) > new Date() && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
                        {t("admin.owner.closedNow")}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1 truncate text-xs text-mute">
                    <MapPin size={12} strokeWidth={2.25} />
                    {b.address}
                  </p>
                  <p className="mt-0.5 text-xs text-mute">
                    {t("admin.owner.menuCount", { count: b.counts.menuItems })} ·{" "}
                    {t("admin.owner.promoCount", { count: b.counts.promotions })}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-mute" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Cablear rutas anidadas en `App.tsx`**

Reemplazar el contenido de `web/src/App.tsx` por:
```tsx
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { BranchDetailPage } from "./pages/BranchDetailPage.js";
import { LoginPage } from "./pages/admin/LoginPage.js";
import { AdminHome } from "./pages/admin/AdminHome.js";
import { OwnerBranchesPage } from "./pages/admin/OwnerBranchesPage.js";
import { BranchEditorPage } from "./pages/admin/BranchEditorPage.js";
import { AdminLayout } from "./components/admin/AdminLayout.js";
import { RequireRole } from "./components/RequireRole.js";

const ADMIN_ROLES = ["superadmin", "admin_general", "admin_sucursal"] as const;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/branch/:id" element={<BranchDetailPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin/*"
        element={
          <RequireRole roles={[...ADMIN_ROLES]}>
            <AdminLayout>
              <Routes>
                <Route path="" element={<AdminHome />} />
                <Route path="branches" element={<OwnerBranchesPage />} />
                <Route path="branches/:id" element={<BranchEditorPage />} />
              </Routes>
            </AdminLayout>
          </RequireRole>
        }
      />
    </Routes>
  );
}
```
Nota: `BranchEditorPage` se crea en Task 5; este `App.tsx` ya lo importa, así que **el orden de ejecución es: completar Task 5 antes de que `tsc`/build de Task 4 pase**. Para mantener Task 4 verde de forma independiente, crear primero un stub mínimo de `BranchEditorPage` en Task 4 (Step 6) y reemplazarlo en Task 5. (Ver Step 6.)
Además, `AdminHome` (capa 1) ahora se renderiza DENTRO de `AdminLayout`; conserva su contenido pero su botón de logout duplica el del layout — en Task 4 simplificar `AdminHome` para que sea una bienvenida breve sin logout (opcional, no romper su test: si `AdminHome.test`/`RequireRole.test` referencia su texto, mantener `admin.home.title`).

- [ ] **Step 6: Stub de `BranchEditorPage` + claves i18n**

Crear un stub `web/src/pages/admin/BranchEditorPage.tsx` (se reemplaza en Task 5):
```tsx
export function BranchEditorPage() {
  return null;
}
```
En `web/src/i18n/es.json`, completar el objeto `admin.owner` (fusionar con las 3 claves de Task 3) para que quede:
```json
    "owner": {
      "title": "Panel",
      "myBranches": "Mis locales",
      "inactive": "Inactivo",
      "closedNow": "Cerrado",
      "menuCount_one": "{{count}} ítem",
      "menuCount_other": "{{count}} ítems",
      "promoCount_one": "{{count}} promo",
      "promoCount_other": "{{count}} promos",
      "chooseImage": "Elegir imagen",
      "uploading": "Subiendo…",
      "uploadError": "No se pudo subir la imagen"
    }
```
Replicar la estructura completa en `en.json` y `pt.json` (traducciones equivalentes; mantener las claves de plural `_one`/`_other`). Verificar JSON válido.

- [ ] **Step 7: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/OwnerBranchesPage.test.tsx` → PASS (2 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/admin/AdminLayout.tsx web/src/pages/admin/OwnerBranchesPage.tsx web/src/pages/admin/BranchEditorPage.tsx web/src/App.tsx web/src/i18n web/src/tests/OwnerBranchesPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): layout admin y lista de mis locales"
```

---

## Task 5: Editor de la sucursal (datos, imagen, ubicación, estado)

**Files:**
- Modify: `web/src/pages/admin/BranchEditorPage.tsx` (reemplaza el stub)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/BranchEditorPage.test.tsx`

**Interfaces:**
- Consumes: `ownerClient.getOwnerBranch/updateBranch/setBranchActive/closeBranch/reopenBranch`, `ImageUploader`, `MapPicker`, `useAuth`, `useParams`.
- Produces: pantalla de edición con formulario de datos + `ImageUploader` + `MapPicker` + acciones de estado. `setBranchActive` solo visible si `user.role !== "admin_sucursal"`. Cierre temporal con `<input type="datetime-local">`. El editor de horarios (Task 6) se inserta como sección.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/BranchEditorPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { BranchEditorPage } from "../pages/admin/BranchEditorPage.js";
import * as owner from "../api/ownerClient.js";
import * as authCtx from "../auth/AuthContext.js";

const detail = {
  id: "b1", name: "Café Central", category: "cafe", address: "Plaza 1", lat: -33.43, lng: -70.65,
  phone: null, description: "Rico café", imageUrl: null, closedUntil: null, active: true,
  businessId: "biz", business: { id: "biz", name: "Grupo", plan: null },
  hours: [], menuItems: [], promotions: [], discountCodes: [],
};

function setup(role = "admin_general") {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    user: { id: "u1", email: "o@d.cl", name: "Dueño", role, preferredLang: "es" },
    status: "authed", signIn: vi.fn(), signOut: vi.fn(),
  } as never);
  return render(
    <MemoryRouter initialEntries={["/admin/branches/b1"]}>
      <Routes>
        <Route path="/admin/branches/:id" element={<BranchEditorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(owner, "getOwnerBranch").mockResolvedValue(detail as never);
  vi.spyOn(owner, "replaceHours").mockResolvedValue([] as never);
});

describe("BranchEditorPage", () => {
  it("carga los datos y guarda los cambios", async () => {
    const update = vi.spyOn(owner, "updateBranch").mockResolvedValue({} as never);
    setup();
    const nameInput = (await screen.findByLabelText(/nombre/i)) as HTMLInputElement;
    expect(nameInput.value).toBe("Café Central");
    fireEvent.change(nameInput, { target: { value: "Café Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("b1", expect.objectContaining({ name: "Café Nuevo" }))
    );
  });

  it("oculta el control de activar/desactivar para admin_sucursal", async () => {
    setup("admin_sucursal");
    await screen.findByLabelText(/nombre/i);
    expect(screen.queryByText(/desactivar local/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/BranchEditorPage.test.tsx`
Expected: FAIL (stub vacío).

- [ ] **Step 3: Implementar el editor**

Reemplazar `web/src/pages/admin/BranchEditorPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import {
  getOwnerBranch,
  updateBranch,
  setBranchActive,
  closeBranch,
  reopenBranch,
} from "../../api/ownerClient.js";
import type { OwnerBranchDetail, Category } from "../../api/ownerTypes.js";
import { ImageUploader } from "../../components/admin/ImageUploader.js";
import { MapPicker } from "../../components/admin/MapPicker.js";
import { HoursEditor } from "../../components/admin/HoursEditor.js";
import { useAuth } from "../../auth/AuthContext.js";

const CATEGORIES: Category[] = ["bar", "pub", "restaurant", "cafe"];
const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function BranchEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branch, setBranch] = useState<OwnerBranchDetail | null>(null);
  const [form, setForm] = useState<Partial<OwnerBranchDetail>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    getOwnerBranch(id).then((b) => {
      setBranch(b);
      setForm(b);
    });
  };
  useEffect(load, [id]);

  if (!branch || !id) return <p className="text-mute">…</p>;

  const set = <K extends keyof OwnerBranchDetail>(k: K, v: OwnerBranchDetail[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await updateBranch(id!, {
        name: form.name,
        category: form.category as Category,
        address: form.address,
        lat: form.lat,
        lng: form.lng,
        phone: form.phone ?? null,
        description: form.description ?? null,
        imageUrl: form.imageUrl ?? null,
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  const closedActive = branch.closedUntil && new Date(branch.closedUntil) > new Date();
  const canToggleActive = user?.role !== "admin_sucursal";

  return (
    <div>
      <Link to="/admin/branches" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        <ArrowLeft size={16} strokeWidth={2.5} /> {t("admin.owner.myBranches")}
      </Link>

      <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
        <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.data")}</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.name")}</label>
            <input aria-label={t("admin.owner.name")} className={inputCls} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.category")}</label>
            <select aria-label={t("admin.owner.category")} className={inputCls} value={form.category ?? "cafe"} onChange={(e) => set("category", e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`categories.${c}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.address")}</label>
            <input aria-label={t("admin.owner.address")} className={inputCls} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.phone")}</label>
            <input aria-label={t("admin.owner.phone")} className={inputCls} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.description")}</label>
            <textarea aria-label={t("admin.owner.description")} className={`${inputCls} resize-none`} rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>

          <ImageUploader value={form.imageUrl ?? null} onChange={(url) => set("imageUrl", url)} label={t("admin.owner.image")} />

          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.location")}</label>
            <MapPicker
              lat={form.lat ?? branch.lat}
              lng={form.lng ?? branch.lng}
              onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-40">
              {t("admin.owner.save")}
            </button>
            {saved && <span className="text-sm font-semibold text-open">{t("admin.owner.saved")}</span>}
          </div>
        </div>
      </section>

      {/* Estado: cierre temporal y activación */}
      <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
        <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.status")}</h2>

        <div className="mb-3">
          {closedActive ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-brand-dark">
                {t("admin.owner.closedUntil", { date: new Date(branch.closedUntil!).toLocaleString() })}
              </span>
              <button onClick={() => reopenBranch(id).then(load)} className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-white">
                {t("admin.owner.reopen")}
              </button>
            </div>
          ) : (
            <CloseControl branchId={id} onDone={load} />
          )}
        </div>

        {canToggleActive && (
          <button
            onClick={() => setBranchActive(id, !branch.active).then(load)}
            className="rounded-xl bg-bg px-3 py-2 text-sm font-bold text-ink ring-1 ring-line"
          >
            {branch.active ? t("admin.owner.deactivate") : t("admin.owner.activate")}
          </button>
        )}
      </section>

      {/* Horarios */}
      <HoursEditor branchId={id} initial={branch.hours} />
    </div>
  );
}

function CloseControl({ branchId, onDone }: { branchId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [until, setUntil] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.closeUntil")}</label>
        <input
          type="datetime-local"
          aria-label={t("admin.owner.closeUntil")}
          className={inputCls}
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </div>
      <button
        disabled={!until}
        onClick={() => closeBranch(branchId, new Date(until).toISOString()).then(onDone)}
        className="rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        {t("admin.owner.closeNow")}
      </button>
    </div>
  );
}
```
Nota: `Category` se reexporta desde `ownerTypes.ts`. Si no está exportado allí, importar `Category` desde `../../api/types.js` en su lugar (verificar y usar el path correcto). El editor importa `HoursEditor` (Task 6) — para que Task 5 compile de forma independiente, crear primero el stub de `HoursEditor` (Step 4) y completarlo en Task 6.

- [ ] **Step 4: Stub de `HoursEditor` + claves i18n**

Crear stub `web/src/components/admin/HoursEditor.tsx` (se reemplaza en Task 6):
```tsx
import type { OwnerHour } from "../../api/ownerTypes.js";
export function HoursEditor({ branchId, initial }: { branchId: string; initial: OwnerHour[] }) {
  void branchId; void initial;
  return null;
}
```
En `web/src/i18n/es.json`, agregar al objeto `admin.owner` las claves del editor:
```json
      "data": "Datos",
      "name": "Nombre",
      "category": "Categoría",
      "address": "Dirección",
      "phone": "Teléfono",
      "description": "Descripción",
      "image": "Imagen del local",
      "location": "Ubicación (toca el mapa)",
      "save": "Guardar",
      "saved": "Guardado",
      "status": "Estado",
      "closeUntil": "Cerrar hasta",
      "closeNow": "Cerrar",
      "closedUntil": "Cerrado hasta {{date}}",
      "reopen": "Reabrir",
      "activate": "Activar local",
      "deactivate": "Desactivar local"
```
Replicar en `en.json` y `pt.json` con traducciones equivalentes. JSON válido.

- [ ] **Step 5: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/BranchEditorPage.test.tsx` → PASS (2 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/admin/BranchEditorPage.tsx web/src/components/admin/HoursEditor.tsx web/src/i18n web/src/tests/BranchEditorPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): editor de sucursal (datos, imagen, mapa, cierre temporal, activación)"
```

---

## Task 6: Editor de horarios

**Files:**
- Modify: `web/src/components/admin/HoursEditor.tsx` (reemplaza el stub)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/HoursEditor.test.tsx`

**Interfaces:**
- Consumes: `ownerClient.replaceHours`, `weekdays` de i18n.
- Produces: `<HoursEditor branchId={string} initial={OwnerHour[]} />` — 7 filas (lun..dom o el orden 0=domingo..6=sábado), cada una con checkbox "abierto" + inputs `time` de apertura/cierre; botón guardar → `replaceHours` con solo los días marcados como abiertos.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/HoursEditor.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { HoursEditor } from "../components/admin/HoursEditor.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

describe("HoursEditor", () => {
  it("guarda solo los días marcados como abiertos", async () => {
    const replace = vi.spyOn(owner, "replaceHours").mockResolvedValue([] as never);
    render(
      <HoursEditor
        branchId="b1"
        initial={[{ id: "h1", weekday: 1, openTime: "09:00", closeTime: "18:00" }]}
      />
    );
    // el día 1 (lunes) viene abierto desde initial; guardar debe enviarlo
    fireEvent.click(screen.getByRole("button", { name: /guardar horarios/i }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "b1",
        expect.arrayContaining([{ weekday: 1, openTime: "09:00", closeTime: "18:00" }])
      )
    );
    // y NO debe incluir días no marcados (longitud 1)
    expect(replace.mock.calls[0][1]).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/HoursEditor.test.tsx`
Expected: FAIL (stub).

- [ ] **Step 3: Implementar `HoursEditor`**

Reemplazar `web/src/components/admin/HoursEditor.tsx`:
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { replaceHours } from "../../api/ownerClient.js";
import type { OwnerHour, HourInput } from "../../api/ownerTypes.js";

interface DayRow {
  open: boolean;
  openTime: string;
  closeTime: string;
}

function buildRows(initial: OwnerHour[]): DayRow[] {
  // 7 filas indexadas por weekday 0..6
  const rows: DayRow[] = Array.from({ length: 7 }, () => ({ open: false, openTime: "09:00", closeTime: "18:00" }));
  for (const h of initial) {
    rows[h.weekday] = { open: true, openTime: h.openTime, closeTime: h.closeTime };
  }
  return rows;
}

export function HoursEditor({ branchId, initial }: { branchId: string; initial: OwnerHour[] }) {
  const { t } = useTranslation();
  const weekdays = t("weekdays", { returnObjects: true }) as string[];
  const [rows, setRows] = useState<DayRow[]>(() => buildRows(initial));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const setRow = (i: number, patch: Partial<DayRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setSaved(false);
    const hours: HourInput[] = rows
      .map((r, weekday) => ({ ...r, weekday }))
      .filter((r) => r.open)
      .map((r) => ({ weekday: r.weekday, openTime: r.openTime, closeTime: r.closeTime }));
    try {
      await replaceHours(branchId, hours);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "rounded-lg bg-bg px-2 py-1 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

  return (
    <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.hours")}</h2>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <label className="flex w-32 items-center gap-2">
              <input
                type="checkbox"
                aria-label={weekdays[i]}
                checked={r.open}
                onChange={(e) => setRow(i, { open: e.target.checked })}
              />
              <span className="text-sm text-ink">{weekdays[i]}</span>
            </label>
            <input type="time" aria-label={`${weekdays[i]} ${t("admin.owner.openTime")}`} className={inputCls} value={r.openTime} disabled={!r.open} onChange={(e) => setRow(i, { openTime: e.target.value })} />
            <span className="text-mute">–</span>
            <input type="time" aria-label={`${weekdays[i]} ${t("admin.owner.closeTime")}`} className={inputCls} value={r.closeTime} disabled={!r.open} onChange={(e) => setRow(i, { closeTime: e.target.value })} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-40">
          {t("admin.owner.saveHours")}
        </button>
        {saved && <span className="text-sm font-semibold text-open">{t("admin.owner.saved")}</span>}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Claves i18n**

En `web/src/i18n/es.json`, agregar al objeto `admin.owner`:
```json
      "hours": "Horarios",
      "openTime": "apertura",
      "closeTime": "cierre",
      "saveHours": "Guardar horarios"
```
Replicar en `en.json` ("Hours"/"open"/"close"/"Save hours") y `pt.json` ("Horários"/"abertura"/"fechamento"/"Salvar horários"). JSON válido.

- [ ] **Step 5: Run test, debe pasar; typecheck; suite web completa**

Run: `cd web && npx vitest run src/tests/HoursEditor.test.tsx` → PASS.
Run: `cd web && npx vitest run` → toda la suite web verde (reportar conteo).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/admin/HoursEditor.tsx web/src/i18n web/src/tests/HoursEditor.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): editor de horarios semanal de la sucursal"
```

---

## Verificación final de la capa 2B

- `cd web && npx vitest run` → toda la suite web verde.
- `cd web && npx tsc -b --noEmit` y `cd web && npm run build` → sin errores.
- `docker compose exec -T api npx vitest run src/tests/owner-plans.test.ts` → verde (el único cambio backend). Si se corrió `npm test`, re-sembrar (`docker compose exec -T api npm run seed:all`) — ver [[restoapp-test-db-reset]].
- **Flujo manual** (con el stack arriba, `localhost:5173`): login en `/admin/login` con `owner@demo.cl`/`owner12345` → ir a `/admin/branches` → ver los 6 locales → abrir uno → cambiar nombre/descripción, subir una imagen (aparece en la ficha pública), tocar el mapa para mover la ubicación, guardar; marcar cierre temporal (la ficha pública `localhost:5173/branch/<id>` debe reflejarlo) y reabrir; editar horarios y guardar.

## Self-review (cobertura, capa 2B)

- `GET /admin/plans` (para el modal de upgrade de 2C) → Task 1. ✓
- Cliente API tipado del panel (todas las operaciones de sucursal + upload) → Task 2. ✓
- ImageUploader (MinIO) + MapPicker (Leaflet) → Task 3. ✓
- Layout `/admin` + lista "mis locales" + rutas anidadas → Task 4. ✓
- Editor de sucursal: datos, imagen, ubicación, activar/desactivar (general), cierre/reapertura → Task 5. ✓
- Editor de horarios → Task 6. ✓
- **Pendiente capa 2C** (siguiente plan): managers de menú, promociones y códigos de descuento (con contador de límite y bloqueo + "solicitar upgrade"); crear sucursal (con MapPicker y manejo de `plan_limit_branches`); modales de solicitud de upgrade y de anuncio; y discovery público: cupones en la ficha + indicador "cerrado temporalmente" en card/ficha (extender el tipo `BranchDetail` con `closedUntil`/`discountCodes`).
- Follow-ups heredados de 2A a resolver en 2C: unificar el path de ownership de `ad-requests`; DTO consistente ya resuelto en el frontend vía `ownerTypes`.
