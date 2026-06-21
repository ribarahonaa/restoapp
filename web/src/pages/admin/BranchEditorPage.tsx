import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import {
  getOwnerBranch,
  updateBranch,
  setBranchActive,
  closeBranch,
  reopenBranch,
} from "../../api/ownerClient.js";
import type { OwnerBranchDetail, Category } from "../../api/ownerTypes.js";
import { ImageUploader } from "../../components/admin/ImageUploader.js";
import { MapPicker } from "../../components/admin/MapPicker.js";
import { HoursEditor } from "../../components/admin/HoursEditor.js";
import { useAuth } from "../../auth/AuthContext.js";
import { Tabs } from "../../components/Tabs.js";
import { MenuManager } from "../../components/admin/MenuManager.js";
import { PromotionsManager } from "../../components/admin/PromotionsManager.js";
import { DiscountsManager } from "../../components/admin/DiscountsManager.js";

const CATEGORIES: Category[] = ["bar", "pub", "restaurant", "cafe"];
const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function BranchEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branch, setBranch] = useState<OwnerBranchDetail | null>(null);
  const [form, setForm] = useState<Partial<OwnerBranchDetail>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("data");

  const load = () => {
    if (!id) return;
    getOwnerBranch(id).then((b) => {
      setBranch(b);
      setForm(b);
    });
  };
  useEffect(load, [id]);

  if (!branch || !id) return <p className="text-mute">…</p>;

  const set = <K extends keyof OwnerBranchDetail>(k: K, v: OwnerBranchDetail[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(false);
    try {
      await updateBranch(id!, {
        name: form.name,
        category: form.category as Category,
        address: form.address,
        lat: form.lat,
        lng: form.lng,
        phone: form.phone ?? null,
        description: form.description ?? null,
        imageUrl: form.imageUrl ?? null,
      });
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const closedActive = branch.closedUntil && new Date(branch.closedUntil) > new Date();
  const canToggleActive = user?.role !== "admin_sucursal";

  return (
    <div>
      <Link to="/admin/branches" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        <ArrowLeft size={16} strokeWidth={2.5} /> {t("admin.owner.myBranches")}
      </Link>

      <Tabs
        tabs={[
          { key: "data", label: t("admin.owner.data") },
          { key: "menu", label: t("admin.owner.menuTab") },
          { key: "promos", label: t("admin.owner.promosTab") },
          { key: "discounts", label: t("admin.owner.discountsTab") },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "data" && (
        <>
          <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
            <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.data")}</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.name")}</label>
                <input aria-label={t("admin.owner.name")} className={inputCls} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.category")}</label>
                <select aria-label={t("admin.owner.category")} className={inputCls} value={form.category ?? "cafe"} onChange={(e) => set("category", e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`categories.${c}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.address")}</label>
                <input aria-label={t("admin.owner.address")} className={inputCls} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.phone")}</label>
                <input aria-label={t("admin.owner.phone")} className={inputCls} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.description")}</label>
                <textarea aria-label={t("admin.owner.description")} className={`${inputCls} resize-none`} rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </div>

              <ImageUploader value={form.imageUrl ?? null} onChange={(url) => set("imageUrl", url)} label={t("admin.owner.image")} />

              <div>
                <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.location")}</label>
                <MapPicker
                  lat={form.lat ?? branch.lat}
                  lng={form.lng ?? branch.lng}
                  onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <button onClick={save} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-40">
                  {t("admin.owner.save")}
                </button>
                {saved && <span className="text-sm font-semibold text-open">{t("admin.owner.saved")}</span>}
                {error && <span className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{t("admin.owner.saveError")}</span>}
              </div>
            </div>
          </section>

          {/* Estado: cierre temporal y activación */}
          <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
            <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.status")}</h2>

            <div className="mb-3">
              {closedActive ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-dark">
                    {t("admin.owner.closedUntil", { date: new Date(branch.closedUntil!).toLocaleString() })}
                  </span>
                  <button onClick={() => { setError(false); reopenBranch(id).then(load).catch(() => setError(true)); }} className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-white">
                    {t("admin.owner.reopen")}
                  </button>
                </div>
              ) : (
                <CloseControl branchId={id} onDone={load} onError={() => setError(true)} />
              )}
            </div>

            {canToggleActive && (
              <button
                onClick={() => { setError(false); setBranchActive(id, !branch.active).then(load).catch(() => setError(true)); }}
                className="rounded-xl bg-bg px-3 py-2 text-sm font-bold text-ink ring-1 ring-line"
              >
                {branch.active ? t("admin.owner.deactivate") : t("admin.owner.activate")}
              </button>
            )}
          </section>

          {/* Horarios */}
          <HoursEditor branchId={id} initial={branch.hours} />
        </>
      )}

      {tab === "menu" && <MenuManager branch={branch} onChange={load} />}
      {tab === "promos" && <PromotionsManager branch={branch} onChange={load} />}
      {tab === "discounts" && <DiscountsManager branch={branch} onChange={load} />}
    </div>
  );
}

function CloseControl({ branchId, onDone, onError }: { branchId: string; onDone: () => void; onError: () => void }) {
  const { t } = useTranslation();
  const [until, setUntil] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-semibold text-mute">{t("admin.owner.closeUntil")}</label>
        <input
          type="datetime-local"
          aria-label={t("admin.owner.closeUntil")}
          className={inputCls}
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </div>
      <button
        disabled={!until}
        onClick={() => closeBranch(branchId, new Date(until).toISOString()).then(onDone).catch(onError)}
        className="rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        {t("admin.owner.closeNow")}
      </button>
    </div>
  );
}
