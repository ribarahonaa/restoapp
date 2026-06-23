import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { SaAdsPage } from "../pages/admin/sa/SaAdsPage.js";
import * as sa from "../api/saClient.js";

beforeEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
  vi.spyOn(sa, "listBusinesses").mockResolvedValue([{ id: "b1", name: "Grupo", plan: null, owner: { id: "u", email: "e", name: "n" }, branches: [] }] as never);
});

describe("SaAdsPage", () => {
  it("lista anuncios y elimina uno", async () => {
    vi.spyOn(sa, "listAds").mockResolvedValue([
      { id: "a1", businessId: "b1", branchId: null, title: "Promo Verano", description: null, imageUrl: null, placement: "section", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", active: true, business: { id: "b1", name: "Grupo" } },
    ] as never);
    const del = vi.spyOn(sa, "deleteAd").mockResolvedValue(undefined as never);
    render(<SaAdsPage />);
    expect(await screen.findByText("Promo Verano")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("a1"));
  });
});
