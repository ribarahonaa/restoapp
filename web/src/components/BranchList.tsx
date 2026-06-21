import { useTranslation } from "react-i18next";
import { SearchX } from "lucide-react";
import type { NearbyBranch } from "../api/types.js";
import { BranchCard } from "./BranchCard.js";

export function BranchList({ branches }: { branches: NearbyBranch[] }) {
  const { t } = useTranslation();
  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-mute">
        <SearchX size={32} strokeWidth={1.75} className="text-mute/60" />
        <p className="text-sm">{t("branch.noResults")}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {branches.map((b, i) => (
        <BranchCard key={b.id} branch={b} index={i} />
      ))}
    </div>
  );
}

// Placeholders animados mientras carga (mismo layout que el feed).
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
          <div className="skeleton h-28 w-full" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
