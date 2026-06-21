import { useTranslation } from "react-i18next";
import type { Category, Purpose } from "../api/types.js";

export interface FilterValue {
  category?: Category;
  purpose?: string;
  promo: boolean;
  open: boolean;
  radius: number;
}

interface FilterBarProps {
  value: FilterValue;
  purposes: Purpose[];
  onChange: (next: FilterValue) => void;
}

const CATEGORIES: Category[] = ["bar", "pub", "restaurant", "cafe"];

export function FilterBar({ value, purposes, onChange }: FilterBarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const purposeLabel = (p: Purpose) =>
    lang === "en" ? p.labelEn : lang === "pt" ? p.labelPt : p.labelEs;

  return (
    <div className="flex flex-wrap gap-3 p-3 bg-white border-b border-slate-200">
      <label className="flex flex-col text-xs text-slate-600">
        {t("filters.category")}
        <select
          aria-label={t("filters.category")}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={value.category ?? ""}
          onChange={(e) =>
            onChange({ ...value, category: (e.target.value || undefined) as Category | undefined })
          }
        >
          <option value="">{t("filters.all")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-slate-600">
        {t("filters.purpose")}
        <select
          aria-label={t("filters.purpose")}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={value.purpose ?? ""}
          onChange={(e) => onChange({ ...value, purpose: e.target.value || undefined })}
        >
          <option value="">{t("filters.all")}</option>
          {purposes.map((p) => (
            <option key={p.slug} value={p.slug}>
              {purposeLabel(p)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-slate-600">
        {t("filters.radius")}
        <select
          aria-label={t("filters.radius")}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={value.radius}
          onChange={(e) => onChange({ ...value, radius: Number(e.target.value) })}
        >
          <option value={1000}>1 km</option>
          <option value={5000}>5 km</option>
          <option value={10000}>10 km</option>
          <option value={50000}>50 km</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          aria-label={t("filters.promo")}
          checked={value.promo}
          onChange={(e) => onChange({ ...value, promo: e.target.checked })}
        />
        {t("filters.promo")}
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          aria-label={t("filters.open")}
          checked={value.open}
          onChange={(e) => onChange({ ...value, open: e.target.checked })}
        />
        {t("filters.open")}
      </label>
    </div>
  );
}
