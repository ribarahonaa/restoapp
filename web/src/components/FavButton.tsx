import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { useFavorites } from "../lib/favorites.js";

// Corazón para marcar/desmarcar un local como favorito. Si va dentro de un
// <Link> (card), corta la propagación para no navegar al togglear.
export function FavButton({ id, className = "" }: { id: string; className?: string }) {
  const { t } = useTranslation();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-pressed={fav}
      aria-label={fav ? t("fav.remove") : t("fav.add")}
      className={className}
    >
      <Heart
        size={19}
        strokeWidth={2.5}
        className={fav ? "fill-brand text-brand" : "text-ink"}
      />
    </button>
  );
}
