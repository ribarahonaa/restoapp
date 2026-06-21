import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export interface SheetItem {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: string | null; // formateado, ej "$6.900"
  badge?: string | null; // ej "Promoción"
}

export function ItemSheet({ item, onClose }: { item: SheetItem | null; onClose: () => void }) {
  const { t } = useTranslation();

  // Bloquea el scroll del fondo y cierra con Escape mientras está abierto.
  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [item, onClose]);

  if (!item) return null;

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
        aria-label={item.title}
        className="animate-sheet-up relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("item.close")}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-md transition active:scale-95"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-56 w-full object-cover sm:rounded-t-3xl"
          />
        )}

        <div className="p-4">
          {item.badge && (
            <span className="mb-2 inline-block rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand">
              {item.badge}
            </span>
          )}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl font-extrabold text-ink">{item.title}</h3>
            {item.price && (
              <span className="shrink-0 font-display text-lg font-extrabold text-brand">
                {item.price}
              </span>
            )}
          </div>
          {item.description && (
            <p className="mt-2 text-sm leading-relaxed text-mute">{item.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
