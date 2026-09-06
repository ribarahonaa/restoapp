import { useEffect, useState } from "react";
import { getNearby } from "../api/client.js";
import type { NearbyBranch, NearbyFilters } from "../api/types.js";

export interface NearbyState {
  loading: boolean;
  error: boolean;
  branches: NearbyBranch[];
}

export function useNearby(filters: NearbyFilters | null): NearbyState {
  const [state, setState] = useState<NearbyState>({ loading: false, error: false, branches: [] });

  useEffect(() => {
    if (!filters) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    getNearby(filters)
      .then((branches) => {
        if (!cancelled) setState({ loading: false, error: false, branches });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: true, branches: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [
    filters?.lat,
    filters?.lng,
    filters?.radius,
    filters?.category,
    filters?.purpose,
    filters?.promo,
    filters?.open,
    filters?.q,
  ]);

  return state;
}
