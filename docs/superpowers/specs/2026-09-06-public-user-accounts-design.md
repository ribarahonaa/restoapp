# Cuentas de usuario público — Diseño

Fecha: 2026-09-06
Estado: aprobado (pendiente de plan de implementación)

## Objetivo

Permitir que usuarios finales (no admins) se registren e inicien sesión, para:
1. Atar cada reseña a una cuenta (saber quién opina; nombre real de la cuenta).
2. Guardar favoritos en la cuenta (sincronizados entre dispositivos).
3. **Reseñas verificadas por presencia**: solo puede reseñar quien hizo check-in
   en el local (GPS dentro de radio) y esperó un mínimo de tiempo — así la
   reseña evidencia que la persona realmente estuvo ahí.

Base para analítica futura, pero **esta ronda es solo atribución** (sin tracking
de eventos).

### Límite técnico asumido (presencia)

La web no rastrea ubicación en segundo plano; solo con la app abierta y el GPS
es falsificable. Por eso la verificación es una **señal razonable, no prueba
dura**, y se modela como híbrido "check-in + espera" (no permanencia continua):
el check-in marca la llegada cerca del local, y la reseña se habilita si pasó el
mínimo de tiempo **y** el GPS sigue cerca al reseñar. Sin GPS disponible, no se
puede reseñar.

## Fuera de alcance (esta ronda)

- Tracking de eventos (vistas, clics) — otra ronda.
- Edición/borrado de reseñas por el usuario.
- Recuperación de contraseña, verificación de email, OAuth.
- Perfil de usuario editable (avatar, bio).

## Contexto existente (reutilizable)

- `POST /auth/register` ya crea usuarios con rol `usuario`; `POST /auth/login`,
  `GET /auth/me`, y refresh con rotación/revocación ya existen.
- Web: `AuthContext` (signIn/signOut/user/status) y `authClient` (login, me,
  refreshSession, logout, authedFetch con retry en 401). El admin usa esto.
- Reseñas hoy: `POST /branches/:id/reviews` anónimo, `authorName` texto libre,
  dedup por (branchId, authorName, rating, comment) en 24h.
- Favoritos hoy: store reactivo en `localStorage` (`web/src/lib/favorites.ts`).

## Modelo de datos

### Review (modificado)
- Agregar `userId String?` con FK a `User` (`onDelete: SetNull`). Nullable para
  no romper reseñas legacy del seed.
- `authorName` se conserva: snapshot del `user.name` al crear (display estable
  aunque el usuario cambie su nombre después).
- Agregar `verified Boolean @default(false)`: true cuando la reseña pasó la
  verificación de presencia. Como sin GPS se bloquea, las reseñas nuevas son
  todas `verified=true`; las legacy del seed quedan `false`.
- Nueva unicidad: **una reseña por (userId, branchId)**. Índice único parcial
  donde `userId` no es null. Las reseñas legacy (userId null) no chocan.

### Visit (nuevo) — check-in de presencia
```
model Visit {
  userId    String
  branchId  String
  startedAt DateTime @default(now())  // llegada (no se resetea en re-check-in)
  lastSeenAt DateTime @default(now()) // último check-in, para frescura
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch    Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  @@id([userId, branchId])
  @@index([userId])
}
```

