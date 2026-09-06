# Deploy gratis (para probar)

Objetivo: subir la app a free-tiers y ver cómo funciona. Tres piezas:

| Pieza | Servicio | Costo |
|---|---|---|
| Postgres + PostGIS | **Supabase** | gratis |
| API (Docker) | **Render** | gratis (duerme tras 15 min inactivo) |
| Web (SPA) | **Cloudflare Pages** | gratis |
| Imágenes (opcional) | Supabase Storage / Cloudflare R2 | gratis |

> El primer test **no necesita storage**: los locales se siembran igual, sin
> fotos (cae al gradiente por categoría). Para tener fotos, ver el paso 5.

---

## 1. Base de datos — Supabase

1. Crea cuenta en [supabase.com](https://supabase.com) → **New project**. Guarda la
   contraseña de la base.
2. **Database → Extensions** → busca `postgis` y **habilítalo**. (Las migraciones
   igual hacen `CREATE EXTENSION IF NOT EXISTS postgis`, pero habilitarlo aquí
   evita problemas de permisos.)
3. Botón **Connect** (arriba) → pestaña **Session pooler** → copia la URI.
   Se ve así:
   ```
   postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
   - **Usa el Session pooler (puerto 5432), NO la conexión directa.** Render sale
     por IPv4 y la conexión directa de Supabase es IPv6 → no conecta.
   - Reemplaza `<PASSWORD>` por la contraseña real y **agrega `?schema=public`** al
     final. Esta es tu `DATABASE_URL`.

---

## 2. API — Render

Opción A (blueprint, recomendada):

1. Sube el repo a GitHub (ya está en `ribarahonaa/restoapp`).
2. En [render.com](https://render.com) → **New → Blueprint** → conecta el repo.
   Render lee `render.yaml` y crea el servicio `restoapp-api`.
3. Completa las variables marcadas (Render las pide):
   - `DATABASE_URL` → la del paso 1.
   - `CORS_ORIGIN` → déjala en blanco por ahora (la llenas en el paso 4).
   - `SEED_ON_START` → **`true`** para el primer deploy (siembra datos).
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` → Render los genera solo.
   - Storage (`MINIO_*`) → déjalas vacías si no vas a usar fotos aún.
4. **Deploy**. Al arrancar corre `prisma migrate deploy` y, con `SEED_ON_START=true`,
   siembra plans/tags/superadmin + locales demo.
5. Cuando termine, copia la URL pública del API (ej. `https://restoapp-api.onrender.com`).
6. **Importante:** vuelve a poner `SEED_ON_START=false` y redeploy, para no re-sembrar
   en cada reinicio.

Opción B (manual): New → Web Service → Docker → `dockerfilePath: api/Dockerfile.prod`,
root `api`, plan Free, y las mismas env vars.

Verifica: `https://<api>.onrender.com/health` → `{"ok":true}`.

Credenciales sembradas: dueño `owner@demo.cl` / `owner12345`, superadmin
`admin@restoapp.cl` / `admin12345`.

---

## 3. Web — Cloudflare Pages

1. En [pages.cloudflare.com](https://pages.cloudflare.com) → **Create → Connect to Git**
   → el repo.
2. Configuración de build:
   - **Root directory:** `web`
   - **Framework preset:** Vite (o None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Variables de entorno** (build):
   - `VITE_API_URL` = la URL del API de Render (paso 2.5). Sin barra final.
4. **Save and Deploy**. Copia la URL final (ej. `https://restoapp.pages.dev`).

El archivo `web/public/_redirects` ya deja el ruteo SPA funcionando (deep links).

---

## 4. Cerrar el círculo — CORS

1. En Render → servicio API → **Environment** → `CORS_ORIGIN` = la URL de Cloudflare
   Pages (ej. `https://restoapp.pages.dev`). Sin barra final.
2. Redeploy del API.

Listo: abre la URL de Pages. Login dueño en `/admin/login`.

---

## 5. (Opcional) Imágenes — Supabase Storage

Sin esto la app funciona, sólo sin fotos. Para habilitarlas:

1. Supabase → **Storage** → crea un bucket `restoapp` **público**.
2. Supabase → **Project Settings → Storage** → sección **S3 Connection**: habilita
   y crea unas **access keys** S3. Anota endpoint, region, access key y secret.
3. En Render (API) setea:
   - `MINIO_USE_SSL` = `true`
   - `MINIO_ENDPOINT` = host del endpoint S3 (sin `https://`), ej
     `<ref>.storage.supabase.co`
   - `MINIO_PORT` = `443`
   - `MINIO_ROOT_USER` = access key S3
   - `MINIO_ROOT_PASSWORD` = secret S3
   - `MINIO_BUCKET` = `restoapp`
   - `MINIO_PUBLIC_URL` = URL pública base del bucket, ej
     `https://<ref>.supabase.co/storage/v1/object/public`
4. Para poblar fotos demo: `SEED_ON_START=true` un deploy (o corre `npm run seed:sample`
   desde la Shell de Render) y vuelve a `false`.

> Alternativa a Supabase Storage: **Cloudflare R2** (S3-compatible, sin egress).
> Mismos `MINIO_*` apuntando a R2.

---

## Límites del free-tier

- **Render free duerme** tras ~15 min sin tráfico. La primera carga después
  tarda 30–60 s (cold start). Normal para probar.
- Supabase free: 500 MB de base, se pausa tras inactividad prolongada.
- Cloudflare Pages: sin límite práctico para esto.

## Prod de verdad (después)

Para algo serio: VPS con `docker-compose` + Caddy, o managed sin cold start
(Railway/Fly para el API, Postgres dedicado, R2 para storage). Ver notas en el
historial del proyecto.
