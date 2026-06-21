import { useEffect, useState } from "react";

// Estado que sobrevive a la navegación (sessionStorage). Útil para que los
// filtros no se pierdan al entrar a un local y volver atrás.
export function usePersistedState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // sessionStorage no disponible (modo privado) — se ignora.
    }
  }, [key, state]);

  return [state, setState];
}
