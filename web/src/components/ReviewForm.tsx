import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { addReview, checkIn, getReviewEligibility } from "../api/client.js";
import type { ReviewEligibility } from "../api/types.js";
import { useAuth } from "../auth/AuthContext.js";
import { useGeolocation } from "../hooks/useGeolocation.js";
import { AuthSheet } from "./auth/AuthSheet.js";

export function ReviewForm({ branchId, onAdded }: { branchId: string; onAdded: () => void }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const geo = useGeolocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elig, setElig] = useState<ReviewEligibility | null>(null);

  const lat = geo.status === "ready" ? geo.lat : undefined;
  const lng = geo.status === "ready" ? geo.lng : undefined;

  useEffect(() => {
    if (status !== "authed" || lat == null || lng == null) return;
    let cancelled = false;
    getReviewEligibility(branchId, lat, lng)
      .then((res) => {
        if (!cancelled) setElig(res);
      })
      .catch(() => {
        if (!cancelled) setElig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [status, lat, lng, branchId]);

  if (status !== "authed") {
    return (
      <div className="rounded-2xl bg-surface p-4 text-center shadow-sm ring-1 ring-line">
        <p className="mb-2 text-sm text-mute">{t("review.loginGate")}</p>
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
        >
          {t("review.loginCta")}
        </button>
        <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  if (geo.status !== "ready") {
    return (
      <div className="rounded-2xl bg-surface p-4 text-center shadow-sm ring-1 ring-line">
        <p className="mb-2 text-sm text-mute">{t("review.needGps")}</p>
        <button
          type="button"
          onClick={geo.locate}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
        >
          {t("geo.locate")}
        </button>
      </div>
    );
  }

  async function doCheckIn() {
    if (lat == null || lng == null) return;
    setCheckingIn(true);
    setError(null);
    try {
      await checkIn(branchId, lat, lng);
      const res = await getReviewEligibility(branchId, lat, lng);
      setElig(res);
    } catch (e) {
      setError(e instanceof Error && e.message === "too_far" ? "review.tooFar" : "errors.loadFailed");
    } finally {
      setCheckingIn(false);
    }
  }

  if (!elig) {
    return (
      <div className="rounded-2xl bg-surface p-4 text-center text-sm text-mute shadow-sm ring-1 ring-line">…</div>
    );
  }

  if (!elig.eligible) {
    if (elig.reason === "too_soon") {
      const min = elig.canReviewAt
        ? Math.max(0, Math.ceil((new Date(elig.canReviewAt).getTime() - Date.now()) / 60000))
        : 0;
      return (
        <div className="rounded-2xl bg-surface p-4 text-center shadow-sm ring-1 ring-line">
          <p className="text-sm text-mute">{t("review.wait", { min })}</p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-surface p-4 text-center shadow-sm ring-1 ring-line">
        {elig.reason === "too_far" && <p className="mb-2 text-sm text-mute">{t("review.tooFar")}</p>}
        {error && <p className="mb-2 text-xs text-brand-dark">{t(error)}</p>}
        <button
          type="button"
          onClick={doCheckIn}
          disabled={checkingIn}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {t("review.checkin")}
        </button>
      </div>
    );
  }

  const canSubmit = rating >= 1 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || lat == null || lng == null) return;
    setBusy(true);
    setError(null);
    try {
      await addReview(branchId, { rating, comment: comment.trim() || undefined, lat, lng });
      setRating(0);
      setComment("");
      onAdded();
    } catch (e) {
      const msg = e instanceof Error && e.message === "already_reviewed" ? "review.duplicate" : "errors.loadFailed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line"
    >
      <p className="mb-2 font-display text-sm font-bold text-ink">{t("review.add")}</p>

      <div className="mb-2 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const n = i + 1;
          const on = (hover || rating) >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-0.5"
            >
              <Star
                size={26}
                strokeWidth={0}
                className={on ? "fill-amber-400" : "fill-line"}
              />
            </button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("review.comment")}
        maxLength={500}
        rows={2}
        className="mb-2 w-full resize-none rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand"
      />

      {error && <p className="mb-2 text-xs text-brand-dark">{t(error)}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-40"
      >
        {t("review.submit")}
      </button>
    </form>
  );
}
