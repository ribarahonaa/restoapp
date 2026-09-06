import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  iconHtml?: string;
  onClick?: () => void;
}

interface MapViewProps {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  zoom?: number;
  route?: { lat: number; lng: number }[];
  // Puntos a encuadrar (ej. resultados de búsqueda). Tiene prioridad sobre el
  // recentrado normal, pero no sobre una ruta activa.
  fitTo?: { lat: number; lng: number }[];
}

const DEFAULT_PIN = `<div style="width:36px;height:36px;border-radius:9999px;background:#fff;border:2px solid #ff4d2e;box-shadow:0 4px 10px rgba(27,27,31,.25);display:flex;align-items:center;justify-content:center;color:#ff4d2e;font-size:18px;line-height:1;">•</div>`;

// Pin cálido on-theme: el caller provee el HTML (ícono de categoría) o usa el default.
function pinIcon(iconHtml?: string) {
  return L.divIcon({
    className: "",
    html: iconHtml ?? DEFAULT_PIN,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function Recenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center.lat, center.lng, map]);
  return null;
}

// Al aparecer una ruta, encuadra el mapa para mostrarla completa.
function FitRoute({ coords }: { coords: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [coords, map]);
  return null;
}

// Encuadra el mapa a un conjunto de puntos (ej. resultados de una búsqueda).
// Con un solo punto centra con un zoom cómodo en vez de acercar al máximo.
function FitPoints({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 15));
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
    // key resume los puntos; evita reencuadrar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export function MapView({ center, markers, zoom = 14, route, fitTo }: MapViewProps) {
  const hasRoute = !!route && route.length >= 2;
  const hasFit = !hasRoute && !!fitTo && fitTo.length > 0;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      className="h-full w-full"
      scrollWheelZoom
    >
      {hasRoute ? (
        <FitRoute coords={route!} />
      ) : hasFit ? (
        <FitPoints points={fitTo!} />
      ) : (
        <Recenter center={center} />
      )}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hasRoute && (
        <Polyline
          positions={route!.map((c) => [c.lat, c.lng] as [number, number])}
          pathOptions={{ color: "#ff4d2e", weight: 5, opacity: 0.85 }}
        />
      )}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.iconHtml)}
          eventHandlers={m.onClick ? { click: m.onClick } : undefined}
        >
          {!m.onClick && <Popup>{m.label}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  );
}
