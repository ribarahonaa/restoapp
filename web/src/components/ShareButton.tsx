import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2, Check } from "lucide-react";

interface Props {
  title: string;
  url?: string; // por defecto la URL actual (deep link del local)
  className?: string;
}

// Comparte vía Web Share API (móvil) o, si no existe, copia el link al
// portapapeles y muestra un aviso breve.
export function ShareButton({ title, url, className = "" }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function share() {
    const shareUrl = url ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch {
        return; // el usuario canceló
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sin permiso de portapapeles: no hay más fallback silencioso
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={share}
        aria-label={t("share.button")}
        className={className}
      >
        {copied ? <Check size={20} strokeWidth={2.5} /> : <Share2 size={19} strokeWidth={2.5} />}
      </button>
      {copied && (
        <span className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
          {t("share.copied")}
        </span>
      )}
    </div>
  );
}
