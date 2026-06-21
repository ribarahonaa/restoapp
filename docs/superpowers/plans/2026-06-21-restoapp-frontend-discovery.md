# RestoApp Frontend Discovery (PWA pública) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web PWA pública (React+Vite+TypeScript+Tailwind) que muestra locales cercanos en un mapa Leaflet+OSM, con barra de filtros (categoría, propósito, promo activa, abierto ahora, radio), ficha de local, y UI multilenguaje (es/en/pt). Corre en contenedor Docker y consume la Discovery API existente.

**Architecture:** SPA con React Router. El acceso a datos se centraliza en un cliente API tipado (`src/api/`). El mapa se aísla tras un componente `<MapView>` (envuelve react-leaflet) para poder migrar a Google después sin tocar el resto. La posición del usuario viene de `navigator.geolocation` (hook `useGeolocation`). i18n con i18next (solo UI). Estilos con Tailwind CSS v4. PWA via `vite-plugin-pwa`. El navegador (en el host) llama al API en `http://localhost:3000` (CORS ya abierto).

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), react-router-dom v6, react-leaflet v5 + leaflet, i18next + react-i18next, vite-plugin-pwa, Vitest + @testing-library/react + jsdom.

**Alcance:** SOLO app pública (descubrimiento). Login/registro y paneles (dueño/superadmin) son Planes 4-5. No se construye geocoding (dirección→coords) aquí; se usa solo geolocalización del navegador. La abstracción `<MapView>` queda lista para Google y geocoding futuros.

---

## File Structure

```
web/
├── Dockerfile
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.css                 # @import "tailwindcss"
├── public/                      # iconos PWA
└── src/
    ├── main.tsx                 # bootstrap React + Router + i18n
    ├── App.tsx                  # rutas
    ├── env.ts                   # VITE_API_URL
    ├── api/
    │   ├── types.ts             # Branch, BranchDetail, Purpose, NearbyFilters
    │   └── client.ts            # getNearby, getBranch, getPurposes
    ├── i18n/
    │   ├── index.ts             # init i18next
    │   ├── es.json
    │   ├── en.json
    │   └── pt.json
    ├── hooks/
    │   ├── useGeolocation.ts
    │   ├── usePurposes.ts
    │   └── useNearby.ts
    ├── components/
    │   ├── map/
    │   │   └── MapView.tsx      # abstracción Leaflet (única que importa leaflet)
    │   ├── FilterBar.tsx
    │   ├── BranchCard.tsx
    │   ├── BranchList.tsx
    │   └── LanguageSwitcher.tsx
    ├── pages/
    │   ├── HomePage.tsx         # mapa + lista + filtros + geolocalización
    │   └── BranchDetailPage.tsx
    └── tests/
        ├── client.test.ts
        ├── useNearby.test.tsx
        ├── FilterBar.test.tsx
        └── BranchCard.test.tsx
```

**Wiring Docker:** se agrega un servicio `web` a `docker-compose.yml` (raíz) que monta `./web` y expone `5173`.

---

## Task 1: Scaffold del frontend (Vite + React + TS) + Tailwind

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/index.html`, `web/vite.config.ts`, `web/tailwind.css`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/env.ts`, `web/.gitignore`

- [ ] **Step 1: Crear `web/package.json`**

```json
{
  "name": "restoapp-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "i18next": "^23.16.0",
    "i18next-browser-languagedetector": "^8.0.0",
    "leaflet": "^1.9.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-i18next": "^15.1.0",
    "react-leaflet": "^5.0.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/leaflet": "^1.9.12",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Crear `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Crear `web/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RestoApp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Crear `web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "RestoApp",
        short_name: "RestoApp",
        description: "Descubre bares, restaurantes y cafés cerca de ti",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
```

- [ ] **Step 5: Crear `web/tailwind.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Crear `web/src/env.ts` y `web/src/vite-env.d.ts`**

`web/src/vite-env.d.ts` (necesario para tipar `import.meta.env` y los imports de assets `.png` de leaflet):

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

`web/src/env.ts`:

```ts
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
```

- [ ] **Step 7: Crear `web/src/App.tsx` (placeholder mínimo, se completa en Task 9-10)**

```tsx
export default function App() {
  return <div className="p-4 text-slate-900">RestoApp</div>;
}
```

