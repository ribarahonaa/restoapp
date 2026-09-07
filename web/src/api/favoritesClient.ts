import { authedFetch } from "../auth/authClient.js";

export const fetchFavorites = async (): Promise<string[]> => (await authedFetch("/me/favorites")).json();
export const addFavorite = (id: string) => authedFetch(`/me/favorites/${id}`, { method: "POST" });
export const removeFavorite = (id: string) => authedFetch(`/me/favorites/${id}`, { method: "DELETE" });
export const mergeFavorites = async (ids: string[]): Promise<string[]> =>
  (
    await authedFetch("/me/favorites/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
  ).json();
