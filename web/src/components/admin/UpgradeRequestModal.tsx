import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { listPlans, requestUpgrade } from "../../api/ownerClient.js";
import type { PlanInfo } from "../../api/ownerTypes.js";

export function UpgradeRequestModal({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPlans().then((p) => {
      setPlans(p);
      if (p[0]) setPlanId(p[0].id);
    });
  }, []);

  async function submit() {
    setBusy(true);
    try {
      await requestUpgrade(businessId, planId, note || undefined);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">{t("admin.owner.requestUpgrade")}</h3>
          <button aria-label={t("item.close")} onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-bg text-mute">
            <X size={16} />
          </button>
        </div>
        {done ? (
          <p className="text-sm text-open">{t("admin.owner.requestSent")}</p>
        ) : (
          <div className="space-y-3">
            <select aria-label={t("admin.owner.plan")} className="w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.maxBranches} suc · {p.maxMenuItems} ítems · {p.maxPromos} promos</option>
              ))}
            </select>
            <textarea aria-label={t("admin.owner.note")} placeholder={t("admin.owner.note")} className="w-full resize-none rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={submit} disabled={busy || !planId} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t("admin.owner.send")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
