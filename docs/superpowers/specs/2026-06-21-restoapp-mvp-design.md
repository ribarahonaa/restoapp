# RestoApp — Diseño MVP (slice vertical)

Fecha: 2026-06-21
Estado: aprobado para planificación

## 1. Resumen

PWA web/mobile para descubrir bares, pubs, restaurantes y cafeterías cercanos, y
para que dueños gestionen sus locales. Slice vertical fino que cubre los 3
subsistemas con lo mínimo para validar la idea de punta a punta.

Subsistemas:
1. **App pública** — usuario común busca locales cercanos con filtros.
2. **Panel dueño** — admin de sucursal / admin general gestiona promos, carta, horarios.
3. **Panel superadmin** — crea locales, gestiona cuentas y planes, revisa propuestas.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + PWA (instalable, manifest + service worker) |
| API | Node + Express + TypeScript |
| ORM / migraciones | Prisma |
| Base de datos | PostgreSQL + PostGIS |
| Auth | JWT propio (access + refresh), passwords con argon2, roles en token |
| Storage imágenes | MinIO (S3 compatible) |
| Mapa | Leaflet + OpenStreetMap (con capa de abstracción para migrar a Google) |
| Geocoding | Nominatim hoy, detrás de interfaz `GeocodingProvider` |
| i18n | i18next — UI en es (base) / en / pt |
| Infra | Docker (docker-compose) — todas las dependencias en contenedores |
| Tests | Vitest/Jest + Supertest (API), Vitest + RTL (web), Playwright (E2E opcional) |

**Decisión clave:** API propia (no Supabase) para control total de la lógica.

## 3. Arquitectura

```
┌──────────────────────────────────────────────────────┐
│  docker-compose                                       │
│                                                       │
│  ┌───────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ frontend  │──▶│ api          │──▶│ postgres     │  │
│  │ React+Vite│   │ Node/Express │   │ + PostGIS    │  │
│  │ PWA :5173 │   │ TS  :3000    │   │ :5432        │  │
│  └───────────┘   └──────┬───────┘   └──────────────┘  │
│                         ▼                             │
│                  ┌──────────────┐                     │
│                  │ minio (S3)   │  imágenes carta/promos
│                  │ :9000        │                     │
│                  └──────────────┘                     │
└──────────────────────────────────────────────────────┘
```

- Frontend nunca habla con DB directo — solo vía API.
- Geo: PostGIS + `ST_DWithin` / `ST_Distance` para cercanía.
- Migraciones SQL versionadas vía Prisma en `api/prisma/migrations/`.

### Estructura repo (monorepo)

```
restoapp/
├── docker-compose.yml
├── api/          Node+Express+TS, Prisma, tests
│   ├── prisma/schema.prisma + migrations
│   └── src/{routes,middleware,services,...}
├── web/          React+Vite PWA, i18n, tests
│   └── src/{pages,components,map,i18n,...}
└── docs/superpowers/specs/
```

## 4. Roles

- **usuario** — busca locales, ve fichas, propone locales no registrados.
- **admin_sucursal** — gestiona UNA sucursal (la suya).
- **admin_general** — dueño de la marca; gestiona TODAS sus sucursales.
- **superadmin** — crea negocios/sucursales, gestiona cuentas, planes, propuestas.

## 5. Modelo de datos

```
User
  id, email, password_hash, role[superadmin|admin_general|admin_sucursal|usuario]
  name, preferred_lang[es|en|pt], created_at

Business (marca/negocio)
  id, name, owner_user_id ──▶ User(admin_general), created_at

Branch (sucursal)
  id, business_id ──▶ Business
  name, category[bar|pub|restaurant|cafe]
  address, lat, lng (PostGIS point)
  phone, description
  plan_id ──▶ Plan        (plan POR sucursal)
  active (bool), created_at

BranchAdmin  (M:N — admin_sucursal ↔ branch)
  user_id ──▶ User, branch_id ──▶ Branch

ServiceHours
  id, branch_id, weekday[0-6], open_time, close_time

Promotion
  id, branch_id, title, description, image_url
  starts_at, ends_at, active

MenuItem
  id, branch_id, name, description, price, image_url, category

PurposeTag  (seed fijo, traducido)
  id, slug, label_es, label_en, label_pt

BranchPurpose (M:N branch ↔ tag)
  branch_id, tag_id

Plan
  id, name[Free|Pro|...], features(jsonb), max_promos, max_menu_items
  (sin precio real / sin pago en MVP)

PlaceSuggestion
  id, suggested_by ──▶ User
  name, category, address, lat, lng, note
  status[pending|approved|rejected]
  created_at, reviewed_by, reviewed_at
```

Reglas derivadas:
- **Promo activa ahora** = `active AND now() BETWEEN starts_at AND ends_at`.
- **Abierto ahora** = weekday actual dentro de algún `ServiceHours`.
- **Límite de plan** se chequea al crear promo/menu (ej. Free = 1 promo).
- **i18n contenido**: solo UI traducida. Contenido del dueño (carta, promos) queda
  como lo escribe. Excepción: `PurposeTag` viene traducido por ser dato semilla fijo.

