import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGeolocation } from "../hooks/useGeolocation.js";
import { usePurposes } from "../hooks/usePurposes.js";
import { useNearby } from "../hooks/useNearby.js";
import { FilterBar, type FilterValue } from "../components/FilterBar.js";
import { BranchList } from "../components/BranchList.js";
import { MapView, type MapMarker } from "../components/map/MapView.js";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import type { NearbyFilters } from "../api/types.js";

// Fallback: Plaza de Armas, Santiago (si el usuario no da ubicación)
const FALLBACK = { lat: -33.4378, lng: -70.6504 };

export function HomePage() {
  const { t } = useTranslation();
  const geo = useGeolocation();
  const purposes = usePurposes();
  const [filter, setFilter] = useState<FilterValue>({ promo: false, open: false, radius: 5000 });

  const center =
    geo.status === "ready" ? { lat: geo.lat, lng: geo.lng } : FALLBACK;

  const nearbyFilters: NearbyFilters = useMemo(
    () => ({
      lat: center.lat,
      lng: center.lng,
      radius: filter.radius,
      category: filter.category,
      purpose: filter.purpose,
      promo: filter.promo || undefined,
      open: filter.open || undefined,
    }),
    [center.lat, center.lng, filter]
  );

  const { branches } = useNearby(nearbyFilters);

  const markers: MapMarker[] = branches.map((b) => ({
    id: b.id,
    lat: b.lat,
    lng: b.lng,
    label: b.name,
  }));

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
        <h1 className="font-bold">{t("appName")}</h1>
        <LanguageSwitcher />
      </header>

      <FilterBar value={filter} purposes={purposes} onChange={setFilter} />

      {geo.status === "denied" && (
        <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50">{t("geo.denied")}</p>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="h-1/2 md:h-auto md:w-1/2">
          <MapView center={center} markers={markers} />
        </div>
        <div className="h-1/2 md:h-auto md:w-1/2 overflow-y-auto">
          <h2 className="px-4 pt-3 text-sm font-semibold text-slate-700">{t("nearbyTitle")}</h2>
          <BranchList branches={branches} />
        </div>
      </div>
    </div>
  );
}
