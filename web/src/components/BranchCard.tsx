import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NearbyBranch } from "../api/types.js";

export function BranchCard({ branch }: { branch: NearbyBranch }) {
  const { t } = useTranslation();
  const km = (branch.distance / 1000).toFixed(1);
  return (
    <Link
      to={`/branch/${branch.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400 transition-colors"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{branch.name}</h3>
        <span className="text-xs text-slate-500">{t("branch.distance", { km })}</span>
      </div>
      <p className="text-sm text-slate-600">{t(`categories.${branch.category}`)}</p>
      <p className="text-xs text-slate-400">{branch.address}</p>
    </Link>
  );
}
