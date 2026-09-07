// api/src/tests/presence.test.ts
import { describe, it, expect } from "vitest";
import { distanceMeters } from "../branches/presence.js";

describe("distanceMeters", () => {
  it("0 para el mismo punto", () => {
    expect(distanceMeters({ lat: -33.4378, lng: -70.6504 }, { lat: -33.4378, lng: -70.6504 })).toBeLessThan(1);
  });
  it("~cientos de metros entre puntos cercanos", () => {
    const d = distanceMeters({ lat: -33.4378, lng: -70.6504 }, { lat: -33.4380, lng: -70.6500 });
    expect(d).toBeGreaterThan(20); expect(d).toBeLessThan(200);
  });
});
