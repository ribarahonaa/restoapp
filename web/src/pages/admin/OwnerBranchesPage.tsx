import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, MapPin } from "lucide-react";
import { listBranches } from "../../api/ownerClient.js";
import type { OwnerBranchSummary } from "../../api/ownerTypes.js";
import { useAuth } from "../../auth/AuthContext.js";

export function OwnerBranchesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branches, setBranches] = useState<OwnerBranchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-4 font-display text-xl font-extrabold text-ink">{t("admin.owner.myBranches")}</h1>
      {user?.role !== "admin_sucursal" && (
        <Link to="/admin/branches/new" className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          + {t("admin.owner.newBranch")}
        </Link>
      )}
      {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{t("errors.loadFailed")}</p>}
      {loading ? (
        <p className="text-mute">…</p>
      ) : (
        <ul className="space-y-2">
          {branches.map((b) => (
            <li key={b.id}>
              <Link
                to={`/admin/branches/${b.id}`}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line transition hover:ring-ink/20"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bg">
                  {b.imageUrl && <img src={b.imageUrl} alt={b.name} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">{b.name}</span>
                    {!b.active && (
                      <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold text-mute">
                        {t("admin.owner.inactive")}
                      </span>
                    )}
                    {b.closedUntil && new Date(b.closedUntil) > new Date() && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
                        {t("admin.owner.closedNow")}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1 truncate text-xs text-mute">
                    <MapPin size={12} strokeWidth={2.25} />
                    {b.address}
                  </p>
                  <p className="mt-0.5 text-xs text-mute">
                    {t("admin.owner.menuCount", { count: b.counts.menuItems })} ·{" "}
                    {t("admin.owner.promoCount", { count: b.counts.promotions })}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-mute" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
