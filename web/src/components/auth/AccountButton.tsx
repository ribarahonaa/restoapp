import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext.js";
import { AuthSheet } from "./AuthSheet.js";

export function AccountButton() {
  const { t } = useTranslation();
  const { user, status, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (status === "authed" && user) {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-[6rem] truncate text-xs font-bold text-ink">{user.name}</span>
        <button
          type="button"
          onClick={signOut}
          className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-mute transition hover:text-ink"
        >
          {t("account.signOut")}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-mute transition hover:text-ink"
      >
        {t("account.signIn")}
      </button>
      <AuthSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
