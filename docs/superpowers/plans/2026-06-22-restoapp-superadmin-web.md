# RestoApp Capa 3B — Frontend del panel superadmin + anuncios en discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el panel web del superadmin (vista jerárquica empresa→sucursales, crear empresas/cuentas/sucursales, asignar plan, bandejas de solicitudes de upgrade y de anuncio con aprobar/rechazar, CRUD de anuncios) y mostrar los anuncios en el discovery público (`AdSection` en la home + `AdPopup` una vez por sesión).

**Architecture:** Sobre la base de auth/admin de capas 2B/2C. Un cliente `saClient.ts` envuelve los endpoints `/admin/superadmin/*` (vía `authedFetch`) y el cliente público suma `getAds`/`getPopupAd`. El `AdminLayout` muestra navegación distinta según rol: superadmin ve Empresas/Anuncios/Solicitudes; dueño ve Mis locales. Las pantallas superadmin viven bajo `/admin/superadmin/*` protegidas por `RequireRole roles={["superadmin"]}`. El discovery público suma `AdSection` (carrusel en la home, consume `GET /ads`) y `AdPopup` (modal una vez por sesión con `sessionStorage`, consume `GET /ads/popup`).

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind v4, react-router-dom 6, react-i18next 15, Vitest 2 + @testing-library/react 16 (jsdom, globals, jest-dom). Backend capa 3A ya en `main`.

## Global Constraints

- Commits: autor **ribarahonaa <ribarahonaa@gmail.com>**, fijado **por commit**: `git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "..."`. **NO** `Co-Authored-By` ni referencia a Claude. Verificar `git log -1 --pretty='%ae'` = `ribarahonaa@gmail.com` tras cada commit.
- TypeScript ESM: imports relativos con `.js`. Tests web en HOST: `cd web && npx vitest run <archivo>`; typecheck `cd web && npx tsc -b --noEmit`.
- Tokens Tailwind: `bg/surface/line/ink/mute/brand/brand-dark/brand-soft/open/promo`. Input/botón/card patterns como en capas 2B/2C. Modal: overlay `fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 sm:items-center` (sobre el mapa).
- Tests: importar `../i18n/index.js` + `i18n.changeLanguage("es")`; `MemoryRouter` para router; `vi.mock`/`vi.spyOn` para `saClient`/`client`/`useAuth`.
- Claves i18n nuevas bajo `admin.sa.*` (panel superadmin) y `ads.*` (discovery), replicadas en es/en/pt (JSON válido).
- Endpoints 3A (ya en `main`, bajo `/admin/superadmin`, requieren rol superadmin): empresas `POST|GET /businesses`, `PATCH /businesses/:id`; cuentas `POST /users`, `POST /businesses/:businessId/branches`, `POST /branch-admins`, `POST /branches/:id/active`; upgrades `GET /upgrade-requests?status=`, `POST /upgrade-requests/:id/approve|reject`; anuncios `POST|GET /ads`, `PATCH|DELETE /ads/:id`; ad-requests `GET /ad-requests?status=`, `POST /ad-requests/:id/approve|reject`. Públicos: `GET /ads?lat&lng` (array), `GET /ads/popup?lat&lng` (`{ ad }`). `listPlans()` ya existe en `ownerClient`.
- `authedFetch(path, init?)` (de `../auth/authClient.js`) antepone `API_URL`, agrega `Authorization`, reintenta una vez ante 401. El cliente público usa `getJson<T>(url)` de `client.ts` (con `API_URL`).
- Cuenta superadmin demo: `admin@restoapp.cl` / `admin12345`.

---

## File Structure

**Frontend (web/):**
- `src/api/saTypes.ts` — crear: DTOs superadmin (SaBusiness, SaUpgradeRequest, SaAdRequest, SaAd, inputs).
- `src/api/saClient.ts` — crear: wrappers superadmin sobre `authedFetch`.
- `src/api/types.ts` — modificar: `PublicAd` type.
- `src/api/client.ts` — modificar: `getAds(lat,lng)`, `getPopupAd(lat,lng)`.
- `src/components/admin/AdminLayout.tsx` — modificar: navegación según rol.
- `src/pages/admin/sa/SaBusinessesPage.tsx` — crear (lista jerárquica + crear empresa + editar/plan + crear sucursal/cuenta/asignar).
- `src/pages/admin/sa/SaRequestsPage.tsx` — crear (upgrades + ad-requests).
- `src/pages/admin/sa/SaAdsPage.tsx` — crear (CRUD anuncios + crear desde ad-request).
- `src/components/AdSection.tsx`, `src/components/AdPopup.tsx` — crear.
- `src/pages/HomePage.tsx` — modificar: montar `AdSection` + `AdPopup`.
- `src/App.tsx` — modificar: rutas `/admin/superadmin/*`.
- `src/i18n/{es,en,pt}.json` — modificar: `admin.sa.*`, `ads.*`.
- Tests: `saClient.test.ts`, `SaBusinessesPage.test.tsx`, `SaRequestsPage.test.tsx`, `SaAdsPage.test.tsx`, `AdPopup.test.tsx`.

---

## Task 1: Cliente superadmin + cliente público de anuncios

**Files:**
- Create: `web/src/api/saTypes.ts`
- Create: `web/src/api/saClient.ts`
- Modify: `web/src/api/types.ts`
- Modify: `web/src/api/client.ts`
- Test: `web/src/tests/saClient.test.ts`

**Interfaces:**
- `saClient.ts` (sobre `authedFetch`): `listBusinesses()`, `createBusiness(input)`, `updateBusiness(id, {name?,planId?})`, `createUser(input)`, `createSaBranch(businessId, input)`, `assignBranchAdmin(userId, branchId)`, `setSaBranchActive(branchId, active)`, `listUpgradeRequests(status?)`, `approveUpgrade(id)`, `rejectUpgrade(id)`, `listAds()`, `createAd(input)`, `updateAd(id, input)`, `deleteAd(id)`, `listAdRequests(status?)`, `approveAdRequest(id)`, `rejectAdRequest(id)`.
- `client.ts`: `getAds(lat,lng): Promise<PublicAd[]>`, `getPopupAd(lat,lng): Promise<PublicAd | null>`.
- Tipos en `saTypes.ts` y `PublicAd` en `types.ts`.

