import { useSyncExternalStore } from "react";
import { addFavorite as apiAddFavorite, removeFavorite as apiRemoveFavorite } from "../api/favoritesClient.js";

// Favoritos del usuario. Dos fuentes: localStorage (anónimo) o servidor
// (autenticado). Store reactivo: cards, detalle y el filtro del home se
// actualizan al alternar.
const KEY = "resto.favs";
const listeners = new Set<() => void>();

type Mode = "local" | "server";

function loadLocal(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

let favs: Set<string> = loadLocal();
let mode: Mode = "local";

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...favs]));
  } catch {
    // sin acceso a localStorage: los favoritos viven sólo en memoria
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function toggleFavorite(id: string) {
  const next = new Set(favs);
  const adding = !next.has(id);
  adding ? next.add(id) : next.delete(id);
  favs = next; // nueva referencia => useSyncExternalStore detecta el cambio
  if (mode === "local") {
    persist();
  } else {
    // optimista: no bloquea el render, y un fallo de red no revierte la UI
    (adding ? apiAddFavorite(id) : apiRemoveFavorite(id)).catch(() => {});
  }
  emit();
}

// Reemplaza el estado con la lista del servidor (post-login/merge). No
// persiste en localStorage: la fuente de verdad pasa a ser la cuenta.
export function setFavoritesFromServer(ids: string[]) {
  favs = new Set(ids);
  mode = "server";
  emit();
}

// Vuelve a la fuente local (logout): recarga desde localStorage.
export function resetToLocal() {
  favs = loadLocal();
  mode = "local";
  emit();
}

// Ids guardados localmente, para enviarlos al merge al iniciar sesión.
export function getLocalIds(): string[] {
  return [...loadLocal()];
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
