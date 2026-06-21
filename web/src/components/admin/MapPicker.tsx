import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

const PICK_PIN = `<div style="width:28px;height:28px;border-radius:9999px;background:#fff;border:2px solid #ff4d2e;box-shadow:0 4px 10px rgba(27,27,31,.25);display:flex;align-items:center;justify-content:center;color:#ff4d2e;font-size:14px;line-height:1;">•</div>`;
const pickIcon = L.divIcon({ className: "", html: PICK_PIN, iconSize: [28, 28], iconAnchor: [14, 14] });

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <div className="h-56 w-full overflow-hidden rounded-xl ring-1 ring-line">
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[lat, lng]} icon={pickIcon} />
        <ClickHandler onChange={onChange} />
      </MapContainer>
    </div>
  );
}
