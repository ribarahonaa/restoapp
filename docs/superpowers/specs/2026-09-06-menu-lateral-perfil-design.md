# Menú lateral (drawer) + perfil de usuario con avatar — Design Spec

**Fecha:** 2026-09-06
**Estado:** aprobado (diseño)

## Problema

El header de la home quedó apretado tras agregar el login: el nombre del usuario
se trunca ("Raul Bar…") y compite por espacio con `CERRAR SESIÓN` y el switch de
idioma `ES/EN/PT`. No hay lugar para un perfil de usuario ni para funciones futuras.

## Objetivo

1. Un **menú hamburguesa** que abre un **panel lateral (drawer) desde el borde
   izquierdo** (entra izquierda→derecha).
2. Mover al drawer lo que hoy satura el header: **idioma** y **cerrar sesión**.
3. Una **sección de perfil** en el drawer: avatar, nombre, correo, editar nombre,
   cambiar contraseña, cambiar/quitar foto.
4. **Avatar de usuario con imagen** subida por el usuario (reutilizando la
   infraestructura de subida existente), con fallback a iniciales.

El drawer queda como shell estructural para hospedar filtros y features futuras
(no en v1).

## Alcance (decisiones tomadas)

- **Filtros/búsqueda:** se quedan donde están (top bar). El drawer NO los toma en
  v1; queda preparado para recibirlos después.
- **Avatar:** subida real de imagen (nuevo endpoint + columna `User.avatarUrl` +
  fallback iniciales).
- **Perfil v1 incluye:** editar nombre, cambiar/quitar avatar, cambiar contraseña,
  ver correo (solo lectura).
- **Layout:** panel desde la izquierda; header = hamburguesa (izq) + marca +
  avatar (der).

### Fuera de v1 (YAGNI)
Filtros dentro del drawer, recorte/redimensionado de imagen en cliente, borrado del
objeto anterior en minio al reemplazar el avatar (se deja huérfano; aceptable).

## Arquitectura

Reutiliza los patrones existentes del repo:
- Subida: `api/src/admin/uploads.routes.ts` (multer memoryStorage, allowlist
  `image/jpeg|png|webp`, límite 5MB, `uploadSingle`) + `api/src/storage/minio.ts`
  (`uploadBuffer(buffer, mimetype, key) → url`).
- Hash: `api/src/auth/password.ts` (argon2: `hashPassword`, `verifyPassword`).
- `me`: `GET /auth/me` con `select` explícito en `api/src/auth/auth.routes.ts`.
- Modal/panel: patrón de `web/src/components/ItemSheet.tsx` (overlay `bg-ink/50`,
  cierre Escape/overlay, animación).
- Migraciones a mano + `prisma migrate deploy` (NUNCA `migrate dev`).

## Backend

### Migración `20260906040000_user_avatar`
Agrega columna nullable:
```sql
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
```
Schema: `avatarUrl String?` en `model User`.

### `GET /auth/me`
Agregar `avatarUrl: true` al `select`. Respuesta gana `avatarUrl: string | null`.

### Router de perfil `api/src/me/profile.routes.ts`
Montado `app.use("/me", authenticate, profileRouter)`. **Montar `/me/favorites`
ANTES de `/me`** en `app.ts` para que el router de favoritos no quede sombreado.
Los paths del router de perfil (`/`, `/password`, `/avatar`) no colisionan con
`/favorites`.

Endpoints (todos autenticados, `req.user.sub`):

- `PATCH /me` `{ name: string }` (zod `trim().min(1).max(80)`) → actualiza
  `User.name`, devuelve el `Me` actualizado (mismo `select` que `/auth/me`).
- `POST /me/password` `{ currentPassword: string, newPassword: string (min 8) }` →
  `verifyPassword(user.passwordHash, currentPassword)`; si falla → `HttpError(400,
  "invalid_password")`; si ok → `hashPassword(newPassword)`, update. 204.
- `POST /me/avatar` (multipart, campo `file`) → `uploadSingle` (allowlist + 5MB) →
  key `avatars/<sub>-<uuid>.<ext>` → `uploadBuffer` → set `User.avatarUrl` →
  `{ avatarUrl }`. 201.
- `DELETE /me/avatar` → `avatarUrl = null`. 204. (No borra el objeto en minio.)

Errores vía `HttpError` (el errorHandler emite `{ error: code }`). Validación zod →
400.

