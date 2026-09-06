import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

// Barra de búsqueda por nombre de local. Controlada por el padre.
export function SearchBar({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="px-4 pb-1 pt-1">
      <div className="relative">
        <Search
          size={17}
          strokeWidth={2.25}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="w-full rounded-full bg-bg py-2.5 pl-9 pr-9 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("search.clear")}
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-mute transition hover:bg-line/60 active:scale-95"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
