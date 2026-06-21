import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Clock, ChevronDown, LayoutGrid, type LucideIcon } from "lucide-react";
import type { Category, Purpose } from "../api/types.js";
import { CATEGORY_ICON } from "../lib/categories.js";

export interface FilterValue {
  category?: Category;
  purpose?: string;
  promo: boolean;
  open: boolean;
}

interface FilterBarProps {
  value: FilterValue;
  purposes: Purpose[];
  onChange: (next: FilterValue) => void;
}

const CATEGORIES: Category[] = ["restaurant", "bar", "pub", "cafe"];

// Categoría como círculo con ícono + etiqueta (estilo feed de delivery).
function CatCircle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-2xl transition ${
          active
            ? "bg-brand text-white shadow-lg shadow-brand/30"
            : "bg-bg text-ink ring-1 ring-line"
        }`}
      >
        <Icon size={24} strokeWidth={2.25} />
      </span>
      <span
        className={`line-clamp-2 text-center text-[11px] font-semibold leading-tight ${
          active ? "text-brand" : "text-mute"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

// Toggle redondeado (promo / abierto ahora).
function TogglePill({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
        active ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-line hover:ring-ink/30"
      }`}
    >
      {children}
    </button>
  );
}

function SelectChip({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <select
        aria-label={label}
        className="appearance-none rounded-full bg-surface py-2.5 pl-4 pr-8 text-sm font-semibold text-ink ring-1 ring-line transition hover:ring-ink/30 focus:outline-none focus:ring-brand"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mute"
        aria-hidden="true"
      />
    </div>
  );
}

export function FilterBar({ value, purposes, onChange }: FilterBarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const purposeLabel = (p: Purpose) =>
    lang === "en" ? p.labelEn : lang === "pt" ? p.labelPt : p.labelEs;

  return (
    <div>
      {/* Categorías */}
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pt-2 pb-4">
        <CatCircle
          icon={LayoutGrid}
          label={t("filters.all")}
          active={!value.category}
          onClick={() => onChange({ ...value, category: undefined })}
        />
        {CATEGORIES.map((c) => (
          <CatCircle
            key={c}
            icon={CATEGORY_ICON[c]}
            label={t(`categories.${c}`)}
            active={value.category === c}
            onClick={() =>
              onChange({ ...value, category: value.category === c ? undefined : c })
            }
          />
        ))}
      </div>

      {/* Toggles + select — separados de las categorías con un divisor sutil */}
      <div className="no-scrollbar flex items-center gap-2.5 overflow-x-auto border-t border-line px-4 pb-1 pt-3.5">
        <TogglePill
          active={value.promo}
          label={t("filters.promo")}
          onClick={() => onChange({ ...value, promo: !value.promo })}
        >
          <Flame size={15} strokeWidth={2.5} aria-hidden="true" />
          {t("filters.promo")}
        </TogglePill>
        <TogglePill
          active={value.open}
          label={t("filters.open")}
          onClick={() => onChange({ ...value, open: !value.open })}
        >
          <Clock size={15} strokeWidth={2.5} aria-hidden="true" />
          {t("filters.open")}
        </TogglePill>

        <SelectChip
          label={t("filters.purpose")}
          value={value.purpose ?? ""}
          onChange={(v) => onChange({ ...value, purpose: v || undefined })}
        >
          <option value="">{t("filters.purpose")}</option>
          {purposes.map((p) => (
            <option key={p.slug} value={p.slug}>
              {purposeLabel(p)}
            </option>
          ))}
        </SelectChip>
      </div>
    </div>
  );
}
