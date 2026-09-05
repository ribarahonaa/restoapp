import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { getPopupAd } from "../api/client.js";
import type { PublicAd } from "../api/types.js";
import { SafeImg } from "./SafeImg.js";

export function AdPopup({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslation();
  const [ad, setAd] = useState<PublicAd | null>(null);

  useEffect(() => {
    getPopupAd(lat, lng)
      .then((a) => {
        if (!a) return;
        const key = `resto.popup.${a.id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        setAd(a);
      })
      .catch(() => {});
  }, [lat, lng]);

  if (!ad) return null;
  return (
    <div role="dialog" className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/50 p-4" onClick={() => setAd(null)}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-40 w-full bg-brand-soft">
          {ad.imageUrl && <SafeImg src={ad.imageUrl} alt={ad.title} className="h-full w-full object-cover" />}
          <button aria-label={t("item.close")} onClick={() => setAd(null)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <h3 className="font-display text-lg font-extrabold text-ink">{ad.title}</h3>
          {ad.description && <p className="mt-1 text-sm text-mute">{ad.description}</p>}
        </div>
      </div>
    </div>
  );
}
