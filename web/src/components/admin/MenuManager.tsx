import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Pencil } from "lucide-react";
import { createMenuItem, updateMenuItem, deleteMenuItem, LimitError } from "../../api/ownerClient.js";
import { ImageUploader } from "./ImageUploader.js";
import { UpgradeRequestModal } from "./UpgradeRequestModal.js";
import type { OwnerBranchDetail, MenuItemInput } from "../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function MenuManager({ branch, onChange }: { branch: OwnerBranchDetail; onChange: () => void }) {
  const { t } = useTranslation();
  const max = branch.business.plan?.maxMenuItems ?? null;
  const count = branch.menuItems.length;
  const atLimit = max != null && count >= max;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<MenuItemInput>({ name: "", price: 0, category: "", description: "", imageUrl: null });
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setForm({ name: "", price: 0, category: "", description: "", imageUrl: null });
    setEditingId(null);
  }

  function startEdit(m: typeof branch.menuItems[number]) {
    setForm({ name: m.name, price: Number(m.price), category: m.category ?? "", description: m.description ?? "", imageUrl: m.imageUrl });
    setEditingId(m.id);
  }

  async function submit() {
    setBusy(true);
    setError(false);
    try {
      if (editingId) {
        await updateMenuItem(branch.id, editingId, {
          name: form.name,
          price: Number(form.price),
          category: form.category || null,
          description: form.description || null,
          imageUrl: form.imageUrl ?? null,
        });
        resetForm();
        onChange();
      } else {
        await createMenuItem(branch.id, {
          name: form.name,
          price: Number(form.price),
          category: form.category || null,
          description: form.description || null,
          imageUrl: form.imageUrl ?? null,
        });
        setForm({ name: "", price: 0, category: "", description: "", imageUrl: null });
        onChange();
      }
    } catch (e) {
      if (e instanceof LimitError) setShowUpgrade(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId: string) {
    setError(false);
    try {
      await deleteMenuItem(branch.id, itemId);
      onChange();
    } catch {
      setError(true);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink">{t("admin.owner.menuTab")}</h2>
        {max != null && <span className="text-xs font-semibold text-mute">{count}/{max}</span>}
      </div>

      <ul className="mb-4 space-y-2">
        {branch.menuItems.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl bg-bg p-2">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-line">
              {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="h-full w-full object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{m.name}</p>
              <p className="text-xs text-mute">{m.category ?? ""}</p>
            </div>
            <button aria-label={t("admin.owner.edit")} onClick={() => startEdit(m)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Pencil size={16} />
            </button>
            <button aria-label={t("admin.owner.delete")} onClick={() => remove(m.id)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}

      {editingId ? (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <input aria-label={t("admin.owner.itemName")} placeholder={t("admin.owner.itemName")} className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex gap-2">
            <input aria-label={t("admin.owner.price")} placeholder={t("admin.owner.price")} type="number" className={inputCls} value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <input aria-label={t("admin.owner.itemCategory")} placeholder={t("admin.owner.itemCategory")} className={inputCls} value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <textarea aria-label={t("admin.owner.itemDescription")} placeholder={t("admin.owner.itemDescription")} className={`${inputCls} resize-none`} rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <ImageUploader value={form.imageUrl ?? null} onChange={(url) => setForm({ ...form, imageUrl: url })} label={t("admin.owner.itemImage")} />
          <button onClick={submit} disabled={busy || !form.name || !form.price} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {t("admin.owner.saveChanges")}
          </button>
          <button onClick={resetForm} className="w-full rounded-xl bg-bg py-2.5 text-sm font-bold text-mute ring-1 ring-line">
            {t("admin.owner.cancel")}
          </button>
        </div>
      ) : atLimit ? (
        <div className="rounded-xl bg-brand-soft p-3 text-center">
          <p className="mb-2 text-sm font-semibold text-brand-dark">{t("admin.owner.limitReached")}</p>
          <button onClick={() => setShowUpgrade(true)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
            {t("admin.owner.requestUpgrade")}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <input aria-label={t("admin.owner.itemName")} placeholder={t("admin.owner.itemName")} className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex gap-2">
            <input aria-label={t("admin.owner.price")} placeholder={t("admin.owner.price")} type="number" className={inputCls} value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <input aria-label={t("admin.owner.itemCategory")} placeholder={t("admin.owner.itemCategory")} className={inputCls} value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <textarea aria-label={t("admin.owner.itemDescription")} placeholder={t("admin.owner.itemDescription")} className={`${inputCls} resize-none`} rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <ImageUploader value={form.imageUrl ?? null} onChange={(url) => setForm({ ...form, imageUrl: url })} label={t("admin.owner.itemImage")} />
          <button onClick={submit} disabled={busy || !form.name || !form.price} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {t("admin.owner.addItem")}
          </button>
        </div>
      )}

      {showUpgrade && <UpgradeRequestModal businessId={branch.businessId} onClose={() => setShowUpgrade(false)} />}
    </section>
  );
}
