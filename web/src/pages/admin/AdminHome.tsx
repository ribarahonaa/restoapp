import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext.js";

export function AdminHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("admin.home.title")}</h1>
      <p className="mt-1 text-mute">{user?.name} — {user?.role}</p>
    </div>
  );
}
