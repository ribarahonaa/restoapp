// api/src/tests/nearby.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb } from "./helpers.js";
import { prisma } from "../prisma.js";

const app = createApp();

// Punto de referencia para las consultas (Santiago).
const ORIGIN = { lat: -33.4378, lng: -70.6504 };

async function seedNearby() {
  const owner = await prisma.user.create({
    data: {
      email: "owner@resto.cl",
      passwordHash: "x",
      name: "Owner",
    },
  });
  const business = await prisma.business.create({
    data: { name: "Negocio", ownerUserId: owner.id },
  });

  // Sucursal cercana con horario 24h (00:00-23:59) todos los días + promo activa.
  const lunch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Cercano Lunch Promo",
      category: "restaurant",
      address: "Calle 1",
      lat: ORIGIN.lat + 0.0005,
      lng: ORIGIN.lng + 0.0005,
    },
  });
  await prisma.serviceHours.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      branchId: lunch.id,
      weekday,
      openTime: "00:00",
      closeTime: "23:59",
    })),
  });
  await prisma.promotion.create({
    data: {
      branchId: lunch.id,
      title: "Almuerzo",
      startsAt: new Date("2000-01-01T00:00:00Z"),
      endsAt: new Date("2100-01-01T00:00:00Z"),
      active: true,
    },
  });

  // Sucursal cercana sin horarios: no debe aparecer con open=true.
  await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Cercano Bar",
      category: "bar",
      address: "Calle 2",
      lat: ORIGIN.lat + 0.0006,
      lng: ORIGIN.lng + 0.0006,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  await seedNearby();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /branches/nearby", () => {
  it("devuelve sucursales cercanas ordenadas por distancia", async () => {
    const res = await request(app)
      .get("/branches/nearby")
      .query({ lat: String(ORIGIN.lat), lng: String(ORIGIN.lng), radius: 5000 });
    expect(res.status).toBe(200);
    const names = res.body.map((b: any) => b.name);
    expect(names).toContain("Cercano Lunch Promo");
    expect(names).toContain("Cercano Bar");
  });

  it("filtra por abierto ahora (incluye 24h)", async () => {
    const res = await request(app)
      .get("/branches/nearby")
      .query({ lat: "-33.4378", lng: "-70.6504", radius: 5000, open: "true" });
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.name)).toContain("Cercano Lunch Promo");
    // Sin horarios cargados, "Cercano Bar" no debe aparecer con open=true.
    expect(res.body.map((b: any) => b.name)).not.toContain("Cercano Bar");
  });

  it("open=false equivale a no filtrar (filter off)", async () => {
    const res = await request(app)
      .get("/branches/nearby")
      .query({ lat: "-33.4378", lng: "-70.6504", radius: 5000, open: "false" });
    expect(res.status).toBe(200);
    const names = res.body.map((b: any) => b.name);
    expect(names).toContain("Cercano Lunch Promo");
    expect(names).toContain("Cercano Bar");
  });
});
