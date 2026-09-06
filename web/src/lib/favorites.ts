import { useSyncExternalStore } from "react";

// Favoritos del usuario, persistidos en localStorage (sin login). Store
// reactivo: cards, detalle y el filtro del home se actualizan al alternar.
const KEY = "resto.favs";
const listeners = new Set<() => void>();

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

let favs: Set<string> = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...favs]));
  } catch {
    // sin acceso a localStorage: los favoritos viven sólo en memoria
  }
}

export function toggleFavorite(id: string) {
  const next = new Set(favs);
  next.has(id) ? next.delete(id) : next.add(id);
  favs = next; // nueva referencia => useSyncExternalStore detecta el cambio
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return favs;
}

export function useFavorites() {
  const set = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    favorites: set,
    isFavorite: (id: string) => set.has(id),
    toggle: toggleFavorite,
    count: set.size,
  };
}
