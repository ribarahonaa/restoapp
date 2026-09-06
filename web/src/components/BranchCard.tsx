import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, Clock } from "lucide-react";
import type { NearbyBranch } from "../api/types.js";
import { CATEGORY_ICON, CATEGORY_GRADIENT } from "../lib/categories.js";
import { RatingBadge } from "./RatingStars.js";
import { OpenBadge } from "./OpenBadge.js";
import { FavButton } from "./FavButton.js";

// Tiempo estimado a pie (~80 m/min), mínimo 5 min.
function walkMinutes(distanceMeters: number) {
  return Math.max(5, Math.round(distanceMeters / 80));
}

export function BranchCard({ branch, index = 0 }: { branch: NearbyBranch; index?: number }) {
  const { t } = useTranslation();
  const km = (branch.distance / 1000).toFixed(1);
  const eta = walkMinutes(branch.distance);
  const Icon = CATEGORY_ICON[branch.category];
  return (
    <Link
      to={`/branch/${branch.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className="animate-card-in block overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line transition active:scale-[.99] hover:shadow-md"
    >
      <div className={`relative h-32 bg-gradient-to-br ${CATEGORY_GRADIENT[branch.category]}`}>
        {branch.imageUrl ? (
          <img
            src={branch.imageUrl}
            alt={branch.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon
            size={96}
            strokeWidth={1.5}
            className="absolute -right-2 -bottom-3 text-white/25"
            aria-hidden="true"
          />
        )}
        {/* Estado abierto/cerrado arriba-izquierda */}
        <span className="absolute left-2 top-2">
          <OpenBadge open={branch.openNow} className="shadow-sm" />
        </span>
        {/* Rating arriba-derecha */}
        <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-xs text-ink shadow-sm">
          <RatingBadge value={branch.ratingAvg} count={branch.ratingCount} />
        </span>
        {/* Tiempo abajo-izquierda */}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
          <Clock size={12} strokeWidth={2.5} />
          {t("branch.eta", { min: eta })}
        </span>
        {/* Favorito abajo-derecha */}
        <FavButton
          id={branch.id}
          className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow-sm transition active:scale-90"
        />
      </div>
      <div className="p-3">
        <h3 className="truncate font-display text-[15px] font-bold text-ink">{branch.name}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-mute">
          <span className="font-medium text-ink/70">{t(`categories.${branch.category}`)}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-0.5">
            <MapPin size={12} strokeWidth={2.25} />
            {t("branch.distance", { km })}
          </span>
        </div>
      </div>
    </Link>
  );
}
