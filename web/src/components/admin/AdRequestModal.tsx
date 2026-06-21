import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { requestAd } from "../../api/ownerClient.js";

export function AdRequestModal({ businessId, branchId, onClose }: { businessId: string; branchId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [wantsPopup, setWantsPopup] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await requestAd({ businessId, branchId, desiredStartsAt: new Date(startsAt).toISOString(), desiredEndsAt: new Date(endsAt).toISOString(), wantsPopup, note: note || null });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">{t("admin.owner.requestAd")}</h3>
          <button aria-label={t("item.close")} onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-bg text-mute"><X size={16} /></button>
        </div>
        {done ? (
          <p className="text-sm text-open">{t("admin.owner.requestSent")}</p>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-mute">{t("admin.owner.from")}
              <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-mute">{t("admin.owner.to")}
              <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={wantsPopup} onChange={(e) => setWantsPopup(e.target.checked)} />
              {t("admin.owner.wantsPopup")}
            </label>
            <textarea aria-label={t("admin.owner.note")} placeholder={t("admin.owner.note")} className={`${inputCls} resize-none`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={submit} disabled={busy || !startsAt || !endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">{t("admin.owner.send")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