- [ ] **Step 8: Crear `web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import "./tailwind.css";
import "leaflet/dist/leaflet.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 9: Crear `web/.gitignore`**

```
node_modules
dist
dev-dist
.env
```

- [ ] **Step 10: Instalar dependencias y verificar build**

Run: `cd /home/ribacl/restoapp/web && npm install && npm run build`
Expected: instala sin errores y `vite build` genera `dist/` (con service worker de PWA). Si falla por tipos de placeholder, corregir solo lo necesario para compilar.

- [ ] **Step 11: Commit**

```bash
cd /home/ribacl/restoapp
git add web/package.json web/tsconfig.json web/index.html web/vite.config.ts web/tailwind.css web/src web/.gitignore web/package-lock.json
# incluye web/src/vite-env.d.ts (referencias a vite/client y vite-plugin-pwa/client)
git commit -m "chore: scaffold react+vite+tailwind pwa frontend"
```

---

## Task 2: Servicio Docker `web` + variable de API

**Files:**
- Create: `web/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.env.example` (agregar `VITE_API_URL`)

- [ ] **Step 1: Crear `web/Dockerfile`**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

- [ ] **Step 2: Agregar el servicio `web` a `docker-compose.yml`**

Insertar este bloque dentro de `services:` (después del bloque `api:`, antes de `volumes:`):

```yaml
  web:
    build: ./web
    environment:
      VITE_API_URL: http://localhost:3000
    ports:
      - "5173:5173"
    depends_on:
      - api
    volumes:
      - ./web:/app
      - /app/node_modules
```

- [ ] **Step 3: Agregar `VITE_API_URL` a `.env.example`**

Agregar al final de `.env.example`:

```
# Frontend
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 4: Verificar que el contenedor levanta**

Run: `cd /home/ribacl/restoapp && docker compose up -d --build web`
Expected: servicio `web` corriendo. Verificar: `curl -s http://localhost:5173 | grep -q '<div id="root">' && echo OK` → imprime OK.

- [ ] **Step 5: Commit**

```bash
git add web/Dockerfile docker-compose.yml .env.example
git commit -m "chore: add web service to docker compose"
```

---

## Task 3: i18n (es/en/pt) + LanguageSwitcher

**Files:**
- Create: `web/src/i18n/index.ts`, `web/src/i18n/es.json`, `web/src/i18n/en.json`, `web/src/i18n/pt.json`, `web/src/components/LanguageSwitcher.tsx`
- Modify: `web/src/main.tsx` (importar i18n)

- [ ] **Step 1: Crear `web/src/i18n/es.json`**

```json
{
  "appName": "RestoApp",
  "nearbyTitle": "Locales cerca de ti",
  "filters": {
    "category": "Categoría",
    "purpose": "Propósito",
    "promo": "Con promoción",
    "open": "Abierto ahora",
    "radius": "Radio",
    "all": "Todos"
  },
  "categories": {
    "bar": "Bar",
    "pub": "Pub",
    "restaurant": "Restaurante",
    "cafe": "Cafetería"
  },
  "branch": {
    "hours": "Horarios",
    "menu": "Carta",
    "promos": "Promociones",
    "distance": "{{km}} km",
    "noResults": "No hay locales que coincidan",
    "back": "Volver"
  },
  "geo": {
    "requesting": "Obteniendo tu ubicación…",
    "denied": "Activa la ubicación para ver locales cercanos",
    "unavailable": "Ubicación no disponible"
  },
  "weekdays": ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
}
```

- [ ] **Step 2: Crear `web/src/i18n/en.json`**

```json
{
  "appName": "RestoApp",
  "nearbyTitle": "Places near you",
  "filters": {
    "category": "Category",
    "purpose": "Purpose",
    "promo": "With promotion",
    "open": "Open now",
    "radius": "Radius",
    "all": "All"
  },
  "categories": {
    "bar": "Bar",
    "pub": "Pub",
    "restaurant": "Restaurant",
    "cafe": "Café"
  },
  "branch": {
    "hours": "Hours",
    "menu": "Menu",
    "promos": "Promotions",
    "distance": "{{km}} km",
    "noResults": "No matching places",
    "back": "Back"
  },
  "geo": {
    "requesting": "Getting your location…",
    "denied": "Enable location to see nearby places",
    "unavailable": "Location unavailable"
  },
  "weekdays": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
}
```

- [ ] **Step 3: Crear `web/src/i18n/pt.json`**

