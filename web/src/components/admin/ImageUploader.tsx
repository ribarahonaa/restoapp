import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";
import { uploadImage } from "../../api/ownerClient.js";

export function ImageUploader({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (url: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-semibold text-mute">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg ring-1 ring-line">
          {value && <img src={value} alt={label} className="h-full w-full object-cover" />}
        </div>
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-bg px-3 py-2 text-sm font-semibold text-ink ring-1 ring-line transition hover:ring-ink/30"
        >
          <ImagePlus size={16} strokeWidth={2.25} />
          {busy ? t("admin.owner.uploading") : t("admin.owner.chooseImage")}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={label}
          className="sr-only"
          onChange={handleFile}
          disabled={busy}
        />
      </div>
      {error && <p className="mt-1 text-xs text-brand-dark">{t("admin.owner.uploadError")}</p>}
    </div>
  );
}
