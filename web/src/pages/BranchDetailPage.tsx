import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getBranch } from "../api/client.js";
import type { BranchDetail } from "../api/types.js";
import { MapView } from "../components/map/MapView.js";

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBranch(id)
      .then(setBranch)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="p-4">
        <Link to="/" className="text-sm text-blue-600">
          ← {t("branch.back")}
        </Link>
        <p className="mt-4 text-slate-600">{t("branch.noResults")}</p>
      </div>
    );
  }

  if (!branch) {
    return <div className="p-4 text-slate-500">…</div>;
  }

  const weekdays = t("weekdays", { returnObjects: true }) as string[];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Link to="/" className="text-sm text-blue-600">
        ← {t("branch.back")}
      </Link>

      <h1 className="mt-2 text-2xl font-bold text-slate-900">{branch.name}</h1>
      <p className="text-slate-600">{t(`categories.${branch.category}`)}</p>
      <p className="text-sm text-slate-500">{branch.address}</p>
      {branch.description && <p className="mt-2 text-slate-700">{branch.description}</p>}

      <div className="my-4 h-56 rounded-lg overflow-hidden">
        <MapView
          center={{ lat: branch.lat, lng: branch.lng }}
          markers={[{ id: branch.id, lat: branch.lat, lng: branch.lng, label: branch.name }]}
          zoom={16}
        />
      </div>

      {branch.promotions.length > 0 && (
        <section className="mb-4">
          <h2 className="font-semibold text-slate-800">{t("branch.promos")}</h2>
          <ul className="mt-1 space-y-1">
            {branch.promotions.map((p) => (
              <li key={p.id} className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <strong>{p.title}</strong>
                {p.description ? ` — ${p.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-semibold text-slate-800">{t("branch.hours")}</h2>
        <ul className="mt-1 text-sm text-slate-700">
          {branch.hours.map((h) => (
            <li key={h.id} className="flex justify-between border-b border-slate-100 py-1">
              <span>{weekdays[h.weekday]}</span>
              <span>
                {h.openTime}–{h.closeTime}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-slate-800">{t("branch.menu")}</h2>
        <ul className="mt-1 space-y-1">
          {branch.menuItems.map((m) => (
            <li key={m.id} className="flex justify-between text-sm text-slate-700">
              <span>{m.name}</span>
              <span>${m.price}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
