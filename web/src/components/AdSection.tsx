import { useEffect, useState } from "react";
import { getAds } from "../api/client.js";
import type { PublicAd } from "../api/types.js";
import { SafeImg } from "./SafeImg.js";

export function AdSection({ lat, lng }: { lat: number; lng: number }) {
  const [ads, setAds] = useState<PublicAd[]>([]);
  useEffect(() => {
    getAds(lat, lng).then(setAds).catch(() => setAds([]));
  }, [lat, lng]);
  if (ads.length === 0) return null;
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
      {ads.map((a) => (
        <div key={a.id} className="w-64 shrink-0 overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
          <div className="h-28 w-full bg-brand-soft">
            {a.imageUrl && <SafeImg src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" />}
          </div>
          <div className="p-3">
            <p className="truncate font-bold text-ink">{a.title}</p>
            {a.description && <p className="mt-0.5 line-clamp-2 text-xs text-mute">{a.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
