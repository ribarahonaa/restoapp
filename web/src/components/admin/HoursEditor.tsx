import { useState } from "react";
import { useTranslation } from "react-i18next";
import { replaceHours } from "../../api/ownerClient.js";
import type { OwnerHour, HourInput } from "../../api/ownerTypes.js";

interface DayRow {
  open: boolean;
  openTime: string;
  closeTime: string;
}

function buildRows(initial: OwnerHour[]): DayRow[] {
  // 7 filas indexadas por weekday 0..6
  const rows: DayRow[] = Array.from({ length: 7 }, () => ({ open: false, openTime: "09:00", closeTime: "18:00" }));
  for (const h of initial) {
    rows[h.weekday] = { open: true, openTime: h.openTime, closeTime: h.closeTime };
  }
  return rows;
}

export function HoursEditor({ branchId, initial }: { branchId: string; initial: OwnerHour[] }) {
  const { t } = useTranslation();
  const weekdays = t("weekdays", { returnObjects: true }) as string[];
  const [rows, setRows] = useState<DayRow[]>(() => buildRows(initial));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const setRow = (i: number, patch: Partial<DayRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setSaved(false);
    const hours: HourInput[] = rows
      .map((r, weekday) => ({ ...r, weekday }))
      .filter((r) => r.open)
      .map((r) => ({ weekday: r.weekday, openTime: r.openTime, closeTime: r.closeTime }));
    try {
      await replaceHours(branchId, hours);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "rounded-lg bg-bg px-2 py-1 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-brand";

  return (
    <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <h2 className="mb-3 font-display text-base font-bold text-ink">{t("admin.owner.hours")}</h2>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <label className="flex w-32 items-center gap-2">
              <input
                type="checkbox"
                aria-label={weekdays[i]}
                checked={r.open}
                onChange={(e) => setRow(i, { open: e.target.checked })}
              />
              <span className="text-sm text-ink">{weekdays[i]}</span>
            </label>
            <input type="time" aria-label={`${weekdays[i]} ${t("admin.owner.openTime")}`} className={inputCls} value={r.openTime} disabled={!r.open} onChange={(e) => setRow(i, { openTime: e.target.value })} />
            <span className="text-mute">–</span>
            <input type="time" aria-label={`${weekdays[i]} ${t("admin.owner.closeTime")}`} className={inputCls} value={r.closeTime} disabled={!r.open} onChange={(e) => setRow(i, { closeTime: e.target.value })} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-40">
          {t("admin.owner.saveHours")}
        </button>
        {saved && <span className="text-sm font-semibold text-open">{t("admin.owner.saved")}</span>}
      </div>
    </section>
  );
}