```json
{
  "appName": "RestoApp",
  "nearbyTitle": "Lugares perto de você",
  "filters": {
    "category": "Categoria",
    "purpose": "Propósito",
    "promo": "Com promoção",
    "open": "Aberto agora",
    "radius": "Raio",
    "all": "Todos"
  },
  "categories": {
    "bar": "Bar",
    "pub": "Pub",
    "restaurant": "Restaurante",
    "cafe": "Café"
  },
  "branch": {
    "hours": "Horários",
    "menu": "Cardápio",
    "promos": "Promoções",
    "distance": "{{km}} km",
    "noResults": "Nenhum lugar corresponde",
    "back": "Voltar"
  },
  "geo": {
    "requesting": "Obtendo sua localização…",
    "denied": "Ative a localização para ver lugares próximos",
    "unavailable": "Localização indisponível"
  },
  "weekdays": ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
}
```

- [ ] **Step 4: Crear `web/src/i18n/index.ts`**

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import es from "./es.json";
import en from "./en.json";
import pt from "./pt.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      pt: { translation: pt },
    },
    fallbackLng: "es",
    supportedLngs: ["es", "en", "pt"],
    interpolation: { escapeValue: false },
  });

export default i18n;
```

- [ ] **Step 5: Crear `web/src/components/LanguageSwitcher.tsx`**

```tsx
import { useTranslation } from "react-i18next";

const LANGS = ["es", "en", "pt"] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="flex gap-1" role="group" aria-label="language">
      {LANGS.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`px-2 py-1 text-xs rounded uppercase ${
            i18n.resolvedLanguage === lng
              ? "bg-slate-900 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Importar i18n en `web/src/main.tsx`**

Agregar el import `import "./i18n/index.js";` justo después del import de `App`:

```tsx
import App from "./App.js";
import "./i18n/index.js";
import "./tailwind.css";
import "leaflet/dist/leaflet.css";
```

- [ ] **Step 7: Verificar build**

Run: `cd /home/ribacl/restoapp/web && npm run build`
Expected: compila sin errores.

- [ ] **Step 8: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/i18n web/src/components/LanguageSwitcher.tsx web/src/main.tsx
git commit -m "feat: add i18n (es/en/pt) and language switcher"
```

---

## Task 4: Cliente API tipado + tests

**Files:**
- Create: `web/src/api/types.ts`, `web/src/api/client.ts`
- Create: `web/vitest.config.ts`
- Test: `web/src/tests/client.test.ts`

- [ ] **Step 1: Crear `web/src/api/types.ts`**

```ts
export type Category = "bar" | "pub" | "restaurant" | "cafe";

export interface NearbyBranch {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  distance: number; // metros
}

export interface Purpose {
  slug: string;
  labelEs: string;
  labelEn: string;
  labelPt: string;
}

export interface ServiceHour {
  id: string;
  weekday: number;
  openTime: string;
  closeTime: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
}

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
}

export interface BranchPurposeTag {
  tag: Purpose;
}

export interface BranchDetail {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  hours: ServiceHour[];
  menuItems: MenuItem[];
  promotions: Promotion[];
  purposes: BranchPurposeTag[];
}

export interface NearbyFilters {
  lat: number;
  lng: number;
  radius: number;
  category?: Category;
  purpose?: string;
  promo?: boolean;
  open?: boolean;
}
```

- [ ] **Step 2: Crear `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
```

- [ ] **Step 3: Escribir test que falla**

```ts
// web/src/tests/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNearby, getPurposes } from "../api/client.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("getNearby arma la query string con los filtros y parsea JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "1", name: "X" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await getNearby({ lat: -33.4, lng: -70.6, radius: 5000, category: "bar", promo: true });
    expect(res).toEqual([{ id: "1", name: "X" }]);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/branches/nearby");
    expect(calledUrl).toContain("lat=-33.4");
    expect(calledUrl).toContain("lng=-70.6");
    expect(calledUrl).toContain("radius=5000");
    expect(calledUrl).toContain("category=bar");
    expect(calledUrl).toContain("promo=true");
  });

  it("getNearby NO incluye filtros opcionales ausentes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    await getNearby({ lat: -33.4, lng: -70.6, radius: 5000 });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("category=");
    expect(calledUrl).not.toContain("promo=");
    expect(calledUrl).not.toContain("open=");
  });

  it("getPurposes lanza error si la respuesta no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(getPurposes()).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Correr test, verificar que falla**

Run: `cd /home/ribacl/restoapp/web && npx vitest run src/tests/client.test.ts`
Expected: FAIL — módulo `../api/client.js` no encontrado.

- [ ] **Step 5: Implementar `web/src/api/client.ts`**

```ts
import { API_URL } from "../env.js";
import type { NearbyBranch, BranchDetail, Purpose, NearbyFilters } from "./types.js";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function getNearby(f: NearbyFilters): Promise<NearbyBranch[]> {
  const p = new URLSearchParams();
  p.set("lat", String(f.lat));
  p.set("lng", String(f.lng));
  p.set("radius", String(f.radius));
  if (f.category) p.set("category", f.category);
  if (f.purpose) p.set("purpose", f.purpose);
  if (f.promo) p.set("promo", "true");
  if (f.open) p.set("open", "true");
  return getJson<NearbyBranch[]>(`${API_URL}/branches/nearby?${p.toString()}`);
}

export function getBranch(id: string): Promise<BranchDetail> {
  return getJson<BranchDetail>(`${API_URL}/branches/${id}`);
}

export function getPurposes(): Promise<Purpose[]> {
  return getJson<Purpose[]>(`${API_URL}/purposes`);
}
```

- [ ] **Step 6: Correr test, verificar que pasa**

Run: `cd /home/ribacl/restoapp/web && npx vitest run src/tests/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/api web/vitest.config.ts web/src/tests/client.test.ts
git commit -m "feat: add typed api client with tests"
```

---

## Task 5: Hooks (useGeolocation, usePurposes, useNearby) + test de useNearby

**Files:**
- Create: `web/src/hooks/useGeolocation.ts`, `web/src/hooks/usePurposes.ts`, `web/src/hooks/useNearby.ts`
- Test: `web/src/tests/useNearby.test.tsx`

- [ ] **Step 1: Crear `web/src/hooks/useGeolocation.ts`**

```ts
import { useEffect, useState } from "react";

export type GeoState =
  | { status: "loading" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "denied" }
  | { status: "unavailable" };

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ status: "loading" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return state;
}
```

- [ ] **Step 2: Crear `web/src/hooks/usePurposes.ts`**

```ts
import { useEffect, useState } from "react";
import { getPurposes } from "../api/client.js";
import type { Purpose } from "../api/types.js";