- [ ] **Step 1: Definir tipos**

Crear `web/src/api/saTypes.ts`:
```ts
import type { Category } from "./types.js";

export interface SaPlan { id: string; name: string; maxBranches: number; maxPromos: number; maxMenuItems: number; }
export interface SaBusiness {
  id: string; name: string;
  plan: SaPlan | null;
  owner: { id: string; email: string; name: string };
  branches: { id: string; name: string; category: Category; active: boolean }[];
}
export interface CreateBusinessInput { businessName: string; ownerEmail: string; ownerName: string; ownerPassword: string; planId?: string; }
export interface CreateUserInput { email: string; name: string; password: string; role: "admin_general" | "admin_sucursal"; }
export interface SaBranchInput { name: string; category: Category; address: string; lat: number; lng: number; phone?: string | null; description?: string | null; imageUrl?: string | null; planId?: string | null; }

export interface SaUpgradeRequest {
  id: string; status: "pending" | "approved" | "rejected"; note: string | null; createdAt: string;
  business: { id: string; name: string };
  requestedPlan: { id: string; name: string; maxBranches: number };
}
export interface SaAdRequest {
  id: string; status: "pending" | "approved" | "rejected"; note: string | null; createdAt: string;
  businessId: string; branchId: string | null; desiredStartsAt: string; desiredEndsAt: string; wantsPopup: boolean;
  business: { id: string; name: string };
}
export interface SaAd {
  id: string; businessId: string; branchId: string | null; title: string; description: string | null;
  imageUrl: string | null; placement: "section" | "popup"; startsAt: string; endsAt: string; active: boolean;
  business?: { id: string; name: string };
}
export interface AdInput {
  businessId: string; branchId?: string | null; title: string; description?: string | null;
  imageUrl?: string | null; placement: "section" | "popup"; startsAt: string; endsAt: string; active?: boolean;
}
```

- [ ] **Step 2: Agregar `PublicAd` a types.ts**

En `web/src/api/types.ts`, agregar:
```ts
export interface PublicAd {
  id: string;
  businessId: string;
  branchId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  distance: number | null;
}
```

- [ ] **Step 3: Escribir el test (falla primero)**

Crear `web/src/tests/saClient.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as auth from "../auth/authClient.js";
import * as sa from "../api/saClient.js";

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("saClient", () => {
  it("listBusinesses hace GET a /admin/superadmin/businesses", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok([{ id: "b1" }]));
    const out = await sa.listBusinesses();
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/businesses");
    expect(out[0].id).toBe("b1");
  });

  it("createBusiness POST con JSON", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ business: { id: "b" }, owner: { id: "u" } }, 201));
    await sa.createBusiness({ businessName: "X", ownerEmail: "o@d.cl", ownerName: "O", ownerPassword: "clave1234" });
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/businesses", expect.objectContaining({ method: "POST" }));
  });

  it("approveUpgrade POST al endpoint correcto", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(ok({ status: "approved" }));
    await sa.approveUpgrade("r1");
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/upgrade-requests/r1/approve", expect.objectContaining({ method: "POST" }));
  });

  it("deleteAd hace DELETE", async () => {
    const spy = vi.spyOn(auth, "authedFetch").mockResolvedValue(new Response(null, { status: 204 }));
    await sa.deleteAd("a1");
    expect(spy).toHaveBeenCalledWith("/admin/superadmin/ads/a1", expect.objectContaining({ method: "DELETE" }));
  });
});
```

- [ ] **Step 4: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/saClient.test.ts`
Expected: FAIL (no existe saClient).

- [ ] **Step 5: Implementar `saClient.ts`**

Crear `web/src/api/saClient.ts`:
```ts
import { authedFetch } from "../auth/authClient.js";
import type {
  SaBusiness, CreateBusinessInput, CreateUserInput, SaBranchInput,
  SaUpgradeRequest, SaAdRequest, SaAd, AdInput,
} from "./saTypes.js";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return res.json() as Promise<T>;
}
function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
const SA = "/admin/superadmin";