## 6. API — Endpoints

### Auth
```
POST /auth/register      → usuario común
POST /auth/login         → JWT access + refresh
POST /auth/refresh
GET  /auth/me
```

### Público (usuario común)
```
GET /branches/nearby?lat&lng&radius&category&purpose&promo=1&open=1
       → lista ordenada por distancia, filtros combinables
GET /branches/:id        → ficha: horarios, carta, promos activas
GET /purposes            → tags para filtro UI
POST /suggestions        → propone local no registrado
GET  /suggestions/mine   → estado de mis propuestas
```

### Admin sucursal / general
```
GET/POST/PUT/DELETE /branches/:id/promotions
GET/POST/PUT/DELETE /branches/:id/menu-items
GET/PUT             /branches/:id/hours
PUT                 /branches/:id          (datos básicos)
POST                /uploads               (imagen → MinIO, devuelve url)
```

### Superadmin
```
POST/PUT/DELETE /businesses
POST/PUT/DELETE /branches            (crea locales)
POST/PUT/DELETE /users               (gestiona cuentas, asigna admins)
GET/POST/PUT    /plans
PUT             /branches/:id/plan   (asigna plan a sucursal)
GET             /suggestions         (lista pendientes)
PUT             /suggestions/:id     (aprueba → crea Business+Branch | rechaza)
```

## 7. Matriz de permisos (middleware)

| Acción | usuario | admin_suc | admin_gen | superadmin |
|---|:-:|:-:|:-:|:-:|
| ver/buscar locales | ✅ | ✅ | ✅ | ✅ |
| proponer local | ✅ | ❌ | ❌ | ❌ |
| editar promos | ❌ | ✅ solo suya | ✅ sus sucursales | ✅ todas |
| editar carta | ❌ | ✅ solo suya | ✅ sus sucursales | ✅ todas |
| editar horarios | ❌ | ✅ solo suya | ✅ sus sucursales | ✅ todas |
| editar datos sucursal | ❌ | ✅ solo suya | ✅ sus sucursales | ✅ todas |
| crear negocio/sucursal | ❌ | ❌ | ❌ | ✅ |
| gestionar usuarios | ❌ | ❌ | ❌ | ✅ |
| asignar plan | ❌ | ❌ | ❌ | ✅ |
| revisar/aprobar propuestas | ❌ | ❌ | ❌ | ✅ |

Al aprobar una propuesta, el superadmin crea Business + Branch desde sus datos y
asigna admin después.

## 8. Frontend — Mapa de pantallas

### App pública (usuario)
```
/                 → mapa + lista locales cercanos (pide geolocalización)
                    filtros: categoría · propósito · promo activa · abierto ahora · radio
/branch/:id       → ficha: fotos, carta, horarios, promos activas, dirección/mapa
/suggest          → formulario proponer local (pin en mapa)
/me/suggestions   → estado de mis propuestas
/login /register
```

### Panel dueño (admin_sucursal / admin_general)
```
/admin                       → selector sucursal (general ve varias, sucursal ve 1)
/admin/:branch/promotions    → CRUD promos (con límite plan)
/admin/:branch/menu          → CRUD carta
/admin/:branch/hours         → editor horarios semana
/admin/:branch/settings      → datos básicos sucursal
```

### Panel superadmin
```
/super/businesses   → CRUD negocios + sucursales
/super/users        → CRUD usuarios, asignar admins
/super/plans        → CRUD planes
/super/suggestions  → revisar/aprobar propuestas
```

### Transversal
- Selector idioma es/en/pt (i18next) — guarda `preferred_lang`.
- PWA instalable.

## 9. Abstracción de mapa (plan migración a Google)

- Componente `<MapView>` envuelve Leaflet; el resto de la app nunca importa Leaflet directo.
- Servicio `geocoding` detrás de interfaz `GeocodingProvider`:
  - `NominatimProvider` (hoy, gratis).
  - `GoogleProvider` (futuro).
- Coords en DB en estándar WGS84 (lat/lng) — válidas para ambos proveedores.
- Migrar = nuevo provider + swap interno de `<MapView>`. La app no se entera.

## 10. Testing

- **API**: Vitest/Jest + Supertest. Unit (lógica plan, permisos, geo) +
  integration (endpoints contra Postgres de test en Docker).
- **Frontend**: Vitest + React Testing Library (componentes, filtros).
- **E2E** (opcional MVP): Playwright — buscar→ver ficha; login admin→crear promo.
- Foco MVP: tests de permisos por rol, query geo y límites de plan.

## 11. Fuera de alcance (MVP)

- Pagos reales / pasarela (planes solo como datos).
- i18n de contenido del dueño (solo UI traducida).
- App nativa (solo PWA).
- Google Maps (solo Leaflet/OSM, con plan de migración).
- Reviews/ratings, favoritos, notificaciones push.
```
