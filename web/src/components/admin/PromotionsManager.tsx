import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { createPromotion, deletePromotion, LimitError } from "../../api/ownerClient.js";
import { ImageUploader } from "./ImageUploader.js";
import { UpgradeRequestModal } from "./UpgradeRequestModal.js";
import type { OwnerBranchDetail } from "../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function PromotionsManager({ branch, onChange }: { branch: OwnerBranchDetail; onChange: () => void }) {
  const { t } = useTranslation();
  const max = branch.business.plan?.maxPromos ?? null;
  const count = branch.promotions.length;
  const atLimit = max != null && count >= max;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function add() {
    setBusy(true);
    setError(false);
    try {
      await createPromotion(branch.id, {
        title,
        description: description || null,
        imageUrl,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setTitle(""); setDescription(""); setImageUrl(null); setStartsAt(""); setEndsAt("");
      onChange();
    } catch (e) {
      if (e instanceof LimitError) setShowUpgrade(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(false);
    try {
      await deletePromotion(branch.id, id);
      onChange();
    } catch {
      setError(true);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink">{t("admin.owner.promosTab")}</h2>
        {max != null && <span className="text-xs font-semibold text-mute">{count}/{max}</span>}
      </div>

      <ul className="mb-4 space-y-2">
        {branch.promotions.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-bg p-2">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-line">
              {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />}
            </span>
            <p className="min-w-0 flex-1 truncate font-semibold text-ink">{p.title}</p>
            <button aria-label={t("admin.owner.delete")} onClick={() => remove(p.id)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}

      {atLimit ? (
        <div className="rounded-xl bg-brand-soft p-3 text-center">
          <p className="mb-2 text-sm font-semibold text-brand-dark">{t("admin.owner.limitReached")}</p>
          <button onClick={() => setShowUpgrade(true)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
            {t("admin.owner.requestUpgrade")}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <input aria-label={t("admin.owner.promoTitle")} placeholder={t("admin.owner.promoTitle")} className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea aria-label={t("admin.owner.itemDescription")} placeholder={t("admin.owner.itemDescription")} className={`${inputCls} resize-none`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.from")}
              <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.to")}
              <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
          </div>
          <ImageUploader value={imageUrl} onChange={setImageUrl} label={t("admin.owner.promoImage")} />
          <button onClick={add} disabled={busy || !title || !startsAt || !endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {t("admin.owner.addPromo")}
          </button>
        </div>
      )}

      {showUpgrade && <UpgradeRequestModal businessId={branch.businessId} onClose={() => setShowUpgrade(false)} />}
    </section>
  );
}
