// web/src/tests/useNearby.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNearby } from "../hooks/useNearby.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useNearby", () => {
  it("no consulta cuando los filtros son null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useNearby(null));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carga sucursales cuando hay filtros", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: "1", name: "Bar X" }] })
    );
    const { result } = renderHook(() =>
      useNearby({ lat: -33.4, lng: -70.6, radius: 5000 })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.branches).toEqual([{ id: "1", name: "Bar X" }]);
    expect(result.current.error).toBe(false);
  });

  it("marca error si la consulta falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() =>
      useNearby({ lat: -33.4, lng: -70.6, radius: 5000 })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });
});
