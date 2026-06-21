// web/src/tests/BranchCard.test.tsx
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n/index.js";
import { BranchCard } from "../components/BranchCard.js";
import type { NearbyBranch } from "../api/types.js";

// jsdom's navigator.language is en-US, so the LanguageDetector resolves to en.
// These assertions check the Spanish category label, so pin the language to es
// (the i18n fallbackLng) for this suite.
beforeAll(async () => {
  await i18n.changeLanguage("es");
});

const branch: NearbyBranch = {
  id: "b1",
  name: "Café Central",
  category: "cafe",
  address: "Plaza 1",
  lat: -33.4,
  lng: -70.6,
  phone: null,
  description: null,
  imageUrl: null,
  ratingAvg: 4.5,
  ratingCount: 12,
  distance: 1500,
};

describe("BranchCard", () => {
  it("muestra nombre, categoría traducida y distancia en km", () => {
    render(
      <MemoryRouter>
        <BranchCard branch={branch} />
      </MemoryRouter>
    );
    expect(screen.getByText("Café Central")).toBeInTheDocument();
    expect(screen.getByText(/Cafetería/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5 km/)).toBeInTheDocument();
  });

  it("enlaza a la ficha del local", () => {
    render(
      <MemoryRouter>
        <BranchCard branch={branch} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/branch/b1");
  });
});
