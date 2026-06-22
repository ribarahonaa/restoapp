# RestoApp Capa 2C — Panel del dueño: menú, promos, descuentos, crear sucursal, solicitudes y discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el panel del dueño: gestionar el menú, las promociones y los códigos de descuento de cada sucursal (con contador de límite del plan y "solicitar upgrade" al topar), crear sucursales nuevas (con límite), solicitar anuncios; y en el discovery público mostrar los cupones vigentes y el indicador de "cerrado temporalmente".

**Architecture:** Sobre la base de capa 2B (cliente `ownerClient`, `BranchEditorPage`, componentes `ImageUploader`/`MapPicker`). Se extiende `ownerClient` con las operaciones de menú/promos/descuentos/crear-sucursal/solicitudes. El editor de sucursal pasa a tener pestañas (Datos · Menú · Promos · Descuentos); cada pestaña es un "manager" que consume el detalle ya cargado (`OwnerBranchDetail`) y recarga al mutar. Modales reutilizables para "solicitar upgrade" y "solicitar anuncio". El discovery público (`BranchDetailPage`/`BranchCard`) suma cupones y el estado de cierre (datos que el backend de capa 2A ya devuelve).

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind v4, react-router-dom 6, react-i18next 15, Vitest 2 + @testing-library/react 16 (jsdom, globals, jest-dom). Backend ya existente (capa 2A) en `main`.

## Global Constraints

- Commits: autor **ribarahonaa <ribarahonaa@gmail.com>**, fijado **por commit**: `git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "..."`. **NO** `Co-Authored-By` ni referencia a Claude. Verificar `git log -1 --pretty='%ae'` = `ribarahonaa@gmail.com` tras cada commit.
- TypeScript ESM: imports relativos con extensión `.js`. Tests web en el HOST: `cd web && npx vitest run <archivo>`; typecheck `cd web && npx tsc -b --noEmit`.
- Tokens Tailwind: `bg/surface/line/ink/mute/brand/brand-dark/brand-soft/open/promo`. Input: `w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand`. Botón primario: `rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-40`. Card: `rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line`.
- Tests: importar `../i18n/index.js` y fijar `i18n.changeLanguage("es")`; `MemoryRouter` para router; `vi.mock`/`vi.spyOn` para mockear `ownerClient`/`useAuth`.
- Claves i18n nuevas bajo `admin.owner.*`, replicadas en es/en/pt (JSON válido).
- Endpoints de capa 2A (ya en `main`, bajo `/admin`, detrás de auth): menú `POST/PATCH/DELETE /admin/branches/:id/menu[/:itemId]`; promos `POST/PATCH/DELETE /admin/branches/:id/promotions[/:promoId]`; descuentos `GET/POST/PATCH/DELETE /admin/branches/:id/discounts[/:codeId]`; crear sucursal `POST /admin/branches {businessId,...}` (403 `plan_limit_branches`); solicitudes `POST /admin/upgrade-requests {businessId,requestedPlanId,note?}` y `POST /admin/ad-requests {businessId,branchId?,desiredStartsAt,desiredEndsAt,wantsPopup?,note?}`. Límites: menú `plan_limit_menu`, promos `plan_limit_promos`.
- El discovery backend ya devuelve `closedUntil` y `discountCodes` en `GET /branches/:id`, y `nearby?open=true` ya respeta `closedUntil` (capa 2A Task 10).
- Cuentas demo: `owner@demo.cl`/`owner12345` (admin_general).

---

## File Structure

**Frontend (web/):**
- `src/api/ownerTypes.ts` — modificar: inputs de menú/promo/descuento/crear-sucursal/solicitudes.
- `src/api/ownerClient.ts` — modificar: funciones nuevas.
- `src/api/types.ts` — modificar: `BranchDetail` + `closedUntil`/`discountCodes`; nuevo `PublicDiscountCode`.
- `src/components/admin/MenuManager.tsx`, `PromotionsManager.tsx`, `DiscountsManager.tsx` — crear.
- `src/components/admin/UpgradeRequestModal.tsx`, `AdRequestModal.tsx` — crear.
- `src/pages/admin/BranchEditorPage.tsx` — modificar: pestañas + integrar managers + botón "solicitar anuncio".
- `src/pages/admin/CreateBranchPage.tsx` — crear.
- `src/pages/admin/OwnerBranchesPage.tsx` — modificar: botón "crear sucursal".
- `src/App.tsx` — modificar: ruta `/admin/branches/new`.
- `src/pages/BranchDetailPage.tsx` — modificar: cupones + banner "cerrado temporalmente".
- `src/components/BranchCard.tsx` — modificar: indicador "cerrado" (no usado en panel; el discovery público no expone closedUntil en `nearby` salvo el filtro — ver Task 7).
- `src/i18n/{es,en,pt}.json` — modificar.
- Tests: `ownerClient.menu.test.ts`, `MenuManager.test.tsx`, `PromotionsManager.test.tsx`, `DiscountsManager.test.tsx`, `CreateBranchPage.test.tsx`, `BranchDetailPage.coupons.test.tsx`.

---

## Task 1: Extender `ownerClient` con menú, promos, descuentos, crear sucursal y solicitudes

**Files:**
- Modify: `web/src/api/ownerTypes.ts`
- Modify: `web/src/api/ownerClient.ts`
- Test: `web/src/tests/ownerClient.menu.test.ts`

**Interfaces:**
- Produces en `ownerClient.ts`:
  - `createMenuItem(branchId, input: MenuItemInput): Promise<OwnerMenuItem>`
  - `updateMenuItem(branchId, itemId, input: Partial<MenuItemInput>): Promise<OwnerMenuItem>`
  - `deleteMenuItem(branchId, itemId): Promise<void>`
  - `createPromotion(branchId, input: PromotionInput): Promise<OwnerPromotion>`
  - `updatePromotion(branchId, promoId, input: Partial<PromotionInput>): Promise<OwnerPromotion>`
  - `deletePromotion(branchId, promoId): Promise<void>`
  - `listDiscounts(branchId): Promise<OwnerDiscountCode[]>`
  - `createDiscount(branchId, input: DiscountInput): Promise<OwnerDiscountCode>`
  - `deleteDiscount(branchId, codeId): Promise<void>`
  - `createBranch(input: CreateBranchInput): Promise<{ id: string }>`
  - `requestUpgrade(businessId, requestedPlanId, note?): Promise<unknown>`
  - `requestAd(input: AdRequestInput): Promise<unknown>`
  - `LimitError` (clase) lanzada con `code` cuando la API responde 403 con `error` `plan_limit_*`.
- Inputs en `ownerTypes.ts`.

- [ ] **Step 1: Agregar los tipos de input**

