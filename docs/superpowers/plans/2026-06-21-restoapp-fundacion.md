# RestoApp Fundación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar la base dockerizada de RestoApp: Postgres+PostGIS, MinIO, API Express+TS con Prisma, autenticación JWT con roles y datos semilla.

**Architecture:** Monorepo con `api/` (Node+Express+TypeScript+Prisma) y `web/` (más adelante). Postgres+PostGIS y MinIO en docker-compose. La API expone auth propia (JWT access+refresh, argon2) y middleware de roles. El esquema Prisma completo del MVP se define aquí para que los planes siguientes solo agreguen rutas.

**Tech Stack:** Docker Compose, PostgreSQL 16 + PostGIS, MinIO, Node 20, Express, TypeScript, Prisma, argon2, jsonwebtoken, Zod, Vitest + Supertest.

---

## File Structure

```
restoapp/
├── docker-compose.yml          # postgres+postgis, minio, api
├── .env.example                # variables (DB, JWT secrets, MinIO)
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── prisma/
│   │   └── schema.prisma       # esquema completo MVP
│   └── src/
│       ├── index.ts            # arranque server
│       ├── app.ts              # construye Express app (testeable)
│       ├── env.ts              # carga + valida env con Zod
│       ├── prisma.ts           # PrismaClient singleton
│       ├── auth/
│       │   ├── password.ts     # hash/verify argon2
│       │   ├── tokens.ts       # firmar/verificar JWT
│       │   ├── auth.routes.ts  # register/login/refresh/me
│       │   └── auth.service.ts # lógica registro/login
│       ├── middleware/
│       │   ├── authenticate.ts # extrae user del JWT
│       │   ├── authorize.ts    # exige rol(es)
│       │   └── error.ts        # handler central de errores
│       ├── seed/
│       │   └── seed.ts         # planes, purpose tags, superadmin
│       └── tests/
│           ├── helpers.ts      # app de test + reset DB
│           ├── auth.test.ts
│           └── authorize.test.ts
```

**Responsabilidades:**
- `app.ts` construye la app sin escuchar puerto → tests usan Supertest contra ella.
- `env.ts` única fuente de config; falla rápido si falta una var.
- `auth/` aislado: password, tokens, rutas y servicio separados.
- `middleware/authorize.ts` recibe lista de roles permitidos.

---

## Task 1: Scaffolding del monorepo y API

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/.gitignore`

- [ ] **Step 1: Crear `api/package.json`**

```json
{
  "name": "restoapp-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "seed": "tsx src/seed/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "argon2": "^0.41.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.16.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.22.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Crear `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Crear `api/.gitignore`**

```
node_modules
dist
.env
```

- [ ] **Step 4: Instalar dependencias**

Run: `cd api && npm install`
Expected: crea `node_modules` y `package-lock.json` sin errores.

- [ ] **Step 5: Commit**

```bash
git add api/package.json api/tsconfig.json api/.gitignore api/package-lock.json
git commit -m "chore: scaffold api package"
```

---

## Task 2: Docker Compose (Postgres+PostGIS, MinIO, API)

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `api/Dockerfile`

- [ ] **Step 1: Crear `.env.example`**

```
# Postgres
POSTGRES_USER=resto
POSTGRES_PASSWORD=resto
POSTGRES_DB=restoapp
DATABASE_URL=postgresql://resto:resto@postgres:5432/restoapp?schema=public

# API
PORT=3000
JWT_ACCESS_SECRET=dev_access_secret_change_me
JWT_REFRESH_SECRET=dev_refresh_secret_change_me
ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=604800

# MinIO
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=minio12345
MINIO_BUCKET=restoapp
```

- [ ] **Step 2: Copiar a `.env`**

Run: `cp .env.example .env`
Expected: existe `.env` (ya ignorado por git).

- [ ] **Step 3: Crear `api/Dockerfile`**

```dockerfile
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

- [ ] **Step 4: Crear `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  api:
    build: ./api
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./api:/app
      - /app/node_modules

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 5: Levantar postgres y minio**

Run: `docker compose up -d postgres minio`
Expected: ambos contenedores `healthy`/running. Verificar: `docker compose ps`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example api/Dockerfile
git commit -m "chore: add docker compose with postgis and minio"
```

---

## Task 3: Esquema Prisma completo del MVP

**Files:**
- Create: `api/prisma/schema.prisma`

- [ ] **Step 1: Crear `api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  superadmin
  admin_general
  admin_sucursal
  usuario
}

