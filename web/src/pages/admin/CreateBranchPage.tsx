import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { listBranches, createBranch, LimitError } from "../../api/ownerClient.js";
import type { Category } from "../../api/ownerTypes.js";
import { MapPicker } from "../../components/admin/MapPicker.js";
import { ImageUploader } from "../../components/admin/ImageUploader.js";
import { UpgradeRequestModal } from "../../components/admin/UpgradeRequestModal.js";

const CATEGORIES: Category[] = ["bar", "pub", "restaurant", "cafe"];
const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";
const SANTIAGO = { lat: -33.4378, lng: -70.6504 };

function UpgradeInline({ businessId, t }: { businessId: string; t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
        {t("admin.owner.requestUpgrade")}
      </button>
      {open && <UpgradeRequestModal businessId={businessId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CreateBranchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [address, setAddress] = useState("");
  const [pos, setPos] = useState(SANTIAGO);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [overLimit, setOverLimit] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listBranches().then((bs) => {
      if (bs[0]) setBusinessId(bs[0].businessId);
    });
  }, []);

  async function submit() {
    if (!businessId) return;
    setBusy(true);
    setError(false);
    setOverLimit(false);
    try {
      const { id } = await createBranch({ businessId, name, category, address, lat: pos.lat, lng: pos.lng, imageUrl });
      navigate(`/admin/branches/${id}`);
    } catch (e) {
      if (e instanceof LimitError) setOverLimit(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link to="/admin/branches" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        <ArrowLeft size={16} strokeWidth={2.5} /> {t("admin.owner.myBranches")}
      </Link>
      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
        <h1 className="mb-3 font-display text-lg font-extrabold text-ink">{t("admin.owner.newBranch")}</h1>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.name")}</label>
            <input aria-label={t("admin.owner.name")} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.category")}</label>
            <select aria-label={t("admin.owner.category")} className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.address")}</label>
            <input aria-label={t("admin.owner.address")} className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <ImageUploader value={imageUrl} onChange={setImageUrl} label={t("admin.owner.image")} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.location")}</label>
            <MapPicker lat={pos.lat} lng={pos.lng} onChange={(lat, lng) => setPos({ lat, lng })} />
          </div>
          {error && <p className="text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}
          {overLimit && businessId ? (
            <div className="rounded-xl bg-brand-soft p-3 text-center">
              <p className="mb-2 text-sm font-semibold text-brand-dark">{t("admin.owner.limitReached")}</p>
              <UpgradeInline businessId={businessId} t={t} />
            </div>
          ) : (
            <button onClick={submit} disabled={busy || !name || !address || !businessId} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t("admin.owner.createBranch")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
