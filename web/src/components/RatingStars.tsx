import { Star } from "lucide-react";

// Badge compacto: estrella + promedio + (nº reseñas opcional). Para cards y hero.
export function RatingBadge({
  value,
  count,
  className = "",
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Star size={13} strokeWidth={0} className="fill-amber-400" aria-hidden="true" />
      <span className="font-bold">{value > 0 ? value.toFixed(1) : "—"}</span>
      {count != null && <span className="font-medium opacity-70">({count})</span>}
    </span>
  );
}

// Fila de 5 estrellas para una reseña individual (rating entero 1..5).
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={0}
          className={i < Math.round(value) ? "fill-amber-400" : "fill-line"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
