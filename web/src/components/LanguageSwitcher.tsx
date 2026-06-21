import { useTranslation } from "react-i18next";

const LANGS = ["es", "en", "pt"] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="flex gap-1" role="group" aria-label="language">
      {LANGS.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`px-2 py-1 text-xs rounded uppercase ${
            i18n.resolvedLanguage === lng
              ? "bg-slate-900 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