En `web/src/api/ownerTypes.ts`, agregar al final:
```ts
import type { Category } from "./types.js";

export interface MenuItemInput {
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  imageUrl?: string | null;
}

export interface PromotionInput {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  endsAt: string;
  active?: boolean;
}

export interface DiscountInput {
  code: string;
  type: "percent" | "amount";
  value: number;
  startsAt: string;
  endsAt: string;
  scope: "branch" | "chain";
}

export interface CreateBranchInput {
  businessId: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface AdRequestInput {
  businessId: string;
  branchId?: string | null;
  desiredStartsAt: string;
  desiredEndsAt: string;
  wantsPopup?: boolean;
  note?: string | null;
}
```
Nota: si `Category` ya está importado al inicio de `ownerTypes.ts` (lo está, de capa 2B), NO duplicar el import — agregar solo las interfaces.

- [ ] **Step 2: Escribir el test (falla primero)**

Crear `web/src/tests/ownerClient.menu.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";
import * as owner from "../api/ownerClient.js";

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ownerClient — menú/promos/descuentos/crear/solicitudes", () => {
  it("createMenuItem hace POST al endpoint de menú con JSON", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ id: "m1", name: "Café" }, 201));
    const out = await owner.createMenuItem("b1", { name: "Café", price: 2500 });
    expect(spy).toHaveBeenCalledWith(
      "/admin/branches/b1/menu",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Café", price: 2500 }) })
    );
    expect(out.id).toBe("m1");
  });

  it("deleteMenuItem hace DELETE y no parsea body", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(new Response(null, { status: 204 }));
    await owner.deleteMenuItem("b1", "m1");
    expect(spy).toHaveBeenCalledWith("/admin/branches/b1/menu/m1", expect.objectContaining({ method: "DELETE" }));
  });

  it("createDiscount con scope chain", async () => {
    vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ id: "d1", branchId: null }, 201));
    const out = await owner.createDiscount("b1", { code: "X", type: "percent", value: 10, scope: "chain", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" });
    expect(out.branchId).toBeNull();
  });

  it("createBranch que excede límite lanza LimitError con code plan_limit_branches", async () => {
    vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ error: "plan_limit_branches" }, 403));
    await expect(
      owner.createBranch({ businessId: "biz", name: "N", category: "bar", address: "x", lat: -33, lng: -70 })
    ).rejects.toMatchObject({ code: "plan_limit_branches" });
  });

  it("requestUpgrade hace POST a /admin/upgrade-requests", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ id: "r1", status: "pending" }, 201));
    await owner.requestUpgrade("biz", "plan2", "más sucursales");
    expect(spy).toHaveBeenCalledWith(
      "/admin/upgrade-requests",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ businessId: "biz", requestedPlanId: "plan2", note: "más sucursales" }) })
    );
  });
});
```

- [ ] **Step 3: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/ownerClient.menu.test.ts`
Expected: FAIL (funciones no existen).

- [ ] **Step 4: Implementar las funciones nuevas**

En `web/src/api/ownerClient.ts`, agregar los imports de tipos al bloque de import existente:
```ts
import type {
  OwnerBranchSummary,
  OwnerBranchDetail,
  BranchUpdate,
  HourInput,
  PlanInfo,
  OwnerMenuItem,
  OwnerPromotion,
  OwnerDiscountCode,
  MenuItemInput,
  PromotionInput,
  DiscountInput,
  CreateBranchInput,
  AdRequestInput,
} from "./ownerTypes.js";
```
(Fusionar con el import existente — no duplicar los tipos ya importados.)
Agregar tras `jsonOrThrow`/`jsonInit` una clase de error de límite y un helper que la detecta:
```ts
// Error de límite de plan (la API responde 403 con error plan_limit_*).
export class LimitError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "LimitError";
  }
}

// Igual que jsonOrThrow pero mapea 403 plan_limit_* a LimitError (para mostrar "solicitar upgrade").
async function jsonOrLimit<T>(res: Response): Promise<T> {
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error && body.error.startsWith("plan_limit_")) throw new LimitError(body.error);
    throw new Error("forbidden");
  }
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return res.json() as Promise<T>;
}
```
Agregar las funciones al final del archivo:
```ts
export async function createMenuItem(branchId: string, input: MenuItemInput): Promise<OwnerMenuItem> {
  return jsonOrLimit(await authedFetch(`/admin/branches/${branchId}/menu`, jsonInit("POST", input)));
}
export async function updateMenuItem(branchId: string, itemId: string, input: Partial<MenuItemInput>): Promise<OwnerMenuItem> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/menu/${itemId}`, jsonInit("PATCH", input)));
}
export async function deleteMenuItem(branchId: string, itemId: string): Promise<void> {
  const res = await authedFetch(`/admin/branches/${branchId}/menu/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}

export async function createPromotion(branchId: string, input: PromotionInput): Promise<OwnerPromotion> {
  return jsonOrLimit(await authedFetch(`/admin/branches/${branchId}/promotions`, jsonInit("POST", input)));
}
export async function updatePromotion(branchId: string, promoId: string, input: Partial<PromotionInput>): Promise<OwnerPromotion> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/promotions/${promoId}`, jsonInit("PATCH", input)));
}
export async function deletePromotion(branchId: string, promoId: string): Promise<void> {
  const res = await authedFetch(`/admin/branches/${branchId}/promotions/${promoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}