enum Lang {
  es
  en
  pt
}

enum Category {
  bar
  pub
  restaurant
  cafe
}

enum SuggestionStatus {
  pending
  approved
  rejected
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  role          Role     @default(usuario)
  name          String
  preferredLang Lang     @default(es)
  createdAt     DateTime @default(now())

  ownedBusinesses Business[]      @relation("BusinessOwner")
  branchAdmins    BranchAdmin[]
  suggestions     PlaceSuggestion[] @relation("Suggester")
  reviewed        PlaceSuggestion[] @relation("Reviewer")
}

model Business {
  id          String   @id @default(uuid())
  name        String
  ownerUserId String
  owner       User     @relation("BusinessOwner", fields: [ownerUserId], references: [id])
  createdAt   DateTime @default(now())
  branches    Branch[]
}

model Branch {
  id          String   @id @default(uuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  name        String
  category    Category
  address     String
  lat         Float
  lng         Float
  phone       String?
  description String?
  planId      String?
  plan        Plan?    @relation(fields: [planId], references: [id])
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  admins      BranchAdmin[]
  hours       ServiceHours[]
  promotions  Promotion[]
  menuItems   MenuItem[]
  purposes    BranchPurpose[]
}

model BranchAdmin {
  userId   String
  branchId String
  user     User   @relation(fields: [userId], references: [id])
  branch   Branch @relation(fields: [branchId], references: [id])
  @@id([userId, branchId])
}

model ServiceHours {
  id        String @id @default(uuid())
  branchId  String
  branch    Branch @relation(fields: [branchId], references: [id])
  weekday   Int    // 0=domingo .. 6=sábado
  openTime  String // "HH:MM"
  closeTime String
}

model Promotion {
  id          String   @id @default(uuid())
  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id])
  title       String
  description String?
  imageUrl    String?
  startsAt    DateTime
  endsAt      DateTime
  active      Boolean  @default(true)
}

model MenuItem {
  id          String  @id @default(uuid())
  branchId    String
  branch      Branch  @relation(fields: [branchId], references: [id])
  name        String
  description String?
  price       Decimal @db.Decimal(10, 2)
  imageUrl    String?
  category    String?
}

model PurposeTag {
  id       String          @id @default(uuid())
  slug     String          @unique
  labelEs  String
  labelEn  String
  labelPt  String
  branches BranchPurpose[]
}

model BranchPurpose {
  branchId String
  tagId    String
  branch   Branch     @relation(fields: [branchId], references: [id])
  tag      PurposeTag @relation(fields: [tagId], references: [id])
  @@id([branchId, tagId])
}

model Plan {
  id           String   @id @default(uuid())
  name         String   @unique
  features     Json     @default("{}")
  maxPromos    Int      @default(1)
  maxMenuItems Int      @default(10)
  branches     Branch[]
}

