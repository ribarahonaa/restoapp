import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MapPin, List, Map as MapIcon, LocateFixed, Loader2, X, Heart } from "lucide-react";
import { useGeolocation } from "../hooks/useGeolocation.js";
import { usePurposes } from "../hooks/usePurposes.js";
import { useNearby } from "../hooks/useNearby.js";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { FilterBar, type FilterValue } from "../components/FilterBar.js";
import { SearchBar } from "../components/SearchBar.js";
import { BranchList, SkeletonGrid } from "../components/BranchList.js";
import { MapView, type MapMarker } from "../components/map/MapView.js";
import { MapBranchSheet } from "../components/map/MapBranchSheet.js";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import { categoryPinHtml } from "../lib/categories.js";
import { useFavorites } from "../lib/favorites.js";
import { getBranch } from "../api/client.js";
import { getRoute } from "../lib/route.js";
import { AdSection } from "../components/AdSection.js";
import { AdPopup } from "../components/AdPopup.js";
import type { NearbyFilters, BranchDetail } from "../api/types.js";

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
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const { isFavorite, count: favCount } = useFavorites();
  const q = useDebouncedValue(search.trim(), 300);

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
      q: q || undefined,
    }),
    [center.lat, center.lng, filter, q]
  );

  const { branches, error, loading } = useNearby(nearbyFilters);

  // Burbuja del local seleccionado en el mapa + ruta "Ir".
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BranchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [route, setRoute] = useState<{ lat: number; lng: number }[] | undefined>();
  const [routing, setRouting] = useState(false);

  // Al seleccionar un pin, trae el detalle del local (fotos, horarios).
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setDetail(null);
    setDetailLoading(true);
    getBranch(selectedId)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setDetail(null))
      .finally(() => alive && setDetailLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const closeSheet = () => {
    setSelectedId(null);
    setDetail(null);
  };

  // "Ir": traza ruta desde la ubicación del usuario al local y cierra la burbuja.
  const handleGo = async () => {
    if (geo.status !== "ready" || !detail) return;
    setRouting(true);
    try {
      const r = await getRoute({ lat: geo.lat, lng: geo.lng }, { lat: detail.lat, lng: detail.lng });
      setRoute(r.coords);
      closeSheet();
    } catch {
      setRoute([
        { lat: geo.lat, lng: geo.lng },
        { lat: detail.lat, lng: detail.lng },
      ]); // fallback: línea recta si OSRM falla
      closeSheet();
    } finally {
      setRouting(false);
    }
  };

  // Filtro "solo favoritos" (client-side, sobre los resultados cargados).
  const displayed = favOnly ? branches.filter((b) => isFavorite(b.id)) : branches;

  const selectedDistance = branches.find((b) => b.id === selectedId)?.distance;

  const markers: MapMarker[] = displayed.map((b) => ({
    id: b.id,
    lat: b.lat,
    lng: b.lng,
    label: b.name,
    iconHtml: categoryPinHtml(b.category),
    onClick: () => setSelectedId(b.id),
  }));

  if (geo.status === "ready") {
    markers.push({
      id: "__me__",
      lat: geo.lat,
      lng: geo.lng,
      label: t("geo.locate"),
      iconHtml:
        '<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center"><div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.35)"></div></div>',
    });
  }

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

      {/* Búsqueda + Filtros */}
      <div className="z-10 shrink-0 bg-surface pb-2 shadow-sm">
        <SearchBar value={search} onChange={setSearch} />
        <FilterBar value={filter} purposes={purposes} onChange={setFilter} />
      </div>

      {geo.status === "denied" && (
        <p className="shrink-0 bg-brand-soft px-4 py-2 text-xs font-medium text-brand-dark">
          {t("geo.denied")}
        </p>
      )}

      {/* Toolbar: resultados + favoritos + toggle vista */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm font-semibold text-ink">
            {t("results", { count: displayed.length })}
          </span>
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            aria-pressed={favOnly}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition active:scale-95 ${
              favOnly
                ? "bg-brand text-white ring-brand"
                : "bg-surface text-mute ring-line hover:text-ink"
            }`}
          >
            <Heart size={13} strokeWidth={2.5} className={favOnly ? "fill-white" : ""} />
            {t("fav.only")}
            {favCount > 0 && <span className="opacity-80">({favCount})</span>}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface p-1 shadow-sm ring-1 ring-line">
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
        <AdSection lat={center.lat} lng={center.lng} />
        {view === "list" ? (
          loading && branches.length === 0 ? (
            <SkeletonGrid />
          ) : favOnly && displayed.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-mute">{t("fav.empty")}</p>
          ) : (
            <BranchList branches={displayed} />
          )
        ) : (
          <div className="relative h-full w-full">
            <MapView
              center={center}
              markers={markers}
              route={route}
              fitTo={q || favOnly ? displayed.map((b) => ({ lat: b.lat, lng: b.lng })) : undefined}
            />
            <button
              type="button"
              onClick={geo.locate}
              disabled={geo.status === "loading"}
              aria-label={t("geo.locate")}
              title={t("geo.locate")}
              className="absolute bottom-5 right-5 z-[1000] grid h-12 w-12 place-items-center rounded-full bg-surface text-brand shadow-lg ring-1 ring-line transition active:scale-95 disabled:opacity-60"
            >
              {geo.status === "loading" ? (
                <Loader2 size={20} strokeWidth={2.5} className="animate-spin" />
              ) : (
                <LocateFixed size={20} strokeWidth={2.5} />
              )}
            </button>

            {route && (
              <button
                type="button"
                onClick={() => setRoute(undefined)}
                className="absolute left-5 top-5 z-[1000] inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-sm font-bold text-ink shadow-lg ring-1 ring-line transition active:scale-95"
              >
                <X size={16} strokeWidth={2.5} /> {t("map.clearRoute")}
              </button>
            )}

            <MapBranchSheet
              branch={detail}
              loading={detailLoading}
              distance={selectedDistance}
              routing={routing}
              canRoute={geo.status === "ready"}
              onClose={closeSheet}
              onDetails={() => detail && navigate(`/branch/${detail.id}`)}
              onGo={handleGo}
            />
          </div>
        )}
      </main>
      <AdPopup lat={center.lat} lng={center.lng} />
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
