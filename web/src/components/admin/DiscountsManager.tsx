import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { createDiscount, deleteDiscount } from "../../api/ownerClient.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { OwnerBranchDetail, DiscountInput } from "../../api/ownerTypes.js";

const inputCls = "w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

export function DiscountsManager({ branch, onChange }: { branch: OwnerBranchDetail; onChange: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canChain = user?.role !== "admin_sucursal";
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"branch" | "chain">("branch");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function create() {
    setBusy(true);
    setError(false);
    const input: DiscountInput = {
      code,
      type,
      value: Number(value),
      scope: canChain ? scope : "branch",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    };
    try {
      await createDiscount(branch.id, input);
      setCode(""); setValue(""); setStartsAt(""); setEndsAt("");
      onChange();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(false);
    try {
      await deleteDiscount(branch.id, id);
      onChange();
    } catch {
      setError(true);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.discountsTab")}</h2>

      <ul className="mb-4 space-y-2">
        {branch.discountCodes.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl bg-bg p-2">
            <span className="font-mono font-bold text-ink">{c.code}</span>
            <span className="text-xs text-mute">
              {c.type === "percent" ? `${c.value}%` : `$${c.value}`} · {c.branchId ? t("admin.owner.scopeBranch") : t("admin.owner.scopeChain")}
            </span>
            <button aria-label={t("admin.owner.delete")} onClick={() => remove(c.id)} className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-mute hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.owner.saveError")}</p>}

      <div className="space-y-2 rounded-xl bg-bg p-3">
        <input aria-label={t("admin.owner.code")} placeholder={t("admin.owner.code")} className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} />
        <div className="flex gap-2">
          <select aria-label={t("admin.owner.type")} className={inputCls} value={type} onChange={(e) => setType(e.target.value as "percent" | "amount")}>
            <option value="percent">%</option>
            <option value="amount">$</option>
          </select>
          <input aria-label={t("admin.owner.value")} placeholder={t("admin.owner.value")} type="number" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        {canChain && (
          <select aria-label={t("admin.owner.scope")} className={inputCls} value={scope} onChange={(e) => setScope(e.target.value as "branch" | "chain")}>
            <option value="branch">{t("admin.owner.scopeBranch")}</option>
            <option value="chain">{t("admin.owner.scopeChain")}</option>
          </select>
        )}
        <div className="flex gap-2">
          <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.from")}
            <input aria-label={t("admin.owner.from")} type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="flex-1 text-xs font-semibold text-mute">{t("admin.owner.to")}
            <input aria-label={t("admin.owner.to")} type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <button onClick={create} disabled={busy || !code || !value || !startsAt || !endsAt} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {t("admin.owner.createCode")}
        </button>
      </div>
    </section>
  );
}