## Frontend

### `web/src/components/Drawer.tsx` (nuevo)
Panel lateral desde la izquierda. Overlay `bg-ink/50` (click cierra), panel con
animación slide izq→der, cierre por Escape, `role="dialog"` `aria-modal`.
Props: `open`, `onClose`, `children`.

### `web/src/components/Avatar.tsx` (nuevo)
Círculo con foto (`SafeImg`, `avatarUrl`) o fallback iniciales + color derivado del
nombre. Tamaño configurable.

### Header (`web/src/pages/HomePage.tsx`)
- Izquierda: botón **hamburguesa** (abre drawer).
- Centro/izq: bloque marca ("RestoApp" + "cerca de ti").
- Derecha: si authed → chip **Avatar** (abre drawer); si anon → botón "Ingresar"
  (abre `AuthSheet`).
- Se remueven del header: `LanguageSwitcher` y el botón cerrar sesión (van al
  drawer).

### Contenido del drawer
- **Authed:** cabecera de perfil (Avatar grande con acción cambiar/quitar foto;
  nombre + correo) · editar nombre (form inline → PATCH /me) · cambiar contraseña
  (form colapsable → POST /me/password) · idioma (`LanguageSwitcher`) · cerrar
  sesión.
- **Anon:** CTA "Ingresar" (abre `AuthSheet`) · idioma.

### `web/src/api/profileClient.ts` (nuevo)
Via `authedFetch`:
- `updateName(name): Promise<Me>`
- `changePassword(currentPassword, newPassword): Promise<void>`
- `uploadAvatar(file: File): Promise<{ avatarUrl: string }>` (FormData, campo `file`)
- `removeAvatar(): Promise<void>`

### Estado de auth
`Me` (en `web/src/auth/authClient.ts`) gana `avatarUrl: string | null`.
`AuthContext.user` lo expone; tras `updateName`/avatar se refresca el `user`
(re-`me()` o `setUser` con la respuesta).

### i18n (es/en/pt)
Nuevas claves: `menu` (abrir menú), `profile.title`, `profile.editName`,
`profile.save`, `profile.email`, `profile.changePhoto`, `profile.removePhoto`,
`profile.changePassword`, `profile.currentPassword`, `profile.newPassword`,
`profile.passwordChanged`, `profile.wrongPassword`, `profile.avatarError`.
en/pt traducidos (no copiar español).

## Data flow (avatar)
1. Usuario elige archivo en el drawer → `uploadAvatar(file)` (FormData) →
   `POST /me/avatar`.
2. Backend valida tipo/tamaño, sube a minio, guarda `avatarUrl`, responde `{avatarUrl}`.
3. Cliente actualiza `user.avatarUrl` → Avatar re-renderiza (header + drawer).
4. Quitar → `DELETE /me/avatar` → `user.avatarUrl = null` → fallback iniciales.

## Manejo de errores
- Tipo inválido / muy grande → 400 (`invalid_type`/`file_too_large`) → mensaje
  `profile.avatarError`.
- Contraseña actual incorrecta → 400 `invalid_password` → `profile.wrongPassword`.
- Nombre vacío → 400 (zod) → deshabilitar submit / mensaje inline.
- Fallos de red en el drawer no rompen el render (try/catch, mensajes locales).

## Testing
- **api `profile.test.ts`:** PATCH nombre (401 sin token, 200 cambia y `me` lo
  refleja, 400 vacío); password (400 con actual incorrecta, 204 con correcta y
  login con la nueva funciona, 401 sin token); avatar (supertest `.attach('file',
  buffer)` → 201 setea avatarUrl y `me` lo expone; DELETE → 204 y avatarUrl null;
  400 tipo inválido).
- **web `Drawer.test.tsx`:** abre/cierra (overlay+Escape); authed muestra sección
  perfil y "editar nombre" invoca el client (mock); anon muestra CTA Ingresar.

## Restricciones globales (para el plan)
- Migración a mano + `migrate deploy`; timestamp posterior a `20260906030000`.
- Comandos en contenedores (`docker compose exec -T api|web ...`); tras tests
  re-sembrar (`npm run seed:all`).
- Typecheck por tarea (api `tsc --noEmit`, web `tsc -b --noEmit`).
- Commits sin línea co-author (convención del repo); Conventional Commits;
  autor `ribarahonaa`.
- i18n en es/en/pt.
