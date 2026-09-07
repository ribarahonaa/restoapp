import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as favoritesClient from "../api/favoritesClient.js";
import {
  toggleFavorite,
  setFavoritesFromServer,
  resetToLocal,
  getLocalIds,
  clearLocal,
} from "../lib/favorites.js";

const KEY = "resto.favs";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  resetToLocal(); // arranca en modo "local" con localStorage limpio
});
afterEach(() => vi.restoreAllMocks());

describe("favorites store", () => {
  it("modo local: toggle persiste en localStorage", () => {
    toggleFavorite("b1");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toEqual(["b1"]);
    toggleFavorite("b1");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toEqual([]);
  });

  it("getLocalIds lee lo persistido en localStorage", () => {
    toggleFavorite("b1");
    toggleFavorite("b2");
    expect(getLocalIds().sort()).toEqual(["b1", "b2"]);
  });

  it("setFavoritesFromServer adopta la lista del servidor sin tocar localStorage", () => {
    toggleFavorite("local-only");
    setFavoritesFromServer(["b1", "b2"]);
    expect(getLocalIds()).toEqual(["local-only"]); // localStorage no cambió
  });

  it("modo server: toggle llama a addFavorite/removeFavorite de forma optimista", async () => {
    const add = vi.spyOn(favoritesClient, "addFavorite").mockResolvedValue(new Response(null, { status: 204 }));
    const remove = vi.spyOn(favoritesClient, "removeFavorite").mockResolvedValue(new Response(null, { status: 204 }));
    setFavoritesFromServer(["b1"]);

    toggleFavorite("b2"); // agrega
    expect(add).toHaveBeenCalledWith("b2");

    toggleFavorite("b1"); // quita
    expect(remove).toHaveBeenCalledWith("b1");

    // no debe haber escrito nada en localStorage en modo server
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("modo server: un fallo de red en el toggle no rompe (se captura)", () => {
    vi.spyOn(favoritesClient, "addFavorite").mockRejectedValue(new Error("network"));
    setFavoritesFromServer([]);
    expect(() => toggleFavorite("b1")).not.toThrow();
  });

  it("resetToLocal vuelve a modo local leyendo lo persistido", () => {
    toggleFavorite("b1"); // modo local, persiste b1
    setFavoritesFromServer(["b2"]); // modo server
    resetToLocal();
    expect(getLocalIds()).toEqual(["b1"]);
  });

  it("clearLocal borra la lista anónima persistida", () => {
    toggleFavorite("b1");
    expect(getLocalIds()).toEqual(["b1"]);
    clearLocal();
    expect(getLocalIds()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("no hay sangrado de favoritos anónimos entre cuentas en un dispositivo compartido", () => {
    // Usuario A, anónimo: favoritea dos locales antes de iniciar sesión.
    toggleFavorite("a1");
    toggleFavorite("a2");
    expect(getLocalIds().sort()).toEqual(["a1", "a2"]);

    // A inicia sesión: el merge (anon + cuenta) se resuelve con éxito y,
    // como hace syncFavoritesOnAuth en AuthContext, se limpia la lista
    // anónima justo después de adoptar la del servidor.
    setFavoritesFromServer(["a1", "a2", "server-a"]);
    clearLocal();
    expect(getLocalIds()).toEqual([]); // ya no queda nada que pueda sangrar

    // A cierra sesión: resetToLocal no debe resucitar la lista de A.
    resetToLocal();
    expect(getLocalIds()).toEqual([]);

    // B inicia sesión en el mismo dispositivo: el merge sólo envía los ids
    // locales vigentes (ninguno), así que B no recibe nada de A.
    expect(getLocalIds()).toEqual([]);
    setFavoritesFromServer(["b1"]); // favoritos propios de B, distintos de A
    expect(getLocalIds()).toEqual([]);

    // Login repetido de B tampoco reintroduce nada de A.
    clearLocal();
    resetToLocal();
    expect(getLocalIds()).toEqual([]);
  });
});
