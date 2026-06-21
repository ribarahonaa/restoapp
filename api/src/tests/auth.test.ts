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

  it("rechaza registro con email inválido con 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "no-es-email", password: "secret123", name: "Ana" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("rechaza registro con password corta con 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@b.cl", password: "123", name: "Ana" });
    expect(res.status).toBe(400);
  });
});