model PlaceSuggestion {
  id          String           @id @default(uuid())
  suggestedBy String
  suggester   User             @relation("Suggester", fields: [suggestedBy], references: [id])
  name        String
  category    Category
  address     String
  lat         Float
  lng         Float
  note        String?
  status      SuggestionStatus @default(pending)
  createdAt   DateTime         @default(now())
  reviewedBy  String?
  reviewer    User?            @relation("Reviewer", fields: [reviewedBy], references: [id])
  reviewedAt  DateTime?
}
```

- [ ] **Step 2: Crear la migración inicial**

Run: `cd api && DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx prisma migrate dev --name init`
Expected: crea `api/prisma/migrations/*_init/` y aplica el esquema sin errores.

- [ ] **Step 3: Habilitar extensión PostGIS (migración manual)**

Run: `docker compose exec postgres psql -U resto -d restoapp -c "CREATE EXTENSION IF NOT EXISTS postgis;"`
Expected: `CREATE EXTENSION` (o ya existe). Nota: lat/lng se guardan como Float; PostGIS se usará vía SQL crudo en el Plan 2 (`ST_DWithin`).

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat: add full prisma schema for mvp"
```

---

## Task 4: Config de entorno y cliente Prisma

**Files:**
- Create: `api/src/env.ts`
- Create: `api/src/prisma.ts`

- [ ] **Step 1: Crear `api/src/env.ts`**

```ts
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  ACCESS_TOKEN_TTL: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().default(604800),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 2: Crear `api/src/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Verificar que compila**

Run: `cd api && npx tsc --noEmit`
Expected: sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add api/src/env.ts api/src/prisma.ts
git commit -m "feat: add env validation and prisma client"
```

---

## Task 5: Hash de password (argon2)

**Files:**
- Create: `api/src/auth/password.ts`
- Test: `api/src/tests/password.test.ts`

- [ ] **Step 1: Escribir test que falla**

```ts
// api/src/tests/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../auth/password.js";

describe("password", () => {
  it("hashea y verifica correctamente", async () => {
    const hash = await hashPassword("secret123");
    expect(hash).not.toBe("secret123");
    expect(await verifyPassword(hash, "secret123")).toBe(true);
  });

  it("rechaza password incorrecta", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});
```

- [ ] **Step 2: Crear `api/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    fileParallelism: false,
  },
});
```

- [ ] **Step 3: Correr test, verificar que falla**

Run: `cd api && npx vitest run src/tests/password.test.ts`
Expected: FAIL — "Cannot find module '../auth/password.js'".

- [ ] **Step 4: Implementar `api/src/auth/password.ts`**

```ts
import argon2 from "argon2";

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

- [ ] **Step 5: Correr test, verificar que pasa**

Run: `cd api && npx vitest run src/tests/password.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/auth/password.ts api/src/tests/password.test.ts api/vitest.config.ts
git commit -m "feat: add argon2 password hashing"
```

---

## Task 6: Tokens JWT

**Files:**
- Create: `api/src/auth/tokens.ts`
- Test: `api/src/tests/tokens.test.ts`

- [ ] **Step 1: Escribir test que falla**

```ts
// api/src/tests/tokens.test.ts
import { describe, it, expect } from "vitest";
import { signAccessToken, signRefreshToken, verifyAccessToken } from "../auth/tokens.js";

const payload = { sub: "user-1", role: "usuario" as const };

describe("tokens", () => {
  it("firma y verifica access token", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.role).toBe("usuario");
  });

  it("verifyAccessToken rechaza un refresh token", () => {
    const refresh = signRefreshToken(payload);
    expect(() => verifyAccessToken(refresh)).toThrow();
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

Run: `cd api && npx vitest run src/tests/tokens.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `api/src/auth/tokens.ts`**

```ts
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { Role } from "@prisma/client";

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}
```

- [ ] **Step 4: Correr test, verificar que pasa**

Run: `cd api && npx vitest run src/tests/tokens.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/tokens.ts api/src/tests/tokens.test.ts
git commit -m "feat: add jwt token helpers"
```

---

## Task 7: Middleware authenticate y authorize + error handler

**Files:**
- Create: `api/src/middleware/authenticate.ts`
- Create: `api/src/middleware/authorize.ts`
- Create: `api/src/middleware/error.ts`

- [ ] **Step 1: Crear `api/src/middleware/error.ts`**

```ts
import type { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "internal_error" });
}
```

- [ ] **Step 2: Crear `api/src/middleware/authenticate.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "../auth/tokens.js";
import { HttpError } from "./error.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "missing_token"));
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(new HttpError(401, "invalid_token"));
  }
}
```

- [ ] **Step 3: Crear `api/src/middleware/authorize.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { HttpError } from "./error.js";

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "unauthenticated"));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "forbidden"));
    }
    next();
  };
}
```

- [ ] **Step 4: Verificar que compila**

Run: `cd api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add api/src/middleware
git commit -m "feat: add auth and authorize middleware"
```

---

## Task 8: Servicio de auth (register/login)

**Files:**
- Create: `api/src/auth/auth.service.ts`

- [ ] **Step 1: Implementar `api/src/auth/auth.service.ts`**

```ts
import { prisma } from "../prisma.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, signRefreshToken } from "./tokens.js";
import { HttpError } from "../middleware/error.js";

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, "email_taken");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      role: "usuario",
    },
  });
  return issueTokens(user.id, user.role);
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new HttpError(401, "invalid_credentials");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new HttpError(401, "invalid_credentials");
  return issueTokens(user.id, user.role);
}

function issueTokens(userId: string, role: import("@prisma/client").Role) {
  return {
    accessToken: signAccessToken({ sub: userId, role }),
    refreshToken: signRefreshToken({ sub: userId, role }),
  };
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/src/auth/auth.service.ts
git commit -m "feat: add auth service register and login"
```

---

## Task 9: Rutas de auth y app Express

**Files:**
- Create: `api/src/auth/auth.routes.ts`
- Create: `api/src/app.ts`
- Create: `api/src/index.ts`

- [ ] **Step 1: Crear `api/src/auth/auth.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { registerUser, loginUser } from "./auth.service.js";
import { authenticate } from "../middleware/authenticate.js";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "./tokens.js";
import { HttpError } from "../middleware/error.js";
import { prisma } from "../prisma.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    res.status(201).json(await registerUser(data));
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    res.json(await loginUser(data));
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", (req, res, next) => {
  try {
    const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
    const payload = verifyRefreshToken(token);
    res.json({
      accessToken: signAccessToken({ sub: payload.sub, role: payload.role }),
      refreshToken: signRefreshToken({ sub: payload.sub, role: payload.role }),
    });
  } catch {
    next(new HttpError(401, "invalid_refresh"));
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, name: true, role: true, preferredLang: true },
    });
    if (!user) throw new HttpError(404, "not_found");
    res.json(user);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 2: Crear `api/src/app.ts`**

```ts
import express from "express";
import cors from "cors";
import { authRouter } from "./auth/auth.routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 3: Crear `api/src/index.ts`**

```ts
import { createApp } from "./app.js";
import { env } from "./env.js";

createApp().listen(env.PORT, () => {
  console.log(`API escuchando en :${env.PORT}`);
});
```

- [ ] **Step 4: Verificar que compila**

Run: `cd api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/auth.routes.ts api/src/app.ts api/src/index.ts
git commit -m "feat: add auth routes and express app"
```

---

## Task 10: Test de integración de auth

**Files:**
- Create: `api/src/tests/helpers.ts`
- Create: `api/src/tests/auth.test.ts`

- [ ] **Step 1: Crear `api/src/tests/helpers.ts`**

```ts
import { prisma } from "../prisma.js";

export async function resetDb() {
  // orden respeta FKs
  await prisma.placeSuggestion.deleteMany();
  await prisma.branchPurpose.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.serviceHours.deleteMany();
  await prisma.branchAdmin.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.business.deleteMany();
  await prisma.purposeTag.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();
}
```

- [ ] **Step 2: Escribir test de integración**

```ts
// api/src/tests/auth.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("registra un usuario y devuelve tokens", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@b.cl", password: "secret123", name: "Ana" });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it("rechaza email duplicado", async () => {
    const body = { email: "a@b.cl", password: "secret123", name: "Ana" };
    await request(app).post("/auth/register").send(body);
    const res = await request(app).post("/auth/register").send(body);
    expect(res.status).toBe(409);
  });

  it("hace login y /me devuelve el usuario", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "a@b.cl", password: "secret123", name: "Ana" });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "a@b.cl", password: "secret123" });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get("/auth/me")
      .set("authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("a@b.cl");
    expect(me.body.role).toBe("usuario");
  });

  it("/me sin token devuelve 401", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Correr test contra DB (postgres arriba)**

Run: `cd api && DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx vitest run src/tests/auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add api/src/tests/helpers.ts api/src/tests/auth.test.ts
git commit -m "test: add auth integration tests"
```

---

## Task 11: Test de middleware authorize

**Files:**
- Create: `api/src/tests/authorize.test.ts`

- [ ] **Step 1: Escribir test**

```ts
// api/src/tests/authorize.test.ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { errorHandler } from "../middleware/error.js";
import { signAccessToken } from "../auth/tokens.js";

function appWithGuard() {
  const app = express();
  app.get("/admin", authenticate, authorize("superadmin"), (_req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);
  return app;
}

describe("authorize", () => {
  it("permite el rol correcto", async () => {
    const token = signAccessToken({ sub: "u1", role: "superadmin" });
    const res = await request(appWithGuard())
      .get("/admin")
      .set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("bloquea rol incorrecto con 403", async () => {
    const token = signAccessToken({ sub: "u1", role: "usuario" });
    const res = await request(appWithGuard())
      .get("/admin")
      .set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("bloquea sin token con 401", async () => {
    const res = await request(appWithGuard()).get("/admin");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Correr test, verificar que pasa**

Run: `cd api && npx vitest run src/tests/authorize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add api/src/tests/authorize.test.ts
git commit -m "test: add authorize middleware tests"
```

---

## Task 12: Seed (planes, purpose tags, superadmin)

**Files:**
- Create: `api/src/seed/seed.ts`

- [ ] **Step 1: Implementar `api/src/seed/seed.ts`**

```ts
import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";

async function main() {
  // Planes
  await prisma.plan.upsert({
    where: { name: "Free" },
    update: {},
    create: { name: "Free", maxPromos: 1, maxMenuItems: 10 },
  });
  await prisma.plan.upsert({
    where: { name: "Pro" },
    update: {},
    create: { name: "Pro", maxPromos: 100, maxMenuItems: 500 },
  });

  // Purpose tags
  const tags = [
    { slug: "lunch", labelEs: "Almuerzo", labelEn: "Lunch", labelPt: "Almoço" },
    { slug: "drinks", labelEs: "Tragos", labelEn: "Drinks", labelPt: "Drinks" },
    { slug: "dinner", labelEs: "Cena", labelEn: "Dinner", labelPt: "Jantar" },
    { slug: "coffee", labelEs: "Café", labelEn: "Coffee", labelPt: "Café" },
  ];
  for (const t of tags) {
    await prisma.purposeTag.upsert({
      where: { slug: t.slug },
      update: t,
      create: t,
    });
  }

  // Superadmin
  const email = "admin@restoapp.cl";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Super Admin",
      role: "superadmin",
      passwordHash: await hashPassword("admin12345"),
    },
  });

  console.log("Seed completo.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Correr seed**

Run: `cd api && DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx tsx src/seed/seed.ts`
Expected: imprime "Seed completo."; verificar: `docker compose exec postgres psql -U resto -d restoapp -c "SELECT name FROM \"Plan\";"` muestra Free y Pro.

- [ ] **Step 3: Commit**

```bash
git add api/src/seed/seed.ts
git commit -m "feat: add seed for plans, purpose tags and superadmin"
```

---

## Task 13: Verificación final de la fundación

- [ ] **Step 1: Correr toda la suite de tests**

Run: `cd api && DATABASE_URL=postgresql://resto:resto@localhost:5432/restoapp npx vitest run`
Expected: PASS — todos los tests (password, tokens, auth, authorize).

- [ ] **Step 2: Levantar el stack completo en Docker**

Run: `docker compose up -d --build`
Expected: `postgres`, `minio`, `api` corriendo.

- [ ] **Step 3: Probar el endpoint health**

Run: `curl -s http://localhost:3000/health`
Expected: `{"ok":true}`

- [ ] **Step 4: Probar login del superadmin**

Run: `curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@restoapp.cl","password":"admin12345"}'`
Expected: JSON con `accessToken` y `refreshToken`.

- [ ] **Step 5: Commit final (si quedaron cambios)**

```bash
git add -A
git commit -m "chore: foundation verified" || echo "nada que commitear"
```

---

## Notas para planes siguientes

- PostGIS está habilitado pero `Branch.lat/lng` son Float. En el Plan 2, la query
  `nearby` usará SQL crudo (`prisma.$queryRaw`) con `ST_DWithin`/`ST_Distance` sobre
  `ST_MakePoint(lng, lat)`. Evaluar agregar columna `geography` generada si el
  rendimiento lo requiere.
- MinIO ya está levantado; el Plan 3 crea el bucket (`MINIO_BUCKET`) y el endpoint `/uploads`.
- El esquema Prisma ya incluye TODO el modelo del MVP; los planes siguientes solo
  agregan rutas/servicios, no migraciones de esquema (salvo ajustes puntuales).
```
