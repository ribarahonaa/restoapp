import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Navigation, Clock, MapPin, Loader2, ChevronRight } from "lucide-react";
import type { BranchDetail } from "../../api/types.js";
import { CATEGORY_ICON } from "../../lib/categories.js";
import { santiagoWeekday } from "../../lib/time.js";
import { RatingBadge } from "../RatingStars.js";
import { SafeImg } from "../SafeImg.js";

interface Props {
  branch: BranchDetail | null;
  loading: boolean;
  distance?: number; // metros, desde el listado nearby
  routing: boolean;
  canRoute: boolean; // hay ubicación disponible (o al menos no denegada)
  onClose: () => void;
  onDetails: () => void;
  onGo: () => void;
}

function formatDistance(m?: number): string | null {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function MapBranchSheet({
  branch,
  loading,
  distance,
  routing,
  canRoute,
  onClose,
  onDetails,
  onGo,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!branch && !loading) return null;

  return (
    <div className="absolute inset-0 z-[1200] flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={branch?.name ?? ""}
        className="animate-sheet-up relative max-h-[80%] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("item.close")}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-md transition active:scale-95"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {loading || !branch ? (
          <div className="grid h-40 place-items-center text-mute">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <Content
            branch={branch}
            distance={distance}
            routing={routing}
            canRoute={canRoute}
            onDetails={onDetails}
            onGo={onGo}
          />
        )}
      </div>
    </div>
  );
}

function Content({
  branch,
  distance,
  routing,
  canRoute,
  onDetails,
  onGo,
}: {
  branch: BranchDetail;
  distance?: number;
  routing: boolean;
  canRoute: boolean;
  onDetails: () => void;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const CatIcon = CATEGORY_ICON[branch.category];

  // Galería: foto del local + imágenes de platos/promos (dedup, sin nulos).
  const photos = Array.from(
    new Set(
      [
        branch.imageUrl,
        ...branch.menuItems.map((m) => m.imageUrl),
        ...branch.promotions.map((p) => p.imageUrl),
      ].filter((u): u is string => !!u)
    )
  );

  // Horario de hoy según el día en Chile (los horarios se definen en esa zona).
  const today = branch.hours.find((h) => h.weekday === santiagoWeekday());
  const dist = formatDistance(distance);

  return (
    <>
      {/* Galería horizontal */}
      {photos.length > 0 ? (
        <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto p-3 pt-12">
          {photos.map((src, i) => (
            <SafeImg
              key={i}
              src={src}
              alt={branch.name}
              className="h-40 w-64 shrink-0 snap-start rounded-2xl object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="grid h-32 place-items-center pt-8 text-brand/30">
          <CatIcon size={64} strokeWidth={1.25} />
        </div>
      )}

      <div className="px-4 pb-4">
        <span className="inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-dark">
          {t(`categories.${branch.category}`)}
        </span>
        <h2 className="mt-1.5 font-display text-xl font-extrabold leading-tight text-ink">
          {branch.name}
        </h2>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
          <RatingBadge value={branch.ratingAvg} count={branch.ratingCount} className="text-ink" />
          {dist && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} strokeWidth={2.25} /> {dist}
            </span>
          )}
        </div>

        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-mute">
          <MapPin size={14} strokeWidth={2.25} className="mt-0.5 shrink-0" />
          {branch.address}
        </p>

        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
          <Clock size={14} strokeWidth={2.25} className="shrink-0 text-brand" />
          {today ? `${t("map.today")} ${today.openTime}–${today.closeTime}` : t("map.closedToday")}
        </p>

        {/* Acciones */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onDetails}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-bg py-3 text-sm font-bold text-ink ring-1 ring-line transition active:scale-95"
          >
            {t("map.viewMore")} <ChevronRight size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onGo}
            disabled={routing || !canRoute}
            title={!canRoute ? t("geo.denied") : undefined}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
          >
            {routing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Navigation size={16} strokeWidth={2.5} />
            )}
            {t("map.go")}
          </button>
        </div>
      </div>
    </>
  );
}
