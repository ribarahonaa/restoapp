import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext.js";

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await signIn(email, password);
      navigate("/admin");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line">
        <h1 className="mb-4 font-display text-xl font-extrabold text-brand">{t("admin.login.title")}</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("admin.login.email")}
          className="mb-2 w-full rounded-xl bg-bg px-3 py-2 text-sm ring-1 ring-line focus:outline-none focus:ring-brand"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("admin.login.password")}
          className="mb-3 w-full rounded-xl bg-bg px-3 py-2 text-sm ring-1 ring-line focus:outline-none focus:ring-brand"
        />
        {error && <p className="mb-2 text-xs text-brand-dark">{t("admin.login.error")}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {t("admin.login.submit")}
        </button>
      </form>
    </div>
  );
}
