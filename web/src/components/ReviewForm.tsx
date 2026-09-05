import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { addReview } from "../api/client.js";

export function ReviewForm({ branchId, onAdded }: { branchId: string; onAdded: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && rating >= 1 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await addReview(branchId, { authorName: name.trim(), rating, comment: comment.trim() || undefined });
      setName("");
      setRating(0);
      setComment("");
      onAdded();
    } catch (e) {
      const msg = e instanceof Error && e.message === "duplicate_review" ? "review.duplicate" : "errors.loadFailed";
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

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("review.name")}
        maxLength={60}
        className="mb-2 w-full rounded-xl bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand"
      />
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
