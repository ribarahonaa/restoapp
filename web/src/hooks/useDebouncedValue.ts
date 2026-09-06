import { useEffect, useState } from "react";

// Devuelve `value` con un retardo: sólo cambia tras `delay` ms sin nuevas
// actualizaciones. Útil para no disparar una búsqueda en cada tecla.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
