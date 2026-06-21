# RestoApp — Paneles de administración, monetización y anuncios (Plan 4) — Diseño

## Contexto

RestoApp ya tiene tres fases en `main`: la **fundación** (Docker, Postgres+PostGIS, MinIO, API Express+Prisma, auth JWT con roles y middleware `authenticate`/`authorize`), la **discovery API** (endpoints públicos de cercanía/ficha) y el **frontend discovery** (PWA pública con mapa, filtros, ficha con tabs, reseñas e imágenes servidas desde MinIO).

Hoy todo el contenido (locales, menús, promos, imágenes, reseñas) se carga por *seed*. Falta la operación real: que un **superadmin** dé de alta empresas y locales, y que los **dueños** gestionen su contenido. Esta fase construye esa capa privada — dos paneles web detrás de login — más la **monetización** (planes con límites + solicitudes de upgrade) y la **publicidad** (anuncios geo-priorizados con sección y popup). El discovery público no cambia su naturaleza, pero suma: cupones en la ficha, cierres temporales en "abierto ahora", y la sección/popup de anuncios.

El schema de la fundación ya contempla varias de estas piezas (`Business`, `BranchAdmin`, `Plan`, roles), por lo que gran parte es construir endpoints + UI sobre datos existentes.

## Jerarquía de roles (confirmada con el usuario)

- **`superadmin`** — provisiona todo. No hay registro público. Crea empresas, locales, cuentas, asigna planes, revisa solicitudes (upgrade y anuncios), crea anuncios.
- **`admin_general`** — dueño de un `Business`. Gestiona **todas** las sucursales de su empresa y su contenido. Puede crear sucursales nuevas (acotado por el plan).
- **`admin_sucursal`** — gestiona **un** local (los `Branch` donde figura en `BranchAdmin`).
- **`usuario`** — sin acceso al panel.

## Arquitectura

- **Backend:** nuevo router `admin` montado en `/admin`, todo detrás de `authenticate`. Reutiliza `/auth` (login/refresh/me) y `authorize(...roles)` de la fundación. Se agrega un middleware **ownership** que resuelve si el `branchId`/`businessId` del request pertenece al usuario (admin_general → su business; admin_sucursal → su `BranchAdmin`; superadmin → saltea). Las imágenes se suben vía `multer` (memoria) y se almacenan en MinIO con el cliente `api/src/storage/minio.ts` ya existente.
- **Frontend:** la SPA suma un área privada `/admin/*`. `AuthContext` mantiene el access token en memoria y el refresh en `localStorage`, con auto-refresh. `RequireRole` protege rutas. El discovery público (`/`, `/branch/:id`) se mantiene, sumando sección de anuncios y popup.
- **Aislamiento:** cada recurso (locales, menú, promos, códigos, anuncios, solicitudes) es un módulo backend (`routes`+`service`) y una pantalla frontend independientes, comunicados por el cliente API tipado.

## Cambios de schema (migración manual que preserva la columna `geog` de PostGIS)

- **`Plan`** → agregar `maxBranches Int @default(1)`. (Ya tiene `maxPromos`, `maxMenuItems`.)
- **`Branch`** → agregar `closedUntil DateTime?` (cierre temporal excepcional).
- **`DiscountCode`** (nuevo): `id`, `businessId`, `branchId String?` (null = toda la cadena del business), `code`, `type` enum `percent|amount`, `value Decimal`, `startsAt`, `endsAt`, `active`, timestamps. Índices por `branchId`/`businessId`.
- **`PlanUpgradeRequest`** (nuevo): `id`, `businessId`, `requestedPlanId`, `note String?`, `status` enum `pending|approved|rejected`, `createdBy`, `reviewedBy String?`, `reviewedAt DateTime?`, timestamps.
- **`AdRequest`** (nuevo): `id`, `businessId`, `branchId String?` (null = cadena), `desiredStartsAt`, `desiredEndsAt`, `wantsPopup Boolean`, `note String?`, `status` enum `pending|approved|rejected`, `createdBy`, `reviewedBy String?`, timestamps.
- **`Ad`** (nuevo): `id`, `businessId`, `branchId String?` (null = cadena), `title`, `description String?`, `imageUrl String?`, `placement` enum `section|popup`, `startsAt`, `endsAt`, `active Boolean`, `createdBy`, timestamps. Índices por fechas/`active`.

## Reglas de negocio

- **Límites de plan:** al crear sucursal/promo/ítem de menú se cuenta contra `maxBranches`/`maxPromos`/`maxMenuItems` del plan correspondiente; si excede → `403` con código claro (ej. `plan_limit_branches`). El front muestra el contador y, al topar sucursales, ofrece "Solicitar upgrade".
- **Cierre temporal:** si `Branch.closedUntil` es futuro, el local figura **cerrado ahora** en el discovery aunque su horario regular indique abierto. Afecta el filtro `open` de `nearby` y el estado en la ficha. Toggle "Cerrar ahora / Reabrir" en el panel (general y sucursal).
- **Cupones (público):** la ficha muestra los `DiscountCode` vigentes del local — los de su `branchId` más los del `business` con `branchId = null`. Solo visualización (canje fuera de la app).
- **Anuncios (geo):** `GET /ads?lat&lng` devuelve los `Ad` vigentes (`placement=section`, dentro de `[startsAt,endsAt]`, `active`) ordenados por **distancia** del usuario a la sucursal (o a la sucursal más cercana del business si es de cadena), usando PostGIS como en `nearby`. `GET /ads/popup?lat&lng` devuelve **un** popup vigente respetando un **cupo diario configurable** (`MAX_POPUPS_PER_DAY`, default 3) — se elige por proximidad/prioridad; el front lo muestra una vez por sesión (`sessionStorage`).
- **Solicitudes (upgrade y anuncio):** las crea el dueño; el superadmin las aprueba/rechaza. Aprobar un `PlanUpgradeRequest` cambia el `Plan` del business. Aprobar un `AdRequest` abre el formulario de creación de `Ad` (el pago se coordina fuera de la plataforma).

