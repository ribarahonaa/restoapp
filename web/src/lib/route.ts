// Ruteo con el server demo público de OSRM (sin API key).
// Perfil "driving" (el demo no expone foot/walking). Rate-limited: solo dev.
export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  coords: LatLng[]; // geometría de la ruta, en orden origen→destino
  distance: number; // metros
  duration: number; // segundos
}

const OSRM = "https://router.project-osrm.org/route/v1/driving";

export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const url =
    `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error("no route");
  const coords: LatLng[] = (route.geometry.coordinates as [number, number][]).map(
    ([lng, lat]) => ({ lat, lng })
  );
  return { coords, distance: route.distance, duration: route.duration };
}
