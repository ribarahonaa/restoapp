import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Coffee, Martini, Beer, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { Category } from "../api/types.js";

// Ícono lucide por categoría (cards, filtros, pines del mapa).
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  bar: Martini,
  pub: Beer,
  restaurant: UtensilsCrossed,
  cafe: Coffee,
};

// Gradiente vivo por categoría — banner de las cards (estilo feed de delivery).
export const CATEGORY_GRADIENT: Record<Category, string> = {
  restaurant: "from-orange-400 to-rose-500",
  bar: "from-violet-500 to-fuchsia-500",
  pub: "from-amber-400 to-orange-600",
  cafe: "from-emerald-400 to-teal-600",
};

// Color sólido del pin del mapa (primer tono del gradiente). Leaflet usa HTML crudo.
const CATEGORY_HEX: Record<Category, string> = {
  restaurant: "#fb7c3a",
  bar: "#8b5cf6",
  pub: "#f59e0b",
  cafe: "#10b981",
};

// HTML del pin del mapa: círculo blanco con sombra y el ícono de categoría.
// Cacheado por categoría (renderToStaticMarkup no es gratis).
const pinCache = new Map<Category, string>();
export function categoryPinHtml(category: Category): string {
  const cached = pinCache.get(category);
  if (cached) return cached;
  const svg = renderToStaticMarkup(
    createElement(CATEGORY_ICON[category], {
      size: 18,
      color: CATEGORY_HEX[category],
      strokeWidth: 2.25,
    })
  );
  const html = `<div style="width:36px;height:36px;border-radius:9999px;background:#fff;border:2px solid ${CATEGORY_HEX[category]};box-shadow:0 4px 10px rgba(42,32,26,.3);display:flex;align-items:center;justify-content:center;">${svg}</div>`;
  pinCache.set(category, html);
  return html;
}
