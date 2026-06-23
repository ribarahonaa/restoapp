import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listUpgradeRequests, approveUpgrade, rejectUpgrade,
  listAdRequests, approveAdRequest, rejectAdRequest,
} from "../../../api/saClient.js";
import type { SaUpgradeRequest, SaAdRequest } from "../../../api/saTypes.js";

export function SaRequestsPage() {
  const { t } = useTranslation();
  const [ups, setUps] = useState<SaUpgradeRequest[]>([]);
  const [ads, setAds] = useState<SaAdRequest[]>([]);

  const load = () => {
    listUpgradeRequests("pending").then(setUps).catch(() => {});
    listAdRequests("pending").then(setAds).catch(() => {});
  };
  useEffect(load, []);

  const act = (p: Promise<unknown>) => p.then(load).catch(() => {});

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-3 font-display text-xl font-extrabold text-ink">{t("admin.sa.upgradeRequests")}</h1>
        {ups.length === 0 && <p className="text-sm text-mute">{t("admin.sa.noRequests")}</p>}
        <ul className="space-y-2">
          {ups.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
              <span className="text-sm text-ink">{r.business.name} → <b>{r.requestedPlan.name}</b></span>
              <div className="flex gap-2">
                <button onClick={() => act(approveUpgrade(r.id))} className="rounded-lg bg-open px-3 py-1.5 text-xs font-bold text-white">{t("admin.sa.approve")}</button>
                <button onClick={() => act(rejectUpgrade(r.id))} className="rounded-lg bg-bg px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-line">{t("admin.sa.reject")}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h1 className="mb-3 font-display text-xl font-extrabold text-ink">{t("admin.sa.adRequests")}</h1>
        {ads.length === 0 && <p className="text-sm text-mute">{t("admin.sa.noRequests")}</p>}
        <ul className="space-y-2">
          {ads.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
              <span className="text-sm text-ink">
                {r.business.name} · {new Date(r.desiredStartsAt).toLocaleDateString()}–{new Date(r.desiredEndsAt).toLocaleDateString()}
                {r.wantsPopup && <span className="ml-2 rounded-full bg-promo/15 px-2 py-0.5 text-[11px] font-semibold text-promo">popup</span>}
              </span>
              <div className="flex gap-2">
                <button onClick={() => act(approveAdRequest(r.id))} className="rounded-lg bg-open px-3 py-1.5 text-xs font-bold text-white">{t("admin.sa.approve")}</button>
                <button onClick={() => act(rejectAdRequest(r.id))} className="rounded-lg bg-bg px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-line">{t("admin.sa.reject")}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
