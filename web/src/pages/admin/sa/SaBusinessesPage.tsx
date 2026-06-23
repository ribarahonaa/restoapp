import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Store, Plus } from "lucide-react";
import { listBusinesses, createBusiness, updateBusiness } from "../../../api/saClient.js";
import { listPlans } from "../../../api/ownerClient.js";
import type { SaBusiness } from "../../../api/saTypes.js";
import type { PlanInfo } from "../../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function SaBusinessesPage() {
  const { t } = useTranslation();
  const [businesses, setBusinesses] = useState<SaBusiness[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);

  const load = () => listBusinesses().then(setBusinesses).catch(() => setError(true));
  useEffect(() => {
    load();
    listPlans().then(setPlans).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-extrabold text-ink">{t("admin.sa.businesses")}</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} /> {t("admin.sa.newBusiness")}
        </button>
      </div>
      {error && <p className="mb-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{t("errors.loadFailed")}</p>}

      <ul className="space-y-3">
        {businesses.map((b) => (
          <li key={b.id} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <Store size={16} className="text-brand" /> {b.name}
                </h2>
                <p className="text-xs text-mute">{b.owner.name} · {b.owner.email}</p>
              </div>
              <PlanSelect business={b} plans={plans} onChange={load} />
            </div>
            <ul className="mt-3 space-y-1 border-t border-line pt-2">
              {b.branches.length === 0 && <li className="text-xs text-mute">{t("admin.sa.noBranches")}</li>}
              {b.branches.map((br) => (
                <li key={br.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{br.name} <span className="text-xs text-mute">· {t(`categories.${br.category}`)}</span></span>
                  {!br.active && <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold text-mute">{t("admin.owner.inactive")}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {creating && <CreateBusinessModal plans={plans} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );

  function PlanSelect({ business, plans, onChange }: { business: SaBusiness; plans: PlanInfo[]; onChange: () => void }) {
    return (
      <select
        aria-label={t("admin.owner.plan")}
        className="shrink-0 rounded-lg bg-bg px-2 py-1 text-xs font-semibold text-ink ring-1 ring-line"
        value={business.plan?.id ?? ""}
        onChange={(e) => updateBusiness(business.id, { planId: e.target.value || null }).then(onChange)}
      >
        <option value="">{t("admin.sa.noPlan")}</option>
        {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    );
  }

  function CreateBusinessModal({ plans, onClose, onCreated }: { plans: PlanInfo[]; onClose: () => void; onCreated: () => void }) {
    const [f, setF] = useState({ businessName: "", ownerName: "", ownerEmail: "", ownerPassword: "", planId: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(false);
    async function submit() {
      setBusy(true); setErr(false);
      try {
        await createBusiness({ businessName: f.businessName, ownerName: f.ownerName, ownerEmail: f.ownerEmail, ownerPassword: f.ownerPassword, planId: f.planId || undefined });
        onCreated();
      } catch { setErr(true); } finally { setBusy(false); }
    }
    return (
      <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
        <div className="w-full max-w-sm rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 font-display text-lg font-bold text-ink">{t("admin.sa.newBusiness")}</h3>
          <div className="space-y-2">
            <input aria-label={t("admin.sa.businessName")} placeholder={t("admin.sa.businessName")} className={inputCls} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} />
            <input aria-label={t("admin.sa.ownerName")} placeholder={t("admin.sa.ownerName")} className={inputCls} value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} />
            <input aria-label={t("admin.sa.ownerEmail")} placeholder={t("admin.sa.ownerEmail")} className={inputCls} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} />
            <input aria-label={t("admin.sa.ownerPassword")} type="password" placeholder={t("admin.sa.ownerPassword")} className={inputCls} value={f.ownerPassword} onChange={(e) => setF({ ...f, ownerPassword: e.target.value })} />
            <select aria-label={t("admin.owner.plan")} className={inputCls} value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>
              <option value="">{t("admin.sa.noPlan")}</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {err && <p className="text-xs text-brand-dark">{t("admin.sa.createError")}</p>}
            <button onClick={submit} disabled={busy || !f.businessName || !f.ownerEmail || f.ownerPassword.length < 8} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t("admin.sa.create")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
