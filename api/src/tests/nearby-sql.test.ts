// api/src/tests/nearby-sql.test.ts
import { describe, it, expect } from "vitest";
import { buildNearbyQuery } from "../branches/nearby.sql.js";

const base = {
  lat: -33.4378,
  lng: -70.6504,
  radius: 5000,
  now: new Date("2026-06-21T15:00:00Z"),
  weekday: 0,
  hhmm: "12:00",
};

describe("buildNearbyQuery", () => {
  it("incluye ST_DWithin con lat/lng/radio como parámetros", () => {
    const q = buildNearbyQuery(base);
    // Prisma.Sql expone .sql (texto con placeholders) y .values
    expect(q.sql).toContain("ST_DWithin");
    expect(q.sql).toContain("ORDER BY distance");
    expect(q.values).toContain(5000);
  });

  it("agrega filtro de categoría cuando se entrega", () => {
    const q = buildNearbyQuery({ ...base, category: "bar" });
    expect(q.sql).toContain('"category"');
    expect(q.values).toContain("bar");
  });

  it("agrega filtro de propósito (slug) cuando se entrega", () => {
    const q = buildNearbyQuery({ ...base, purpose: "drinks" });
    expect(q.sql).toContain("BranchPurpose");
    expect(q.values).toContain("drinks");
  });

  it("agrega filtro de promo activa cuando promo=true", () => {
    const q = buildNearbyQuery({ ...base, promo: true });
    expect(q.sql).toContain("Promotion");
  });

  it("agrega filtro de abierto ahora cuando open=true", () => {
    const q = buildNearbyQuery({ ...base, open: true });
    expect(q.sql).toContain("ServiceHours");
  });

  it("el filtro abierto-ahora soporta horario nocturno (cierre < apertura)", () => {
    const q = buildNearbyQuery({ ...base, open: true });
    expect(q.sql).toContain('"closeTime" <');
  });
});
