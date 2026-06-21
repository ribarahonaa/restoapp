import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, seedDiscoveryFixture } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();
const origin = { lat: "-33.4378", lng: "-70.6504" };

beforeEach(async () => {
  await resetDb();
  await seedDiscoveryFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /branches/nearby", () => {
  it("devuelve sucursales dentro del radio, ordenadas por distancia, sin inactivas", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000 });
    expect(res.status).toBe(200);
    const names = res.body.map((b: any) => b.name);
    expect(names).toContain("Cercano Lunch Promo");
    expect(names).toContain("Cercano Bar");
    expect(names).not.toContain("Lejano");
    expect(names).not.toContain("Inactivo");
    // distancia ascendente
    const dists = res.body.map((b: any) => b.distance);
    expect(dists).toEqual([...dists].sort((a, b) => a - b));
  });

  it("filtra por categoría", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, category: "bar" });
    expect(res.body.map((b: any) => b.name)).toEqual(["Cercano Bar"]);
  });

  it("filtra por propósito (slug)", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, purpose: "lunch" });
    expect(res.body.map((b: any) => b.name)).toEqual(["Cercano Lunch Promo"]);
  });

  it("filtra por promo activa", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, promo: "true" });
    expect(res.body.map((b: any) => b.name)).toEqual(["Cercano Lunch Promo"]);
  });

  it("incluye el lejano si el radio es grande", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 50000 });
    expect(res.body.map((b: any) => b.name)).toContain("Lejano");
  });

  it("sin radio devuelve TODOS los locales activos, ordenados por cercanía", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin });
    expect(res.status).toBe(200);
    const names = res.body.map((b: any) => b.name);
    expect(names).toContain("Lejano"); // ya no se acota por distancia
    expect(names).not.toContain("Inactivo");
    const dists = res.body.map((b: any) => b.distance);
    expect(dists).toEqual([...dists].sort((a, b) => a - b));
    expect(res.body[0]).toHaveProperty("imageUrl");
    expect(res.body[0]).toHaveProperty("ratingAvg");
    expect(res.body[0]).toHaveProperty("ratingCount");
  });

  it("400 si faltan lat/lng", async () => {
    const res = await request(app).get("/branches/nearby").query({ radius: 5000 });
    expect(res.status).toBe(400);
  });

  it("filtra por abierto ahora (incluye 24h)", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, open: "true" });
    expect(res.status).toBe(200);
    const names = res.body.map((b: any) => b.name);
    expect(names).toContain("Cercano Lunch Promo");
    // Sin horarios cargados, "Cercano Bar" no debe aparecer con open=true.
    expect(names).not.toContain("Cercano Bar");
  });

  it("open=false equivale a no filtrar", async () => {
    const res = await request(app).get("/branches/nearby").query({ ...origin, radius: 5000, open: "false" });
    expect(res.status).toBe(200);
    const names = res.body.map((b: any) => b.name);
    expect(names).toContain("Cercano Lunch Promo");
    expect(names).toContain("Cercano Bar");
  });
});
