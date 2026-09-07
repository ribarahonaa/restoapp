import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
beforeEach(async () => { await resetDb(); await seedDiscoveryFixture(); });
afterAll(async () => prisma.$disconnect());

async function tokenFor(email = "pf@pf.cl", name = "Peri") {
  const res = await request(app).post("/auth/register").send({ email, password: "secret123", name });
  return res.body.accessToken as string;
}

describe("PATCH /me", () => {
  it("sin token 401", async () => {
    expect((await request(app).patch("/me").send({ name: "X" })).status).toBe(401);
  });
  it("cambia el nombre y me lo refleja", async () => {
    const t = await tokenFor();
    const res = await request(app).patch("/me").set("authorization", `Bearer ${t}`).send({ name: "Nuevo Nombre" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nuevo Nombre");
    const me = await request(app).get("/auth/me").set("authorization", `Bearer ${t}`);
    expect(me.body.name).toBe("Nuevo Nombre");
  });
  it("400 con nombre vacío", async () => {
    const t = await tokenFor();
    expect((await request(app).patch("/me").set("authorization", `Bearer ${t}`).send({ name: "  " })).status).toBe(400);
  });
});

describe("POST /me/password", () => {
  it("400 con contraseña actual incorrecta", async () => {
    const t = await tokenFor("pw@pw.cl");
    const res = await request(app).post("/me/password").set("authorization", `Bearer ${t}`).send({ currentPassword: "mala1234", newPassword: "nuevo1234" });
    expect(res.status).toBe(400);
  });
  it("204 y permite login con la nueva contraseña", async () => {
    const t = await tokenFor("pw2@pw.cl");
    const ch = await request(app).post("/me/password").set("authorization", `Bearer ${t}`).send({ currentPassword: "secret123", newPassword: "nuevo1234" });
    expect(ch.status).toBe(204);
    const login = await request(app).post("/auth/login").send({ email: "pw2@pw.cl", password: "nuevo1234" });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
  });
});

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082", "hex");

describe("avatar", () => {
  it("sube el avatar y me lo refleja; DELETE lo limpia", async () => {
    const t = await tokenFor("av@av.cl");
    const up = await request(app).post("/me/avatar").set("authorization", `Bearer ${t}`).attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(up.status).toBe(201);
    expect(typeof up.body.avatarUrl).toBe("string");
    const me = await request(app).get("/auth/me").set("authorization", `Bearer ${t}`);
    expect(me.body.avatarUrl).toBe(up.body.avatarUrl);
    const del = await request(app).delete("/me/avatar").set("authorization", `Bearer ${t}`);
    expect(del.status).toBe(204);
    const me2 = await request(app).get("/auth/me").set("authorization", `Bearer ${t}`);
    expect(me2.body.avatarUrl).toBeNull();
  });
  it("400 con tipo inválido", async () => {
    const t = await tokenFor("av2@av.cl");
    const up = await request(app).post("/me/avatar").set("authorization", `Bearer ${t}`).attach("file", Buffer.from("hola"), { filename: "a.txt", contentType: "text/plain" });
    expect(up.status).toBe(400);
  });
});
