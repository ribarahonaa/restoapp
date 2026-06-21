// web/src/tests/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNearby, getPurposes } from "../api/client.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("getNearby arma la query string con los filtros y parsea JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "1", name: "X" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await getNearby({ lat: -33.4, lng: -70.6, radius: 5000, category: "bar", promo: true });
    expect(res).toEqual([{ id: "1", name: "X" }]);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/branches/nearby");
    expect(calledUrl).toContain("lat=-33.4");
    expect(calledUrl).toContain("lng=-70.6");
    expect(calledUrl).toContain("radius=5000");
    expect(calledUrl).toContain("category=bar");
    expect(calledUrl).toContain("promo=true");
  });

  it("getNearby NO incluye filtros opcionales ausentes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    await getNearby({ lat: -33.4, lng: -70.6, radius: 5000 });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("category=");
    expect(calledUrl).not.toContain("promo=");
    expect(calledUrl).not.toContain("open=");
  });

  it("getPurposes lanza error si la respuesta no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(getPurposes()).rejects.toThrow();
  });
});