export function usePurposes(): Purpose[] {
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  useEffect(() => {
    getPurposes()
      .then(setPurposes)
      .catch(() => setPurposes([]));
  }, []);
  return purposes;
}
```

- [ ] **Step 3: Crear `web/src/hooks/useNearby.ts`**

```ts
import { useEffect, useState } from "react";
import { getNearby } from "../api/client.js";
import type { NearbyBranch, NearbyFilters } from "../api/types.js";

export interface NearbyState {
  loading: boolean;
  error: boolean;
  branches: NearbyBranch[];
}

export function useNearby(filters: NearbyFilters | null): NearbyState {
  const [state, setState] = useState<NearbyState>({ loading: false, error: false, branches: [] });

  useEffect(() => {
    if (!filters) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    getNearby(filters)
      .then((branches) => {
        if (!cancelled) setState({ loading: false, error: false, branches });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: true, branches: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [
    filters?.lat,
    filters?.lng,
    filters?.radius,
    filters?.category,
    filters?.purpose,
    filters?.promo,
    filters?.open,
  ]);

  return state;
}
```

- [ ] **Step 4: Escribir test de useNearby**

```tsx
// web/src/tests/useNearby.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNearby } from "../hooks/useNearby.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useNearby", () => {
  it("no consulta cuando los filtros son null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useNearby(null));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carga sucursales cuando hay filtros", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: "1", name: "Bar X" }] })
    );
    const { result } = renderHook(() =>
      useNearby({ lat: -33.4, lng: -70.6, radius: 5000 })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.branches).toEqual([{ id: "1", name: "Bar X" }]);
    expect(result.current.error).toBe(false);
  });

  it("marca error si la consulta falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() =>
      useNearby({ lat: -33.4, lng: -70.6, radius: 5000 })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });
});
```

- [ ] **Step 5: Correr test, verificar que pasa**

Run: `cd /home/ribacl/restoapp/web && npx vitest run src/tests/useNearby.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/hooks web/src/tests/useNearby.test.tsx
git commit -m "feat: add geolocation, purposes and nearby hooks"
```

---

## Task 6: MapView (abstracción Leaflet) + fix de iconos

**Files:**
- Create: `web/src/components/map/MapView.tsx`

- [ ] **Step 1: Implementar `web/src/components/map/MapView.tsx`**

```tsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Fix de iconos por defecto rotos con bundlers
const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  onClick?: () => void;
}

