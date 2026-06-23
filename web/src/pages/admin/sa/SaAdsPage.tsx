import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Plus } from "lucide-react";
import { listAds, createAd, updateAd, deleteAd, listBusinesses } from "../../../api/saClient.js";
import type { SaAd, SaBusiness } from "../../../api/saTypes.js";
import { ImageUploader } from "../../../components/admin/ImageUploader.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function SaAdsPage() {
  const { t } = useTranslation();
  const [ads, setAds] = useState<SaAd[]>([]);
  const [businesses, setBusinesses] = useState<SaBusiness[]>([]);
  const [creating, setCreating] = useState(false);

  const load = () => listAds().then(setAds).catch(() => {});
  useEffect(() => { load(); listBusinesses().then(setBusinesses).catch(() => {}); }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-extrabold text-ink">{t("admin.sa.ads")}</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} /> {t("admin.sa.newAd")}
        </button>
      </div>

      <ul className="space-y-2">
        {ads.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-bg">
              {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{a.title}</p>
              <p className="text-xs text-mute">{a.business?.name} · {a.placement} · {new Date(a.startsAt).toLocaleDateString()}–{new Date(a.endsAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => updateAd(a.id, { active: !a.active }).then(load)} className={`rounded-lg px-2 py-1 text-xs font-bold ring-1 ${a.active ? "bg-open-soft text-open ring-open/30" : "bg-bg text-mute ring-line"}`}>
              {a.active ? t("admin.sa.active") : t("admin.sa.inactive")}
            </button>
            <button aria-label={t("admin.owner.delete")} onClick={() => deleteAd(a.id).then(load)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {creating && <CreateAdModal businesses={businesses} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </div>
  );

  function CreateAdModal({ businesses, onClose, onDone }: { businesses: SaBusiness[]; onClose: () => void; onDone: () => void }) {
    const [f, setF] = useState({ businessId: businesses[0]?.id ?? "", title: "", description: "", imageUrl: null as string | null, placement: "section" as "section" | "popup", startsAt: "", endsAt: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    async function submit() {
      setBusy(true); setErr(null);
      try {
        await createAd({
          businessId: f.businessId, title: f.title, description: f.description || null, imageUrl: f.imageUrl,
          placement: f.placement, startsAt: new Date(f.startsAt).toISOString(), endsAt: new Date(f.endsAt).toISOString(),
        });
        onDone();
      } catch (e) {
        setErr(String(e).includes("403") ? t("admin.sa.popupFull") : t("admin.sa.createError"));
      } finally { setBusy(false); }
    }
    return (
      <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
        <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 font-display text-lg font-bold text-ink">{t("admin.sa.newAd")}</h3>
          <div className="space-y-2">
            <select aria-label={t("admin.sa.business")} className={inputCls} value={f.businessId} onChange={(e) => setF({ ...f, businessId: e.target.value })}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input aria-label={t("admin.sa.adTitle")} placeholder={t("admin.sa.adTitle")} className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <textarea aria-label={t("admin.owner.itemDescription")} placeholder={t("admin.owner.itemDescription")} className={`${inputCls} resize-none`} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <ImageUploader value={f.imageUrl} onChange={(url) => setF({ ...f, imageUrl: url })} label={t("admin.sa.adImage")} />
            <select aria-label={t("admin.sa.placement")} className={inputCls} value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value as "section" | "popup" })}>
              <option value="section">{t("admin.sa.placementSection")}</option>
              <option value="popup">{t("admin.sa.placementPopup")}</option>
            </select>
            <div className="flex gap-2">
              <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.from")}
                <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
              </label>
              <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.to")}
                <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
              </label>
            </div>
            {err && <p className="text-xs text-brand-dark">{err}</p>}
            <button onClick={submit} disabled={busy || !f.businessId || !f.title || !f.startsAt || !f.endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">{t("admin.sa.create")}</button>
          </div>
        </div>
      </div>
    );
  }
}
