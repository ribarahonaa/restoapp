import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

export function MapView({ center, markers, zoom = 14 }: MapViewProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      className="h-full w-full"
      scrollWheelZoom
    >
      <Recenter center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.iconHtml)}
          eventHandlers={m.onClick ? { click: m.onClick } : undefined}
        >
          <Popup>{m.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
