import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  me,
  hasRefreshToken,
  type Me,
} from "./authClient.js";
import { getLocalIds, setFavoritesFromServer, resetToLocal, clearLocal } from "../lib/favorites.js";
import { mergeFavorites } from "../api/favoritesClient.js";

type Status = "loading" | "authed" | "anon";
interface AuthValue {
  user: Me | null;
  status: Status;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

// Al pasar a "authed": sube los favoritos guardados localmente (anónimo),
// mergea con los de la cuenta y adopta la lista resultante. Un fallo de red
// no debe romper el login.
async function syncFavoritesOnAuth() {
  try {
    const ids = getLocalIds();
    const merged = await mergeFavorites(ids);
    setFavoritesFromServer(merged);
    // merge exitoso: la lista anónima ya fue absorbida por esta cuenta.
    // Se borra para que no vuelva a mezclarse con la próxima cuenta que
    // inicie sesión en este mismo dispositivo (ver fix-wave-report).
    clearLocal();
  } catch {
    // sin red / error del servidor: se mantienen los favoritos locales
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!hasRefreshToken()) {
      setStatus("anon");
      return;
    }
    me()
      .then(async (u) => {
        setUser(u);
        setStatus("authed");
        await syncFavoritesOnAuth();
      })
      .catch(() => setStatus("anon"));
  }, []);

  const signIn = async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    setStatus("authed");
    await syncFavoritesOnAuth();
  };
  const signUp = async (name: string, email: string, password: string) => {
    const u = await apiRegister(name, email, password);
    setUser(u);
    setStatus("authed");
    await syncFavoritesOnAuth();
  };
  const signOut = () => {
    apiLogout();
    setUser(null);
    setStatus("anon");
    resetToLocal();
  };
  const refreshUser = async () => {
    try { setUser(await me()); } catch { /* ignora */ }
  };

  return <Ctx.Provider value={{ user, status, signIn, signUp, signOut, refreshUser }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
