import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext.js";
import { Avatar } from "./Avatar.js";
import { updateName, changePassword, uploadAvatar, removeAvatar } from "../api/profileClient.js";

// Acciones de perfil dentro del drawer: editar nombre, cambiar/quitar foto,
// cambiar contraseña. Los errores se manejan localmente (try/catch) para no
// romper el render del drawer.
export function ProfileSection() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!user) return null;

  const startEditName = () => {
    setNameValue(user.name);
    setNameError(null);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    setNameBusy(true);
    setNameError(null);
    try {
      await updateName(nameValue);
      await refreshUser();
      setEditingName(false);
    } catch {
      // se deja el formulario abierto para reintentar
      setNameError(t("profile.saveError"));
    } finally {
      setNameBusy(false);
    }
  };

  const handleChoosePhoto = () => fileInputRef.current?.click();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await uploadAvatar(file);
      await refreshUser();
    } catch {
      setAvatarError(t("profile.avatarError"));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await removeAvatar();
      await refreshUser();
    } catch {
      setAvatarError(t("profile.avatarError"));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordBusy(true);
    setPasswordMsg(null);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: "success", text: t("profile.passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      const invalid = err instanceof Error && err.message === "invalid_password";
      setPasswordMsg({ type: "error", text: invalid ? t("profile.wrongPassword") : t("profile.saveError") });
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar name={user.name} url={user.avatarUrl} size={64} />
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="rounded-xl border border-ink/10 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
              {nameError && <p className="text-xs font-medium text-red-600">{nameError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveName()}
                  disabled={nameBusy}
                  className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-60"
                >
                  {t("profile.save")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="truncate font-display text-base font-bold text-ink">{user.name}</p>
              <p className="truncate text-xs text-mute">
                {t("profile.email")}: {user.email}
              </p>
              <button type="button" onClick={startEditName} className="mt-1 text-xs font-bold text-brand">
                {t("profile.editName")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileChange(e)} />
          <button
            type="button"
            onClick={handleChoosePhoto}
            disabled={avatarBusy}
            className="rounded-xl bg-bg px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-line disabled:opacity-60"
          >
            {t("profile.changePhoto")}
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              onClick={() => void handleRemovePhoto()}
              disabled={avatarBusy}
              className="rounded-xl bg-bg px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-line disabled:opacity-60"
            >
              {t("profile.removePhoto")}
            </button>
          )}
        </div>
        {avatarError && <p className="text-xs font-medium text-red-600">{avatarError}</p>}
      </div>

      <div className="border-t border-line pt-3">
        {!changingPassword ? (
          <button
            type="button"
            onClick={() => {
              setChangingPassword(true);
              setPasswordMsg(null);
            }}
            className="text-xs font-bold text-brand"
          >
            {t("profile.changePassword")}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="password"
              placeholder={t("profile.currentPassword")}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-xl border border-ink/10 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            <input
              type="password"
              placeholder={t("profile.newPassword")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl border border-ink/10 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            {passwordMsg && (
              <p className={`text-xs font-medium ${passwordMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                {passwordMsg.text}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleChangePassword()}
                disabled={passwordBusy}
                className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-60"
              >
                {t("profile.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
