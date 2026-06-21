import { useTranslation } from "react-i18next";

const LANGS = ["es", "en", "pt"] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="flex gap-0.5 rounded-full bg-bg p-1" role="group" aria-label="language">
      {LANGS.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition ${
            i18n.resolvedLanguage === lng
              ? "bg-brand text-white shadow-sm"
              : "text-mute hover:text-ink"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
