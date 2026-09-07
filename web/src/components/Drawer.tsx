import { useEffect, type ReactNode } from "react";

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 animate-backdrop-in" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-surface shadow-2xl animate-drawer-in">
        {children}
      </div>
    </div>
  );
}
