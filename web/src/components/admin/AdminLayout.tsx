import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store, LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.js";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-surface px-4 py-3 shadow-sm">
        <Link to="/admin/branches" className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-brand">
          <Store size={20} strokeWidth={2.5} />
          {t("admin.owner.title")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-mute sm:inline">
            {user?.name} · {user?.role}
          </span>
          <button
            onClick={signOut}
            aria-label={t("admin.home.logout")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-sm font-bold text-white transition active:scale-95"
          >
            <LogOut size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">{t("admin.home.logout")}</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
