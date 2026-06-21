import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MapPin, List, Map as MapIcon } from "lucide-react";
import { useGeolocation } from "../hooks/useGeolocation.js";
import { usePurposes } from "../hooks/usePurposes.js";
import { useNearby } from "../hooks/useNearby.js";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { FilterBar, type FilterValue } from "../components/FilterBar.js";
import { BranchList, SkeletonGrid } from "../components/BranchList.js";
import { MapView, type MapMarker } from "../components/map/MapView.js";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import { categoryPinHtml } from "../lib/categories.js";
import type { NearbyFilters } from "../api/types.js";

// Fallback: Plaza de Armas, Santiago (si el usuario no da ubicación)
const FALLBACK = { lat: -33.4378, lng: -70.6504 };

type ViewMode = "list" | "map";

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const geo = useGeolocation();
  const purposes = usePurposes();
  const [filter, setFilter] = usePersistedState<FilterValue>("resto.filter", {
    promo: false,
    open: false,
  });
  const [view, setView] = usePersistedState<ViewMode>("resto.view", "list");

  const center = geo.status === "ready" ? { lat: geo.lat, lng: geo.lng } : FALLBACK;

  const nearbyFilters: NearbyFilters = useMemo(
    () => ({
      lat: center.lat,
      lng: center.lng,
      // sin radio: todos los locales, ordenados por cercanía
      category: filter.category,
      purpose: filter.purpose,
      promo: filter.promo || undefined,
      open: filter.open || undefined,
    }),
    [center.lat, center.lng, filter]
  );

  const { branches, error, loading } = useNearby(nearbyFilters);

  const markers: MapMarker[] = branches.map((b) => ({
    id: b.id,
    lat: b.lat,
    lng: b.lng,
    label: b.name,
    iconHtml: categoryPinHtml(b.category),
    onClick: () => navigate(`/branch/${b.id}`),
  }));

  return (
    <div className="flex h-screen flex-col bg-bg">
      {/* Header */}
      <header className="z-20 shrink-0 bg-surface px-4 pt-3 pb-2 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-brand">
              {t("appName")}
            </h1>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-mute">
              <MapPin size={13} strokeWidth={2.5} className="text-brand" />
              {t("nearYou")}
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Filtros */}
      <div className="z-10 shrink-0 bg-surface pb-2 shadow-sm">
        <FilterBar value={filter} purposes={purposes} onChange={setFilter} />
      </div>

      {geo.status === "denied" && (
        <p className="shrink-0 bg-brand-soft px-4 py-2 text-xs font-medium text-brand-dark">
          {t("geo.denied")}
        </p>
      )}

      {/* Toolbar: resultados + toggle vista */}
      <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
        <span className="text-sm font-semibold text-ink">
          {t("results", { count: branches.length })}
        </span>
        <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-sm ring-1 ring-line">
          <ViewTab active={view === "list"} onClick={() => setView("list")}>
            <List size={15} strokeWidth={2.5} /> {t("view.list")}
          </ViewTab>
          <ViewTab active={view === "map"} onClick={() => setView("map")}>
            <MapIcon size={15} strokeWidth={2.5} /> {t("view.map")}
          </ViewTab>
        </div>
      </div>

      {/* Contenido */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <p className="mx-3 my-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">
            {t("errors.loadFailed")}
          </p>
        )}
        {view === "list" ? (
          loading && branches.length === 0 ? (
            <SkeletonGrid />
          ) : (
            <BranchList branches={branches} />
          )
        ) : (
          <div className="h-full w-full">
            <MapView center={center} markers={markers} />
          </div>
        )}
      </main>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-brand text-white shadow-sm" : "text-mute hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
