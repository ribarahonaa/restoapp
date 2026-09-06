import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MapPin, ChevronRight } from "lucide-react";
import { getBranch } from "../api/client.js";
import type { BranchDetail, MenuItem, Promotion, PublicDiscountCode } from "../api/types.js";
import { CATEGORY_ICON, CATEGORY_GRADIENT, categoryPinHtml } from "../lib/categories.js";
import { formatPrice } from "../lib/format.js";
import { MapView } from "../components/map/MapView.js";
import { Tabs } from "../components/Tabs.js";
import { ItemSheet, type SheetItem } from "../components/ItemSheet.js";
import { ReviewForm } from "../components/ReviewForm.js";
import { RatingBadge, Stars } from "../components/RatingStars.js";
import { SafeImg } from "../components/SafeImg.js";
import { OpenBadge } from "../components/OpenBadge.js";
import { ShareButton } from "../components/ShareButton.js";
import { FavButton } from "../components/FavButton.js";

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"menu" | "hours">("menu");
  const [sheet, setSheet] = useState<SheetItem | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    getBranch(id).then(setBranch).catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
          <ArrowLeft size={16} strokeWidth={2.5} /> {t("branch.back")}
        </Link>
        <p className="mt-4 text-mute">{t("branch.noResults")}</p>
      </div>
    );
  }

  if (!branch) {
    return <div className="grid h-screen place-items-center text-mute">…</div>;
  }

  const CatIcon = CATEGORY_ICON[branch.category];
  const weekdays = t("weekdays", { returnObjects: true }) as string[];

  // Menú agrupado por category (preservando el orden de aparición)
  const groups = new Map<string, MenuItem[]>();
  for (const m of branch.menuItems) {
    const key = m.category ?? t("branch.menu");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const openMenuItem = (m: MenuItem) =>
    setSheet({ title: m.name, description: m.description, imageUrl: m.imageUrl, price: formatPrice(m.price) });
  const openPromo = (p: Promotion) =>
    setSheet({ title: p.title, description: p.description, imageUrl: p.imageUrl, badge: t("branch.promos") });

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero con imagen del local */}
      <div className={`relative h-60 bg-gradient-to-br ${CATEGORY_GRADIENT[branch.category]}`}>
        {branch.imageUrl ? (
          <SafeImg
            src={branch.imageUrl}
            alt={branch.name}
            className="h-full w-full object-cover"
            fallback={<CatIcon size={96} strokeWidth={1.25} className="text-white/40" />}
          />
        ) : (
          <CatIcon size={180} strokeWidth={1.25} className="absolute -right-6 -bottom-8 text-white/25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />

        <Link
          to="/"
          aria-label={t("branch.back")}
          className="absolute left-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-md transition active:scale-95"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </Link>

        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <FavButton
            id={branch.id}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-md transition active:scale-95"
          />
          <ShareButton
            title={branch.name}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-md transition active:scale-95"
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-9 pt-10 text-white">
          <span className="inline-block rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur">
            {t(`categories.${branch.category}`)}
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight drop-shadow">
            {branch.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <RatingBadge value={branch.ratingAvg} count={branch.ratingCount} />
            <OpenBadge open={branch.openNow} />
            <span className="inline-flex items-center gap-1 opacity-90">
              <MapPin size={13} strokeWidth={2.25} />
              {branch.address}
            </span>
          </div>
        </div>
      </div>

      {branch.closedUntil && new Date(branch.closedUntil) > new Date() && (
        <div className="bg-brand-soft px-4 py-2 text-center text-sm font-semibold text-brand-dark">
          {t("branch.closedTemporarily")}
        </div>
      )}

      {/* Sheet de contenido */}
      <div className="relative -mt-5 rounded-t-3xl bg-bg">
        <div className="mx-auto max-w-2xl">
          <Tabs
            tabs={[
              { key: "menu", label: t("tabs.menu") },
              { key: "hours", label: t("tabs.hours") },
            ]}
            active={tab}
            onChange={(k) => setTab(k as "menu" | "hours")}
          />

          {tab === "menu" ? (
            <div className="p-4">
              {branch.description && <p className="mb-4 text-sm text-mute">{branch.description}</p>}

              {/* Promociones destacadas */}
              {branch.promotions.length > 0 && (
                <section className="mb-6">
                  <h2 className="mb-2 font-display text-base font-bold text-ink">
                    🔥 {t("branch.featured")}
                  </h2>
                  <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                    {branch.promotions.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => openPromo(p)}
                        className="w-60 shrink-0 overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 ring-line transition active:scale-[.99]"
                      >
                        <div className="h-28 w-full bg-brand-soft">
                          {p.imageUrl && (
                            <SafeImg src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="p-3">
                          <p className="truncate font-bold text-ink">{p.title}</p>
                          {p.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-mute">{p.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Cupones */}
              {branch.discountCodes.length > 0 && (
                <section className="mb-6">
                  <h2 className="mb-2 font-display text-base font-bold text-ink">{t("branch.coupons")}</h2>
                  <ul className="space-y-2">
                    {branch.discountCodes.map((c: PublicDiscountCode) => (
                      <li key={c.id} className="flex items-center justify-between rounded-2xl border border-dashed border-brand/40 bg-brand-soft px-3 py-2">
                        <span className="font-mono font-extrabold tracking-wide text-brand-dark">{c.code}</span>
                        <span className="text-sm font-semibold text-ink">
                          {c.type === "percent" ? `${c.value}% ` : `$${c.value} `}{t("branch.couponOff")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Carta agrupada */}
              {[...groups.entries()].map(([cat, items]) => (
                <section key={cat} className="mb-5">
                  <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-mute">
                    {cat}
                  </h3>
                  <ul className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
                    {items.map((m) => (
                      <li key={m.id}>
                        <button
                          onClick={() => openMenuItem(m)}
                          className="flex w-full items-center gap-3 border-b border-line p-3 text-left transition last:border-b-0 hover:bg-bg"
                        >
                          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg">
                            {m.imageUrl && (
                              <SafeImg src={m.imageUrl} alt={m.name} className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold text-ink">{m.name}</span>
                            {m.description && (
                              <span className="mt-0.5 line-clamp-2 block text-xs text-mute">
                                {m.description}
                              </span>
                            )}
                            <span className="mt-1 block font-bold text-brand">{formatPrice(m.price)}</span>
                          </span>
                          <ChevronRight size={18} className="shrink-0 text-mute" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="p-4">
              {/* Mapa */}
              <div className="mb-5 h-44 overflow-hidden rounded-2xl ring-1 ring-line">
                <MapView
                  center={{ lat: branch.lat, lng: branch.lng }}
                  markers={[
                    {
                      id: branch.id,
                      lat: branch.lat,
                      lng: branch.lng,
                      label: branch.name,
                      iconHtml: categoryPinHtml(branch.category),
                    },
                  ]}
                  zoom={16}
                />
              </div>

              {/* Horarios */}
              <h2 className="mb-2 font-display text-base font-bold text-ink">{t("branch.hours")}</h2>
              <ul className="mb-6 overflow-hidden rounded-2xl bg-surface text-sm shadow-sm ring-1 ring-line">
                {branch.hours.map((h) => (
                  <li
                    key={h.id}
                    className="flex justify-between border-b border-line px-3.5 py-2.5 last:border-b-0"
                  >
                    <span className="text-mute">{weekdays[h.weekday]}</span>
                    <span className="font-medium tabular-nums text-ink">
                      {h.openTime}–{h.closeTime}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Reseñas */}
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-ink">{t("branch.reviews")}</h2>
                <RatingBadge value={branch.ratingAvg} count={branch.ratingCount} className="text-ink" />
              </div>
              {branch.reviews.length === 0 ? (
                <p className="mb-3 text-sm text-mute">{t("review.empty")}</p>
              ) : (
                <ul className="mb-4 space-y-2">
                  {branch.reviews.map((r) => (
                    <li key={r.id} className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{r.authorName}</span>
                        <Stars value={r.rating} />
                      </div>
                      {r.comment && <p className="mt-1 text-sm text-mute">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <ReviewForm branchId={branch.id} onAdded={load} />
            </div>
          )}
        </div>
      </div>

      <ItemSheet item={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
