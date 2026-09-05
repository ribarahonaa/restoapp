import { useCallback, useEffect, useState } from "react";

export type GeoState =
  | { status: "loading" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "denied" }
  | { status: "unavailable" };

export function useGeolocation(): GeoState & { locate: () => void } {
  const [state, setState] = useState<GeoState>({ status: "loading" });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  return { ...state, locate };
}
