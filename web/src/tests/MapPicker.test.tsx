import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock react-leaflet para no depender del DOM de Leaflet en jsdom.
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ position }: any) => <div data-testid="marker">{position.join(",")}</div>,
  useMapEvents: (handlers: any) => {
    // expone el handler de click para invocarlo desde el test
    (globalThis as any).__mapClick = handlers.click;
    return null;
  },
}));

beforeEach(() => vi.restoreAllMocks());

describe("MapPicker", () => {
  it("renderiza el marcador en la posición dada y reacciona al click", async () => {
    const { MapPicker } = await import("../components/admin/MapPicker.js");
    const onChange = vi.fn();
    render(<MapPicker lat={-33.45} lng={-70.66} onChange={onChange} />);
    expect(screen.getByTestId("marker")).toHaveTextContent("-33.45,-70.66");
    // simular un click en el mapa
    (globalThis as any).__mapClick({ latlng: { lat: -33.4, lng: -70.6 } });
    expect(onChange).toHaveBeenCalledWith(-33.4, -70.6);
  });
});
