import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as favoritesClient from "../api/favoritesClient.js";
import {
  toggleFavorite,
  setFavoritesFromServer,
  resetToLocal,
  getLocalIds,
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
});