export async function listBusinesses(): Promise<SaBusiness[]> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses`));
}
export async function createBusiness(input: CreateBusinessInput): Promise<{ business: { id: string }; owner: { id: string } }> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses`, jsonInit("POST", input)));
}
export async function updateBusiness(id: string, input: { name?: string; planId?: string | null }): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses/${id}`, jsonInit("PATCH", input)));
}
export async function createUser(input: CreateUserInput): Promise<{ id: string; email: string; name: string; role: string }> {
  return jsonOrThrow(await authedFetch(`${SA}/users`, jsonInit("POST", input)));
}
export async function createSaBranch(businessId: string, input: SaBranchInput): Promise<{ id: string }> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses/${businessId}/branches`, jsonInit("POST", input)));
}
export async function assignBranchAdmin(userId: string, branchId: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/branch-admins`, jsonInit("POST", { userId, branchId })));
}
export async function setSaBranchActive(branchId: string, active: boolean): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/branches/${branchId}/active`, jsonInit("POST", { active })));
}
export async function listUpgradeRequests(status?: string): Promise<SaUpgradeRequest[]> {
  const q = status ? `?status=${status}` : "";
  return jsonOrThrow(await authedFetch(`${SA}/upgrade-requests${q}`));
}
export async function approveUpgrade(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/upgrade-requests/${id}/approve`, { method: "POST" }));
}
export async function rejectUpgrade(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/upgrade-requests/${id}/reject`, { method: "POST" }));
}
export async function listAds(): Promise<SaAd[]> {
  return jsonOrThrow(await authedFetch(`${SA}/ads`));
}
export async function createAd(input: AdInput): Promise<SaAd> {
  return jsonOrThrow(await authedFetch(`${SA}/ads`, jsonInit("POST", input)));
}
export async function updateAd(id: string, input: Partial<AdInput>): Promise<SaAd> {
  return jsonOrThrow(await authedFetch(`${SA}/ads/${id}`, jsonInit("PATCH", input)));
}
export async function deleteAd(id: string): Promise<void> {
  const res = await authedFetch(`${SA}/ads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}
export async function listAdRequests(status?: string): Promise<SaAdRequest[]> {
  const q = status ? `?status=${status}` : "";
  return jsonOrThrow(await authedFetch(`${SA}/ad-requests${q}`));
}
export async function approveAdRequest(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/ad-requests/${id}/approve`, { method: "POST" }));
}
export async function rejectAdRequest(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/ad-requests/${id}/reject`, { method: "POST" }));
}
```

- [ ] **Step 6: Agregar `getAds`/`getPopupAd` al cliente público**

En `web/src/api/client.ts`, importar `PublicAd` y agregar (usando el `getJson` y `API_URL` ya presentes):
```ts
import type { /* ...existentes..., */ PublicAd } from "./types.js";
// ...
export function getAds(lat: number, lng: number): Promise<PublicAd[]> {
  return getJson<PublicAd[]>(`${API_URL}/ads?lat=${lat}&lng=${lng}`);
}
export async function getPopupAd(lat: number, lng: number): Promise<PublicAd | null> {
  const { ad } = await getJson<{ ad: PublicAd | null }>(`${API_URL}/ads/popup?lat=${lat}&lng=${lng}`);
  return ad;
}
```
(Fusionar el import de `PublicAd` con el import de tipos ya existente; no duplicar.)

- [ ] **Step 7: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/saClient.test.ts` → PASS (4 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 8: Commit**

```bash
git add web/src/api/saTypes.ts web/src/api/saClient.ts web/src/api/types.ts web/src/api/client.ts web/src/tests/saClient.test.ts
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): cliente API superadmin y de anuncios públicos"
```

---

## Task 2: Navegación por rol + página de empresas (jerárquica)

**Files:**
- Modify: `web/src/components/admin/AdminLayout.tsx`
- Create: `web/src/pages/admin/sa/SaBusinessesPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/SaBusinessesPage.test.tsx`

**Interfaces:**
- `AdminLayout` muestra links según `user.role`: superadmin → Empresas (`/admin/superadmin/businesses`), Anuncios (`/admin/superadmin/ads`), Solicitudes (`/admin/superadmin/requests`); admin_general/admin_sucursal → Mis locales (`/admin/branches`).
- `SaBusinessesPage`: lista jerárquica (cada empresa = card con dueño + plan + sus sucursales); botón "crear empresa" (modal con form); por empresa: editar nombre/plan, "+ sucursal", "+ cuenta". Usa `saClient` + `listPlans`.
- Rutas `/admin/superadmin/businesses|ads|requests` bajo `RequireRole roles={["superadmin"]}`.

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `web/src/tests/SaBusinessesPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { SaBusinessesPage } from "../pages/admin/sa/SaBusinessesPage.js";
import * as sa from "../api/saClient.js";
import * as owner from "../api/ownerClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(owner, "listPlans").mockResolvedValue([{ id: "p1", name: "Free", maxBranches: 1, maxPromos: 1, maxMenuItems: 10 }] as never);
});

const data = [
  { id: "biz1", name: "Grupo Demo", plan: { id: "p1", name: "Pro", maxBranches: 5, maxPromos: 100, maxMenuItems: 500 }, owner: { id: "u1", email: "o@d.cl", name: "Dueño" }, branches: [{ id: "br1", name: "Local Centro", category: "cafe", active: true }] },
];

