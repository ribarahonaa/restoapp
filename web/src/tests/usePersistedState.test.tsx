import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedState } from "../hooks/usePersistedState.js";

describe("usePersistedState", () => {
  beforeEach(() => sessionStorage.clear());

  it("usa el valor inicial cuando no hay nada guardado", () => {
    const { result } = renderHook(() => usePersistedState("k", { radius: 5000 }));
    expect(result.current[0]).toEqual({ radius: 5000 });
  });

  it("persiste y rehidrata tras re-montar (entrar a local y volver)", () => {
    const first = renderHook(() => usePersistedState("resto.filter", { radius: 5000 }));
    act(() => first.result.current[1]({ radius: 1000 }));
    expect(sessionStorage.getItem("resto.filter")).toBe('{"radius":1000}');

    // Simula desmontar Home (navegar a detalle) y volver a montarla.
    first.unmount();
    const second = renderHook(() => usePersistedState("resto.filter", { radius: 5000 }));
    expect(second.result.current[0]).toEqual({ radius: 1000 });
  });
});