interface MapViewProps {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  zoom?: number;
}

function Recenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  map.setView([center.lat, center.lng]);
  return null;
}

export function MapView({ center, markers, zoom = 14 }: MapViewProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className="h-full w-full"
      scrollWheelZoom
    >
      <Recenter center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={defaultIcon}
          eventHandlers={m.onClick ? { click: m.onClick } : undefined}
        >
          <Popup>{m.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `cd /home/ribacl/restoapp/web && npm run build`
Expected: compila (las imágenes de leaflet se resuelven como assets). Sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/components/map/MapView.tsx
git commit -m "feat: add leaflet mapview abstraction"
```

---

## Task 7: FilterBar + test

**Files:**
- Create: `web/src/components/FilterBar.tsx`
- Test: `web/src/tests/FilterBar.test.tsx`

- [ ] **Step 1: Escribir test que falla**

```tsx
// web/src/tests/FilterBar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "../i18n/index.js";
import { FilterBar } from "../components/FilterBar.js";
import type { Purpose } from "../api/types.js";

const purposes: Purpose[] = [
  { slug: "lunch", labelEs: "Almuerzo", labelEn: "Lunch", labelPt: "Almoço" },
];

describe("FilterBar", () => {
  it("llama onChange al activar promo", () => {
    const onChange = vi.fn();
    render(
      <FilterBar value={{ promo: false, open: false, radius: 5000 }} purposes={purposes} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText(/promo/i));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ promo: true }));
  });

  it("llama onChange al elegir categoría", () => {
    const onChange = vi.fn();
    render(
      <FilterBar value={{ promo: false, open: false, radius: 5000 }} purposes={purposes} onChange={onChange} />
    );
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "bar" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: "bar" }));
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

Run: `cd /home/ribacl/restoapp/web && npx vitest run src/tests/FilterBar.test.tsx`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `web/src/components/FilterBar.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import type { Category, Purpose } from "../api/types.js";

export interface FilterValue {
  category?: Category;
  purpose?: string;
  promo: boolean;
  open: boolean;
  radius: number;
}

interface FilterBarProps {
  value: FilterValue;
  purposes: Purpose[];
  onChange: (next: FilterValue) => void;
}

const CATEGORIES: Category[] = ["bar", "pub", "restaurant", "cafe"];

export function FilterBar({ value, purposes, onChange }: FilterBarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const purposeLabel = (p: Purpose) =>
    lang === "en" ? p.labelEn : lang === "pt" ? p.labelPt : p.labelEs;

  return (
    <div className="flex flex-wrap gap-3 p-3 bg-white border-b border-slate-200">
      <label className="flex flex-col text-xs text-slate-600">
        {t("filters.category")}
        <select
          aria-label={t("filters.category")}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={value.category ?? ""}
          onChange={(e) =>
            onChange({ ...value, category: (e.target.value || undefined) as Category | undefined })
          }
        >
          <option value="">{t("filters.all")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-slate-600">
        {t("filters.purpose")}
        <select
          aria-label={t("filters.purpose")}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={value.purpose ?? ""}
          onChange={(e) => onChange({ ...value, purpose: e.target.value || undefined })}
        >
          <option value="">{t("filters.all")}</option>
          {purposes.map((p) => (
            <option key={p.slug} value={p.slug}>
              {purposeLabel(p)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-slate-600">
        {t("filters.radius")}
        <select
          aria-label={t("filters.radius")}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={value.radius}
          onChange={(e) => onChange({ ...value, radius: Number(e.target.value) })}
        >
          <option value={1000}>1 km</option>
          <option value={5000}>5 km</option>
          <option value={10000}>10 km</option>
          <option value={50000}>50 km</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          aria-label={t("filters.promo")}
          checked={value.promo}
          onChange={(e) => onChange({ ...value, promo: e.target.checked })}
        />
        {t("filters.promo")}
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          aria-label={t("filters.open")}
          checked={value.open}
          onChange={(e) => onChange({ ...value, open: e.target.checked })}
        />
        {t("filters.open")}
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Correr test, verificar que pasa**

Run: `cd /home/ribacl/restoapp/web && npx vitest run src/tests/FilterBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/components/FilterBar.tsx web/src/tests/FilterBar.test.tsx
git commit -m "feat: add filter bar component with tests"
```

---

## Task 8: BranchCard + BranchList + test

**Files:**
- Create: `web/src/components/BranchCard.tsx`, `web/src/components/BranchList.tsx`
- Test: `web/src/tests/BranchCard.test.tsx`

- [ ] **Step 1: Escribir test que falla**

```tsx
// web/src/tests/BranchCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index.js";
import { BranchCard } from "../components/BranchCard.js";
import type { NearbyBranch } from "../api/types.js";

