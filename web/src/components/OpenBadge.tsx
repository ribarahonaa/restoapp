import { useTranslation } from "react-i18next";

// Píldora de estado abierto/cerrado. `open` viene calculado del backend
// (hora de Chile), así que aquí sólo se pinta.
export function OpenBadge({ open, className = "" }: { open: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        open ? "bg-emerald-100 text-emerald-700" : "bg-line text-mute"
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-mute"}`} />
      {open ? t("open.now") : t("open.closed")}
    </span>
  );
}
