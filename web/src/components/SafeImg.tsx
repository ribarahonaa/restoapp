import { useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";

interface Props {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: ReactNode; // qué mostrar si no hay imagen o falla la carga
}

// <img> con manejo de error: si la URL falla (404, red) o es nula, muestra un
// placeholder neutro en vez de dejar un hueco blanco.
export function SafeImg({ src, alt, className = "", fallback }: Props) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className={`grid place-items-center bg-bg text-mute/50 ${className}`} aria-hidden="true">
        {fallback ?? <ImageOff size={24} strokeWidth={1.75} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