describe("SaBusinessesPage", () => {
  it("muestra empresas con su dueño y sucursales", async () => {
    vi.spyOn(sa, "listBusinesses").mockResolvedValue(data as never);
    render(<MemoryRouter><SaBusinessesPage /></MemoryRouter>);
    expect(await screen.findByText("Grupo Demo")).toBeInTheDocument();
    expect(screen.getByText(/o@d\.cl/)).toBeInTheDocument();
    expect(screen.getByText("Local Centro")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/SaBusinessesPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Navegación por rol en `AdminLayout`**

En `web/src/components/admin/AdminLayout.tsx`, agregar nav según rol. Tras el link del título (o junto a él), insertar una barra de navegación:
```tsx
{user?.role === "superadmin" ? (
  <nav className="flex items-center gap-3 text-sm font-semibold">
    <Link to="/admin/superadmin/businesses" className="text-ink hover:text-brand">{t("admin.sa.businesses")}</Link>
    <Link to="/admin/superadmin/ads" className="text-ink hover:text-brand">{t("admin.sa.ads")}</Link>
    <Link to="/admin/superadmin/requests" className="text-ink hover:text-brand">{t("admin.sa.requests")}</Link>
  </nav>
) : (
  <nav className="flex items-center gap-3 text-sm font-semibold">
    <Link to="/admin/branches" className="text-ink hover:text-brand">{t("admin.owner.myBranches")}</Link>
  </nav>
)}
```
(Ubicar la nav en el header existente, entre el título y el bloque de usuario/logout. Mantener `useAuth`/`useTranslation` ya presentes.)

- [ ] **Step 4: Implementar `SaBusinessesPage`**

Crear `web/src/pages/admin/sa/SaBusinessesPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Store, Plus } from "lucide-react";
import { listBusinesses, createBusiness, updateBusiness } from "../../../api/saClient.js";
import { listPlans } from "../../../api/ownerClient.js";
import type { SaBusiness } from "../../../api/saTypes.js";
import type { PlanInfo } from "../../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function SaBusinessesPage() {
  const { t } = useTranslation();
  const [businesses, setBusinesses] = useState<SaBusiness[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);

  const load = () => listBusinesses().then(setBusinesses).catch(() => setError(true));
  useEffect(() => {
    load();
    listPlans().then(setPlans).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-extrabold text-ink">{t("admin.sa.businesses")}</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} /> {t("admin.sa.newBusiness")}
        </button>
      </div>
      {error && <p className="mb-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{t("errors.loadFailed")}</p>}

      <ul className="space-y-3">
        {businesses.map((b) => (
          <li key={b.id} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <Store size={16} className="text-brand" /> {b.name}
                </h2>
                <p className="text-xs text-mute">{b.owner.name} · {b.owner.email}</p>
              </div>
              <PlanSelect business={b} plans={plans} onChange={load} />
            </div>
            <ul className="mt-3 space-y-1 border-t border-line pt-2">
              {b.branches.length === 0 && <li className="text-xs text-mute">{t("admin.sa.noBranches")}</li>}
              {b.branches.map((br) => (
                <li key={br.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{br.name} <span className="text-xs text-mute">· {t(`categories.${br.category}`)}</span></span>
                  {!br.active && <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold text-mute">{t("admin.owner.inactive")}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {creating && <CreateBusinessModal plans={plans} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );

  function PlanSelect({ business, plans, onChange }: { business: SaBusiness; plans: PlanInfo[]; onChange: () => void }) {
    return (
      <select
        aria-label={t("admin.owner.plan")}
        className="shrink-0 rounded-lg bg-bg px-2 py-1 text-xs font-semibold text-ink ring-1 ring-line"
        value={business.plan?.id ?? ""}
        onChange={(e) => updateBusiness(business.id, { planId: e.target.value || null }).then(onChange)}
      >
        <option value="">{t("admin.sa.noPlan")}</option>
        {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    );
  }

  function CreateBusinessModal({ plans, onClose, onCreated }: { plans: PlanInfo[]; onClose: () => void; onCreated: () => void }) {
    const [f, setF] = useState({ businessName: "", ownerName: "", ownerEmail: "", ownerPassword: "", planId: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(false);
    async function submit() {
      setBusy(true); setErr(false);
      try {
        await createBusiness({ businessName: f.businessName, ownerName: f.ownerName, ownerEmail: f.ownerEmail, ownerPassword: f.ownerPassword, planId: f.planId || undefined });
        onCreated();
      } catch { setErr(true); } finally { setBusy(false); }
    }
    return (
      <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
        <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 font-display text-lg font-bold text-ink">{t("admin.sa.newBusiness")}</h3>
          <div className="space-y-2">
            <input aria-label={t("admin.sa.businessName")} placeholder={t("admin.sa.businessName")} className={inputCls} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} />
            <input aria-label={t("admin.sa.ownerName")} placeholder={t("admin.sa.ownerName")} className={inputCls} value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} />
            <input aria-label={t("admin.sa.ownerEmail")} placeholder={t("admin.sa.ownerEmail")} className={inputCls} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} />
            <input aria-label={t("admin.sa.ownerPassword")} type="password" placeholder={t("admin.sa.ownerPassword")} className={inputCls} value={f.ownerPassword} onChange={(e) => setF({ ...f, ownerPassword: e.target.value })} />
            <select aria-label={t("admin.owner.plan")} className={inputCls} value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>
              <option value="">{t("admin.sa.noPlan")}</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {err && <p className="text-xs text-brand-dark">{t("admin.sa.createError")}</p>}
            <button onClick={submit} disabled={busy || !f.businessName || !f.ownerEmail || f.ownerPassword.length < 8} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t("admin.sa.create")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 5: Rutas + i18n**

En `web/src/App.tsx`, dentro del `<Routes>` anidado de `/admin/*`, agregar (cada una envuelta en `RequireRole roles={["superadmin"]}`):
```tsx
<Route path="superadmin/businesses" element={<RequireRole roles={["superadmin"]}><SaBusinessesPage /></RequireRole>} />
<Route path="superadmin/ads" element={<RequireRole roles={["superadmin"]}><SaAdsPage /></RequireRole>} />
<Route path="superadmin/requests" element={<RequireRole roles={["superadmin"]}><SaRequestsPage /></RequireRole>} />
```
Importar las tres páginas. `SaAdsPage` y `SaRequestsPage` se crean en Tasks 5 y 4 — crear stubs mínimos ahora (`export function SaAdsPage(){return null;}` y `SaRequestsPage`) para que App.tsx compile; se completan después.
En `web/src/i18n/es.json`, agregar el objeto `admin.sa` (hermano de `admin.owner`):
```json
    "sa": {
      "businesses": "Empresas", "ads": "Anuncios", "requests": "Solicitudes",
      "newBusiness": "Crear empresa", "businessName": "Nombre de la empresa",
      "ownerName": "Nombre del dueño", "ownerEmail": "Correo del dueño", "ownerPassword": "Contraseña (mín. 8)",
      "noPlan": "Sin plan", "noBranches": "Sin sucursales", "create": "Crear", "createError": "No se pudo crear"
    }
```
Replicar en en.json y pt.json (traducciones equivalentes). JSON válido.

- [ ] **Step 6: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/SaBusinessesPage.test.tsx` → PASS.
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/admin/AdminLayout.tsx web/src/pages/admin/sa web/src/App.tsx web/src/i18n web/src/tests/SaBusinessesPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): navegación por rol y vista jerárquica de empresas (superadmin)"
```

---

## Task 3: Crear sucursal y cuenta desde una empresa (superadmin)

**Files:**
- Modify: `web/src/pages/admin/sa/SaBusinessesPage.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: actualizar `web/src/tests/SaBusinessesPage.test.tsx`

**Interfaces:**
- Por cada empresa, botones "+ sucursal" (modal: name/category/address/lat/lng — sin mapa para simplicidad, inputs numéricos lat/lng) → `createSaBranch`; y "+ cuenta" (modal: email/name/password/role) → `createUser`, y si role=admin_sucursal mostrar un select de sucursal de la empresa → `assignBranchAdmin`. Tras crear, recargar.

- [ ] **Step 1: Test (falla primero)**

Agregar a `web/src/tests/SaBusinessesPage.test.tsx`:
```tsx
import { fireEvent } from "@testing-library/react";

it("crea una sucursal en la empresa", async () => {
  vi.spyOn(sa, "listBusinesses").mockResolvedValue(data as never);
  const create = vi.spyOn(sa, "createSaBranch").mockResolvedValue({ id: "brNew" } as never);
  render(<MemoryRouter><SaBusinessesPage /></MemoryRouter>);
  await screen.findByText("Grupo Demo");
  fireEvent.click(screen.getByRole("button", { name: /\+ sucursal/i }));
  fireEvent.change(screen.getByLabelText(/nombre de la sucursal/i), { target: { value: "Suc Nueva" } });
  fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: "Calle 1" } });
  fireEvent.click(screen.getByRole("button", { name: /^crear sucursal$/i }));
  await waitFor(() => expect(create).toHaveBeenCalledWith("biz1", expect.objectContaining({ name: "Suc Nueva" })));
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/SaBusinessesPage.test.tsx`
Expected: FAIL (no hay botón "+ sucursal").

- [ ] **Step 3: Implementar los modales y botones**

En `SaBusinessesPage.tsx`, en cada `<li>` de empresa, junto a `PlanSelect`, agregar botones que abren modales por empresa. Manejar el estado del modal abierto con `const [branchFor, setBranchFor] = useState<string | null>(null)` y `const [userFor, setUserFor] = useState<SaBusiness | null>(null)` a nivel de la página. Agregar los botones:
```tsx
<div className="flex shrink-0 gap-2">
  <button onClick={() => setBranchFor(b.id)} className="rounded-lg bg-bg px-2 py-1 text-xs font-bold text-ink ring-1 ring-line">{t("admin.sa.addBranch")}</button>
  <button onClick={() => setUserFor(b)} className="rounded-lg bg-bg px-2 py-1 text-xs font-bold text-ink ring-1 ring-line">{t("admin.sa.addAccount")}</button>
</div>
```
Y al final del componente, los modales:
```tsx
{branchFor && <BranchModal businessId={branchFor} onClose={() => setBranchFor(null)} onDone={() => { setBranchFor(null); load(); }} />}
{userFor && <AccountModal business={userFor} onClose={() => setUserFor(null)} onDone={() => { setUserFor(null); load(); }} />}
```
Definir los componentes internos (usan `t`, `inputCls`):
```tsx
function BranchModal({ businessId, onClose, onDone }: { businessId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", category: "cafe", address: "", lat: "-33.45", lng: "-70.66" });
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await createSaBranch(businessId, { name: f.name, category: f.category as never, address: f.address, lat: Number(f.lat), lng: Number(f.lng) });
      onDone();
    } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">{t("admin.sa.addBranch")}</h3>
        <div className="space-y-2">
          <input aria-label={t("admin.sa.branchName")} placeholder={t("admin.sa.branchName")} className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <select aria-label={t("admin.owner.category")} className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {["bar", "pub", "restaurant", "cafe"].map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
          </select>
          <input aria-label={t("admin.owner.address")} placeholder={t("admin.owner.address")} className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <div className="flex gap-2">
            <input aria-label="lat" placeholder="lat" className={inputCls} value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />
            <input aria-label="lng" placeholder="lng" className={inputCls} value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />
          </div>
          <button onClick={submit} disabled={busy || !f.name || !f.address} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">{t("admin.sa.createBranch")}</button>
        </div>
      </div>
    </div>
  );
}

function AccountModal({ business, onClose, onDone }: { business: SaBusiness; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ email: "", name: "", password: "", role: "admin_general" as "admin_general" | "admin_sucursal", branchId: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function submit() {
    setBusy(true); setErr(false);
    try {
      const u = await createUser({ email: f.email, name: f.name, password: f.password, role: f.role });
      if (f.role === "admin_sucursal" && f.branchId) await assignBranchAdmin(u.id, f.branchId);
      onDone();
    } catch { setErr(true); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">{t("admin.sa.addAccount")}</h3>
        <div className="space-y-2">
          <input aria-label={t("admin.sa.ownerName")} placeholder={t("admin.sa.ownerName")} className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input aria-label={t("admin.sa.ownerEmail")} placeholder={t("admin.sa.ownerEmail")} className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input aria-label={t("admin.sa.ownerPassword")} type="password" placeholder={t("admin.sa.ownerPassword")} className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <select aria-label={t("admin.sa.role")} className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as never })}>
            <option value="admin_general">admin_general</option>
            <option value="admin_sucursal">admin_sucursal</option>
          </select>
          {f.role === "admin_sucursal" && (
            <select aria-label={t("admin.sa.branch")} className={inputCls} value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
              <option value="">{t("admin.sa.pickBranch")}</option>
              {business.branches.map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
            </select>
          )}
          {err && <p className="text-xs text-brand-dark">{t("admin.sa.createError")}</p>}
          <button onClick={submit} disabled={busy || !f.email || f.password.length < 8} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">{t("admin.sa.createAccount")}</button>
        </div>
      </div>
    </div>
  );
}
```
Importar `createSaBranch`, `createUser`, `assignBranchAdmin` desde `saClient.js` (junto a los imports existentes).

- [ ] **Step 4: i18n**

En `admin.sa` (es): `"addBranch": "+ Sucursal", "addAccount": "+ Cuenta", "branchName": "Nombre de la sucursal", "createBranch": "Crear sucursal", "role": "Rol", "branch": "Sucursal", "pickBranch": "Elegir sucursal", "createAccount": "Crear cuenta"`. Replicar en en/pt. JSON válido.

- [ ] **Step 5: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/SaBusinessesPage.test.tsx` → PASS (2 tests).
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/admin/sa/SaBusinessesPage.tsx web/src/i18n web/src/tests/SaBusinessesPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): superadmin crea sucursales y cuentas desde la empresa"
```

---

## Task 4: Bandeja de solicitudes (upgrades + anuncios)

**Files:**
- Modify: `web/src/pages/admin/sa/SaRequestsPage.tsx` (reemplaza el stub)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/SaRequestsPage.test.tsx`

**Interfaces:**
- `SaRequestsPage`: dos secciones — "Solicitudes de upgrade" (lista pending, cada una con aprobar/rechazar → `approveUpgrade`/`rejectUpgrade`) y "Solicitudes de anuncio" (lista pending, aprobar/rechazar → `approveAdRequest`/`rejectAdRequest`). Tras una acción, recargar.

- [ ] **Step 1: Test (falla primero)**

Crear `web/src/tests/SaRequestsPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { SaRequestsPage } from "../pages/admin/sa/SaRequestsPage.js";
import * as sa from "../api/saClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(sa, "listAdRequests").mockResolvedValue([] as never);
});

describe("SaRequestsPage", () => {
  it("lista y aprueba una solicitud de upgrade", async () => {
    vi.spyOn(sa, "listUpgradeRequests").mockResolvedValue([
      { id: "r1", status: "pending", note: null, createdAt: "x", business: { id: "b1", name: "Grupo Demo" }, requestedPlan: { id: "p", name: "Pro", maxBranches: 5 } },
    ] as never);
    const approve = vi.spyOn(sa, "approveUpgrade").mockResolvedValue({} as never);
    render(<SaRequestsPage />);
    expect(await screen.findByText(/Grupo Demo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /aprobar/i }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("r1"));
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/SaRequestsPage.test.tsx`
Expected: FAIL (stub).

- [ ] **Step 3: Implementar `SaRequestsPage`**

Reemplazar `web/src/pages/admin/sa/SaRequestsPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listUpgradeRequests, approveUpgrade, rejectUpgrade,
  listAdRequests, approveAdRequest, rejectAdRequest,
} from "../../../api/saClient.js";
import type { SaUpgradeRequest, SaAdRequest } from "../../../api/saTypes.js";

export function SaRequestsPage() {
  const { t } = useTranslation();
  const [ups, setUps] = useState<SaUpgradeRequest[]>([]);
  const [ads, setAds] = useState<SaAdRequest[]>([]);

  const load = () => {
    listUpgradeRequests("pending").then(setUps).catch(() => {});
    listAdRequests("pending").then(setAds).catch(() => {});
  };
  useEffect(load, []);

  const act = (p: Promise<unknown>) => p.then(load).catch(() => {});

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-3 font-display text-xl font-extrabold text-ink">{t("admin.sa.upgradeRequests")}</h1>
        {ups.length === 0 && <p className="text-sm text-mute">{t("admin.sa.noRequests")}</p>}
        <ul className="space-y-2">
          {ups.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
              <span className="text-sm text-ink">{r.business.name} → <b>{r.requestedPlan.name}</b></span>
              <div className="flex gap-2">
                <button onClick={() => act(approveUpgrade(r.id))} className="rounded-lg bg-open px-3 py-1.5 text-xs font-bold text-white">{t("admin.sa.approve")}</button>
                <button onClick={() => act(rejectUpgrade(r.id))} className="rounded-lg bg-bg px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-line">{t("admin.sa.reject")}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h1 className="mb-3 font-display text-xl font-extrabold text-ink">{t("admin.sa.adRequests")}</h1>
        {ads.length === 0 && <p className="text-sm text-mute">{t("admin.sa.noRequests")}</p>}
        <ul className="space-y-2">
          {ads.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
              <span className="text-sm text-ink">
                {r.business.name} · {new Date(r.desiredStartsAt).toLocaleDateString()}–{new Date(r.desiredEndsAt).toLocaleDateString()}
                {r.wantsPopup && <span className="ml-2 rounded-full bg-promo/15 px-2 py-0.5 text-[11px] font-semibold text-promo">popup</span>}
              </span>
              <div className="flex gap-2">
                <button onClick={() => act(approveAdRequest(r.id))} className="rounded-lg bg-open px-3 py-1.5 text-xs font-bold text-white">{t("admin.sa.approve")}</button>
                <button onClick={() => act(rejectAdRequest(r.id))} className="rounded-lg bg-bg px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-line">{t("admin.sa.reject")}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: i18n**

En `admin.sa` (es): `"upgradeRequests": "Solicitudes de upgrade", "adRequests": "Solicitudes de anuncio", "noRequests": "Sin solicitudes pendientes", "approve": "Aprobar", "reject": "Rechazar"`. Replicar en en/pt. JSON válido.

- [ ] **Step 5: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/SaRequestsPage.test.tsx` → PASS.
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/admin/sa/SaRequestsPage.tsx web/src/i18n web/src/tests/SaRequestsPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): bandeja de solicitudes de upgrade y anuncio (superadmin)"
```

---

## Task 5: CRUD de anuncios (superadmin)

**Files:**
- Modify: `web/src/pages/admin/sa/SaAdsPage.tsx` (reemplaza el stub)
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/SaAdsPage.test.tsx`

**Interfaces:**
- `SaAdsPage`: lista de anuncios (`listAds`) con su business, placement, vigencia y estado; eliminar (`deleteAd`) y togglear `active` (`updateAd`); botón "crear anuncio" (modal: businessId — select de empresas vía `listBusinesses`; title; description; imageUrl con `ImageUploader`; placement section/popup; startsAt/endsAt datetime-local; → `createAd`; si recibe error `popup_quota_full` mostrar aviso). Tras mutar, recargar.

- [ ] **Step 1: Test (falla primero)**

Crear `web/src/tests/SaAdsPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { SaAdsPage } from "../pages/admin/sa/SaAdsPage.js";
import * as sa from "../api/saClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(sa, "listBusinesses").mockResolvedValue([{ id: "b1", name: "Grupo", plan: null, owner: { id: "u", email: "e", name: "n" }, branches: [] }] as never);
});

describe("SaAdsPage", () => {
  it("lista anuncios y elimina uno", async () => {
    vi.spyOn(sa, "listAds").mockResolvedValue([
      { id: "a1", businessId: "b1", branchId: null, title: "Promo Verano", description: null, imageUrl: null, placement: "section", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", active: true, business: { id: "b1", name: "Grupo" } },
    ] as never);
    const del = vi.spyOn(sa, "deleteAd").mockResolvedValue(undefined as never);
    render(<SaAdsPage />);
    expect(await screen.findByText("Promo Verano")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("a1"));
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/SaAdsPage.test.tsx`
Expected: FAIL (stub).

- [ ] **Step 3: Implementar `SaAdsPage`**

Reemplazar `web/src/pages/admin/sa/SaAdsPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Plus } from "lucide-react";
import { listAds, createAd, updateAd, deleteAd, listBusinesses } from "../../../api/saClient.js";
import type { SaAd, SaBusiness } from "../../../api/saTypes.js";
import { ImageUploader } from "../../../components/admin/ImageUploader.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function SaAdsPage() {
  const { t } = useTranslation();
  const [ads, setAds] = useState<SaAd[]>([]);
  const [businesses, setBusinesses] = useState<SaBusiness[]>([]);
  const [creating, setCreating] = useState(false);

  const load = () => listAds().then(setAds).catch(() => {});
  useEffect(() => { load(); listBusinesses().then(setBusinesses).catch(() => {}); }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-extrabold text-ink">{t("admin.sa.ads")}</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} /> {t("admin.sa.newAd")}
        </button>
      </div>

      <ul className="space-y-2">
        {ads.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-bg">
              {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{a.title}</p>
              <p className="text-xs text-mute">{a.business?.name} · {a.placement} · {new Date(a.startsAt).toLocaleDateString()}–{new Date(a.endsAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => updateAd(a.id, { active: !a.active }).then(load)} className={`rounded-lg px-2 py-1 text-xs font-bold ring-1 ${a.active ? "bg-open-soft text-open ring-open/30" : "bg-bg text-mute ring-line"}`}>
              {a.active ? t("admin.sa.active") : t("admin.sa.inactive")}
            </button>
            <button aria-label={t("admin.owner.delete")} onClick={() => deleteAd(a.id).then(load)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {creating && <CreateAdModal businesses={businesses} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </div>
  );

  function CreateAdModal({ businesses, onClose, onDone }: { businesses: SaBusiness[]; onClose: () => void; onDone: () => void }) {
    const [f, setF] = useState({ businessId: businesses[0]?.id ?? "", title: "", description: "", imageUrl: null as string | null, placement: "section" as "section" | "popup", startsAt: "", endsAt: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    async function submit() {
      setBusy(true); setErr(null);
      try {
        await createAd({
          businessId: f.businessId, title: f.title, description: f.description || null, imageUrl: f.imageUrl,
          placement: f.placement, startsAt: new Date(f.startsAt).toISOString(), endsAt: new Date(f.endsAt).toISOString(),
        });
        onDone();
      } catch (e) {
        setErr(String(e).includes("403") ? t("admin.sa.popupFull") : t("admin.sa.createError"));
      } finally { setBusy(false); }
    }
    return (
      <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
        <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 font-display text-lg font-bold text-ink">{t("admin.sa.newAd")}</h3>
          <div className="space-y-2">
            <select aria-label={t("admin.sa.business")} className={inputCls} value={f.businessId} onChange={(e) => setF({ ...f, businessId: e.target.value })}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input aria-label={t("admin.sa.adTitle")} placeholder={t("admin.sa.adTitle")} className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <textarea aria-label={t("admin.owner.itemDescription")} placeholder={t("admin.owner.itemDescription")} className={`${inputCls} resize-none`} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <ImageUploader value={f.imageUrl} onChange={(url) => setF({ ...f, imageUrl: url })} label={t("admin.sa.adImage")} />
            <select aria-label={t("admin.sa.placement")} className={inputCls} value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value as "section" | "popup" })}>
              <option value="section">{t("admin.sa.placementSection")}</option>
              <option value="popup">{t("admin.sa.placementPopup")}</option>
            </select>
            <div className="flex gap-2">
              <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.from")}
                <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
              </label>
              <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.to")}
                <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
              </label>
            </div>
            {err && <p className="text-xs text-brand-dark">{err}</p>}
            <button onClick={submit} disabled={busy || !f.businessId || !f.title || !f.startsAt || !f.endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">{t("admin.sa.create")}</button>
          </div>
        </div>
      </div>
    );
  }
}
```
Nota: la clave de error de popup es `admin.sa.popupFull` (ASCII).

- [ ] **Step 4: i18n**

En `admin.sa` (es): `"newAd": "Crear anuncio", "adTitle": "Título", "adImage": "Imagen del anuncio", "business": "Empresa", "placement": "Ubicación", "placementSection": "Sección", "placementPopup": "Popup", "active": "Activo", "inactive": "Inactivo", "popupFull": "Cupo de popups lleno"`. Replicar en en/pt. JSON válido.

- [ ] **Step 5: Run test, debe pasar; typecheck**

Run: `cd web && npx vitest run src/tests/SaAdsPage.test.tsx` → PASS.
Run: `cd web && npx tsc -b --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/admin/sa/SaAdsPage.tsx web/src/i18n web/src/tests/SaAdsPage.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): CRUD de anuncios del superadmin"
```

---

## Task 6: Discovery — `AdSection` y `AdPopup`

**Files:**
- Create: `web/src/components/AdSection.tsx`
- Create: `web/src/components/AdPopup.tsx`
- Modify: `web/src/pages/HomePage.tsx`
- Modify: `web/src/i18n/{es,en,pt}.json`
- Test: `web/src/tests/AdPopup.test.tsx`

**Interfaces:**
- `<AdSection lat lng />`: consume `getAds(lat,lng)`; si hay anuncios, renderiza un carrusel horizontal de cards (imagen + título); si no, no renderiza nada.
- `<AdPopup lat lng />`: consume `getPopupAd(lat,lng)`; muestra un modal UNA vez por sesión (guarda en `sessionStorage` la clave `resto.popup.<adId>` para no repetir); cierra por backdrop/botón.
- `HomePage` monta `<AdSection>` (sobre la lista) y `<AdPopup>` usando el `center` (lat/lng) que ya calcula.

- [ ] **Step 1: Test (falla primero)**

Crear `web/src/tests/AdPopup.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { AdPopup } from "../components/AdPopup.js";
import * as client from "../api/client.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  sessionStorage.clear();
});

const ad = { id: "a1", businessId: "b1", branchId: null, title: "Gran Promo", description: "desc", imageUrl: null, startsAt: "x", endsAt: "y", distance: 100 };

describe("AdPopup", () => {
  it("muestra el popup la primera vez y no la segunda (sessionStorage)", async () => {
    vi.spyOn(client, "getPopupAd").mockResolvedValue(ad as never);
    const { unmount } = render(<AdPopup lat={-33.4} lng={-70.6} />);
    expect(await screen.findByText("Gran Promo")).toBeInTheDocument();
    unmount();
    // segunda vez: ya está marcado en sessionStorage → no se muestra
    render(<AdPopup lat={-33.4} lng={-70.6} />);
    await waitFor(() => {});
    expect(screen.queryByText("Gran Promo")).not.toBeInTheDocument();
  });

  it("no renderiza nada si no hay popup", async () => {
    vi.spyOn(client, "getPopupAd").mockResolvedValue(null);
    render(<AdPopup lat={-33.4} lng={-70.6} />);
    await waitFor(() => {});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, debe fallar**

Run: `cd web && npx vitest run src/tests/AdPopup.test.tsx`
Expected: FAIL (no existe AdPopup).

- [ ] **Step 3: Implementar `AdSection`**

Crear `web/src/components/AdSection.tsx`:
```tsx
import { useEffect, useState } from "react";
import { getAds } from "../api/client.js";
import type { PublicAd } from "../api/types.js";

export function AdSection({ lat, lng }: { lat: number; lng: number }) {
  const [ads, setAds] = useState<PublicAd[]>([]);
  useEffect(() => {
    getAds(lat, lng).then(setAds).catch(() => setAds([]));
  }, [lat, lng]);
  if (ads.length === 0) return null;
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
      {ads.map((a) => (
        <div key={a.id} className="w-64 shrink-0 overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
          <div className="h-28 w-full bg-brand-soft">
            {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" />}
          </div>
          <div className="p-3">
            <p className="truncate font-bold text-ink">{a.title}</p>
            {a.description && <p className="mt-0.5 line-clamp-2 text-xs text-mute">{a.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implementar `AdPopup`**

Crear `web/src/components/AdPopup.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { getPopupAd } from "../api/client.js";
import type { PublicAd } from "../api/types.js";

export function AdPopup({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslation();
  const [ad, setAd] = useState<PublicAd | null>(null);

  useEffect(() => {
    getPopupAd(lat, lng)
      .then((a) => {
        if (!a) return;
        const key = `resto.popup.${a.id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        setAd(a);
      })
      .catch(() => {});
  }, [lat, lng]);

  if (!ad) return null;
  return (
    <div role="dialog" className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/50 p-4" onClick={() => setAd(null)}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-40 w-full bg-brand-soft">
          {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="h-full w-full object-cover" />}
          <button aria-label={t("item.close")} onClick={() => setAd(null)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <h3 className="font-display text-lg font-extrabold text-ink">{ad.title}</h3>
          {ad.description && <p className="mt-1 text-sm text-mute">{ad.description}</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Montar en `HomePage`**

En `web/src/pages/HomePage.tsx`, importar y montar. `AdSection` va dentro del `<main>` antes de la lista (solo en vista lista, o siempre arriba); `AdPopup` al final del árbol. Usar el `center` ya calculado:
```tsx
import { AdSection } from "../components/AdSection.js";
import { AdPopup } from "../components/AdPopup.js";
// dentro del return, al inicio del <main> (o antes de BranchList):
<AdSection lat={center.lat} lng={center.lng} />
// y antes de cerrar el contenedor raíz:
<AdPopup lat={center.lat} lng={center.lng} />
```
(Insertar sin romper la estructura existente de header/filtros/toolbar/main.)

- [ ] **Step 6: i18n**

En `web/src/i18n/es.json`, agregar (raíz) `"ads": { "section": "Destacados" }` (en/pt: "Featured"/"Destaques"). (El popup usa `item.close` ya existente.)

- [ ] **Step 7: Run test, debe pasar; suite + typecheck + build**

Run: `cd web && npx vitest run src/tests/AdPopup.test.tsx` → PASS (2 tests).
Run: `cd web && npx vitest run` → toda la suite web verde (reportar conteo).
Run: `cd web && npx tsc -b --noEmit` → sin errores.
Run: `cd web && npm run build` → build OK.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/AdSection.tsx web/src/components/AdPopup.tsx web/src/pages/HomePage.tsx web/src/i18n web/src/tests/AdPopup.test.tsx
git -c user.name=ribarahonaa -c user.email=ribarahonaa@gmail.com commit --no-verify -m "feat(web): AdSection y AdPopup en el discovery público"
```

---

## Verificación final de la capa 3B

- `cd web && npx vitest run` → toda la suite web verde.
- `cd web && npx tsc -b --noEmit` y `cd web && npm run build` → sin errores.
- **Flujo manual** (login `admin@restoapp.cl`/`admin12345`): la nav muestra Empresas/Anuncios/Solicitudes. En **Empresas**: ver jerarquía empresa→sucursales, crear empresa (con dueño), "+ sucursal", "+ cuenta", cambiar plan. En **Solicitudes**: aprobar/rechazar (crear antes una solicitud como dueño). En **Anuncios**: crear un Ad de sección y uno de popup; verlos. En el **discovery público** (`localhost:5173`): el Ad de sección aparece en `AdSection` y el popup se muestra una vez por sesión.

## Self-review (cobertura, capa 3B)

- Cliente superadmin + ads públicos → Task 1. ✓
- Navegación por rol + vista jerárquica de empresas → Task 2. ✓
- Crear sucursal/cuenta desde la empresa → Task 3. ✓
- Bandeja de solicitudes (upgrade + anuncio) → Task 4. ✓
- CRUD de anuncios → Task 5. ✓
- Discovery: AdSection + AdPopup → Task 6. ✓
- Con esto **la fase 4 (paneles admin + monetización + anuncios) queda completa** en sus tres capas (1 fundación, 2 dueño, 3 superadmin). Follow-ups menores pendientes anotados en memoria (cupo popups naming, P2002→409, lazy-load leaflet, etc.).
