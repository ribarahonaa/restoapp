import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext.js";
import { Drawer } from "./Drawer.js";
import { Avatar } from "./Avatar.js";
import { AuthSheet } from "./auth/AuthSheet.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";

export function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { status, user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="flex flex-col gap-4 p-4">
        {status === "authed" && user ? (
          <div className="flex items-center gap-3">
            <Avatar name={user.name} url={user.avatarUrl} size={56} />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-ink">{user.name}</p>
              <p className="truncate text-xs text-mute">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-bg p-4 text-center">
            <p className="mb-2 text-sm text-mute">{t("profile.signInPrompt")}</p>
            <button type="button" onClick={() => setAuthOpen(true)}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">{t("account.signIn")}</button>
          </div>
        )}

        {/* Sección de perfil (acciones) se agrega en Task 7 */}

        <div className="border-t border-line pt-3">
          <LanguageSwitcher />
        </div>

        {status === "authed" && (
          <button type="button" onClick={() => { signOut(); onClose(); }}
            className="rounded-xl bg-bg px-4 py-2 text-sm font-bold text-ink ring-1 ring-line">
            {t("account.signOut")}
          </button>
        )}
      </div>
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
    </Drawer>
  );
}
