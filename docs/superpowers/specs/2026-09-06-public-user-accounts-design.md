# Cuentas de usuario público — Diseño

Fecha: 2026-09-06
Estado: aprobado (pendiente de plan de implementación)

## Objetivo

Permitir que usuarios finales (no admins) se registren e inicien sesión, para:
1. Atar cada reseña a una cuenta (saber quién opina; nombre real de la cuenta).
2. Guardar favoritos en la cuenta (sincronizados entre dispositivos).

Base para analítica futura, pero **esta ronda es solo atribución** (sin tracking
de eventos).

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
- Nueva unicidad: **una reseña por (userId, branchId)**. Índice único parcial
  donde `userId` no es null. Las reseñas legacy (userId null) no chocan.

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
- Migración 1: `Review.userId` + FK + índice único parcial
  `CREATE UNIQUE INDEX ... ON "Review"("userId","branchId") WHERE "userId" IS NOT NULL`.
- Migración 2: tabla `FavoriteBranch` + FKs + índice.

## Backend

### Reseñas (requieren sesión)
- `POST /branches/:id/reviews`: agregar `authenticate`. Body pasa a
  `{ rating, comment? }` (se elimina `authorName` del input).
- Servicio `addReview(branchId, userId, input)`:
  - `authorName` = `user.name` (lookup).
  - Rechaza con 409 `already_reviewed` si ya existe reseña de ese `userId` en el
    local (reemplaza el dedup por nombre).
- La lectura de reseñas (en `getBranchDetail`) no cambia el shape público:
  sigue exponiendo `authorName`, `rating`, `comment`. (No se filtra por usuario.)

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

### ReviewForm
- Si anónimo: en vez del formulario, un aviso "Inicia sesión para dejar tu
  reseña" con botón que abre el `AuthSheet`.
- Si logueado: formulario sin campo nombre (usa el de la cuenta); solo estrellas
  + comentario. Maneja 409 `already_reviewed` con mensaje "Ya reseñaste este
  local".

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

- **Fase A — Cuentas + reseñas identificadas**: migración `Review.userId`,
  endpoint de reseñas protegido, `AuthSheet` + botón de cuenta en header,
  `signUp` en authClient/AuthContext, `ReviewForm` con gate de login. Tests.
- **Fase B — Favoritos sincronizados**: modelo `FavoriteBranch`, router
  `/me/favorites` (+ merge), refactor de `favorites.ts` a fuente dual, merge en
  login. Tests.

Commit por fase; push al final de cada ronda.

## Manejo de errores

- 401 en endpoints protegidos → el `authedFetch` del web ya reintenta con
  refresh; si falla, se trata como sesión expirada (abrir login).
- 409 `already_reviewed` → mensaje específico en el form.
- Merge/favoritos: ids inexistentes se ignoran silenciosamente.

## Testing

- Backend (vitest + supertest):
  - Reseña sin token → 401; con token crea y liga `userId`; segunda del mismo
    usuario → 409; `authorName` = nombre de la cuenta.
  - Favoritos: add/list/delete idempotentes; merge fusiona y deduplica; sin
    token → 401.
- Web (vitest): `AuthSheet` (registro/login), `ReviewForm` gate anónimo vs
  logueado. Los tests que mockean reseñas/branch se actualizan al nuevo shape.
- `npm test` borra la DB de dev → re-sembrar con `seed:all` después.

## Riesgos / notas

- **Cambio de UX**: reseñar pasa a requerir cuenta (antes anónimo). Aceptado.
- Reseñas del seed quedan con `userId` null (legacy permitido).
- El seed que crea reseñas de ejemplo (`authorName` texto) sigue válido: son
  legacy sin usuario.
- Dedup de reseñas cambia de (nombre+comentario) a (usuario+local).
- Secreto/tokens: sin cambios; se reusa el flujo de refresh existente.