## Endpoints

**Públicos (discovery):**
- `GET /ads?lat&lng` — anuncios de sección, vigentes, por proximidad.
- `GET /ads/popup?lat&lng` — popup a mostrar (o vacío), respeta cupo diario.
- `GET /branches/:id` — sumar `discountCodes` vigentes y reflejar `closedUntil` en el estado.
- `GET /branches/nearby` — el filtro `open` considera `closedUntil`.

**Admin — superadmin:**
- `Business`: crear (con su `admin_general`) / listar / editar.
- `Branch`: crear / editar / activar-desactivar (cualquiera).
- `User`/cuentas: crear admin, asignar `BranchAdmin`, asignar `Plan`.
- `PlanUpgradeRequest`: listar / aprobar / rechazar.
- `Ad`: CRUD. `AdRequest`: listar / aprobar (→ crea Ad) / rechazar.

**Admin — dueño (`admin_general`/`admin_sucursal`, con ownership):**
- listar mis locales; editar local (datos + imagen); activar/desactivar (general); cerrar/reabrir (ambos).
- horarios (general: todas sus sucursales; sucursal: la suya).
- menú CRUD (+imagen, límite); promos CRUD (+imagen, límite); `DiscountCode` CRUD (sucursal→su branch; general→branch o toda la cadena).
- crear sucursal (general; límite `maxBranches`); `PlanUpgradeRequest` crear; `AdRequest` crear.

**Upload:** `POST /admin/uploads` (multipart, autenticado) → valida tipo (jpeg/png/webp) y tamaño → sube a MinIO → devuelve URL pública. Los forms guardan esa URL en `imageUrl`.

## Frontend

- **Auth:** `AuthContext` (access en memoria, refresh en `localStorage`, auto-refresh), página **Login**, `RequireRole`, logout. Cliente API con header `Authorization` e interceptor de refresh.
- **Layout `/admin`** con navegación según rol.
- **Superadmin:** empresas (lista/crear), locales (lista/crear/editar), cuentas (crear+asignar), planes (asignar), bandeja de **solicitudes de upgrade**, **anuncios** (CRUD) y **solicitudes de anuncio** (aprobar→crear Ad).
- **Dueño:** mis locales; editor de local (datos + `ImageUploader` + `MapPicker`); editor de **horarios** (semanal); **menú** y **promos** (CRUD + imagen, contador de límite); **códigos de descuento**; botón "Crear sucursal" (con `MapPicker`); modales "Solicitar upgrade" y "Solicitar anuncio".
- **Componentes nuevos:** `ImageUploader` (sube al API, preview), `MapPicker` (Leaflet: clic fija lat/lng), formularios reutilizables, tablas/listas.
- **Discovery público:** `AdSection` (carrusel en la home) y `AdPopup` (modal una vez por sesión); cupones en la ficha; indicador "Cerrado temporalmente".
- **i18n** es/en/pt para todas las pantallas nuevas.

## Testing

- **API:** auth/ownership (un dueño no toca recursos de otro), límites de plan (`maxBranches`/`maxPromos`/`maxMenuItems`), upload (tipo/tamaño), `PlanUpgradeRequest` (aprobar cambia plan), `AdRequest` (aprobar crea Ad), `GET /ads` orden por proximidad y ventana de fechas, popup con cupo diario, `closedUntil` en `nearby`/detalle, cupones en la ficha.
- **Web:** `AuthContext` (login/refresh/logout), `RequireRole` (redirección por rol), forms clave (crear local con MapPicker, subir imagen, crear código), `AdPopup` (una vez por sesión).

## Verificación end-to-end

1. Migración + seed: nuevas tablas creadas, `geog` intacta; seed siembra planes con límites, un superadmin, una empresa demo con admin_general/sucursal, y algún Ad/cupón de ejemplo.
2. Login como cada rol → ver solo lo permitido; un dueño no accede a recursos de otra empresa (403).
3. Dueño: edita local, sube imagen (aparece en MinIO y en la ficha pública), crea promo/menú hasta el límite (bloqueo + solicitar upgrade), crea código (aparece en la ficha), cierra temporalmente (desaparece de "abierto ahora"), solicita anuncio.
4. Superadmin: aprueba upgrade (plan cambia), aprueba solicitud de anuncio y publica Ad; el Ad aparece en la sección por proximidad y el popup respeta el cupo diario.
5. Tests API + web verdes; `tsc`/build limpios.

## Alcance fuera de esta fase

`PlaceSuggestion` (sugerencias públicas) y su moderación, pasarela de pago real, registro self-service de dueños, y canje/uso de cupones dentro de la app.

## Sub-planes sugeridos para `writing-plans`

Por tamaño, conviene ejecutar en capas (cada una con su plan):
1. **Base auth + upload + schema:** migración (todas las entidades nuevas), router `admin`, middleware ownership, endpoint de upload, `AuthContext`/login/rutas protegidas en la web.
2. **Panel del dueño:** locales/horarios/cierre, menú, promos, códigos de descuento, crear sucursal + límites, solicitudes (upgrade/anuncio). Discovery: cupones + `closedUntil`.
3. **Panel superadmin + anuncios:** empresas/locales/cuentas/planes, bandejas de solicitudes, CRUD de anuncios, endpoints públicos `GET /ads` + popup, `AdSection`/`AdPopup` en la home.
