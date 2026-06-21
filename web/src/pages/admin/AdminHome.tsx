import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext.js";

export function AdminHome() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("admin.home.title")}</h1>
        <p className="mt-1 text-mute">{user?.name} — {user?.role}</p>
        <button onClick={signOut} className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">
          {t("admin.home.logout")}
        </button>
      </div>
    </div>
  );
}