### FavoriteBranch (nuevo)
```
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

### Migraciones
- A mano + `prisma migrate deploy` (igual que `refresh_tokens`), porque
  `prisma migrate dev` intenta dropear la columna `geog` de PostGIS.
- Migración 1 (Fase A): `Review.userId` + `Review.verified` + FK + índice único
  parcial `CREATE UNIQUE INDEX ... ON "Review"("userId","branchId") WHERE "userId" IS NOT NULL`.
- Migración 2 (Fase B): tabla `FavoriteBranch` + FKs + índice.
- Migración 3 (Fase C): tabla `Visit` + FKs + índice.

### Constantes (config)
- `PRESENCE_RADIUS_M` (default 150): radio para considerar "en el local".
- `REVIEW_MIN_DWELL_MINUTES` (default 20): espera mínima desde el check-in.
- Vía env (con defaults), para poder ajustarlas sin deploy de código.

## Backend

### Reseñas (requieren sesión + presencia)
- `POST /branches/:id/reviews`: agregar `authenticate`. Body pasa a
  `{ rating, comment?, lat, lng }` (se elimina `authorName`; `lat/lng` = posición
  actual del usuario, obligatorios).
- Verificación de presencia antes de crear (403 con `reason` si falla):
  1. `too_far`: `lat/lng` fuera de `PRESENCE_RADIUS_M` del local (haversine
     contra `branch.lat/lng`).
  2. `no_checkin`: no existe `Visit` del usuario en el local.
  3. `too_soon`: `now - visit.startedAt < REVIEW_MIN_DWELL_MINUTES`.
  (Sin `lat/lng` → 400 `validation_error`; el front bloquea si el GPS está
  denegado, así que nunca llega sin coords.)
- Servicio `addReview(branchId, userId, input)`:
  - `authorName` = `user.name` (lookup); `verified = true`.
  - Rechaza con 409 `already_reviewed` si ya existe reseña de ese `userId` en el
    local (reemplaza el dedup por nombre).
- La lectura de reseñas (en `getBranchDetail`) expone además `verified` por
  reseña, para el badge "Visita verificada". Sigue sin filtrar por usuario.

### Check-in de presencia (nuevo, requiere sesión)
- `POST /branches/:id/checkin` con `{ lat, lng }`:
  - Verifica que `lat/lng` esté dentro de `PRESENCE_RADIUS_M` (403 `too_far`).
  - Upsert `Visit`: si no existe crea con `startedAt=now`; si existe conserva
    `startedAt` y actualiza `lastSeenAt=now`.
  - Devuelve `{ startedAt, canReviewAt }` (canReviewAt = startedAt + dwell) para
    que el front muestre la cuenta regresiva.
- `GET /branches/:id/review-eligibility?lat=&lng=` → `{ eligible, reason?, canReviewAt? }`
  para decidir qué mostrar en el detalle sin intentar el POST.

### Favoritos (nuevo router `/me/favorites`, requiere sesión)
- `GET /me/favorites` → lista de `branchId` del usuario (`string[]`).
- `POST /me/favorites/:branchId` → agrega (idempotente; 204).
- `DELETE /me/favorites/:branchId` → quita (idempotente; 204).
- `POST /me/favorites/merge` con `{ ids: string[] }` → agrega todos los ids que
  falten (fusión de favoritos locales al iniciar sesión); devuelve la lista
  resultante. Ignora ids de locales inexistentes.
- Middleware: `authenticate` (cualquier rol autenticado, incluido `usuario`).

## Frontend

### Auth pública (modal)
- Botón de cuenta en el header del discovery (`HomePage`): si anónimo muestra
  "Ingresar"; si logueado muestra el nombre + menú con "Cerrar sesión".
- **Modal `AuthSheet`**: tabs Ingresar / Crear cuenta. Reusa `AuthContext`; se
  agrega `signUp(name, email, password)` que llama `POST /auth/register` y deja
  la sesión iniciada (el endpoint ya devuelve tokens).
- El login de admin sigue en `/admin/login` sin cambios.

### ReviewForm + presencia
- Estados (en orden de gate):
  1. **Anónimo** → aviso "Inicia sesión para reseñar" + botón que abre `AuthSheet`.
  2. **Logueado, sin GPS** (denegado/no disponible) → aviso "Activa la ubicación
     para poder reseñar" (bloquea; decisión de producto).
  3. **Logueado, sin check-in / muy lejos** → botón **"Estoy aquí (check-in)"**
     que pide GPS y llama al endpoint; si `too_far`, "Acércate al local".
  4. **Con check-in, falta tiempo** → "Podrás reseñar en ~N min" (cuenta
     regresiva hasta `canReviewAt`).
  5. **Elegible** → formulario sin campo nombre (usa la cuenta): estrellas +
     comentario. 409 `already_reviewed` → "Ya reseñaste este local".
- El detalle consulta `review-eligibility` (con GPS actual) para pintar el estado
  correcto. La posición se obtiene con el `useGeolocation` existente.
- Badge **"Visita verificada"** en cada reseña con `verified=true`.

### Favoritos (fuente según sesión)
- `favorites.ts` pasa a tener dos fuentes:
  - Anónimo: `localStorage` (como hoy).
  - Logueado: servidor. Al montar sesión, carga `GET /me/favorites`; `toggle`
    hace POST/DELETE optimista y persiste.
- Al iniciar sesión: `POST /me/favorites/merge` con los ids de `localStorage`,
  luego usa el servidor como fuente. (Los locales se conservan como respaldo
  pero dejan de ser la fuente mientras haya sesión.)
- El corazón (`FavButton`) y el toggle "Favoritos" del home no cambian de API;
  solo cambia de dónde sale el estado.

## Faseo

- **Fase A — Cuentas + reseñas identificadas**: migración `Review.userId` +
  `verified`, endpoint de reseñas protegido (sin presencia todavía, o con
  presencia si se hace junto a C), `AuthSheet` + botón de cuenta en header,
  `signUp` en authClient/AuthContext, `ReviewForm` con gate de login. Tests.
- **Fase B — Favoritos sincronizados**: modelo `FavoriteBranch`, router
  `/me/favorites` (+ merge), refactor de `favorites.ts` a fuente dual, merge en
  login. Tests.
- **Fase C — Reseñas verificadas por presencia**: modelo `Visit`, endpoints de
  check-in y eligibility, verificación de presencia en el POST de reseñas,
  constantes de radio/tiempo, UI de check-in + cuenta regresiva + badge
  "Visita verificada". Tests.

Nota: A y C tocan el mismo endpoint de reseñas; el plan puede fusionarlas o
hacer A dejando el POST protegido y C agregando la verificación de presencia
encima. Se decide en el plan. Commit por fase; push al final de cada ronda.

## Manejo de errores

- 401 en endpoints protegidos → el `authedFetch` del web ya reintenta con
  refresh; si falla, se trata como sesión expirada (abrir login).
- 409 `already_reviewed` → mensaje específico en el form.
- Merge/favoritos: ids inexistentes se ignoran silenciosamente.

## Testing

- Backend (vitest + supertest):
  - Reseña sin token → 401; con token+presencia crea y liga `userId`, `verified`;
    segunda del mismo usuario → 409; `authorName` = nombre de la cuenta.
  - Presencia: reseña sin check-in → 403 `no_checkin`; con check-in reciente →
    403 `too_soon`; lejos → 403 `too_far`; check-in viejo + cerca → crea.
  - Check-in: dentro de radio ok; fuera → 403; re-check-in conserva `startedAt`.
  - Favoritos: add/list/delete idempotentes; merge fusiona y deduplica; sin
    token → 401.
- Web (vitest): `AuthSheet` (registro/login), `ReviewForm` gates (anónimo /
  sin GPS / sin check-in / falta tiempo / elegible). Los tests que mockean
  reseñas/branch se actualizan al nuevo shape (`verified`).
- `npm test` borra la DB de dev → re-sembrar con `seed:all` después.

## Riesgos / notas

- **Cambio de UX**: reseñar pasa a requerir cuenta **y** check-in con GPS (antes
  anónimo, sin ubicación). Sube la fricción; es intencional (reseñas confiables).
- **Presencia no es prueba dura**: GPS falsificable y sin tracking en segundo
  plano. El híbrido "check-in + espera" es una señal, no garantía. `verified`
  refleja "pasó la verificación", no "estuvo con certeza".
- Sin GPS se excluye a quien no da permiso de ubicación (decisión aceptada).
- Reseñas del seed quedan con `userId` null y `verified=false` (legacy).
- El seed que crea reseñas de ejemplo (`authorName` texto) sigue válido: legacy
  sin usuario ni verificación.
- Dedup de reseñas cambia de (nombre+comentario) a (usuario+local).
- Verificación de distancia server-side con haversine sobre `branch.lat/lng`
  (no requiere PostGIS; el `geog` se sigue usando solo para el discovery).
- Secreto/tokens: sin cambios; se reusa el flujo de refresh existente.
