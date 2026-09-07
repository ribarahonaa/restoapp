import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { BranchDetailPage } from "../pages/BranchDetailPage.js";
import * as client from "../api/client.js";
import * as authCtx from "../auth/AuthContext.js";
import type { BranchDetail } from "../api/types.js";

function detail(over: Partial<BranchDetail> = {}): BranchDetail {
  return {
    id: "b1", name: "Café Central", category: "cafe", address: "Plaza 1", lat: -33.4, lng: -70.6,
    phone: null, description: "Rico", imageUrl: null, ratingAvg: 4.5, ratingCount: 10,
    openNow: true, hours: [], menuItems: [], promotions: [], purposes: [], reviews: [],
    closedUntil: null, discountCodes: [],
    ...over,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    user: null,
    status: "anon",
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  } as never);
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/branch/b1"]}>
      <Routes>
        <Route path="/branch/:id" element={<BranchDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BranchDetailPage — cupones y cierre", () => {
  it("muestra el banner de cerrado temporalmente", async () => {
    vi.spyOn(client, "getBranch").mockResolvedValue(detail({ closedUntil: new Date(Date.now() + 3600_000).toISOString() }));
    renderPage();
    expect(await screen.findByText(/cerrado temporalmente/i)).toBeInTheDocument();
  });

  it("muestra los cupones vigentes", async () => {
    vi.spyOn(client, "getBranch").mockResolvedValue(detail({ discountCodes: [{ id: "d1", code: "VERANO20", type: "percent", value: "20", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", branchId: "b1" }] }));
    renderPage();
    expect(await screen.findByText("VERANO20")).toBeInTheDocument();
  });

  it("muestra la píldora de visita verificada sólo en reseñas verificadas", async () => {
    vi.spyOn(client, "getBranch").mockResolvedValue(
      detail({
        reviews: [
          { id: "r1", authorName: "Ana", rating: 5, comment: null, createdAt: "2026-01-01T00:00:00.000Z", verified: true },
          { id: "r2", authorName: "Luis", rating: 4, comment: null, createdAt: "2026-01-01T00:00:00.000Z", verified: false },
        ],
      })
    );
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: /Horarios/i }));
    expect(await screen.findByText("Visita verificada")).toBeInTheDocument();
    expect(screen.getAllByText("Visita verificada")).toHaveLength(1);
  });
});