export async function listDiscounts(branchId: string): Promise<OwnerDiscountCode[]> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/discounts`));
}
export async function createDiscount(branchId: string, input: DiscountInput): Promise<OwnerDiscountCode> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/discounts`, jsonInit("POST", input)));
}
export async function deleteDiscount(branchId: string, codeId: string): Promise<void> {
  const res = await authedFetch(`/admin/branches/${branchId}/discounts/${codeId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}

export async function createBranch(input: CreateBranchInput): Promise<{ id: string }> {
  return jsonOrLimit(await authedFetch("/admin/branches", jsonInit("POST", input)));
}

export async function requestUpgrade(businessId: string, requestedPlanId: string, note?: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch("/admin/upgrade-requests", jsonInit("POST", { businessId, requestedPlanId, note })));
}
export async function requestAd(input: AdRequestInput): Promise<unknown> {
  return jsonOrThrow(await authedFetch("/admin/ad-requests", jsonInit("POST", input)));
}
```
Nota: en `requestUpgrade`, si `note` es `undefined`, `JSON.stringify({...note})` lo omite — el test espera `note: "más sucursales"`. Si se llama sin note, el body será `{"businessId":...,"requestedPlanId":...}` (sin `note`), lo cual el backend acepta (`note` opcional).

- [ ] **Step 5: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/ownerClient.menu.test.ts` → PASS (5 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/ownerTypes.ts web/src/api/ownerClient.ts web/src/tests/ownerClient.menu.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): cliente API para menú, promos, descuentos, crear sucursal y solicitudes"
```

---

## Task 2: Pestañas en el editor de sucursal

**Files:**
- Modify: `web/src/pages/admin/BranchEditorPage.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: actualizar `web/src/tests/BranchEditorPage.test.tsx`

**Interfaces:**
- Produces: el editor muestra `Tabs` (Datos · Menú · Promos · Descuentos). "Datos" conserva el formulario + imagen + mapa + estado + horarios. Las otras tres pestañas renderizan los managers (placeholders en esta task; full en Tasks 3-5). Pasa `branch: OwnerBranchDetail` y `onChange: () => void` (recarga) a cada manager.

- [ ] **Step 1: Crear stubs de los managers**

Crear los tres con firma estable (se completan en Tasks 3-5):
`web/src/components/admin/MenuManager.tsx`:
```tsx
import type { OwnerBranchDetail } from "../../api/ownerTypes.js";
export function MenuManager({ branch, onChange }: { branch: OwnerBranchDetail; onChange: () => void }) {
  void branch; void onChange;
  return null;
}
```
`web/src/components/admin/PromotionsManager.tsx` y `web/src/components/admin/DiscountsManager.tsx`: idénticos cambiando el nombre del componente (`PromotionsManager`, `DiscountsManager`).

- [ ] **Step 2: Actualizar el test del editor (las pestañas cambian el DOM)**

En `web/src/tests/BranchEditorPage.test.tsx`, el formulario de Datos ahora vive bajo la pestaña "Datos" (activa por defecto), así que los tests existentes deben seguir pasando. Agregar un test de pestañas:
```tsx
it("muestra las pestañas y cambia a Menú", async () => {
  setup();
  await screen.findByLabelText(/nombre/i);
  // pestañas presentes
  expect(screen.getByRole("button", { name: /^menú$/i })).toBeInTheDocument();
  // al cambiar a Menú, el formulario de datos deja de mostrarse
  fireEvent.click(screen.getByRole("button", { name: /^menú$/i }));
  expect(screen.queryByLabelText(/nombre/i)).not.toBeInTheDocument();
});
```
(Mantener los dos tests existentes; ahora "Datos" es la pestaña activa por defecto, así que `findByLabelText(/nombre/i)` sigue funcionando.)

- [ ] **Step 3: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/BranchEditorPage.test.tsx`
Expected: FAIL (no hay pestañas).

- [ ] **Step 4: Integrar las pestañas en `BranchEditorPage`**

En `web/src/pages/admin/BranchEditorPage.tsx`:
1. Importar `Tabs` y los managers:
```tsx
import { Tabs } from "../../components/Tabs.js";
import { MenuManager } from "../../components/admin/MenuManager.js";
import { PromotionsManager } from "../../components/admin/PromotionsManager.js";
import { DiscountsManager } from "../../components/admin/DiscountsManager.js";
```
2. Agregar estado de pestaña: `const [tab, setTab] = useState("data");`
3. Tras el `<Link>` de volver, insertar las pestañas:
```tsx
<Tabs
  tabs={[
    { key: "data", label: t("admin.owner.data") },
    { key: "menu", label: t("admin.owner.menuTab") },
    { key: "promos", label: t("admin.owner.promosTab") },
    { key: "discounts", label: t("admin.owner.discountsTab") },
  ]}
  active={tab}
  onChange={setTab}
/>
```
4. Envolver el contenido actual (las `<section>` de Datos/Estado + `<HoursEditor>`) en `{tab === "data" && (<> ... </>)}`. Y agregar:
```tsx
{tab === "menu" && <MenuManager branch={branch} onChange={load} />}
{tab === "promos" && <PromotionsManager branch={branch} onChange={load} />}
{tab === "discounts" && <DiscountsManager branch={branch} onChange={load} />}
```
(El `<>` fragment para "data" agrupa las secciones existentes; conservar su contenido intacto.)

- [ ] **Step 5: Agregar claves i18n de pestañas**

En `web/src/i18n/es.json` dentro de `admin.owner`: `"menuTab": "Menú", "promosTab": "Promos", "discountsTab": "Descuentos"`. Replicar en en (`Menu/Promos/Discounts`) y pt (`Cardápio/Promos/Descontos`). (`data` ya existe.)

- [ ] **Step 6: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/BranchEditorPage.test.tsx` → PASS.
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/admin/BranchEditorPage.tsx web/src/components/admin/MenuManager.tsx web/src/components/admin/PromotionsManager.tsx web/src/components/admin/DiscountsManager.tsx web/src/i18n web/src/tests/BranchEditorPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): pestañas en el editor de sucursal (datos/menú/promos/descuentos)"
```

---

## Task 3: Manager de menú (CRUD + límite + solicitar upgrade)

**Files:**
- Modify: `web/src/components/admin/MenuManager.tsx`
- Create: `web/src/components/admin/UpgradeRequestModal.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/MenuManager.test.tsx`

**Interfaces:**
- Consumes: `createMenuItem/updateMenuItem/deleteMenuItem`, `LimitError`, `ImageUploader`, `UpgradeRequestModal`.
- Produces: lista de ítems del `branch.menuItems`; formulario para agregar (nombre, precio, categoría, descripción, imagen); botón eliminar por ítem; contador `n/max` (de `branch.business.plan?.maxMenuItems`); al topar el límite o recibir `LimitError`, muestra "límite alcanzado" + botón que abre `UpgradeRequestModal`. Llama `onChange()` tras cada mutación. `UpgradeRequestModal({ businessId, onClose })` lista planes (`listPlans`) y envía `requestUpgrade`.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/MenuManager.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { MenuManager } from "../components/admin/MenuManager.js";
import * as owner from "../api/ownerClient.js";
import type { OwnerBranchDetail } from "../api/ownerTypes.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

function branchWith(menuCount: number, max: number | null): OwnerBranchDetail {
  return {
    id: "b1", name: "L", category: "cafe", address: "x", lat: 0, lng: 0, phone: null, description: null,
    imageUrl: null, closedUntil: null, active: true, businessId: "biz",
    business: { id: "biz", name: "G", plan: max == null ? null : { id: "p", name: "Free", maxPromos: 1, maxMenuItems: max, maxBranches: 1 } },
    hours: [],
    menuItems: Array.from({ length: menuCount }, (_, i) => ({ id: `m${i}`, name: `Item ${i}`, description: null, price: "1000", category: null, imageUrl: null })),
    promotions: [], discountCodes: [],
  };
}

describe("MenuManager", () => {
  it("crea un ítem y recarga", async () => {
    const create = vi.spyOn(owner, "createMenuItem").mockResolvedValue({ id: "mX" } as never);
    const onChange = vi.fn();
    render(<MenuManager branch={branchWith(1, 10)} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/nombre del ítem/i), { target: { value: "Latte" } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar ítem/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("b1", expect.objectContaining({ name: "Latte", price: 3000 })));
    expect(onChange).toHaveBeenCalled();
  });

  it("al topar el límite muestra solicitar upgrade y oculta el form de agregar", () => {
    render(<MenuManager branch={branchWith(10, 10)} onChange={vi.fn()} />);
    expect(screen.getByText(/límite/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /solicitar upgrade/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/nombre del ítem/i)).not.toBeInTheDocument();
  });

  it("elimina un ítem", async () => {
    const del = vi.spyOn(owner, "deleteMenuItem").mockResolvedValue(undefined as never);
    const onChange = vi.fn();
    render(<MenuManager branch={branchWith(1, 10)} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("b1", "m0"));
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/MenuManager.test.tsx`
Expected: FAIL (stub).

- [ ] **Step 3: Implementar `UpgradeRequestModal`**

Crear `web/src/components/admin/UpgradeRequestModal.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { listPlans, requestUpgrade } from "../../api/ownerClient.js";
import type { PlanInfo } from "../../api/ownerTypes.js";

export function UpgradeRequestModal({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPlans().then((p) => {
      setPlans(p);
      if (p[0]) setPlanId(p[0].id);
    });
  }, []);

  async function submit() {
    setBusy(true);
    try {
      await requestUpgrade(businessId, planId, note || undefined);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">{t("admin.owner.requestUpgrade")}</h3>
          <button aria-label={t("item.close")} onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-bg text-mute">
            <X size={16} />
          </button>
        </div>
        {done ? (
          <p className="text-sm text-open">{t("admin.owner.requestSent")}</p>
        ) : (
          <div className="space-y-3">
            <select aria-label={t("admin.owner.plan")} className="w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.maxBranches} suc · {p.maxMenuItems} ítems · {p.maxPromos} promos</option>
              ))}
            </select>
            <textarea aria-label={t("admin.owner.note")} placeholder={t("admin.owner.note")} className="w-full resize-none rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={submit} disabled={busy || !planId} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t("admin.owner.send")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `MenuManager`**

Reemplazar `web/src/components/admin/MenuManager.tsx`:
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { createMenuItem, deleteMenuItem, LimitError } from "../../api/ownerClient.js";
import { ImageUploader } from "./ImageUploader.js";
import { UpgradeRequestModal } from "./UpgradeRequestModal.js";
import type { OwnerBranchDetail, MenuItemInput } from "../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function MenuManager({ branch, onChange }: { branch: OwnerBranchDetail; onChange: () => void }) {
  const { t } = useTranslation();
  const max = branch.business.plan?.maxMenuItems ?? null;
  const count = branch.menuItems.length;
  const atLimit = max != null && count >= max;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<MenuItemInput>({ name: "", price: 0, category: "", description: "", imageUrl: null });

  async function add() {
    setBusy(true);
    setError(false);
    try {
      await createMenuItem(branch.id, {
        name: form.name,
        price: Number(form.price),
        category: form.category || null,
        description: form.description || null,
        imageUrl: form.imageUrl ?? null,
      });
      setForm({ name: "", price: 0, category: "", description: "", imageUrl: null });
      onChange();
    } catch (e) {
      if (e instanceof LimitError) setShowUpgrade(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId: string) {
    setError(false);
    try {
      await deleteMenuItem(branch.id, itemId);
      onChange();
    } catch {
      setError(true);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink">{t("admin.owner.menuTab")}</h2>
        {max != null && <span className="text-xs font-semibold text-mute">{count}/{max}</span>}
      </div>

      <ul className="mb-4 space-y-2">
        {branch.menuItems.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl bg-bg p-2">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-line">
              {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="h-full w-full object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{m.name}</p>
              <p className="text-xs text-mute">{m.category ?? ""}</p>
            </div>
            <button aria-label={t("admin.owner.delete")} onClick={() => remove(m.id)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}

      {atLimit ? (
        <div className="rounded-xl bg-brand-soft p-3 text-center">
          <p className="mb-2 text-sm font-semibold text-brand-dark">{t("admin.owner.limitReached")}</p>
          <button onClick={() => setShowUpgrade(true)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
            {t("admin.owner.requestUpgrade")}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <input aria-label={t("admin.owner.itemName")} placeholder={t("admin.owner.itemName")} className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex gap-2">
            <input aria-label={t("admin.owner.price")} placeholder={t("admin.owner.price")} type="number" className={inputCls} value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <input aria-label={t("admin.owner.itemCategory")} placeholder={t("admin.owner.itemCategory")} className={inputCls} value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <textarea aria-label={t("admin.owner.itemDescription")} placeholder={t("admin.owner.itemDescription")} className={`${inputCls} resize-none`} rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <ImageUploader value={form.imageUrl ?? null} onChange={(url) => setForm({ ...form, imageUrl: url })} label={t("admin.owner.itemImage")} />
          <button onClick={add} disabled={busy || !form.name || !form.price} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {t("admin.owner.addItem")}
          </button>
        </div>
      )}

      {showUpgrade && <UpgradeRequestModal businessId={branch.businessId} onClose={() => setShowUpgrade(false)} />}
    </section>
  );
}
```

- [ ] **Step 5: Claves i18n**

En `web/src/i18n/es.json` dentro de `admin.owner`, agregar:
```json
      "addItem": "Agregar ítem",
      "itemName": "Nombre del ítem",
      "price": "Precio",
      "itemCategory": "Categoría",
      "itemDescription": "Descripción",
      "itemImage": "Imagen del ítem",
      "delete": "Eliminar",
      "limitReached": "Llegaste al límite de tu plan",
      "requestUpgrade": "Solicitar upgrade",
      "plan": "Plan",
      "note": "Nota (opcional)",
      "send": "Enviar",
      "requestSent": "Solicitud enviada"
```
Replicar en en.json y pt.json con traducciones equivalentes. (`saveError` ya existe.) JSON válido.

- [ ] **Step 6: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/MenuManager.test.tsx` → PASS (3 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/admin/MenuManager.tsx web/src/components/admin/UpgradeRequestModal.tsx web/src/i18n web/src/tests/MenuManager.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): manager de menú con límite de plan y solicitar upgrade"
```

---

## Task 4: Manager de promociones

**Files:**
- Modify: `web/src/components/admin/PromotionsManager.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/PromotionsManager.test.tsx`

**Interfaces:**
- Consumes: `createPromotion/deletePromotion`, `LimitError`, `ImageUploader`, `UpgradeRequestModal`.
- Produces: lista de `branch.promotions`; form para agregar (título, descripción, imagen, vigencia `startsAt`/`endsAt` con `datetime-local`); eliminar; contador `n/max` (`maxPromos`); límite → `UpgradeRequestModal`. `onChange()` tras mutar.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/PromotionsManager.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { PromotionsManager } from "../components/admin/PromotionsManager.js";
import * as owner from "../api/ownerClient.js";
import type { OwnerBranchDetail } from "../api/ownerTypes.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

function branchWith(promoCount: number, max: number): OwnerBranchDetail {
  return {
    id: "b1", name: "L", category: "cafe", address: "x", lat: 0, lng: 0, phone: null, description: null,
    imageUrl: null, closedUntil: null, active: true, businessId: "biz",
    business: { id: "biz", name: "G", plan: { id: "p", name: "Free", maxPromos: max, maxMenuItems: 10, maxBranches: 1 } },
    hours: [], menuItems: [],
    promotions: Array.from({ length: promoCount }, (_, i) => ({ id: `p${i}`, title: `Promo ${i}`, description: null, imageUrl: null, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", active: true })),
    discountCodes: [],
  };
}

describe("PromotionsManager", () => {
  it("crea una promo", async () => {
    const create = vi.spyOn(owner, "createPromotion").mockResolvedValue({ id: "pX" } as never);
    const onChange = vi.fn();
    render(<PromotionsManager branch={branchWith(0, 5)} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: "2x1" } });
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: "2026-07-01T10:00" } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: "2026-07-31T23:00" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar promo/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("b1", expect.objectContaining({ title: "2x1" })));
    expect(onChange).toHaveBeenCalled();
  });

  it("al topar el límite muestra solicitar upgrade", () => {
    render(<PromotionsManager branch={branchWith(1, 1)} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /solicitar upgrade/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/PromotionsManager.test.tsx`
Expected: FAIL (stub).

- [ ] **Step 3: Implementar `PromotionsManager`**

Reemplazar `web/src/components/admin/PromotionsManager.tsx`:
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { createPromotion, deletePromotion, LimitError } from "../../api/ownerClient.js";
import { ImageUploader } from "./ImageUploader.js";
import { UpgradeRequestModal } from "./UpgradeRequestModal.js";
import type { OwnerBranchDetail } from "../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function PromotionsManager({ branch, onChange }: { branch: OwnerBranchDetail; onChange: () => void }) {
  const { t } = useTranslation();
  const max = branch.business.plan?.maxPromos ?? null;
  const count = branch.promotions.length;
  const atLimit = max != null && count >= max;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function add() {
    setBusy(true);
    setError(false);
    try {
      await createPromotion(branch.id, {
        title,
        description: description || null,
        imageUrl,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setTitle(""); setDescription(""); setImageUrl(null); setStartsAt(""); setEndsAt("");
      onChange();
    } catch (e) {
      if (e instanceof LimitError) setShowUpgrade(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(false);
    try {
      await deletePromotion(branch.id, id);
      onChange();
    } catch {
      setError(true);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink">{t("admin.owner.promosTab")}</h2>
        {max != null && <span className="text-xs font-semibold text-mute">{count}/{max}</span>}
      </div>

      <ul className="mb-4 space-y-2">
        {branch.promotions.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-bg p-2">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-line">
              {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />}
            </span>
            <p className="min-w-0 flex-1 truncate font-semibold text-ink">{p.title}</p>
            <button aria-label={t("admin.owner.delete")} onClick={() => remove(p.id)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}

      {atLimit ? (
        <div className="rounded-xl bg-brand-soft p-3 text-center">
          <p className="mb-2 text-sm font-semibold text-brand-dark">{t("admin.owner.limitReached")}</p>
          <button onClick={() => setShowUpgrade(true)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
            {t("admin.owner.requestUpgrade")}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <input aria-label={t("admin.owner.promoTitle")} placeholder={t("admin.owner.promoTitle")} className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea aria-label={t("admin.owner.itemDescription")} placeholder={t("admin.owner.itemDescription")} className={`${inputCls} resize-none`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.from")}
              <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.to")}
              <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
          </div>
          <ImageUploader value={imageUrl} onChange={setImageUrl} label={t("admin.owner.promoImage")} />
          <button onClick={add} disabled={busy || !title || !startsAt || !endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {t("admin.owner.addPromo")}
          </button>
        </div>
      )}

      {showUpgrade && <UpgradeRequestModal businessId={branch.businessId} onClose={() => setShowUpgrade(false)} />}
    </section>
  );
}
```

- [ ] **Step 4: Claves i18n**

En `admin.owner` (es): `"addPromo": "Agregar promo", "promoTitle": "Título", "promoImage": "Imagen de la promo", "from": "Desde", "to": "Hasta"`. Replicar en en (`Add promo/Title/Promo image/From/To`) y pt (`Adicionar promo/Título/Imagem da promo/De/Até`). JSON válido.

- [ ] **Step 5: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/PromotionsManager.test.tsx` → PASS (2 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/admin/PromotionsManager.tsx web/src/i18n web/src/tests/PromotionsManager.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): manager de promociones con límite de plan"
```

---

## Task 5: Manager de códigos de descuento

**Files:**
- Modify: `web/src/components/admin/DiscountsManager.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/DiscountsManager.test.tsx`

**Interfaces:**
- Consumes: `createDiscount/deleteDiscount`, `useAuth`.
- Produces: lista `branch.discountCodes`; form para crear (código, tipo percent/amount, valor, vigencia, alcance branch/cadena). El selector de alcance "cadena" solo se ofrece si `user.role !== "admin_sucursal"`. Eliminar. `onChange()` tras mutar.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/DiscountsManager.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { DiscountsManager } from "../components/admin/DiscountsManager.js";
import * as owner from "../api/ownerClient.js";
import * as authCtx from "../auth/AuthContext.js";
import type { OwnerBranchDetail } from "../api/ownerTypes.js";

function branch(): OwnerBranchDetail {
  return {
    id: "b1", name: "L", category: "cafe", address: "x", lat: 0, lng: 0, phone: null, description: null,
    imageUrl: null, closedUntil: null, active: true, businessId: "biz",
    business: { id: "biz", name: "G", plan: null },
    hours: [], menuItems: [], promotions: [],
    discountCodes: [{ id: "d0", code: "OLD", type: "percent", value: "10", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", branchId: "b1", active: true }],
  };
}
function mockAuth(role: string) {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({ user: { id: "u", email: "e", name: "n", role, preferredLang: "es" }, status: "authed", signIn: vi.fn(), signOut: vi.fn() } as never);
}

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

describe("DiscountsManager", () => {
  it("admin_general puede elegir alcance cadena y crear", async () => {
    mockAuth("admin_general");
    const create = vi.spyOn(owner, "createDiscount").mockResolvedValue({ id: "dX" } as never);
    const onChange = vi.fn();
    render(<DiscountsManager branch={branch()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "VERANO" } });
    fireEvent.change(screen.getByLabelText(/valor/i), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: "2026-07-01T00:00" } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: "2026-08-01T00:00" } });
    fireEvent.click(screen.getByRole("button", { name: /crear código/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("b1", expect.objectContaining({ code: "VERANO", value: 20 })));
    expect(onChange).toHaveBeenCalled();
  });

  it("admin_sucursal NO ve la opción de alcance cadena", () => {
    mockAuth("admin_sucursal");
    render(<DiscountsManager branch={branch()} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/alcance/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/DiscountsManager.test.tsx`
Expected: FAIL (stub).

- [ ] **Step 3: Implementar `DiscountsManager`**

Reemplazar `web/src/components/admin/DiscountsManager.tsx`:
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { createDiscount, deleteDiscount } from "../../api/ownerClient.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { OwnerBranchDetail, DiscountInput } from "../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function DiscountsManager({ branch, onChange }: { branch: OwnerBranchDetail; onChange: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canChain = user?.role !== "admin_sucursal";
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"branch" | "chain">("branch");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function create() {
    setBusy(true);
    setError(false);
    const input: DiscountInput = {
      code,
      type,
      value: Number(value),
      scope: canChain ? scope : "branch",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    };
    try {
      await createDiscount(branch.id, input);
      setCode(""); setValue(""); setStartsAt(""); setEndsAt("");
      onChange();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(false);
    try {
      await deleteDiscount(branch.id, id);
      onChange();
    } catch {
      setError(true);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.discountsTab")}</h2>

      <ul className="mb-4 space-y-2">
        {branch.discountCodes.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl bg-bg p-2">
            <span className="font-mono font-bold text-ink">{c.code}</span>
            <span className="text-xs text-mute">
              {c.type === "percent" ? `${c.value}%` : `$${c.value}`} · {c.branchId ? t("admin.owner.scopeBranch") : t("admin.owner.scopeChain")}
            </span>
            <button aria-label={t("admin.owner.delete")} onClick={() => remove(c.id)} className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}

      <div className="space-y-2 rounded-xl bg-bg p-3">
        <input aria-label={t("admin.owner.code")} placeholder={t("admin.owner.code")} className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} />
        <div className="flex gap-2">
          <select aria-label={t("admin.owner.type")} className={inputCls} value={type} onChange={(e) => setType(e.target.value as "percent" | "amount")}>
            <option value="percent">%</option>
            <option value="amount">$</option>
          </select>
          <input aria-label={t("admin.owner.value")} placeholder={t("admin.owner.value")} type="number" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        {canChain && (
          <select aria-label={t("admin.owner.scope")} className={inputCls} value={scope} onChange={(e) => setScope(e.target.value as "branch" | "chain")}>
            <option value="branch">{t("admin.owner.scopeBranch")}</option>
            <option value="chain">{t("admin.owner.scopeChain")}</option>
          </select>
        )}
        <div className="flex gap-2">
          <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.from")}
            <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.to")}
            <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <button onClick={create} disabled={busy || !code || !value || !startsAt || !endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {t("admin.owner.createCode")}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Claves i18n**

En `admin.owner` (es): `"code": "Código", "type": "Tipo", "value": "Valor", "scope": "Alcance", "scopeBranch": "Este local", "scopeChain": "Toda la cadena", "createCode": "Crear código"`. Replicar en en (`Code/Type/Value/Scope/This branch/Whole chain/Create code`) y pt (`Código/Tipo/Valor/Alcance/Este local/Toda a rede/Criar código`). JSON válido.

- [ ] **Step 5: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/DiscountsManager.test.tsx` → PASS (2 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/admin/DiscountsManager.tsx web/src/i18n web/src/tests/DiscountsManager.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): manager de códigos de descuento (sucursal y cadena)"
```

---

## Task 6: Crear sucursal + solicitud de anuncio

**Files:**
- Create: `web/src/pages/admin/CreateBranchPage.tsx`
- Create: `web/src/components/admin/AdRequestModal.tsx`
- Modify: `web/src/pages/admin/OwnerBranchesPage.tsx` (botón "crear sucursal" para admin_general)
- Modify: `web/src/pages/admin/BranchEditorPage.tsx` (botón "solicitar anuncio" en la pestaña Datos)
- Modify: `web/src/App.tsx` (ruta `/admin/branches/new`)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/CreateBranchPage.test.tsx`

**Interfaces:**
- Consumes: `createBranch`, `LimitError`, `listBranches` (para obtener `businessId`), `MapPicker`, `ImageUploader`, `useAuth`, `requestAd`.
- Produces: `CreateBranchPage` (form + MapPicker; al exceder → mensaje + `UpgradeRequestModal`); `AdRequestModal({ businessId, branchId, onClose })`; botón "crear sucursal" visible solo para `admin_general`/`superadmin`; botón "solicitar anuncio" en el editor.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/CreateBranchPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { CreateBranchPage } from "../pages/admin/CreateBranchPage.js";
import * as owner from "../api/ownerClient.js";

const summaries = [{ id: "b1", name: "L", category: "cafe", address: "x", active: true, closedUntil: null, imageUrl: null, businessId: "biz", businessName: "G", plan: { maxPromos: 1, maxMenuItems: 10, maxBranches: 5 }, counts: { menuItems: 0, promotions: 0 } }];

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(owner, "listBranches").mockResolvedValue(summaries as never);
});

describe("CreateBranchPage", () => {
  it("crea una sucursal en el business del dueño", async () => {
    const create = vi.spyOn(owner, "createBranch").mockResolvedValue({ id: "bNew" } as never);
    render(
      <MemoryRouter>
        <CreateBranchPage />
      </MemoryRouter>
    );
    await screen.findByLabelText(/nombre/i);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Nueva" } });
    fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: "Calle 1" } });
    fireEvent.click(screen.getByRole("button", { name: /crear sucursal/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ businessId: "biz", name: "Nueva", address: "Calle 1" }))
    );
  });

  it("muestra solicitar upgrade si excede el límite", async () => {
    vi.spyOn(owner, "createBranch").mockRejectedValue(new owner.LimitError("plan_limit_branches"));
    render(
      <MemoryRouter>
        <CreateBranchPage />
      </MemoryRouter>
    );
    await screen.findByLabelText(/nombre/i);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "N" } });
    fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: "C" } });
    fireEvent.click(screen.getByRole("button", { name: /crear sucursal/i }));
    await waitFor(() => expect(screen.getByText(/límite/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/CreateBranchPage.test.tsx`
Expected: FAIL (no existe la página).

- [ ] **Step 3: Implementar `CreateBranchPage`**

Crear `web/src/pages/admin/CreateBranchPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { listBranches, createBranch, LimitError } from "../../api/ownerClient.js";
import type { Category } from "../../api/ownerTypes.js";
import { MapPicker } from "../../components/admin/MapPicker.js";
import { ImageUploader } from "../../components/admin/ImageUploader.js";
import { UpgradeRequestModal } from "../../components/admin/UpgradeRequestModal.js";

const CATEGORIES: Category[] = ["bar", "pub", "restaurant", "cafe"];
const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";
const SANTIAGO = { lat: -33.4378, lng: -70.6504 };

export function CreateBranchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [address, setAddress] = useState("");
  const [pos, setPos] = useState(SANTIAGO);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [overLimit, setOverLimit] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listBranches().then((bs) => {
      if (bs[0]) setBusinessId(bs[0].businessId);
    });
  }, []);

  async function submit() {
    if (!businessId) return;
    setBusy(true);
    setError(false);
    setOverLimit(false);
    try {
      const { id } = await createBranch({ businessId, name, category, address, lat: pos.lat, lng: pos.lng, imageUrl });
      navigate(`/admin/branches/${id}`);
    } catch (e) {
      if (e instanceof LimitError) setOverLimit(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link to="/admin/branches" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        <ArrowLeft size={16} strokeWidth={2.5} /> {t("admin.owner.myBranches")}
      </Link>
      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
        <h1 className="mb-3 font-display text-lg font-extrabold text-ink">{t("admin.owner.newBranch")}</h1>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.name")}</label>
            <input aria-label={t("admin.owner.name")} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.category")}</label>
            <select aria-label={t("admin.owner.category")} className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.address")}</label>
            <input aria-label={t("admin.owner.address")} className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <ImageUploader value={imageUrl} onChange={setImageUrl} label={t("admin.owner.image")} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.location")}</label>
            <MapPicker lat={pos.lat} lng={pos.lng} onChange={(lat, lng) => setPos({ lat, lng })} />
          </div>
          {error && <p className="text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}
          {overLimit && businessId ? (
            <div className="rounded-xl bg-brand-soft p-3 text-center">
              <p className="mb-2 text-sm font-semibold text-brand-dark">{t("admin.owner.limitReached")}</p>
              <UpgradeInline businessId={businessId} />
            </div>
          ) : (
            <button onClick={submit} disabled={busy || !name || !address || !businessId} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t("admin.owner.createBranch")}
            </button>
          )}
        </div>
      </section>
    </div>
  );

  // helper local para abrir el modal de upgrade desde el bloque de límite
  function UpgradeInline({ businessId }: { businessId: string }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          {t("admin.owner.requestUpgrade")}
        </button>
        {open && <UpgradeRequestModal businessId={businessId} onClose={() => setOpen(false)} />}
      </>
    );
  }
}
```
Nota: `UpgradeInline` está declarado como función interna del componente para acceder a `t`; React permite esto pero re-crea la función en cada render — es aceptable aquí (componente pequeño). Alternativamente el implementador puede extraerlo a un componente de módulo recibiendo `t`/`businessId` por props si prefiere; ambas formas son válidas.

- [ ] **Step 4: Implementar `AdRequestModal`**

Crear `web/src/components/admin/AdRequestModal.tsx`:
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { requestAd } from "../../api/ownerClient.js";

export function AdRequestModal({ businessId, branchId, onClose }: { businessId: string; branchId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [wantsPopup, setWantsPopup] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await requestAd({ businessId, branchId, desiredStartsAt: new Date(startsAt).toISOString(), desiredEndsAt: new Date(endsAt).toISOString(), wantsPopup, note: note || null });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">{t("admin.owner.requestAd")}</h3>
          <button aria-label={t("item.close")} onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-bg text-mute"><X size={16} /></button>
        </div>
        {done ? (
          <p className="text-sm text-open">{t("admin.owner.requestSent")}</p>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-mute">{t("admin.owner.from")}
              <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-mute">{t("admin.owner.to")}
              <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={wantsPopup} onChange={(e) => setWantsPopup(e.target.checked)} />
              {t("admin.owner.wantsPopup")}
            </label>
            <textarea aria-label={t("admin.owner.note")} placeholder={t("admin.owner.note")} className={`${inputCls} resize-none`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={submit} disabled={busy || !startsAt || !endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">{t("admin.owner.send")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Botón "crear sucursal" en `OwnerBranchesPage` y "solicitar anuncio" en el editor**

En `web/src/pages/admin/OwnerBranchesPage.tsx`, importar `useAuth` y `Link` (Link ya está). Tras el `<h1>` "Mis locales", agregar (solo para roles que pueden crear):
```tsx
{user?.role !== "admin_sucursal" && (
  <Link to="/admin/branches/new" className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
    + {t("admin.owner.newBranch")}
  </Link>
)}
```
(Agregar `const { user } = useAuth();` y el import `import { useAuth } from "../../auth/AuthContext.js";`.)

En `web/src/pages/admin/BranchEditorPage.tsx`, en la pestaña "Datos" (al final del bloque `tab === "data"`), agregar un botón que abre `AdRequestModal`:
```tsx
<button onClick={() => setShowAd(true)} className="mt-2 rounded-xl bg-bg px-3 py-2 text-sm font-bold text-ink ring-1 ring-line">
  {t("admin.owner.requestAd")}
</button>
{showAd && <AdRequestModal businessId={branch.businessId} branchId={branch.id} onClose={() => setShowAd(false)} />}
```
Agregar `const [showAd, setShowAd] = useState(false);` y `import { AdRequestModal } from "../../components/admin/AdRequestModal.js";`.

- [ ] **Step 6: Ruta `/admin/branches/new` en `App.tsx`**

En `web/src/App.tsx`, importar `CreateBranchPage` y agregar la ruta DENTRO del `<Routes>` anidado, ANTES de `branches/:id` (para que `new` no sea capturado por `:id`):
```tsx
<Route path="branches/new" element={<CreateBranchPage />} />
<Route path="branches/:id" element={<BranchEditorPage />} />
```

- [ ] **Step 7: Claves i18n**

En `admin.owner` (es): `"newBranch": "Crear sucursal", "createBranch": "Crear sucursal", "requestAd": "Solicitar anuncio", "wantsPopup": "Quiero popup (costo adicional)"`. Replicar en en (`New branch/Create branch/Request ad/I want a popup (extra cost)`) y pt (`Nova filial/Criar filial/Solicitar anúncio/Quero popup (custo adicional)`). JSON válido.

- [ ] **Step 8: Run test, debe pasar; suite + typecheck**

Run: `cd web && npx vitest run src/tests/CreateBranchPage.test.tsx` → PASS (2 tests).
Run: `cd web && npx vitest run` → toda la suite verde (reportar conteo).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 9: Commit**

```bash
git add web/src/pages/admin/CreateBranchPage.tsx web/src/components/admin/AdRequestModal.tsx web/src/pages/admin/OwnerBranchesPage.tsx web/src/pages/admin/BranchEditorPage.tsx web/src/App.tsx web/src/i18n web/src/tests/CreateBranchPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): crear sucursal con límite y solicitud de anuncio"
```

---

## Task 7: Discovery público — cupones y "cerrado temporalmente"

**Files:**
- Modify: `web/src/api/types.ts`
- Modify: `web/src/pages/BranchDetailPage.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/BranchDetailPage.coupons.test.tsx`

**Interfaces:**
- Consumes: `getBranch` (que ya devuelve `closedUntil` y `discountCodes` desde capa 2A).
- Produces: `BranchDetail` + `closedUntil: string | null` y `discountCodes: PublicDiscountCode[]`; la ficha muestra un banner "cerrado temporalmente" si `closedUntil` es futuro, y una sección de cupones (en la pestaña Carta) con código + valor + vigencia.

- [ ] **Step 1: Extender el tipo**

En `web/src/api/types.ts`, agregar el tipo y los campos a `BranchDetail`:
```ts
export interface PublicDiscountCode {
  id: string;
  code: string;
  type: "percent" | "amount";
  value: string;
  startsAt: string;
  endsAt: string;
  branchId: string | null;
}
```
Y en `interface BranchDetail`, agregar:
```ts
  closedUntil: string | null;
  discountCodes: PublicDiscountCode[];
```

- [ ] **Step 2: Escribir el test (falla primero)**

Crear `web/src/tests/BranchDetailPage.coupons.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { BranchDetailPage } from "../pages/BranchDetailPage.js";
import * as client from "../api/client.js";
import type { BranchDetail } from "../api/types.js";

function detail(over: Partial<BranchDetail> = {}): BranchDetail {
  return {
    id: "b1", name: "Café Central", category: "cafe", address: "Plaza 1", lat: -33.4, lng: -70.6,
    phone: null, description: "Rico", imageUrl: null, ratingAvg: 4.5, ratingCount: 10,
    hours: [], menuItems: [], promotions: [], purposes: [], reviews: [],
    closedUntil: null, discountCodes: [],
    ...over,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/branch/b1"]}>
      <Routes>
        <Route path="/branch/:id" element={<BranchDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BranchDetailPage — cupones y cierre", () => {
  it("muestra el banner de cerrado temporalmente", async () => {
    vi.spyOn(client, "getBranch").mockResolvedValue(detail({ closedUntil: new Date(Date.now() + 3600_000).toISOString() }));
    renderPage();
    expect(await screen.findByText(/cerrado temporalmente/i)).toBeInTheDocument();
  });

  it("muestra los cupones vigentes", async () => {
    vi.spyOn(client, "getBranch").mockResolvedValue(detail({ discountCodes: [{ id: "d1", code: "VERANO20", type: "percent", value: "20", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", branchId: "b1" }] }));
    renderPage();
    expect(await screen.findByText("VERANO20")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/BranchDetailPage.coupons.test.tsx`
Expected: FAIL (no se renderizan banner ni cupones; o error de tipo si faltan campos).

- [ ] **Step 4: Renderizar banner de cierre + cupones**

En `web/src/pages/BranchDetailPage.tsx`:
1. Tras el cierre del `<div>` del hero (la línea `</div>` que cierra el bloque `relative h-60 ...`), antes del `{/* Sheet de contenido */}`, insertar el banner:
```tsx
{branch.closedUntil && new Date(branch.closedUntil) > new Date() && (
  <div className="bg-brand-soft px-4 py-2 text-center text-sm font-semibold text-brand-dark">
    {t("branch.closedTemporarily")}
  </div>
)}
```
2. En la pestaña Carta (`tab === "menu"`), tras el bloque de "Promociones destacadas" y antes de la "Carta agrupada", insertar la sección de cupones:
```tsx
{branch.discountCodes.length > 0 && (
  <section className="mb-6">
    <h2 className="mb-2 font-display text-base font-bold text-ink">{t("branch.coupons")}</h2>
    <ul className="space-y-2">
      {branch.discountCodes.map((c) => (
        <li key={c.id} className="flex items-center justify-between rounded-2xl border border-dashed border-brand/40 bg-brand-soft px-3 py-2">
          <span className="font-mono font-extrabold tracking-wide text-brand-dark">{c.code}</span>
          <span className="text-sm font-semibold text-ink">
            {c.type === "percent" ? `${c.value}% ` : `$${c.value} `}{t("branch.couponOff")}
          </span>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 5: Claves i18n**

En `web/src/i18n/es.json` dentro de `branch`: `"closedTemporarily": "Cerrado temporalmente", "coupons": "Cupones", "couponOff": "de descuento"`. Replicar en en (`Temporarily closed/Coupons/off`) y pt (`Fechado temporariamente/Cupons/de desconto`). JSON válido.

- [ ] **Step 6: Run test, debe pasar; suite + typecheck + build**

Run: `cd web && npx vitest run src/tests/BranchDetailPage.coupons.test.tsx` → PASS (2 tests).
Run: `cd web && npx vitest run` → toda la suite verde (reportar conteo).
Run: `cd web && npx tsc -b --noEmit` → sin errores.
Run: `cd web && npm run build` → build OK.

- [ ] **Step 7: Commit**

```bash
git add web/src/api/types.ts web/src/pages/BranchDetailPage.tsx web/src/i18n web/src/tests/BranchDetailPage.coupons.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): cupones y aviso de cierre temporal en la ficha pública"
```

---

## Verificación final de la capa 2C

- `cd web && npx vitest run` → toda la suite web verde.
- `cd web && npx tsc -b --noEmit` y `cd web && npm run build` → sin errores.
- **Flujo manual** (login `owner@demo.cl`/`owner12345`): abrir un local → pestaña **Menú**: agregar/eliminar ítems, ver el contador `n/max`; **Promos**: agregar una promo (aparece en la ficha pública); **Descuentos**: crear un cupón (aparece en la ficha pública en la sección Cupones); botón **crear sucursal** (con MapPicker); **solicitar anuncio** desde el editor; marcar un local cerrado temporal → la ficha pública muestra el banner. Para ver el bloqueo de límite + "solicitar upgrade", asignar el plan Free al business demo (o crear ítems hasta topar).

## Self-review (cobertura, capa 2C)

- Cliente API menú/promos/descuentos/crear-sucursal/solicitudes → Task 1. ✓
- Pestañas en el editor → Task 2. ✓
- Manager de menú con límite + solicitar upgrade → Task 3. ✓
- Manager de promociones con límite → Task 4. ✓
- Manager de descuentos (sucursal/cadena) → Task 5. ✓
- Crear sucursal (límite) + solicitud de anuncio → Task 6. ✓
- Discovery: cupones + cierre temporal en la ficha → Task 7. ✓
- Con esto el **panel del dueño queda completo**. Sigue **capa 3** (panel superadmin: vista jerárquica empresa→locales, crear empresas/cuentas/planes, bandejas de solicitudes para aprobar/rechazar, CRUD de anuncios + `GET /ads`/popup + AdSection/AdPopup en el discovery).
- Follow-up de 2B aplicable: lazy-load de `MapPicker`/leaflet para bajar el bundle (se puede hacer en 2C o 3).