const branch: NearbyBranch = {
  id: "b1",
  name: "Café Central",
  category: "cafe",
  address: "Plaza 1",
  lat: -33.4,
  lng: -70.6,
  phone: null,
  description: null,
  distance: 1500,
};

describe("BranchCard", () => {
  it("muestra nombre, categoría traducida y distancia en km", () => {
    render(
      <MemoryRouter>
        <BranchCard branch={branch} />
      </MemoryRouter>
    );
    expect(screen.getByText("Café Central")).toBeInTheDocument();
    expect(screen.getByText(/Cafetería/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5 km/)).toBeInTheDocument();
  });

  it("enlaza a la ficha del local", () => {
    render(
      <MemoryRouter>
        <BranchCard branch={branch} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/branch/b1");
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

Run: `cd /home/ribacl/restoapp/web && npx vitest run src/tests/BranchCard.test.tsx`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `web/src/components/BranchCard.tsx`**

```tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NearbyBranch } from "../api/types.js";

export function BranchCard({ branch }: { branch: NearbyBranch }) {
  const { t } = useTranslation();
  const km = (branch.distance / 1000).toFixed(1);
  return (
    <Link
      to={`/branch/${branch.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400 transition-colors"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{branch.name}</h3>
        <span className="text-xs text-slate-500">{t("branch.distance", { km })}</span>
      </div>
      <p className="text-sm text-slate-600">{t(`categories.${branch.category}`)}</p>
      <p className="text-xs text-slate-400">{branch.address}</p>
    </Link>
  );
}
```

- [ ] **Step 4: Implementar `web/src/components/BranchList.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import type { NearbyBranch } from "../api/types.js";
import { BranchCard } from "./BranchCard.js";

export function BranchList({ branches }: { branches: NearbyBranch[] }) {
  const { t } = useTranslation();
  if (branches.length === 0) {
    return <p className="p-4 text-sm text-slate-500">{t("branch.noResults")}</p>;
  }
  return (
    <div className="flex flex-col gap-2 p-3">
      {branches.map((b) => (
        <BranchCard key={b.id} branch={b} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Correr test, verificar que pasa**

Run: `cd /home/ribacl/restoapp/web && npx vitest run src/tests/BranchCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/components/BranchCard.tsx web/src/components/BranchList.tsx web/src/tests/BranchCard.test.tsx
git commit -m "feat: add branch card and list components"
```

---

## Task 9: HomePage (mapa + lista + filtros + geolocalización)

**Files:**
- Create: `web/src/pages/HomePage.tsx`

- [ ] **Step 1: Implementar `web/src/pages/HomePage.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGeolocation } from "../hooks/useGeolocation.js";
import { usePurposes } from "../hooks/usePurposes.js";
import { useNearby } from "../hooks/useNearby.js";
import { FilterBar, type FilterValue } from "../components/FilterBar.js";
import { BranchList } from "../components/BranchList.js";
import { MapView, type MapMarker } from "../components/map/MapView.js";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import type { NearbyFilters } from "../api/types.js";

// Fallback: Plaza de Armas, Santiago (si el usuario no da ubicación)
const FALLBACK = { lat: -33.4378, lng: -70.6504 };

export function HomePage() {
  const { t } = useTranslation();
  const geo = useGeolocation();
  const purposes = usePurposes();
  const [filter, setFilter] = useState<FilterValue>({ promo: false, open: false, radius: 5000 });

  const center =
    geo.status === "ready" ? { lat: geo.lat, lng: geo.lng } : FALLBACK;

  const nearbyFilters: NearbyFilters = useMemo(
    () => ({
      lat: center.lat,
      lng: center.lng,
      radius: filter.radius,
      category: filter.category,
      purpose: filter.purpose,
      promo: filter.promo || undefined,
      open: filter.open || undefined,
    }),
    [center.lat, center.lng, filter]
  );

  const { branches } = useNearby(nearbyFilters);

  const markers: MapMarker[] = branches.map((b) => ({
    id: b.id,
    lat: b.lat,
    lng: b.lng,
    label: b.name,
  }));

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
        <h1 className="font-bold">{t("appName")}</h1>
        <LanguageSwitcher />
      </header>

      <FilterBar value={filter} purposes={purposes} onChange={setFilter} />

      {geo.status === "denied" && (
        <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50">{t("geo.denied")}</p>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="h-1/2 md:h-auto md:w-1/2">
          <MapView center={center} markers={markers} />
        </div>
        <div className="h-1/2 md:h-auto md:w-1/2 overflow-y-auto">
          <h2 className="px-4 pt-3 text-sm font-semibold text-slate-700">{t("nearbyTitle")}</h2>
          <BranchList branches={branches} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `cd /home/ribacl/restoapp/web && npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/pages/HomePage.tsx
git commit -m "feat: add home page with map, filters and list"
```

---

## Task 10: BranchDetailPage + rutas en App

**Files:**
- Create: `web/src/pages/BranchDetailPage.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Implementar `web/src/pages/BranchDetailPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getBranch } from "../api/client.js";
import type { BranchDetail } from "../api/types.js";
import { MapView } from "../components/map/MapView.js";

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBranch(id)
      .then(setBranch)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="p-4">
        <Link to="/" className="text-sm text-blue-600">
          ← {t("branch.back")}
        </Link>
        <p className="mt-4 text-slate-600">{t("branch.noResults")}</p>
      </div>
    );
  }

  if (!branch) {
    return <div className="p-4 text-slate-500">…</div>;
  }

  const weekdays = t("weekdays", { returnObjects: true }) as string[];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Link to="/" className="text-sm text-blue-600">
        ← {t("branch.back")}
      </Link>

      <h1 className="mt-2 text-2xl font-bold text-slate-900">{branch.name}</h1>
      <p className="text-slate-600">{t(`categories.${branch.category}`)}</p>
      <p className="text-sm text-slate-500">{branch.address}</p>
      {branch.description && <p className="mt-2 text-slate-700">{branch.description}</p>}

      <div className="my-4 h-56 rounded-lg overflow-hidden">
        <MapView
          center={{ lat: branch.lat, lng: branch.lng }}
          markers={[{ id: branch.id, lat: branch.lat, lng: branch.lng, label: branch.name }]}
          zoom={16}
        />
      </div>

      {branch.promotions.length > 0 && (
        <section className="mb-4">
          <h2 className="font-semibold text-slate-800">{t("branch.promos")}</h2>
          <ul className="mt-1 space-y-1">
            {branch.promotions.map((p) => (
              <li key={p.id} className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <strong>{p.title}</strong>
                {p.description ? ` — ${p.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-semibold text-slate-800">{t("branch.hours")}</h2>
        <ul className="mt-1 text-sm text-slate-700">
          {branch.hours.map((h) => (
            <li key={h.id} className="flex justify-between border-b border-slate-100 py-1">
              <span>{weekdays[h.weekday]}</span>
              <span>
                {h.openTime}–{h.closeTime}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-slate-800">{t("branch.menu")}</h2>
        <ul className="mt-1 space-y-1">
          {branch.menuItems.map((m) => (
            <li key={m.id} className="flex justify-between text-sm text-slate-700">
              <span>{m.name}</span>
              <span>${m.price}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `web/src/App.tsx` con las rutas**

```tsx
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { BranchDetailPage } from "./pages/BranchDetailPage.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/branch/:id" element={<BranchDetailPage />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `cd /home/ribacl/restoapp/web && npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Commit**

```bash
cd /home/ribacl/restoapp
git add web/src/pages/BranchDetailPage.tsx web/src/App.tsx
git commit -m "feat: add branch detail page and routing"
```

---

## Task 11: Iconos PWA placeholder + verificación final

**Files:**
- Create: `web/public/icon-192.png`, `web/public/icon-512.png` (placeholders)

- [ ] **Step 1: Generar iconos placeholder**

Run (genera PNGs sólidos simples con ImageMagick si está disponible; si no, crear archivos vacíos válidos no sirve — usar el fallback de abajo):
```
cd /home/ribacl/restoapp/web/public 2>/dev/null || mkdir -p /home/ribacl/restoapp/web/public && cd /home/ribacl/restoapp/web/public
if command -v convert >/dev/null 2>&1; then
  convert -size 192x192 xc:'#0f172a' icon-192.png
  convert -size 512x512 xc:'#0f172a' icon-512.png
else
  echo "ImageMagick no disponible — descargando placeholders"
  curl -sL "https://dummyimage.com/192x192/0f172a/ffffff.png&text=R" -o icon-192.png
  curl -sL "https://dummyimage.com/512x512/0f172a/ffffff.png&text=R" -o icon-512.png
fi
ls -la icon-192.png icon-512.png
```
Expected: existen `icon-192.png` y `icon-512.png` (PNG válidos). Si ninguna opción funciona (sin red ni ImageMagick), reportar BLOCKED — los iconos PWA son necesarios para el manifest; no inventar PNGs corruptos.

- [ ] **Step 2: Correr toda la suite de tests del frontend**

Run: `cd /home/ribacl/restoapp/web && npm run test`
Expected: PASS — client (3) + useNearby (3) + FilterBar (2) + BranchCard (2) = 10 tests.

- [ ] **Step 3: Build de producción + type-check completo**

Run: `cd /home/ribacl/restoapp/web && npm run build`
Expected: `tsc -b` sin errores y `vite build` genera `dist/` con el service worker PWA.

- [ ] **Step 4: Levantar el stack completo (api + postgres + web) y re-seed limpio**

Run:
```
cd /home/ribacl/restoapp && docker compose up -d --build
docker compose exec -T postgres psql -U resto -d restoapp -c 'TRUNCATE "PlaceSuggestion","BranchPurpose","MenuItem","Promotion","ServiceHours","BranchAdmin","Branch","Business","PurposeTag","Plan","User" RESTART IDENTITY CASCADE;'
cd api && DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npm run --silent seed:all
```
Expected: 4 contenedores arriba (api, web, postgres, minio); "Seed completo." + "Seed sample completo.".

- [ ] **Step 5: Verificar que la PWA sirve y carga**

Run:
```
sleep 3
curl -s http://localhost:5173 | grep -q '<div id="root">' && echo "HTML OK"
curl -s "http://localhost:3000/branches/nearby?lat=-33.4378&lng=-70.6504&radius=5000" | head -c 200
```
Expected: "HTML OK" y el JSON de sucursales (el front consume este endpoint).

- [ ] **Step 6: Verificación visual (manual, por el usuario)**

Abrir en el navegador `http://localhost:5173`:
- Permitir ubicación (o usar el fallback Santiago) → ver pins en el mapa y la lista de locales.
- Probar filtros: categoría, propósito, "con promoción", "abierto ahora", radio → la lista y los pins se actualizan.
- Cambiar idioma es/en/pt → la UI se traduce.
- Click en un local → ficha con mapa, promos, horarios y carta.

(El agente no puede tomar screenshots; esta verificación la hace el usuario. El agente confirma solo Steps 2-5.)

- [ ] **Step 7: Commit final**

```bash
cd /home/ribacl/restoapp
git add web/public
git commit -m "chore: add pwa icons and verify frontend" || echo "nada que commitear"
```

---

## Notas para Plan 4 (panel dueño + propuestas)

- La abstracción `<MapView>` está lista; cuando se agregue `/suggest` (proponer local) se necesitará geocoding (dirección→coords) o selección de pin en el mapa — implementar `GeocodingProvider` (Nominatim) ahí.
- Login/registro UI no se construyó aquí; el panel del dueño (Plan 4) agrega autenticación en el front (guardar JWT, header Authorization, rutas protegidas).
- Los tipos en `web/src/api/types.ts` se ampliarán con promociones/carta editables y uploads.
- Para migrar a Google Maps: nuevo proveedor de tiles dentro de `<MapView>` + `GoogleProvider` de geocoding; el resto de la app no cambia.
- Iconos PWA son placeholders; reemplazar por el branding real antes de publicar.