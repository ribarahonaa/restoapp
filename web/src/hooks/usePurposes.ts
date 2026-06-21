import { useEffect, useState } from "react";
import { getPurposes } from "../api/client.js";
import type { Purpose } from "../api/types.js";

export function usePurposes(): Purpose[] {
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  useEffect(() => {
    getPurposes()
      .then(setPurposes)
      .catch(() => setPurposes([]));
  }, []);
  return purposes;
}
