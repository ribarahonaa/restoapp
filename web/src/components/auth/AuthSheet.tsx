import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.js";

type Tab = "login" | "register";

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Bloquea el scroll del fondo y cierra con Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message === "email_taken" ? t("account.emailTaken") : t("account.errorLogin"));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    setBusy(true);
    try {
      await signUp(name, email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message === "email_taken" ? t("account.emailTaken") : t("account.errorRegister"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-backdrop-in absolute inset-0 bg-ink/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("account.signIn")}
        className="animate-sheet-up relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 sm:max-w-sm sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("item.close")}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-md transition active:scale-95"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div role="tablist" className="mb-4 flex gap-1 rounded-full bg-bg p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "login"}
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${
              tab === "login" ? "bg-brand text-white shadow-sm" : "text-mute"
            }`}
          >
            {t("account.tabLogin")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "register"}
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${
              tab === "register" ? "bg-brand text-white shadow-sm" : "text-mute"
            }`}
          >
            {t("account.tabRegister")}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tab === "login") void handleLogin();
            else void handleRegister();
          }}
          className="flex flex-col gap-3"
        >
          {tab === "register" && (
            <input
              type="text"
              placeholder={t("account.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl border border-ink/10 bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-brand"
            />
          )}
          <input
            type="email"
            placeholder={t("account.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border border-ink/10 bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-brand"
          />
          <input
            type="password"
            placeholder={t("account.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border border-ink/10 bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-brand"
          />

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-2xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
          >
            {tab === "login" ? t("account.submitLogin") : t("account.submitRegister")}
          </button>
        </form>
      </div>
    </div>
  );
}
