import { useTranslation } from "react-i18next";
import type { NearbyBranch } from "../api/types.js";
import { BranchCard } from "./BranchCard.js";

export function BranchList({ branches }: { branches: NearbyBranch[] }) {
  const { t } = useTranslation();
  if (branches.length === 0) {
    return <p className="p-4 text-sm text-slate-500">{t("branch.noResults")}</p>;
  }
  return (
    <div className="flex flex-col gap-2 p-3">
      {branches.map((b) => (
        <BranchCard key={b.id} branch={b} />
      ))}
    </div>
  );
}
