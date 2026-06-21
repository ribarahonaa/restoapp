import { useEffect, useState } from "react";

export type GeoState =
  | { status: "loading" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "denied" }
  | { status: "unavailable" };

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ status: "loading" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return state;
}
